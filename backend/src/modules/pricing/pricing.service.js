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

// Why an offer is not live, in words a customer can act on.
function notLiveReason(offer, at) {
  const { startsAt, endsAt } = offer.schedule || {};
  const { totalUses, usedCount } = offer.limits || {};
  if (offer.status !== "active") return "This coupon is not active";
  if (endsAt && at > endsAt) return "This coupon has expired";
  if (startsAt && at < startsAt) return "This coupon is not active yet";
  if (totalUses && usedCount >= totalUses) return "This coupon has reached its usage limit";
  return "This coupon is not available right now";
}

function offerApplies(offer, context) {
  const { lines, subtotal, customer, store, paymentMethod, at, usage } = context;

  if (!offer.isLive(at)) return { ok: false, reason: notLiveReason(offer, at) };

  // One use per customer unless the admin allows more: a typed coupon is a
  // one-time gift, not a standing discount.
  const perCustomerLimit = offer.limits?.perCustomer > 0 ? offer.limits.perCustomer : offer.requiresCode ? 1 : 0;
  if (perCustomerLimit && customer?.id && (usage?.get(String(offer._id)) || 0) >= perCustomerLimit) {
    return {
      ok: false,
      reason: perCustomerLimit === 1
        ? "You have already used this coupon"
        : `You have already used this coupon ${perCustomerLimit} times`,
    };
  }

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
function allocateDiscount(lines, matchingIds, totalDiscount) {
  const eligible = lines.filter((l) => matchingIds.has(l.key));
  const base = eligible.reduce((sum, l) => sum + l.lineTotal, 0);
  if (base <= 0 || totalDiscount <= 0) return;

  let allocated = 0;
  eligible.forEach((line, index) => {
    const isLast = index === eligible.length - 1;
    // The last line absorbs the rounding remainder so the parts sum exactly to
    // the whole.
    const share = isLast
      ? totalDiscount - allocated
      : Math.round((line.lineTotal / base) * totalDiscount);
    line.discount += share;
    allocated += share;
  });
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
  };
}

async function priceCart(context) {
  const {
    lines: inputLines,
    store,
    customer = null,
    couponCode = null,
    paymentMethod = null,
    area = null,
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

  // How many times this customer has already had each candidate on an order
  // (cancelled and rejected orders give the use back).
  const usage = new Map();
  if (customer?.id && candidates.length) {
    const Order = require("../orders/order.model");
    const rows = await Order.aggregate([
      {
        $match: {
          customer: new (require("mongoose").Types.ObjectId)(String(customer.id)),
          status: { $nin: ["CANCELLED", "REJECTED"] },
          "appliedOffers.offer": { $in: candidates.map((o) => o._id) },
        },
      },
      { $unwind: "$appliedOffers" },
      { $group: { _id: "$appliedOffers.offer", count: { $sum: 1 } } },
    ]);
    for (const row of rows) usage.set(String(row._id), row.count);
  }

  const evalContext = { lines, subtotal, customer, store, paymentMethod, at, usage };

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

  const offerDiscount = lines.reduce((sum, l) => sum + l.discount, 0);
  const afterDiscount = subtotal - offerDiscount;

  // --- 3. Charges -----------------------------------------------------
  let deliveryCharge = settings.deliveryCharge || 0;
  // An area the admin gave its own delivery charge (₹0 = free) overrides the
  // store's normal charge for shoppers in that area. An area can also carry its
  // own "free above ₹X": at or above it delivery is free, below it the area's
  // charge is paid — and that threshold replaces the store-wide one there.
  let areaFreeAbove = 0;
  // A shopper who has given no area is priced at the store's default area (picked
  // in the admin), if it has one; otherwise at the store's normal charge.
  const areaName = area?.area || store?.defaultArea || "";
  if (areaName) {
    const wanted = String(areaName).trim().toLowerCase();
    const entry = (store?.pincodeAreas || []).find(
      (r) =>
        String(r.area || "").trim().toLowerCase() === wanted &&
        (!area?.area || !area.pincode || String(r.pincode) === String(area.pincode)) &&
        (Number.isFinite(r.deliveryCharge) || Number.isFinite(r.freeAbove))
    );
    if (entry) {
      if (Number.isFinite(entry.deliveryCharge)) deliveryCharge = entry.deliveryCharge;
      if (Number.isFinite(entry.freeAbove) && entry.freeAbove > 0) areaFreeAbove = entry.freeAbove;
    }
  }
  // A switched-off rule has no threshold at all, so it can neither waive the
  // charge nor be shown to the customer.
  const freeDeliveryEnabled = areaFreeAbove > 0 || settings.freeDeliveryEnabled !== false;
  const freeDeliveryThreshold = areaFreeAbove > 0 ? areaFreeAbove : settings.freeDeliveryEnabled !== false ? settings.freeDeliveryAbove || 0 : 0;
  const freeByThreshold = freeDeliveryThreshold > 0 && afterDiscount >= freeDeliveryThreshold;
  if (freeDelivery || freeByThreshold) deliveryCharge = 0;

  // Packaging: the store's normal charge, unless the admin priced some brands
  // separately. Each such brand in the cart adds its own charge once; items of
  // any other brand are covered by the normal charge (added once, if present).
  let packagingCharge = settings.packagingCharge || 0;
  const brandRules = settings.brandPackaging || [];
  if (brandRules.length) {
    const byBrand = new Map(brandRules.map((r) => [String(r.brand), r.charge || 0]));
    const present = new Set(lines.map((l) => (l.brand ? String(l.brand) : "")));
    let brandTotal = 0;
    let matched = false;
    let unmatched = false;
    for (const brandId of present) {
      if (byBrand.has(brandId)) {
        brandTotal += byBrand.get(brandId);
        matched = true;
      } else {
        unmatched = true;
      }
    }
    if (matched) packagingCharge = brandTotal + (unmatched ? settings.packagingCharge || 0 : 0);
  }

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
  const meetsMinimum = afterDiscount >= minOrderValue;

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
      deliveryCharge,
      deliveryFree: freeDelivery || freeByThreshold,
      freeDeliveryEnabled,
      freeDeliveryThreshold,
      // How much more they need to spend to stop paying for delivery — the
      // nudge the cart screen shows.
      amountToFreeDelivery:
        freeDeliveryThreshold > 0 && !freeByThreshold && !freeDelivery
          ? Math.max(0, freeDeliveryThreshold - afterDiscount)
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
      shortfallToMinimum: meetsMinimum ? 0 : minOrderValue - afterDiscount,
    },
    offers: { applied, rejected },
  };
}

module.exports = { priceCart, offerApplies, computeReward, lineMatchesOffer };
