const Offer = require("./offer.model");
const { pctOf, splitInclusiveTax, lineTotal } = require("../../core/money");

// The one place cart totals are computed. The cart preview, the checkout
// summary and the order that finally gets written all call `priceCart`, so the
// number the customer saw and the number they are charged cannot drift apart.
//
// Everything here is integer paise.

// Does this line fall inside the offer's product scope? An empty list on a
// dimension means "no restriction", so an offer with no conditions at all
// matches the whole cart.
function lineMatchesOffer(line, offer) {
  const c = offer.conditions || {};
  const ids = (list) => (list || []).map(String);

  if (c.variants?.length && !ids(c.variants).includes(String(line.variant))) return false;
  if (c.products?.length && !ids(c.products).includes(String(line.product))) return false;
  if (c.brands?.length && !ids(c.brands).includes(String(line.brand))) return false;

  if (c.categories?.length) {
    // categoryPath holds the whole chain, so an offer on "Fruits & Vegetables"
    // reaches a product filed under "Fruits & Vegetables > Leafy Greens".
    const linePath = ids(line.categoryPath || []);
    const wanted = ids(c.categories);
    if (!linePath.some((id) => wanted.includes(id))) return false;
  }
  return true;
}

function offerApplies(offer, context) {
  const { lines, subtotal, customer, store, paymentMethod, at } = context;

  if (!offer.isLive(at)) return { ok: false, reason: "Offer is not running right now" };

  const c = offer.conditions || {};

  if (c.stores?.length && !c.stores.map(String).includes(String(store?.id || store))) {
    return { ok: false, reason: "Not available at this store" };
  }
  if (c.paymentMethods?.length && paymentMethod && !c.paymentMethods.includes(paymentMethod)) {
    return { ok: false, reason: `Only valid with ${c.paymentMethods.join(", ")}` };
  }
  if (c.firstOrderOnly && (customer?.orderCount || 0) > 0) {
    return { ok: false, reason: "Valid on your first order only" };
  }

  const matching = lines.filter((line) => lineMatchesOffer(line, offer));
  if (matching.length === 0) {
    return { ok: false, reason: "No eligible items in your cart" };
  }

  // Value thresholds are measured against the *eligible* part of the cart, not
  // the whole of it — "₹500 on vegetables" should not be unlocked by rice.
  const eligibleValue = matching.reduce((sum, l) => sum + l.lineTotal, 0);
  const eligibleQty = matching.reduce((sum, l) => sum + l.quantity, 0);

  if (c.minCartValue && eligibleValue < c.minCartValue) {
    return {
      ok: false,
      reason: `Add ₹${((c.minCartValue - eligibleValue) / 100).toFixed(0)} more to use this`,
      shortfall: c.minCartValue - eligibleValue,
    };
  }
  if (c.maxCartValue && subtotal > c.maxCartValue) {
    return { ok: false, reason: "Cart value is above this offer's limit" };
  }
  if (c.minQuantity && eligibleQty < c.minQuantity) {
    return { ok: false, reason: `Add ${c.minQuantity - eligibleQty} more item(s)` };
  }

  return { ok: true, matching, eligibleValue, eligibleQty };
}

// What the offer is worth on this cart, in paise (plus flags for the
// non-monetary rewards).
function computeReward(offer, match) {
  const r = offer.reward || {};
  const base = match.eligibleValue;

  switch (offer.type) {
    case "percentage": {
      let amount = pctOf(base, r.discountPct || 0);
      if (r.maxDiscount) amount = Math.min(amount, r.maxDiscount);
      return { discount: amount, freeDelivery: false, cashback: 0 };
    }
    case "fixed": {
      // Never discount more than the eligible items are worth.
      return { discount: Math.min(r.discountAmount || 0, base), freeDelivery: false, cashback: 0 };
    }
    case "free_delivery":
      return { discount: 0, freeDelivery: true, cashback: 0 };

    case "cashback": {
      let amount = pctOf(base, r.cashbackPct || 0);
      if (r.cashbackMax) amount = Math.min(amount, r.cashbackMax);
      // Cashback is credited after delivery, so it does not reduce what is
      // payable now.
      return { discount: 0, freeDelivery: false, cashback: amount };
    }
    case "bogo": {
      const buy = r.buyQuantity || 1;
      const get = r.getQuantity || 1;
      // Free units are the cheapest eligible ones, which is the convention
      // customers expect and the cheaper one for the business.
      const units = match.matching
        .flatMap((l) => Array(Math.floor(l.quantity)).fill(l.unitPrice))
        .sort((a, b) => a - b);
      const sets = Math.floor(units.length / (buy + get));
      const freeUnits = units.slice(0, sets * get);
      return {
        discount: freeUnits.reduce((sum, p) => sum + p, 0),
        freeDelivery: false,
        cashback: 0,
      };
    }
    default:
      return { discount: 0, freeDelivery: false, cashback: 0 };
  }
}

