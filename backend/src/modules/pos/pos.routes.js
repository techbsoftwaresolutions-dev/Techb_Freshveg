const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { nextSequence } = require("../../core/sequence");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const Category = require("../catalog/category.model");
const Inventory = require("../inventory/inventory.model");
const inventoryService = require("../inventory/inventory.service");
const Order = require("../orders/order.model");
const Store = require("../stores/store.model");
const User = require("../auth/user.model");
const Settings = require("../settings/settings.model");
const cache = require("../../core/cache");

// Counter sales: scan -> bill -> pay -> invoice. A POS bill is an ordinary Order
// (source "pos", already DELIVERED) so reports, returns and the order screens
// keep working; stock leaves through the same inventory service as everything else.
const router = express.Router();
router.use(requireAuth);

const canSell = requirePermission("pos.sell");
const canManage = requirePermission("pos.manage");
// Either permission (requirePermission itself needs all of them).
const canSellOrManage = (req, res, next) =>
  (req.user.permissions || []).some((p) => p === "pos.sell" || p === "pos.manage")
    ? next()
    : canSell(req, res, next);

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, role: req.user.role });
const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const paise = (rupees) => Math.round(Number(rupees) * 100);

async function storeFor(id) {
  const store = id ? await Store.findById(id) : (await Store.findOne({ isDefault: true })) || (await Store.findOne());
  if (!store) throw ApiError.badRequest("Store not found");
  return store;
}

async function presentVariants(variants, storeId) {
  // Three independent lookups, one round trip's worth of waiting. (A variant carries its
  // product's category, so the category names need not wait for the products.)
  const categoryIds = [...new Set(variants.map((v) => String(v.category)).filter((id) => id && id !== "undefined"))];
  const [products, stock, categories] = await Promise.all([
    Product.find({ _id: { $in: variants.map((v) => v.product) } }).select("name unit media category").lean(),
    Inventory.find({ store: storeId, variant: { $in: variants.map((v) => v._id) } }).select("variant onHand").lean(),
    Category.find({ _id: { $in: categoryIds } }).select("name").lean(),
  ]);
  const name = new Map(products.map((p) => [String(p._id), p]));
  const cats = new Map(categories.map((c) => [String(c._id), c.name]));
  const onHand = new Map(stock.map((r) => [String(r.variant), r.onHand]));
  return variants.map((v) => ({
    id: String(v._id),
    productName: name.get(String(v.product))?.name || "",
    image: v.media?.[0]?.url || name.get(String(v.product))?.media?.find((m) => m.type === "image")?.url || "",
    category: cats.get(String(v.category)) || "",
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    unit: v.packSize?.unit || name.get(String(v.product))?.unit || "pcs",
    mrp: v.mrp,
    price: v.sellingPrice,
    taxRatePct: v.taxRatePct,
    taxInclusive: v.taxInclusive,
    stock: onHand.get(String(v._id)) ?? 0,
  }));
}

// Exact barcode/SKU hit - what a scanner sends.
router.get(
  "/lookup",
  canSell,
  asyncHandler(async (req, res) => {
    const code = String(req.query.code || "").trim();
    if (!code) throw ApiError.badRequest("code is required");
    const store = await storeFor(req.query.store);
    const variant = await Variant.findOne({
      status: "active",
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
    });
    if (!variant) throw ApiError.notFound(`No product with barcode/SKU ${code}`);
    const [item] = await presentVariants([variant], store._id);
    res.json({ success: true, item });
  })
);

// Type-ahead, the offline catalogue snapshot and the label picker.
// ?all=1 returns up to 5000 variants (for the till's offline copy).
router.get(
  "/search",
  canSellOrManage,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    // The full list for a till is the heavy one: remember it for 20 s per store. Any write to
    // sales, stock or the catalogue forgets it (see routes/index.js).
    const cacheKey = req.query.all && !q ? `pos:all:${req.query.store || ""}` : null;
    if (cacheKey) {
      const hit = await cache.get(cacheKey);
      if (hit) return res.json(hit);
    }
    const store = await storeFor(req.query.store);
    const filter = { status: "active" };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const products = await Product.find({ name: rx }).select("_id").limit(200).lean();
      filter.$or = [{ sku: rx }, { barcode: rx }, { name: rx }, { product: { $in: products.map((p) => p._id) } }];
    }
    // lean(): plain objects, not 5000 hydrated Mongoose documents.
    const variants = await Variant.find(filter)
      .select("product category sku barcode name packSize mrp sellingPrice taxRatePct taxInclusive media")
      .sort({ updatedAt: -1 })
      .limit(req.query.all ? 5000 : 50)
      .lean();
    const body = { success: true, items: await presentVariants(variants, store._id) };
    if (cacheKey) await cache.set(cacheKey, body, 20);
    res.json(body);
  })
);

