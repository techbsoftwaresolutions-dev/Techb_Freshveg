const Inventory = require("./inventory.model");
const StockMovement = require("./stockMovement.model");
const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const ApiError = require("../../core/ApiError");

// Every stock change goes through this module. Nothing else writes `onHand` or
// `reserved` directly — that rule is what keeps the movement log a complete
// explanation of the current numbers.

async function getOrCreateRow(storeId, variantId, session = null) {
  let row = await Inventory.findOne({ store: storeId, variant: variantId }).session(session);
  if (row) return row;

  const variant = await Variant.findById(variantId).select("product category categoryPath lowStockThreshold").session(session);
  if (!variant) throw ApiError.notFound("Variant not found");

  const created = await Inventory.create(
    [
      {
        store: storeId,
        variant: variantId,
        product: variant.product,
        category: variant.category,
        onHand: 0,
        reserved: 0,
        lowStockThreshold: variant.lowStockThreshold ?? 5,
      },
    ],
    { session }
  );
  return created[0];
}

async function record(row, { type, quantity, reason, note, refType, refId, refCode, actor, batchNo, costPrice }, before, session) {
  await StockMovement.create(
    [
      {
        store: row.store,
        variant: row.variant,
        product: row.product,
        type,
        quantity,
        onHandBefore: before.onHand,
        onHandAfter: row.onHand,
        reservedBefore: before.reserved,
        reservedAfter: row.reserved,
        batchNo: batchNo || "",
        costPrice: costPrice || 0,
        refType: refType || "",
        refId: refId || undefined,
        refCode: refCode || "",
        reason: reason || "",
        note: note || "",
        actor: actor?.id,
        actorName: actor?.name || "",
      },
    ],
    { session }
  );
}

// Keeps the denormalised totals in step, so a listing page can grey out an
// item without touching the inventory collection.
//
// This has to walk all the way up to the Product, not stop at the Variant.
// Product.inStock is what every storefront listing reads, and it is set when a
// product is saved — which is *before* any stock is ever received. Without
// this second write, a fully stocked catalogue shows as out of stock on every
// card while the variants underneath say otherwise.
async function refreshVariantStock(variantId, session = null) {
  const rows = await Inventory.find({ variant: variantId }).session(session);
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.onHand - r.reserved), 0);

  const variant = await Variant.findByIdAndUpdate(
    variantId,
    { totalStock: total, inStock: total > 0 },
    { session, new: true }
  );

  if (variant?.product) {
    const [siblings, product] = await Promise.all([
      Variant.find({ product: variant.product, status: "active" }).select("inStock").session(session),
      Product.findById(variant.product).select("soldOut").session(session),
    ]);
    await Product.findByIdAndUpdate(
      variant.product,
      // Receiving stock never overrides a manual "sold out".
      { inStock: !product?.soldOut && siblings.some((v) => v.inStock) },
      { session }
    );
  }

  return total;
}

// The variants among these whose product is switched to "sold out" — they
// can't be sold whatever the shelf holds.
async function soldOutVariantIds(variantIds) {
  const variants = await Variant.find({ _id: { $in: variantIds } }).select("product");
  const soldOut = await Product.find({
    _id: { $in: [...new Set(variants.map((v) => String(v.product)))] },
    soldOut: true,
  }).select("_id");
  const soldOutProducts = new Set(soldOut.map((p) => String(p._id)));
  return new Set(variants.filter((v) => soldOutProducts.has(String(v.product))).map((v) => String(v._id)));
}

async function availability(storeId, variantId) {
  const [row, soldOut] = await Promise.all([
    Inventory.findOne({ store: storeId, variant: variantId }),
    soldOutVariantIds([variantId]),
  ]);
  if (!row) return { available: 0, onHand: 0, reserved: 0, isLow: true, exists: false };
  return {
    // Sold out means nothing can be added or ordered; onHand stays the truth.
    available: soldOut.size ? 0 : row.available,
    onHand: row.onHand,
    reserved: row.reserved,
    isLow: row.isLow,
    exists: true,
  };
}

