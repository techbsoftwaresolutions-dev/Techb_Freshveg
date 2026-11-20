const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, leanToApi, escapeRegex } = require("../../core/query");
const { optionalAuth } = require("../../middleware/auth");

const Category = require("./category.model");
const Brand = require("./brand.model");
const Product = require("./product.model");
const Variant = require("./variant.model");
const Store = require("../stores/store.model");
const Offer = require("../pricing/offer.model");
const inventoryService = require("../inventory/inventory.service");

const categoryService = require("./category.service");
const schemaService = require("./schema.service");
const { memo, cacheResponse, onClear } = require("../../core/storefrontCache");

// A category's schema is admin configuration (three queries to resolve), so it
// is reused for a minute; any admin save clears it at once.
const resolveCategorySchema = (id) => memo(`schema:${id}`, 60000, () => schemaService.resolveCategorySchema(id));
const categoryTree = (maxDepth) =>
  memo(`tree:${maxDepth}`, 60000, () => categoryService.buildTree({ status: "active", maxDepth }));
const descendantIds = (id) => memo(`desc:${id}`, 60000, () => categoryService.descendantIds(id));
const categoryBySlug = (slug) => memo(`cat:${slug}`, 60000, () => Category.findOne({ slug, status: "active" }));

const { infoFor: deliveryTimeInfo, afterHours } = require("../stores/deliveryTime");
// What the apps show once the cut-off has passed: { message } or null.
const afterHoursOf = (settings) => {
  const info = afterHours(settings);
  return info ? { when: info.when, message: info.reason } : null;
};

const router = express.Router();
router.use(optionalAuth);

// What a customer app or the website reads. Draft products, cost prices and
// internal notes never leave through here.
const PRODUCT_CARD_FIELDS =
  "name slug shortDescription media category categoryPath brand unit priceFrom priceTo mrpFrom maxDiscountPct rating inStock variantCount defaultVariant tags isFeatured offer";

/** 1 -> "1", 1.5 -> "1.5". Trailing zeroes on a shelf label read as noise. */
function trimNumber(value) {
  return Number(value.toFixed(2)).toString();
}

/**
 * "1 kg", "500 ml", "Pack of 6" — what one unit of this variant physically is.
 *
 * Fractions step down to the smaller unit, because a shop writes "500 ml" on a
 * shelf label and never "0.5 l".
 */
function packLabel(packSize, fallbackUnit) {
  if (!packSize || !packSize.value) return fallbackUnit || "";

  let { value, unit } = packSize;

  if (value < 1 && (unit === "kg" || unit === "l" || unit === "ltr")) {
    value = Math.round(value * 1000);
    unit = unit === "kg" ? "g" : "ml";
  }

  if (unit === "pcs") return value === 1 ? "1 pack" : `Pack of ${value}`;
  if (unit === "l" || unit === "ltr") return `${trimNumber(value)} ltr`;

  return `${trimNumber(value)} ${unit}`;
}

// A product filter for "can be bought at this store" — the same rule the
// cards and the Add button use, rather than the product's cross-store roll-up.
async function buyableAt(store) {
  if (!store) return { inStock: true };
  // Two queries over the whole store's stock — shared for a few seconds, and
  // cleared by any order, POS bill or stock change.
  const ids = await memo(`buyable:${store._id}`, 15000, () => inventoryService.buyableProductIds(store._id));
  return { _id: { $in: ids }, soldOut: { $ne: true } };
}

/**
 * Finishes each card for the store being shopped: whether it can be bought
 * there, which pack its Add button adds, and that pack's size.
 *
 * A product's own `inStock` is a roll-up across every store and can lag, so a
 * card built from it can offer an Add the store then refuses as out of stock.
 * Here stock is read for this store: a card is in stock when at least one
 * pack can be bought, and its Add button gets a pack that can be — the
 * default one when it is available, else the first that is.
 *
 * A price with no size beside it cannot be compared — ₹155 means nothing until
 * you know it buys 5 kg. Done in one pass for the whole page rather than a
 * lookup per card.
 */
// Every active pack and its stock at this store, read once and shared by every
// card on every page for a few seconds (cleared at once by any order, POS
// bill or stock/catalogue change). The catalogue is small, so this replaces
// two round trips per page with none.
function cardData(store) {
  return memo(`cards:${store ? store._id : "none"}`, 15000, async () => {
    const variants = await Variant.find({ status: "active" })
      .select("product packSize sellingPrice")
      .sort({ sellingPrice: 1 })
      .lean();
    const stock = store ? await inventoryService.availabilityMap(store._id, variants.map((v) => v._id)) : null;
    const byProduct = new Map();
    for (const v of variants) {
      const key = String(v.product);
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(v);
    }
    return { byProduct, stock };
  });
}