// Name for a phone number already in the customer list (fills the "Add Customer" box).
router.get(
  "/customer",
  canSell,
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone || "");
    const user = /^\d{10}$/.test(phone) && phone !== "0000000000" ? await User.findOne({ phone, role: "customer" }).select("name").lean() : null;
    res.json({ success: true, name: user?.name || "" });
  })
);

// ---- Billing --------------------------------------------------------------

function financialYear(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

async function walkInCustomer(phone, name) {
  const p = /^\d{10}$/.test(phone || "") ? phone : "0000000000";
  return User.findOneAndUpdate(
    { phone: p, role: "customer" },
    { $setOnInsert: { name: p === "0000000000" ? "Walk-in Customer" : name || "Customer" } },
    { upsert: true, new: true }
  );
}

const booking = new Set(); // clientIds being saved right now (single server process)

router.post(
  "/sales",
  canSell,
  asyncHandler(async (req, res) => {
    const { clientId, items, discount = 0, payments, customerName, customerPhone, soldAt } = req.body || {};
    if (!clientId) throw ApiError.badRequest("clientId is required");

    // Replay of a bill already booked (a second click, an offline retry) -> same answer.
    // The in-flight set closes the gap while the first copy is still being saved.
    const existing = await Order.findOne({ posClientId: clientId });
    if (existing) return res.json({ success: true, order: existing, duplicate: true });
    if (booking.has(clientId)) throw ApiError.conflict("This bill is already being saved");
    booking.add(clientId);
    res.on("finish", () => booking.delete(clientId));
    res.on("close", () => booking.delete(clientId));

    if (!Array.isArray(items) || !items.length) throw ApiError.badRequest("Add at least one item");
    const discountPaise = Math.round(Number(discount) || 0);
    if (discountPaise < 0) throw ApiError.badRequest("Invalid discount");
    if (discountPaise > 0 && !(req.user.permissions || []).includes("pos.discount")) {
      throw ApiError.forbidden("You are not allowed to give discounts");
    }

    const store = await storeFor(req.body.store);
    const variants = await Variant.find({ _id: { $in: items.map((i) => i.variantId) } });
    const byId = new Map(variants.map((v) => [String(v._id), v]));
    const products = await Product.find({ _id: { $in: variants.map((v) => v.product) } }).select("name").lean();
    const productName = new Map(products.map((p) => [String(p._id), p.name]));

    // Prices come from the catalogue. A till may override one (customer bargains,
    // price changed) only with the discount permission.
    const lines = items.map((i) => {
      const v = byId.get(String(i.variantId));
      const qty = Number(i.quantity);
      if (!v) throw ApiError.badRequest("An item in the bill no longer exists");
      if (!(qty > 0)) throw ApiError.badRequest("Quantity must be positive");
      let price = v.sellingPrice;
      if (i.unitPrice != null && Math.round(Number(i.unitPrice)) !== price) {
        const override = Math.round(Number(i.unitPrice));
        if (!(override >= 0)) throw ApiError.badRequest("Invalid price");
        if (!(req.user.permissions || []).includes("pos.discount")) throw ApiError.forbidden("You are not allowed to change prices");
        price = override;
      }
      return { v, qty, price, lineTotal: Math.round(price * qty) };
    });

    const gross = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (discountPaise > gross) throw ApiError.badRequest("Discount is more than the bill");

    // Spread the bill discount over the lines in proportion, then work out tax
    // on what each line actually sold for.
    let left = discountPaise;
    const calc = lines.map((l, idx) => {
      const share = idx === lines.length - 1 ? left : Math.round((discountPaise * l.lineTotal) / (gross || 1));
      left -= share;
      const net = l.lineTotal - share;
      const rate = l.v.taxRatePct || 0;
      const tax = l.v.taxInclusive ? Math.round((net * rate) / (100 + rate)) : Math.round((net * rate) / 100);
      return { l, share, net, rate, tax };
    });

    const orderItems = calc.map(({ l, share, net, rate, tax }) => ({
      variant: l.v._id,
      product: l.v.product,
      category: l.v.category,
      name: productName.get(String(l.v.product)) || l.v.name,
      variantName: l.v.name,
      sku: l.v.sku,
      unit: l.v.packSize?.unit || "pcs",
      packSize: l.v.packSize,
      quantity: l.qty,
      unitPrice: l.price,
      mrp: l.v.mrp,
      lineTotal: l.lineTotal,
      discount: share,
      payable: l.v.taxInclusive ? net : net + tax,
      taxRatePct: rate,
      tax,
      pickedQuantity: l.qty,
      itemStatus: "picked",
    }));

    const taxBy = new Map();
    for (const { l, net, rate, tax } of calc) {
      const b = taxBy.get(rate) || { rate, taxableValue: 0, tax: 0 };
      b.taxableValue += net - (l.v.taxInclusive ? tax : 0);
      b.tax += tax;
      taxBy.set(rate, b);
    }

    const exact = orderItems.reduce((s, i) => s + i.payable, 0);
    const total = Math.round(exact / 100) * 100; // round to the rupee
    const roundOff = total - exact;

    const pays = (Array.isArray(payments) ? payments : [])
      .map((p) => ({ method: p.method, amount: Math.round(Number(p.amount)) }))
      .filter((p) => p.amount > 0);
    if (!pays.every((p) => ["cash", "upi", "card"].includes(p.method))) throw ApiError.badRequest("Unknown payment method");
    if (pays.reduce((s, p) => s + p.amount, 0) < total) throw ApiError.badRequest("Payment is less than the bill total");

    const customer = await walkInCustomer(customerPhone, customerName);
    const now = soldAt ? new Date(soldAt) : new Date();
    const dayCode = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const [invSeq, daySeq] = await Promise.all([
      nextSequence(`invoice:${store.code}:${financialYear(now)}`),
      nextSequence(`pos:${dayCode}`),
    ]);
    const actor = actorOf(req);

    const orderData = {
      code: `POS-${dayCode}-${String(daySeq).padStart(4, "0")}`,
      invoiceNo: `${store.code}/${financialYear(now)}/${String(invSeq).padStart(5, "0")}`,
      posClientId: clientId,
      customer: customer._id,
      customerSnapshot: { name: customerName || customer.name, phone: customerPhone || "" },
      store: store._id,
      source: "pos",
      status: "DELIVERED",
      statusHistory: [{ status: "DELIVERED", at: now, by: actor.id, byName: actor.name, byRole: actor.role, note: "POS sale" }],
      items: orderItems,
      pricing: {
        itemCount: orderItems.length,
        unitCount: orderItems.reduce((s, i) => s + i.quantity, 0),
        mrpTotal: orderItems.reduce((s, i) => s + Math.round(i.mrp * i.quantity), 0),
        subtotal: gross,
        offerDiscount: discountPaise,
        taxTotal: orderItems.reduce((s, i) => s + i.tax, 0),
        taxBreakup: [...taxBy.values()],
        roundOff,
        total,
      },
      payment: {
        method: [...pays].sort((a, b) => b.amount - a.amount)[0].method,
        status: "paid",
        amountPaid: total,
        paidAt: now,
      },
      posPayments: pays,
      cashier: actor.id,
      cashierName: actor.name,
      placedAt: now,
    };
    let order;
    try {
      order = await Order.create(orderData);
    } catch (err) {
      // The unique index on posClientId refused a second copy of this bill (two requests raced
      // past the check above): answer with the one already booked.
      if (err.code === 11000 && String(err.message).includes("posClientId")) {
        const dup = await Order.findOne({ posClientId: clientId });
        if (dup) return res.json({ success: true, order: dup, duplicate: true });
      }
      throw err;
    }

    // The goods are already in the customer's hands: stock moves after the bill is
    // booked and never rejects it (an offline sale may outrun the counted stock).
    // An item with no stock record at this store gets one (at 0) first. A failure here
    // must never turn a booked bill into an error: the cashier would just press Pay
    // again and book it twice.
    for (const it of orderItems) {
      try {
        await inventoryService.getOrCreateRow(store._id, it.variant);
        await inventoryService.dispatch(store._id, it.variant, it.quantity, {
          refType: "order", refId: order._id, refCode: order.invoiceNo, reason: "POS sale", actor,
        });
      } catch (err) {
        console.error(`[pos] stock not updated for ${order.invoiceNo} / ${it.sku}: ${err.message}`);
      }
    }

    res.status(201).json({ success: true, order });
  })
);

// Recent bills, for reprints.
router.get(
  "/sales",
  canSell,
  asyncHandler(async (req, res) => {
    const filter = { source: "pos" };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), "i");
      filter.$or = [{ invoiceNo: rx }, { code: rx }, { "customerSnapshot.phone": rx }];
    }
    const orders = await Order.find(filter).sort({ placedAt: -1 }).limit(30);
    res.json({ success: true, items: orders });
  })
);

