const crypto = require("crypto");
const mongoose = require("mongoose");
const Product = require("./product.model");
const ApiError = require("../../core/ApiError");

// A product's category says what it is (Fresh Fruits); its sections say which
// curated shelves it is also placed on (Best Seller, Trending, On Discount).
// Membership lives on Product.sections. Order lives on Product.positions, one
// entry per "order key" — a section key, or "category:<category id>" for
// each category the product is filed under, at every level of its chain — so
// a product can be 1st in Best Seller, 4th in Trending and 7th in Fresh Fruits
// at once. Every key's positions are kept dense (1..n over its members) by
// arrange(), the one routine that writes them.

const LABELS = { best_seller: "Best Seller", trending: "Trending", on_discount: "On Discount" };
// The model's enum is the one list of keys; this only names them.
const SECTION_KEYS = Product.schema.path("sections").caster.enumValues;
const SECTIONS = SECTION_KEYS.map((key) => ({ key, label: LABELS[key] || key }));
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const categoryKey = (rootId) => `category:${rootId}`;
const categoryKeyOf = (product) => (product.categoryPath?.[0] ? categoryKey(product.categoryPath[0]) : null);
const orderKeysOf = (product) => [...(product.sections || []), ...(product.categoryPath || []).map(categoryKey)];

// Archived products drop out of every order; hidden, draft and sold-out ones
// keep their place so switching them back on doesn't shuffle the shelf.
function memberFilter(key) {
  if (SECTION_KEYS.includes(key)) return { sections: key, status: { $ne: "archived" } };
  const rootId = String(key).startsWith("category:") ? key.slice("category:".length) : "";
  if (OBJECT_ID.test(rootId)) return { categoryPath: new mongoose.Types.ObjectId(rootId), status: { $ne: "archived" } };
  throw ApiError.badRequest(`Unknown section "${key}"`);
}

// What a shopper may see in a section. A classification is not a discount:
// "On Discount" only shows products the pricing actually discounts (an MRP
// above the selling price on some pack), so removing the discount takes the
// product off that shelf without anyone having to untick it.
function storefrontFilter(key) {
  const filter = { ...memberFilter(key), status: "active" };
  if (key === "on_discount") filter.maxDiscountPct = { $gt: 0 };
  return filter;
}

// The tags a customer's product card shows. Not On Discount: the card's
// "% OFF" already says that, from the real price, so a second tag could only
// ever repeat it — or contradict it.
const badgesOf = (product) =>
  SECTIONS.filter((s) => s.key !== "on_discount" && product.sections?.includes(s.key)).map((s) => s.label);

// `_id` last so ties (only possible mid-repair) never page unstably.
const sortFor = (key) => ({ [`positions.${key}`]: 1, _id: 1 });

const positionOf = (product, key) =>
  product.positions instanceof Map ? product.positions.get(key) : product.positions?.[key];

// Placed products in their saved order; anything not placed yet follows in
// the order the storefront rails used before positions existed — featured
// first, then best rated, then oldest — so the fallback is deterministic.
function byPosition(key) {
  return (a, b) => {
    const pa = positionOf(a, key) ?? Infinity;
    const pb = positionOf(b, key) ?? Infinity;
    if (pa !== pb) return pa - pb;
    return (
      Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
      (b.rating?.average || 0) - (a.rating?.average || 0) ||
      new Date(a.createdAt) - new Date(b.createdAt) ||
      String(a._id).localeCompare(String(b._id))
    );
  };
}

// ponytail: in-process queue per key; running several API instances would
// need this as a Mongo transaction or lock document instead.
const queues = new Map();
function serial(key, task) {
  const run = (queues.get(key) || Promise.resolve()).then(task);
  queues.set(key, run.catch(() => {}));
  return run;
}

// Rewrites a key's positions as 1..n over its current members. With
// `productId` + `position` it moves that product there first (clamped to the
// list); a `productId` that is no longer a member has its stale position
// cleared. Renumbering the whole list each time means a duplicate or a gap,
// however it got there, is gone after the next write.
function arrange(key, productId = null, position = null) {
  if (!key) return Promise.resolve([]);
  const filter = memberFilter(key);
  return serial(key, async () => {
    const members = await Product.find(filter).select("positions isFeatured rating createdAt").lean();
    const ordered = members.sort(byPosition(key));
    const id = productId && String(productId);

    if (id && position !== null) {
      const from = ordered.findIndex((p) => String(p._id) === id);
      if (from >= 0) {
        const [moving] = ordered.splice(from, 1);
        const to = Math.min(Math.max(1, Math.trunc(position)), ordered.length + 1) - 1;
        ordered.splice(to, 0, moving);
      }
    }

    const drop = id && !ordered.some((p) => String(p._id) === id) ? id : null;
    await writePositions(key, ordered, drop);
    return ordered.map((p) => String(p._id));
  });
}