// Receiving adds a batch when the category tracks them, and always moves
// onHand. Produce arrives as a batch with a harvest date; a carton of soap
// arrives as a plain quantity.
async function receive(storeId, variantId, quantity, options = {}, session = null) {
  if (quantity <= 0) throw ApiError.badRequest("Receive quantity must be positive");

  const row = await getOrCreateRow(storeId, variantId, session);
  const before = { onHand: row.onHand, reserved: row.reserved };

  if (options.batchNo) {
    row.batches.push({
      batchNo: options.batchNo,
      quantity,
      costPrice: options.costPrice || 0,
      manufacturedOn: options.manufacturedOn,
      harvestedOn: options.harvestedOn,
      expiresOn: options.expiresOn,
      bestBefore: options.bestBefore,
      supplier: options.supplier || "",
      grade: options.grade || "",
    });
  }

  row.onHand += quantity;
  row.lastReceivedAt = new Date();
  await row.save({ session });

  await record(row, { type: "receive", quantity, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

// Reserving does not move physical stock — it ring-fences it so the next
// customer sees a lower `available`. Checkout reserves; picking dispatches.
async function reserve(storeId, variantId, quantity, options = {}, session = null) {
  const row = await getOrCreateRow(storeId, variantId, session);

  if (row.available < quantity) {
    throw ApiError.conflict(
      `Only ${row.available} left in stock`,
      { variant: String(variantId), requested: quantity, available: row.available }
    );
  }

  const before = { onHand: row.onHand, reserved: row.reserved };
  row.reserved += quantity;
  await row.save({ session });

  await record(row, { type: "reserve", quantity, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

async function release(storeId, variantId, quantity, options = {}, session = null) {
  const row = await Inventory.findOne({ store: storeId, variant: variantId }).session(session);
  if (!row) return null;

  const before = { onHand: row.onHand, reserved: row.reserved };
  // Never let a double-release push `reserved` negative — that would inflate
  // available stock and oversell.
  row.reserved = Math.max(0, row.reserved - quantity);
  await row.save({ session });

  await record(row, { type: "release", quantity: -quantity, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

// Dispatch turns a reservation into an actual outbound movement, consuming
// batches in FEFO order.
async function dispatch(storeId, variantId, quantity, options = {}, session = null) {
  const row = await Inventory.findOne({ store: storeId, variant: variantId }).session(session);
  if (!row) throw ApiError.conflict("No stock row for this item at this store");

  const before = { onHand: row.onHand, reserved: row.reserved };

  let remaining = quantity;
  for (const batch of row.pickingOrder()) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    batch.quantity -= take;
    remaining -= take;
  }

  row.onHand = Math.max(0, row.onHand - quantity);
  row.reserved = Math.max(0, row.reserved - quantity);
  await row.save({ session });

  await record(row, { type: "dispatch", quantity: -quantity, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

// A counted correction. `newQuantity` is what is physically on the shelf; the
// movement records the delta so the log still explains the change.
async function adjust(storeId, variantId, newQuantity, options = {}, session = null) {
  const row = await getOrCreateRow(storeId, variantId, session);
  const before = { onHand: row.onHand, reserved: row.reserved };

  const delta = newQuantity - row.onHand;
  row.onHand = Math.max(0, newQuantity);
  row.lastCountedAt = new Date();
  await row.save({ session });

  await record(row, { type: options.type || "adjust", quantity: delta, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

async function writeOffDamage(storeId, variantId, quantity, options = {}, session = null) {
  const row = await getOrCreateRow(storeId, variantId, session);
  const before = { onHand: row.onHand, reserved: row.reserved };

  row.onHand = Math.max(0, row.onHand - quantity);
  row.damaged += quantity;
  await row.save({ session });

  await record(row, { type: "damage", quantity: -quantity, ...options }, before, session);
  await refreshVariantStock(variantId, session);
  return row;
}

async function transfer(fromStoreId, toStoreId, variantId, quantity, options = {}, session = null) {
  if (String(fromStoreId) === String(toStoreId)) {
    throw ApiError.badRequest("Source and destination stores must differ");
  }

  const source = await Inventory.findOne({ store: fromStoreId, variant: variantId }).session(session);
  if (!source || source.available < quantity) {
    throw ApiError.conflict(`Only ${source?.available || 0} available at the source store`);
  }

  const sourceBefore = { onHand: source.onHand, reserved: source.reserved };
  source.onHand -= quantity;
  await source.save({ session });
  await record(source, { type: "transfer_out", quantity: -quantity, ...options }, sourceBefore, session);

  const destination = await getOrCreateRow(toStoreId, variantId, session);
  const destBefore = { onHand: destination.onHand, reserved: destination.reserved };
  destination.onHand += quantity;
  await destination.save({ session });
  await record(destination, { type: "transfer_in", quantity, ...options }, destBefore, session);

  await refreshVariantStock(variantId, session);
  return { source, destination };
}

// Bulk availability for a cart or a listing page — one query, not one per line.
async function availabilityMap(storeId, variantIds) {
  const [rows, soldOut] = await Promise.all([
    Inventory.find({ store: storeId, variant: { $in: variantIds } }),
    soldOutVariantIds(variantIds),
  ]);
  const map = new Map();
  for (const row of rows) {
    map.set(row.variant.toString(), {
      // The cart, checkout and product page all read this — a sold-out
      // product shows 0 to all of them, so it can't be carted or ordered.
      available: soldOut.has(row.variant.toString()) ? 0 : row.available,
      onHand: row.onHand,
      isLow: row.isLow,
    });
  }
  // Variants with no row at this store have never been stocked there.
  for (const id of variantIds) {
    const key = String(id);
    if (!map.has(key)) map.set(key, { available: 0, onHand: 0, isLow: true });
  }
  return map;
}

module.exports = {
  getOrCreateRow,
  availability,
  availabilityMap,
  receive,
  reserve,
  release,
  dispatch,
  adjust,
  writeOffDamage,
  transfer,
  refreshVariantStock,
};