async function withCardDetails(cards, store) {
  if (!cards.length) return cards;

  const { byProduct, stock } = await cardData(store);
  const canBuy = (v) => !stock || (stock.get(String(v._id))?.available ?? 0) >= 1;

  return cards.map((card) => {
    const own = byProduct.get(String(card.id)) || [];
    const buyable = own.filter(canBuy);
    const pick =
      buyable.find((v) => String(v._id) === String(card.defaultVariant)) ||
      buyable[0] ||
      own.find((v) => String(v._id) === String(card.defaultVariant)) ||
      own[0];
    return {
      ...card,
      inStock: stock ? buyable.length > 0 : card.inStock,
      defaultVariant: pick ? String(pick._id) : card.defaultVariant,
      packLabel: packLabel(pick?.packSize, card.unit),
    };
  });
}

// Resolves which store is serving this request: an explicit ?store=, the one
// covering the given pincode, or the default. Everything price- and
// stock-related hangs off this.
// Memoised: the serving store is read by every storefront request.
function resolveStore(req) {
  const pincode = req.query.pincode || req.headers["x-delivery-pincode"] || "";
  return memo(`store:${req.query.store || ""}:${pincode}`, 30000, () => findStore(req));
}

async function findStore(req) {
  if (req.query.store) {
    const store = await Store.findById(req.query.store);
    if (store) return store;
  }
  const pincode = req.query.pincode || req.headers["x-delivery-pincode"];
  if (pincode) {
    const store = await Store.findOne({ status: "active", servicePincodes: String(pincode) });
    if (store) return store;
  }
  return Store.findOne({ status: "active" }).sort({ isDefault: -1 });
}

// ?attr.color=red,pink&attr.organic=true -> mongo conditions on the loose
// `attributes` map. The codes are whatever the category binds, so no filter is
// ever named in code.
// A query-string value as the database might hold it: the URL can only say
// "true", but a boolean attribute is stored as true.
function storedForms(value) {
  if (value === "true") return [true, "true"];
  if (value === "false") return [false, "false"];
  return [value];
}

/**
 * attr.<code>=a,b from the query string, as Mongo conditions on Product.
 *
 * An attribute's value can live on the product (variety, organic) or on its
 * variants (pack size — each size is a variant, recorded in axisValues). Which
 * one depends on how the category binds it, so rather than resolve that here
 * a product matches when either holds the value: its own attributes, or any
 * of its live variants. Values within one attribute are OR'd; attributes are
 * AND'd — "1 kg or 2 kg, and organic".
 */