// Spreads a cart-level discount across the lines it came from, proportionally
// to each line's value. Without this, tax on a discounted cart would be
// computed on the undiscounted amount and the invoice would not foot.
function allocateDiscount(lines, matchingIds, totalDiscount, valueOf = (l) => l.lineTotal) {
  const eligible = lines.filter((l) => matchingIds.has(l.key));
  const base = eligible.reduce((sum, l) => sum + valueOf(l), 0);
  if (base <= 0 || totalDiscount <= 0) return;

  let allocated = 0;
  eligible.forEach((line, index) => {
    const isLast = index === eligible.length - 1;
    // The last line absorbs the rounding remainder so the parts sum exactly to
    // the whole.
    const share = isLast
      ? totalDiscount - allocated
      : Math.round((valueOf(line) / base) * totalDiscount);
    line.discount += share;
    allocated += share;
  });
}

// A reward coupon (referrals/coupon.model) on top of the offers: a fixed
// amount off what the eligible lines still cost after offers. Ownership,
// expiry and single use are checked before pricing (coupon.service); this
// decides only what it is worth on this cart. Returns { discount } or
// { reason } when it cannot apply.
function applyRewardCoupon(lines, coupon, applied) {
  if (!coupon.combinable) {
    const other = applied.find((a) => a.requiresCode);
    if (other) return { reason: `Can't be used together with coupon ${other.code} — remove one` };
  }

  const remaining = (l) => l.lineTotal - l.discount;
  const merchandise = lines.reduce((sum, l) => sum + remaining(l), 0);
  if (coupon.minOrderValue && merchandise < coupon.minOrderValue) {
    return {
      reason: `Add ₹${((coupon.minOrderValue - merchandise) / 100).toFixed(0)} more to use this coupon`,
      shortfall: coupon.minOrderValue - merchandise,
    };
  }

  const excluded = (coupon.excludedCategories || []).map(String);
  const eligible = lines.filter(
    (l) => remaining(l) > 0 && !(l.categoryPath || []).map(String).some((id) => excluded.includes(id))
  );
  const eligibleValue = eligible.reduce((sum, l) => sum + remaining(l), 0);
  if (eligibleValue <= 0) return { reason: "No items in your cart can use this coupon" };

  // Never more than the eligible items still cost — the coupon cannot make
  // merchandise negative or pay for delivery.
  const discount = Math.min(coupon.amount, eligibleValue);
  allocateDiscount(lines, new Set(eligible.map((l) => l.key)), discount, remaining);
  return { discount };
}

// The same summary shape as a priced cart, all zeroes. Returning this rather
// than a special case keeps every client's rendering code identical whether
// the cart has something in it or not.
function emptyCart(settings = {}) {
  return {
    lines: [],
    summary: {
      itemCount: 0,
      unitCount: 0,
      mrpTotal: 0,
      subtotal: 0,
      catalogueSavings: 0,
      offerDiscount: 0,
      rewardDiscount: 0,
      qualifyingAmount: 0,
      deliveryCharge: 0,
      deliveryFree: false,
      freeDeliveryEnabled: settings.freeDeliveryEnabled !== false,
      freeDeliveryThreshold: settings.freeDeliveryEnabled !== false ? settings.freeDeliveryAbove || 0 : 0,
      // Nothing in the cart yet, so the whole threshold is still to go.
      amountToFreeDelivery: settings.freeDeliveryEnabled !== false ? settings.freeDeliveryAbove || 0 : 0,
      packagingCharge: 0,
      taxTotal: 0,
      taxBreakup: [],
      walletApplied: 0,
      loyaltyApplied: 0,
      loyaltyPointsUsed: 0,
      roundOff: 0,
      total: 0,
      totalSavings: 0,
      cashbackEarned: 0,
      minOrderValue: settings.minOrderValue || 0,
      // An empty cart cannot be checked out, so it never "meets" the minimum.
      meetsMinimum: false,
      shortfallToMinimum: settings.minOrderValue || 0,
    },
    offers: { applied: [], rejected: [] },
    rewardCoupon: null,
  };
}