// Everything the printed invoice header needs.
router.get(
  "/invoice-header",
  canSell,
  asyncHandler(async (req, res) => {
    const [settings, store] = await Promise.all([Settings.load(), storeFor(req.query.store)]);
    const c = settings.company;
    const a = store.address || {};
    res.json({
      success: true,
      header: {
        name: c.legalName || c.name,
        gstin: c.gstin,
        phone: store.contact?.phone || c.supportPhone,
        address: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ") || c.address,
        store: store.name,
        storeId: String(store._id),
        template: settings.pos?.template || "standard",
      },
    });
  })
);

// ---- Barcodes -------------------------------------------------------------

function ean13(body12) {
  const sum = [...body12].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body12 + String((10 - (sum % 10)) % 10);
}

// Give every variant that has no barcode an in-store EAN-13 (prefix 29 = store use).
router.post(
  "/barcodes/generate",
  canManage,
  asyncHandler(async (req, res) => {
    const filter = { status: "active", $or: [{ barcode: "" }, { barcode: null }] };
    if (Array.isArray(req.body?.variantIds) && req.body.variantIds.length) filter._id = { $in: req.body.variantIds };
    const variants = await Variant.find(filter).limit(2000);
    for (const v of variants) {
      const n = await nextSequence("barcode");
      v.barcode = ean13(`29${String(n).padStart(10, "0")}`);
      await v.save();
    }
    res.json({ success: true, generated: variants.length });
  })
);