// Writes 1..n down `ordered` — only the rows whose number changes — and
// clears `drop`'s stale position. All of it or none: inside a transaction
// where the database has them (a replica set, which Atlas always is); a
// standalone server, like the tests' in-memory one, refuses the first write
// of a transaction, so nothing is half-done and it runs as one bulk write.
async function writePositions(key, ordered, drop = null) {
  const ops = ordered
    .map((p, i) => ({ p, at: i + 1 }))
    .filter(({ p, at }) => positionOf(p, key) !== at)
    .map(({ p, at }) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { [`positions.${key}`]: at } } },
    }));
  if (drop) ops.push({ updateOne: { filter: { _id: drop }, update: { $unset: { [`positions.${key}`]: "" } } } });
  if (!ops.length) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => Product.bulkWrite(ops, { session }));
  } catch (err) {
    if (err.code !== 20 && !/replica set|Transaction numbers/i.test(err.message)) throw err;
    await Product.bulkWrite(ops);
  } finally {
    await session.endSession();
  }
}

// A short fingerprint of an order, sent with every list and required back
// with every save: if anyone changed the order or who is in it since the
// list was read, the fingerprint no longer matches and the save is refused
// rather than overwriting their change.
const versionOf = (ids) => crypto.createHash("sha1").update(ids.map(String).join(",")).digest("hex").slice(0, 16);

// Same set of ids, each once, as `current` — the only list a save accepts.
// A filtered or stale subset of a section can never stand in for all of it.
function checkSameMembers(ids, current) {
  if (!Array.isArray(ids) || !ids.every((id) => OBJECT_ID.test(String(id)))) {
    throw ApiError.badRequest("Send the order as a list of product ids");
  }
  if (new Set(ids.map(String)).size !== ids.length) throw ApiError.badRequest("A product appears twice in that order");
  const have = new Set(current.map(String));
  if (ids.length !== current.length || !ids.every((id) => have.has(String(id)))) {
    throw ApiError.conflict("The products in this section changed while you were arranging them. The latest list has been loaded — please arrange it again.", {
      stale: true,
    });
  }
}

const ORDER_FIELDS = "name slug status inStock soldOut media positions isFeatured rating createdAt maxDiscountPct";
const orderRow = (p, i) => ({
  id: String(p._id),
  name: p.name,
  slug: p.slug,
  status: p.status,
  inStock: p.inStock && !p.soldOut,
  image: p.media?.find((m) => m.type !== "video")?.url || "",
  position: i + 1,
});

// The whole of one order, lightest rows only (no variants, one image url),
// for the admin's Reorder view — every member, whatever page or filter the
// product table is on. Sorted exactly as saveOrder checks it, so the
// version always agrees.
async function readOrder(key) {
  await ensureArranged(key);
  const rows = (await Product.find(memberFilter(key)).select(ORDER_FIELDS).lean()).sort(byPosition(key));
  return { key, items: rows.map(orderRow), version: versionOf(rows.map((p) => p._id)) };
}

// Saves a complete new order for one key. Refused (409) when the order or its
// members changed since `version` was read. Positions are absolute, so the
// same request sent twice — a retry after a timeout — lands the same order
// once, not a second move.
function saveOrder(key, ids, version) {
  const filter = memberFilter(key);
  return serial(key, async () => {
    const members = await Product.find(filter).select("positions isFeatured rating createdAt").lean();
    const current = members.sort(byPosition(key));
    if (version !== versionOf(current.map((p) => p._id))) {
      throw ApiError.conflict("Someone else changed this order while you were arranging it. The latest order has been loaded — please arrange it again.", {
        stale: true,
      });
    }
    checkSameMembers(ids, current.map((p) => p._id));
    const byId = new Map(current.map((p) => [String(p._id), p]));
    await writePositions(key, ids.map((id) => byId.get(String(id))));
  });
}

// After a product changes category or status: every order it was in or is now
// in is rewritten — a product that left one (moved, archived) has its place
// there removed and the rest close up; one that joined (created, moved,
// restored from the archive) goes to the end.
function syncProduct(product, keysBefore = []) {
  const keys = new Set([...keysBefore, ...orderKeysOf(product)]);
  return Promise.all([...keys].map((key) => arrange(key, product._id)));
}

// Products saved without going through arrange() (a seed, an import, one
// restored from the archive) have no position yet. One cheap count finds
// them, and they are placed at the end before the key is read.
async function ensureArranged(key) {
  const unplaced = await Product.exists({ ...memberFilter(key), [`positions.${key}`]: { $exists: false } });
  if (unplaced) await arrange(key);
}

module.exports = {
  SECTIONS,
  SECTION_KEYS,
  categoryKey,
  categoryKeyOf,
  orderKeysOf,
  memberFilter,
  storefrontFilter,
  sortFor,
  serial,
  arrange,
  readOrder,
  saveOrder,
  versionOf,
  checkSameMembers,
  orderRow,
  ORDER_FIELDS,
  badgesOf,
  syncProduct,
  ensureArranged,
};