async function attributeFilters(query) {
  const wanted = Object.entries(query)
    .filter(([key]) => key.startsWith("attr.") && /^[a-z][a-z0-9_]*$/.test(key.slice(5)))
    .map(([key, raw]) => ({ code: key.slice(5), values: String(raw).split(",").filter(Boolean).flatMap(storedForms) }))
    .filter((a) => a.values.length);

  // One lookup per attribute, all at once.
  const clauses = await Promise.all(
    wanted.map(async ({ code, values }) => {
      const viaVariants = await Variant.distinct("product", {
        status: "active",
        $or: [
          { axisValues: { $elemMatch: { code, value: { $in: values } } } },
          { [`attributes.${code}`]: { $in: values } },
        ],
      });
      return { $or: [{ [`attributes.${code}`]: { $in: values } }, { _id: { $in: viaVariants } }] };
    })
  );
  return clauses.length ? { $and: clauses } : {};
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// "1 KG" → "1 kg". Option labels are typed in the admin, and a filter list
// that says "500 g" next to "1 KG" looks like two different systems.
function tidyUnitLabel(label) {
  return String(label).replace(/^(\d+(?:\.\d+)?)\s*(KG|G|ML|L)$/i, (_, n, unit) => `${n} ${unit.toLowerCase()}`);
}

/**
 * The filters a shopper can actually use on this shelf: for each filterable
 * attribute, only the values that occur among the products being browsed,
 * each with how many products have it. An option that would return nothing is
 * never offered, and an attribute with no values here is dropped entirely —
 * so a fruit aisle does not offer "1 Litre", and "Origin" never appears as an
 * empty heading.
 */
async function buildFacets(fields, productMatch, knownIds) {
  const productIds = knownIds || (await Product.distinct("_id", productMatch));
  if (!productIds.length) return [];

  const facets = await Promise.all(
    fields.map(async (field) => {
      const path = `attributes.${field.code}`;

      // Distinct products per value, from wherever the value lives.
      const [productRows, variantAxisRows, variantAttrRows] = await Promise.all([
        Product.aggregate([
          { $match: { _id: { $in: productIds } } },
          { $unwind: `$${path}` },
          { $group: { _id: `$${path}`, products: { $addToSet: "$_id" } } },
        ]),
        Variant.aggregate([
          { $match: { product: { $in: productIds }, status: "active", "axisValues.code": field.code } },
          { $unwind: "$axisValues" },
          { $match: { "axisValues.code": field.code } },
          { $group: { _id: "$axisValues.value", products: { $addToSet: "$product" } } },
        ]),
        Variant.aggregate([
          { $match: { product: { $in: productIds }, status: "active", [path]: { $exists: true } } },
          { $unwind: `$${path}` },
          { $group: { _id: `$${path}`, products: { $addToSet: "$product" } } },
        ]),
      ]);

      const byValue = new Map();
      for (const row of [...productRows, ...variantAxisRows, ...variantAttrRows]) {
        // Measured values ({ value, unit }) are not something a list of
        // options can offer; only plain values become filter choices.
        if (row._id === null || row._id === undefined || row._id === "" || typeof row._id === "object") continue;
        const key = String(row._id);
        const set = byValue.get(key) || new Set();
        row.products.forEach((id) => set.add(String(id)));
        byValue.set(key, set);
      }

      let options;
      if (field.inputType === "boolean") {
        const count = byValue.get("true")?.size || 0;
        options = count ? [{ value: "true", label: `${field.label} only`, count }] : [];
      } else if (field.options?.length) {
        // The admin's own order and labels, minus what nothing here has.
        options = field.options
          .filter((option) => byValue.has(String(option.value)))
          .map((option) => ({
            value: String(option.value),
            label: tidyUnitLabel(option.label || option.value),
            hex: option.hex || undefined,
            count: byValue.get(String(option.value)).size,
          }));
      } else {
        // Free text (origin): the values products actually carry, most common first.
        options = [...byValue.entries()]
          .map(([value, set]) => ({ value, label: value, count: set.size }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      }

      if (!options.length) return null;
      // Values that every product here has ("Variety: Desi" on a shelf of
      // desi fruit, or a lone product sold in two sizes) filter nothing —
      // ticking any of them changes no result.
      if (options.every((option) => option.count === productIds.length)) return null;
      return { code: field.code, label: field.label, inputType: field.inputType, options };
    })
  );

  return facets.filter(Boolean);
}

// Price ceilings drawn from what this shelf actually costs, each with how many
// products it keeps, worked out from shelf rows already in hand. A band that
// keeps nothing is dropped; one that keeps everything is too, since choosing
// it would change nothing.
function priceBandsFrom(rows, max, total) {
  if (!max) return [];
  const ceiling = Math.ceil(max / 100);
  const steps = [...new Set([0.25, 0.5, 0.75].map((f) => Math.round((ceiling * f) / 10) * 10))].filter(
    (rupees) => rupees > 0
  );
  const bands = steps.map((rupees) => ({
    max: rupees * 100,
    label: `Under ₹${rupees}`,
    count: rows.filter((r) => typeof r.priceFrom === "number" && r.priceFrom <= rupees * 100).length,
  }));
  return bands.filter(
    (band, i) => band.count > 0 && band.count < total && band.count !== bands[i - 1]?.count
  );
}

// ---------------------------------------------------------------- discovery

router.get(
  "/serviceability",
  asyncHandler(async (req, res) => {
    const pincode = String(req.query.pincode || "");
    if (!/^\d{6}$/.test(pincode)) throw ApiError.badRequest("Enter a valid 6-digit pincode");

    const store = await Store.findOne({ status: "active", servicePincodes: pincode });
    if (!store) {
      return res.json({
        success: true,
        serviceable: false,
        message: "We don't deliver to this pincode yet",
      });
    }

    res.json({
      success: true,
      serviceable: true,
      store: { id: store.id, name: store.name, code: store.code },
      // The area this pincode stands for, when the admin has named it.
      areas: (store.pincodeAreas || []).filter((r) => r.pincode === pincode).map((r) => r.area),
      area: (store.pincodeAreas || []).find((r) => r.pincode === pincode)?.area || "",
      // Per-area delivery charge where the admin set one (paise; 0 = free).
      areaCharges: Object.fromEntries(
        (store.pincodeAreas || [])
          .filter((r) => r.pincode === pincode && Number.isFinite(r.deliveryCharge))
          .map((r) => [r.area, r.deliveryCharge])
      ),
      // Per-area "free above" order value (paise), where the admin set one.
      areaFreeAbove: Object.fromEntries(
        (store.pincodeAreas || [])
          .filter((r) => r.pincode === pincode && Number.isFinite(r.freeAbove) && r.freeAbove > 0)
          .map((r) => [r.area, r.freeAbove])
      ),
      isOpen: store.isOpenNow(),
      minOrderValue: store.settings.minOrderValue,
      freeDeliveryEnabled: store.settings.freeDeliveryEnabled !== false,
      freeDeliveryAbove: store.settings.freeDeliveryAbove,
      deliveryCharge: store.settings.deliveryCharge,
      prepTimeMinutes: store.settings.prepTimeMinutes,
      deliveryTime: deliveryTimeInfo(store.settings).key,
      deliveryTimeLabel: afterHoursOf(store.settings) ? "Tomorrow morning" : deliveryTimeInfo(store.settings).label,
      afterHours: afterHoursOf(store.settings),
    });
  })
);

router.get(
  "/categories",
  cacheResponse(60),
  asyncHandler(async (req, res) => {
    const tree = await categoryTree(Math.min(Number(req.query.depth) || 3, 10));
    // Only what a nav tile needs — the full category document is a lot to send
    // to a phone on every app open.
    const trim = (nodes) =>
      nodes
        .filter((n) => n.showInNav)
        .map((n) => ({
          id: n.id,
          name: n.name,
          slug: n.slug,
          icon: n.icon,
          image: n.image,
          color: n.color,
          productCount: n.productCount,
          children: trim(n.children || []),
        }));

    res.json({ success: true, categories: trim(tree) });
  })
);

const OFFER_KINDS = ["discount", "special", "combo"];
const OFFER_RAIL_TITLES = { discount: "Discounts", special: "Special Offers", combo: "Combo Offers" };

// The app's home screen in one request: categories, live offers and a few
// merchandised rails. One round trip matters on a phone connection.
router.get(
  "/home",
  cacheResponse(30),
  asyncHandler(async (req, res) => {
    const storeFor = resolveStore(req);
    storeFor.catch(() => {}); // awaited below; a failure surfaces there
    storeFor.then(cardData).catch(() => {}); // warm the card snapshot alongside

    // Product cards for a rail, before their per-store details are added.
    const cards = (query) => query.select(PRODUCT_CARD_FIELDS).lean().then((rows) => rows.map(leanToApi));

    // Everything on the page is independent, so it is all read at once (the
    // database is remote: one round trip after another is what made this slow).
    const [tree, offers, featuredRaw, railsRaw, offerRailsRaw, flash] = await Promise.all([
      categoryTree(1),
      // Every offer the admin has switched on, strongest first. This used to
      // need a hidden "featured" flag the admin form never offered, so a new
      // offer was running but never reached the home page. (Whether each is
      // live is checked now, so a memoised list can't outlive a schedule.)
      memo("offers", 30000, () => Offer.find({ status: "active" }).sort({ editedAt: -1, createdAt: -1 }).limit(12)).then(
        (rows) => rows.filter((o) => o.isLive())
      ),
      cards(Product.find({ status: "active", isFeatured: true }).limit(12)),
      // One rail per top-level department, so the home screen grows by itself
      // when a new department is added.
      Category.find({ status: "active", level: 0, showInNav: true })
        .sort({ seq: 1 })
        .limit(6)
        .then((departments) =>
          Promise.all(
            departments.map(async (category) => ({
              category: { id: category.id, name: category.name, slug: category.slug, icon: category.icon },
              products: await cards(
                Product.find({ categoryPath: category._id, status: "active" })
                  .sort({ sortOrder: 1, isFeatured: -1, "rating.average": -1 })
                  .limit(10)
              ),
            }))
          )
        ),
      // One rail per offer kind the admin has tagged products with, so the home
      // page can show Discounts / Special Offers / Combo Offers on their own.
      Promise.all(
        OFFER_KINDS.map(async (kind) => ({
          kind,
          title: OFFER_RAIL_TITLES[kind],
          products: await cards(
            Product.find({ status: "active", "offer.kind": kind }).sort({ sortOrder: 1, createdAt: -1 }).limit(12)
          ),
        }))
      ),
      // A "Flash Deal" countdown is only ever as real as its deadline — so
      // this looks for an offer someone actually gave a schedule.endsAt in the
      // future (set from the admin's Offers screen), rather than the homepage
      // inventing a countdown to nothing. Independent of isFeatured: a flash
      // sale shouldn't need a second, unrelated flag toggled to show up.
      Offer.findOne({ status: "active", "schedule.endsAt": { $gt: new Date() } })
        .sort({ "schedule.endsAt": 1 })
        .then(async (doc) => {
          if (!doc || !doc.isLive()) return null;
          const conditions = doc.conditions || {};
          const hasScope = conditions.categories?.length || conditions.products?.length || conditions.brands?.length;
          const scopedFilter = { status: "active" };
          if (hasScope) {
            scopedFilter.$or = [
              conditions.categories?.length ? { categoryPath: { $in: conditions.categories } } : null,
              conditions.products?.length ? { _id: { $in: conditions.products } } : null,
              conditions.brands?.length ? { brand: { $in: conditions.brands } } : null,
            ].filter(Boolean);
          }
          // No specific scope on the offer (a cart-wide "20% off" style
          // deal) — the best stand-in for "what's on sale" is simply
          // whatever is discounted the most right now.
          const products = await cards(
            Product.find(scopedFilter).sort(hasScope ? { isFeatured: -1 } : { maxDiscountPct: -1 }).limit(6)
          );
          return { doc, products };
        }),
    ]);

    // An offer card needs a picture and somewhere to go. Both come from the
    // aisle the offer applies to when it names one, so a grocery offer shows
    // the grocery photo and "Shop now" lands in the grocery aisle — and an
    // offer's own uploaded image, when it has one, always wins.
    const offerCategoryIds = offers.flatMap((o) => o.conditions?.categories || []);

    // Every card on the page gets its store details in one pass (one variants
    // query + one stock query) instead of a pass per rail.
    const store = await storeFor;
    const everyCard = [
      ...featuredRaw,
      ...railsRaw.flatMap((r) => r.products),
      ...offerRailsRaw.flatMap((r) => r.products),
      ...(flash?.products || []),
    ];
    const unique = [...new Map(everyCard.map((c) => [String(c.id), c])).values()];
    const [detailed, offerCategories] = await Promise.all([
      withCardDetails(unique, store),
      offerCategoryIds.length
        ? Category.find({ _id: { $in: offerCategoryIds }, status: "active" }).select("slug image")
        : [],
    ]);
    const detailOf = new Map(detailed.map((c) => [String(c.id), c]));
    const finish = (list) => list.map((c) => detailOf.get(String(c.id)) || c);

    const featured = finish(featuredRaw);
    const rails = railsRaw.map((r) => ({ ...r, products: finish(r.products) }));
    const offerRails = offerRailsRaw
      .map((r) => ({ ...r, products: finish(r.products) }))
      .filter((rail) => rail.products.length);
    const flashDeal = flash?.products.length
      ? { id: flash.doc.id, title: flash.doc.title, endsAt: flash.doc.schedule.endsAt, products: finish(flash.products) }
      : null;

    const offerCategoryById = new Map(offerCategories.map((c) => [c.id, c]));
    const departmentImage = tree.find((c) => c.showInNav && c.image)?.image || "";
    const offerTarget = (offer) =>
      (offer.conditions?.categories || []).map((id) => offerCategoryById.get(String(id))).find(Boolean);

    res.json({
      success: true,
      store: store
        ? {
            id: store.id,
            name: store.name,
            isOpen: store.isOpenNow(),
            freeDeliveryEnabled: store.settings.freeDeliveryEnabled !== false,
            freeDeliveryAbove: store.settings.freeDeliveryAbove,
            prepTimeMinutes: store.settings.prepTimeMinutes,
            deliveryTime: deliveryTimeInfo(store.settings).key,
            deliveryTimeLabel: afterHoursOf(store.settings) ? "Tomorrow morning" : deliveryTimeInfo(store.settings).label,
      afterHours: afterHoursOf(store.settings),
          }
        : null,
      categories: tree.filter((c) => c.showInNav).map((c) => ({
        id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, image: c.image,
        color: c.color, children: c.children,
      })),
      offers: offers.map((o) => {
        const target = offerTarget(o);
        return {
          id: o.id, title: o.title, description: o.description, badge: o.badge,
          image: o.image || target?.image || departmentImage,
          categorySlug: target?.slug || null,
          code: o.requiresCode ? o.code : null, type: o.type,
        };
      }),
      featured,
      rails: rails.filter((r) => r.products.length),
      offerRails,
      flashDeal,
    });
  })
);

// The coupon for the site header strip: the coupon the admin added or edited
// most recently, among those a shopper can use right now. null when none.
router.get(
  "/latest-coupon",
  cacheResponse(30),
  asyncHandler(async (_req, res) => {
    const rows = await Offer.find({ status: "active", requiresCode: true, code: { $nin: [null, ""] } })
      .sort({ editedAt: -1, createdAt: -1 })
      .limit(20);
    const now = new Date();
    const offer = rows.find(
      (o) => o.isLive(now) && !(o.limits?.totalUses && o.limits.usedCount >= o.limits.totalUses)
    );
    if (!offer) return res.json({ success: true, coupon: null });

    const r = offer.reward || {};
    const value =
      offer.type === "percentage" && r.discountPct ? `${r.discountPct}% off`
      : offer.type === "fixed" && r.discountAmount ? `Rs ${r.discountAmount} off`.replace("Rs ", "₹")
      : offer.type === "free_delivery" ? "Free delivery"
      : offer.type === "cashback" && r.cashbackPct ? `${r.cashbackPct}% cashback`
      : offer.type === "bogo" && r.buyQuantity ? `Buy ${r.buyQuantity} get ${r.getQuantity} free`
      : "";
    res.json({
      success: true,
      coupon: {
        id: offer.id,
        code: offer.code,
        title: offer.title,
        badge: offer.badge || "",
        // The admin's own badge text first, so the header matches the home-page card.
        value: offer.badge || value,
        minCartValue: offer.conditions?.minCartValue || 0,
      },
    });
  })
);

// Category landing: the category itself, plus the filter set its schema says
// it has. The storefront renders filters from this — it does not know what a
// filter for vegetables looks like.
router.get(
  "/categories/:slug",
  cacheResponse(60),
  asyncHandler(async (req, res) => {
    const category = await categoryBySlug(req.params.slug);
    if (!category) throw ApiError.notFound("Category not found");

    const [schema, children, ids, buyable] = await Promise.all([
      resolveCategorySchema(category._id),
      Category.find({ parent: category._id, status: "active" }).sort({ seq: 1 }),
      descendantIds(category._id),
      resolveStore(req).then(buyableAt),
    ]);

    // Everything in the filter sidebar is computed over the subtree actually
    // being browsed, so it only ever offers choices that return something.
    const shelf = { categoryPath: { $in: ids }, status: "active" };

    // One read of the shelf's products; price range, brand counts, totals and
    // price bands are worked out from it here rather than one query each.
    const rows = await Product.find(shelf).select("_id priceFrom priceTo brand soldOut inStock").lean();
    const total = rows.length;
    const buyableIds = buyable._id ? new Set(buyable._id.$in.map(String)) : null;
    const inStockCount = rows.filter((r) =>
      buyableIds ? buyableIds.has(String(r._id)) && r.soldOut !== true : r.inStock === true
    ).length;
    const prices = rows.map((r) => r.priceFrom).filter((v) => typeof v === "number");
    const tops = rows.map((r) => r.priceTo).filter((v) => typeof v === "number");
    const band = total ? { min: prices.length ? Math.min(...prices) : 0, max: tops.length ? Math.max(...tops) : 0 } : null;
    const brandRows = [...rows.reduce((map, r) => (r.brand ? map.set(String(r.brand), (map.get(String(r.brand)) || 0) + 1) : map), new Map())];

    // Same rule as the attribute facets: a single brand that makes up the
    // whole shelf is not a choice.
    const brandCount = new Map(brandRows.every(([, count]) => count === total) ? [] : brandRows);
    const [brandDocs, facets] = await Promise.all([
      Brand.find({ _id: { $in: [...brandCount.keys()] }, status: "active" }).select("name slug logo"),
      buildFacets(schema.filters, shelf, rows.map((r) => r._id)),
    ]);
    const priceBands = priceBandsFrom(rows, band?.max || 0, total);
    const brands = brandDocs
      .map((brand) => ({ ...brand.toJSON(), count: brandCount.get(brand.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    res.json({
      success: true,
      category: {
        id: category.id, name: category.name, slug: category.slug, description: category.description,
        icon: category.icon, banner: category.banner, path: category.path,
        displayConfig: category.displayConfig, seo: category.seo,
      },
      breadcrumb: schema.chain,
      children: children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, image: c.image })),
      features: schema.features,
      // What the category's schema says is filterable — the contract, and
      // what proves a new department gets its fields with no code change.
      filters: schema.filters,
      // What a shopper can actually filter this shelf by right now: the same
      // fields narrowed to values its products carry, with counts. This is
      // what a filter UI should render.
      facets,
      brands,
      priceRange: { min: band?.min || 0, max: band?.max || 0 },
      priceBands,
      // Offered only when it would actually hide something.
      availability: { total, inStock: inStockCount },
    });
  })
);

// ---------------------------------------------------------------- browse

router.get(
  "/products",
  cacheResponse(20),
  asyncHandler(async (req, res) => {
    const term = String(req.query.q || "").trim().slice(0, 60);
    const rx = term ? new RegExp(escapeRegex(term), "i") : null;
    // Everything the filter needs is independent, so it is read in one go
    // rather than one round trip after another.
    const storeFor = resolveStore(req);
    storeFor.then(cardData).catch(() => {}); // warm the card snapshot alongside
    const [attrs, category, buyable, termBrands, termCategories] = await Promise.all([
      attributeFilters(req.query),
      req.query.category
        ? Category.findOne({
            $or: [{ slug: req.query.category }, ...(/^[0-9a-fA-F]{24}$/.test(req.query.category) ? [{ _id: req.query.category }] : [])],
          }).select("_id")
        : null,
      storeFor.then(buyableAt),
      rx ? Brand.find({ name: rx }).distinct("_id") : [],
      rx ? Category.find({ name: rx, status: "active" }).distinct("_id") : [],
    ]);
    const filter = { status: "active", ...attrs };

    if (req.query.category) {
      if (!category) throw ApiError.notFound("Category not found");
      filter.categoryPath = category._id;
    }

    // brand=a,b — any of the ticked brands. Ids only, so nothing else reaches
    // the query.
    if (req.query.brand) {
      const brandIds = String(req.query.brand).split(",").filter((id) => OBJECT_ID.test(id));
      if (brandIds.length) filter.brand = { $in: brandIds };
    }
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.featured === "true") filter.isFeatured = true;
    // ?offer=combo — the products an admin tagged with that offer kind.
    if (OFFER_KINDS.includes(req.query.offer)) filter["offer.kind"] = req.query.offer;
    if (req.query.inStock === "true") filter.$and = [...(filter.$and || []), buyable];
    // The phone's "Offers" chip: only products with a discount on them.
    if (req.query.offers === "true") filter.maxDiscountPct = { $gt: 0 };

    // In-page search on a listing: matches name, tags, keywords and
    // descriptions, plus anything filed under a matching brand or category —
    // and still honours every other filter and the sort, which /search does not.
    if (term) {
      const [brandIds, categoryIds] = [termBrands, termCategories];
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { name: rx },
            { tags: rx },
            { searchKeywords: rx },
            { shortDescription: rx },
            { description: rx },
            { brand: { $in: brandIds } },
            { categoryPath: { $in: categoryIds } },
          ],
        },
      ];
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.priceFrom = {};
      if (req.query.minPrice) filter.priceFrom.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) filter.priceFrom.$lte = Number(req.query.maxPrice);
    }

    const sortMap = {
      popular: { "rating.count": -1, "rating.average": -1 },
      rating: { "rating.average": -1 },
      price_asc: { priceFrom: 1 },
      price_desc: { priceFrom: -1 },
      discount: { maxDiscountPct: -1 },
      newest: { createdAt: -1 },
    };

    const result = await paginate(Product, filter, req.query, {
      // Named sorts only. The storefront offers a fixed set, so an unknown
      // name falls back instead of reaching the database as a field name.
      // Whatever the order, what can be bought at this store comes first — a
      // shelf that opens on "Out of stock" reads as an empty store.
      // `_id` last: products tie on rating and price all the time, and
      // without a final unique key Mongo may order the ties differently on
      // every page request — so a product can show on two pages or on none.
      sort: { ...(sortMap[req.query.sort] || { sortOrder: 1, isFeatured: -1, "rating.average": -1 }), _id: 1 },
      first: buyable,
      select: PRODUCT_CARD_FIELDS,
      populate: { path: "brand", select: "name slug" },
      lean: true,
    });

    result.items = await withCardDetails(result.items, await storeFor);
    res.json({ success: true, ...result });
  })
);