// ---- Excel import ---------------------------------------------------------
// The browser reads the .xlsx and sends rows; this validates and applies them.
// Matches existing variants by SKU. Creating brand-new products stays in the
// product form (they need a category and attributes).

router.post(
  "/import",
  canManage,
  asyncHandler(async (req, res) => {
    const { rows, dryRun = true } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest("No rows to import");
    if (rows.length > 5000) throw ApiError.badRequest("Import at most 5000 rows at a time");
    const store = await storeFor(req.body.store);

    const skus = rows.map((r) => String(r.sku || "").trim().toUpperCase()).filter(Boolean);
    const found = await Variant.find({ sku: { $in: skus } });
    const bySku = new Map(found.map((v) => [v.sku, v]));
    const has = (x) => x !== undefined && x !== "" && x !== null;
    const results = [];
    const seen = new Set();

    for (const [i, r] of rows.entries()) {
      const sku = String(r.sku || "").trim().toUpperCase();
      const out = { row: i + 2, sku, status: "ok", message: "" }; // +2: header is row 1
      const v = bySku.get(sku);
      const nums = { sellingPrice: r.sellingPrice, mrp: r.mrp, costPrice: r.costPrice, taxRatePct: r.taxRatePct, stock: r.stock };
      const bad = Object.entries(nums).find(([, x]) => has(x) && !(Number(x) >= 0));
      if (!sku) { out.status = "error"; out.message = "SKU is empty"; }
      else if (seen.has(sku)) { out.status = "error"; out.message = "Duplicate SKU in file"; }
      else if (!v) { out.status = "error"; out.message = "SKU not found - add the product first"; }
      else if (bad) { out.status = "error"; out.message = `${bad[0]} must be a number`; }
      seen.add(sku);
      results.push(out);
      if (out.status !== "ok" || dryRun) continue;

      if (has(r.barcode)) v.barcode = String(r.barcode).trim();
      if (has(r.sellingPrice)) v.sellingPrice = paise(r.sellingPrice);
      if (has(r.mrp)) v.mrp = paise(r.mrp);
      if (has(r.costPrice)) v.costPrice = paise(r.costPrice);
      if (has(r.taxRatePct)) v.taxRatePct = Number(r.taxRatePct);
      try {
        await v.save();
        if (has(r.stock)) {
          await inventoryService.adjust(store._id, v._id, Number(r.stock), { reason: "Excel import", actor: actorOf(req) });
        }
      } catch (err) {
        out.status = "error";
        out.message = err.message;
      }
    }

    const ok = results.filter((x) => x.status === "ok").length;
    res.json({ success: true, dryRun, ok, failed: results.length - ok, results });
  })
);

module.exports = router;