async function priceCart(context) {
  const {
    lines: inputLines,
    store,
    customer = null,
    couponCode = null,
    // { id, code, title, amount, minOrderValue, combinable, excludedCategories }
    // — already checked as this customer's, unused and unexpired.
    rewardCoupon = null,
    paymentMethod = null,
    walletRequested = 0,
    loyaltyPointsRequested = 0,
    at = new Date(),
  } = context;

  const settings = store?.settings || {};

  // An empty cart costs nothing. Without this the delivery and packaging
  // charges still apply to zero items, and the storefront header cheerfully
  // announces a ₹34 basket containing nothing at all.
  if (!inputLines.length) return emptyCart(settings);

  // --- 1. Lines -------------------------------------------------------
  const lines = inputLines.map((l, index) => ({
    ...l,
    key: l.key || `${l.variant}:${index}`,
    unitPrice: l.sellingPrice,
    lineTotal: lineTotal(l.sellingPrice, l.quantity),
    mrpTotal: lineTotal(l.mrp || l.sellingPrice, l.quantity),
    discount: 0,
  }));

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const mrpTotal = lines.reduce((sum, l) => sum + l.mrpTotal, 0);
  // What the catalogue prices already save them, before any offer.
  const catalogueSavings = Math.max(0, mrpTotal - subtotal);

  // --- 2. Candidate offers -------------------------------------------
  const candidates = await Offer.find({
    status: "active",
    $or: [{ requiresCode: false }, ...(couponCode ? [{ code: couponCode.toUpperCase() }] : [])],
    // On equal priority a coupon the customer typed beats an automatic offer.
  }).sort({ priority: -1, requiresCode: -1 });

  const evalContext = { lines, subtotal, customer, store, paymentMethod, at };

  const applied = [];
  const rejected = [];
  let freeDelivery = false;
  let cashback = 0;

  for (const offer of candidates) {
    const match = offerApplies(offer, evalContext);
    if (!match.ok) {
      // Only explain the coupon they actually typed; auto-offers that did not
      // apply are noise in the response.
      if (offer.requiresCode) {
        rejected.push({ code: offer.code, title: offer.title, reason: match.reason, shortfall: match.shortfall });
      }
      continue;
    }

    // A non-combinable offer is only taken if nothing non-combinable has been
    // applied yet. `candidates` is sorted by priority, so the strongest wins.
    const haveExclusive = applied.some((a) => !a.combinable);
    if (!offer.combinable && haveExclusive) {
      if (offer.requiresCode) {
        rejected.push({ code: offer.code, title: offer.title, reason: "Cannot be combined with the offer already applied" });
      }
      continue;
    }

    const reward = computeReward(offer, match);
    if (!reward.discount && !reward.freeDelivery && !reward.cashback) continue;

    const matchingIds = new Set(match.matching.map((l) => l.key));
    allocateDiscount(lines, matchingIds, reward.discount);

    if (reward.freeDelivery) freeDelivery = true;
    cashback += reward.cashback;

    applied.push({
      id: offer.id,
      code: offer.code || null,
      title: offer.title,
      type: offer.type,
      badge: offer.badge,
      combinable: offer.combinable,
      discount: reward.discount,
      cashback: reward.cashback,
      freeDelivery: reward.freeDelivery,
      requiresCode: offer.requiresCode,
    });
  }

  // What the merchandise costs after offers — the basis for the order
  // minimum, free delivery and referral qualification. A reward coupon is
  // taken off after this, so spending one never makes a cart fall short.
  const offersOnly = lines.reduce((sum, l) => sum + l.discount, 0);
  const merchandise = subtotal - offersOnly;

  let rewardDiscount = 0;
  let rewardResult = null;
  if (rewardCoupon) {
    const result = applyRewardCoupon(lines, rewardCoupon, applied);
    rewardDiscount = result.discount || 0;
    rewardResult = {
      id: String(rewardCoupon.id),
      code: rewardCoupon.code,
      title: rewardCoupon.title,
      amount: rewardCoupon.amount,
      discount: rewardDiscount,
      ok: Boolean(rewardDiscount),
      reason: result.reason || null,
      shortfall: result.shortfall,
    };
    if (rewardDiscount) {
      applied.push({
        id: String(rewardCoupon.id),
        code: rewardCoupon.code,
        title: rewardCoupon.title,
        type: "reward_coupon",
        badge: "",
        combinable: rewardCoupon.combinable,
        discount: rewardDiscount,
        cashback: 0,
        freeDelivery: false,
        requiresCode: true,
        rewardCoupon: true,
      });
    } else {
      rejected.push({ code: rewardCoupon.code, title: rewardCoupon.title, reason: result.reason, shortfall: result.shortfall });
    }
  }

  // Includes the reward coupon, so older clients that show one "discount"
  // line still add up; newer ones split it out with rewardDiscount.
  const offerDiscount = offersOnly + rewardDiscount;
  const afterDiscount = subtotal - offerDiscount;

  // --- 3. Charges -----------------------------------------------------
  let deliveryCharge = settings.deliveryCharge || 0;
  // A switched-off rule has no threshold at all, so it can neither waive the
  // charge nor be shown to the customer.
  const freeDeliveryEnabled = settings.freeDeliveryEnabled !== false;
  const freeDeliveryThreshold = freeDeliveryEnabled ? settings.freeDeliveryAbove || 0 : 0;
  const freeByThreshold = freeDeliveryThreshold > 0 && merchandise >= freeDeliveryThreshold;
  if (freeDelivery || freeByThreshold) deliveryCharge = 0;

  const packagingCharge = settings.packagingCharge || 0;

  // --- 4. Tax ---------------------------------------------------------
  // Computed per line on the post-discount amount, so tax follows what is
  // actually being charged.
  const taxBreakup = new Map();
  let taxTotal = 0;

  for (const line of lines) {
    const taxable = line.lineTotal - line.discount;
    const rate = line.taxRatePct || 0;
    if (!rate) { line.tax = 0; line.taxableValue = taxable; continue; }

    if (line.taxInclusive !== false) {
      const { base, tax } = splitInclusiveTax(taxable, rate);
      line.taxableValue = base;
      line.tax = tax;
    } else {
      line.taxableValue = taxable;
      line.tax = pctOf(taxable, rate);
    }

    taxTotal += line.tax;
    const bucket = taxBreakup.get(rate) || { rate, taxableValue: 0, tax: 0 };
    bucket.taxableValue += line.taxableValue;
    bucket.tax += line.tax;
    taxBreakup.set(rate, bucket);
  }

  // Tax-inclusive prices already contain the tax, so it is reported, not added.
  const exclusiveTax = lines
    .filter((l) => l.taxInclusive === false)
    .reduce((sum, l) => sum + (l.tax || 0), 0);

  // --- 5. Wallet & loyalty -------------------------------------------
  const payableBeforeCredits = afterDiscount + deliveryCharge + packagingCharge + exclusiveTax;

  const walletApplied = Math.max(0, Math.min(walletRequested, customer?.walletBalance || 0, payableBeforeCredits));
  const afterWallet = payableBeforeCredits - walletApplied;

  // 100 points = ₹10, i.e. 1 point = 10 paise.
  const pointsValue = Math.max(0, Math.min(loyaltyPointsRequested, customer?.loyaltyPoints || 0)) * 10;
  const loyaltyApplied = Math.min(pointsValue, afterWallet);
  const loyaltyPointsUsed = Math.round(loyaltyApplied / 10);

  const beforeRounding = afterWallet - loyaltyApplied;
  const total = Math.round(beforeRounding / 100) * 100; // round to the nearest rupee
  const roundOff = total - beforeRounding;

  const minOrderValue = settings.minOrderValue || 0;
  const meetsMinimum = merchandise >= minOrderValue;

  return {
    lines: lines.map((l) => ({
      key: l.key,
      variant: l.variant,
      product: l.product,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      mrp: l.mrp,
      lineTotal: l.lineTotal,
      discount: l.discount,
      payable: l.lineTotal - l.discount,
      taxRatePct: l.taxRatePct || 0,
      tax: l.tax || 0,
    })),
    summary: {
      itemCount: lines.length,
      unitCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      mrpTotal,
      subtotal,
      catalogueSavings,
      offerDiscount,
      rewardDiscount,
      qualifyingAmount: merchandise,
      deliveryCharge,
      deliveryFree: freeDelivery || freeByThreshold,
      freeDeliveryEnabled,
      freeDeliveryThreshold,
      // How much more they need to spend to stop paying for delivery — the
      // nudge the cart screen shows.
      amountToFreeDelivery:
        freeDeliveryThreshold > 0 && !freeByThreshold && !freeDelivery
          ? Math.max(0, freeDeliveryThreshold - merchandise)
          : 0,
      packagingCharge,
      taxTotal,
      taxBreakup: [...taxBreakup.values()],
      walletApplied,
      loyaltyApplied,
      loyaltyPointsUsed,
      roundOff,
      total,
      totalSavings: catalogueSavings + offerDiscount + walletApplied + loyaltyApplied,
      cashbackEarned: cashback,
      minOrderValue,
      meetsMinimum,
      shortfallToMinimum: meetsMinimum ? 0 : minOrderValue - merchandise,
    },
    offers: { applied, rejected },
    rewardCoupon: rewardResult,
  };
}

module.exports = { priceCart, offerApplies, computeReward, lineMatchesOffer, applyRewardCoupon };