router.get(
  "/search",
  cacheResponse(20),
  asyncHandler(async (req, res) => {
    const term = String(req.query.q || "").trim();
    const storeFor = resolveStore(req);
    storeFor.catch(() => {}); // awaited below; a failure surfaces there
    if (term.length < 2) {
      return res.json({ success: true, items: [], meta: { total: 0 }, suggestions: [] });
    }

    // Text index first; if it returns nothing, fall back to a substring match
    // so partial words ("toma") still find something.
    const categoryList = Category.find({ status: "active", name: new RegExp(escapeRegex(term), "i") })
      .select("name slug icon")
      .limit(5)
      .exec();
    categoryList.catch(() => {}); // awaited below; a failure surfaces there

    let result = { items: [] };
    try {
      result = await paginate(
        Product,
        { status: "active", $text: { $search: term } },
        req.query,
        { defaultSort: { score: { $meta: "textScore" } }, select: PRODUCT_CARD_FIELDS, lean: true }
      );
    } catch (err) {
      // On a database where `npm run sync-indexes` has not been run yet, the
      // text index does not exist. Search should degrade to the slower path
      // rather than fail the request.
      if (err.code !== 27 && err.codeName !== "IndexNotFound") throw err;
    }

    if (!result.items.length) {
      const rx = new RegExp(escapeRegex(term), "i");
      result = await paginate(
        Product,
        { status: "active", $or: [{ name: rx }, { tags: rx }, { searchKeywords: rx }] },
        req.query,
        { select: PRODUCT_CARD_FIELDS, lean: true }
      );
    }

    const categories = await categoryList;

    // Relevance order, but what can be bought leads within the page.
    result.items = (await withCardDetails(result.items, await storeFor)).sort(
      (a, b) => Number(!a.inStock) - Number(!b.inStock)
    );
    res.json({ success: true, ...result, suggestions: categories });
  })
);

router.get(
  "/products/:slug",
  cacheResponse(20),
  asyncHandler(async (req, res) => {
    // The app opens a product from an order line, which only remembers the
    // product's id, so a 24-character id works here as well as a slug.
    const key = req.params.slug;
    const lookup = /^[0-9a-fA-F]{24}$/.test(key) ? { $or: [{ slug: key }, { _id: key }] } : { slug: key };
    const product = await Product.findOne({ ...lookup, status: "active" })
      .populate("category", "name slug path parent")
      .populate("brand", "name slug logo");
    if (!product) throw ApiError.notFound("Product not found");

    // Independent reads, all at once.
    const [variants, schema, store, sameCategory] = await Promise.all([
      // costPrice is excluded here on purpose — it must never reach a client.
      Variant.find({ product: product._id, status: "active" })
        .select("-costPrice")
        .sort({ sellingPrice: 1 }),
      resolveCategorySchema(product.category._id),
      resolveStore(req).then((store) => {
        cardData(store).catch(() => {}); // warm alongside
        return store;
      }),
      Product.find({
        _id: { $ne: product._id },
        category: product.category._id,
        status: "active",
      })
        .select(PRODUCT_CARD_FIELDS)
        .limit(10)
        .lean()
        .then((rows) => rows.map(leanToApi)),
    ]);

    const relatedRail = async () => {
      let related = sameCategory;
      // A narrow leaf category — someone's just-added "Seasonal Fruits" under
      // Fresh Fruits, say — can easily hold only this one product. The shopper
      // still deserves a "you may also like" rail, so when the exact category
      // comes up thin, top it up from the parent category's whole subtree
      // (categoryPath already carries every ancestor, so this is one indexed
      // query, not a walk) rather than showing nothing or fewer than useful.
      if (related.length < 4 && product.category.parent) {
        const seen = new Set([String(product._id), ...related.map((r) => r.id)]);
        const broader = (
          await Product.find({
            _id: { $nin: [...seen] },
            categoryPath: product.category.parent,
            status: "active",
          })
            .select(PRODUCT_CARD_FIELDS)
            .limit(10 - related.length)
            .lean()
        ).map(leanToApi);
        related = [...related, ...broader];
      }
      // Cards in the rail need the same pack label every other card gets ("1 kg",
      // not a bare "kg"), and what can be bought leads — the same rule as every
      // listing.
      return (await withCardDetails(related, store)).sort(
        (a, b) => Number(a.inStock === false) - Number(b.inStock === false)
      );
    };

    // Per-store availability (what the buy button depends on) and the related
    // rail don't depend on each other.
    const [stock, related] = await Promise.all([
      store ? cardData(store).then((d) => d.stock) : new Map(),
      relatedRail(),
    ]);

    // A select or multi-select stores the option's code ("desi"); the shopper
    // should read the label the admin gave it ("Desi / Local").
    const specValue = (field, value) => {
      const labelOf = (v) => field.options?.find((o) => String(o.value) === String(v))?.label ?? v;
      return Array.isArray(value) ? value.map(labelOf) : labelOf(value);
    };

    res.json({
      success: true,
      product,
      breadcrumb: schema.chain,
      features: schema.features,
      // Only the attributes flagged for the spec table, with their labels
      // resolved — the client does not need the whole schema to render specs.
      specs: schema.fields
        .filter((f) => f.showInSpecs && product.attributes?.[f.code] !== undefined && product.attributes[f.code] !== "")
        .map((f) => ({
          label: f.label,
          value: specValue(f, product.attributes[f.code]),
          unit: f.unit,
          group: f.group,
        })),
      variants: variants.map((v) => ({
        ...v.toJSON(),
        availability: stock.get(v._id.toString()) || { available: 0, isLow: true },
      })),
      related,
    });
  })
);

// Rebuild the shared lookups in the background — when the server starts and
// right after any change clears them — so the next shopper finds them ready.
async function warm() {
  const store = await resolveStore({ query: {}, headers: {} });
  await Promise.all([cardData(store), buyableAt(store), categoryTree(1), categoryTree(3)]);
}
onClear(() => warm().catch(() => {}));
setTimeout(() => warm().catch(() => {}), 2000);

module.exports = router;
