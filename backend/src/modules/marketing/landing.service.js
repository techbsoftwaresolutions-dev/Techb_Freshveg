const LandingSection = require("./landingSection.model");
const Category = require("../catalog/category.model");
const Product = require("../catalog/product.model");
const sections = require("../catalog/sections.service");
const ApiError = require("../../core/ApiError");
const { escapeRegex } = require("../../core/query");
const { uniqueSlug, slugify } = require("../../core/slugify");

const QUEUE = "landing-sections";
const MAX_CURATED = 50;
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));

// The order a section's products follow: a catalog order (a category's or a
// classification's, shared with the Products page), or "curated:<id>" — a
// curated section's own hand-picked list.
function orderKeyOf(section) {
  const category = section.source?.category?._id || section.source?.category;
  if (section.type === "category" && category) return sections.categoryKey(category);
  if (section.type === "classification") return section.source?.classification || null;
  if (section.type === "curated") return `curated:${section._id || section.id}`;
  return null;
}

const curatedId = (key) => {
  const id = String(key).slice("curated:".length);
  if (!isId(id)) throw ApiError.badRequest(`Unknown section "${key}"`);
  return id;
};

// A curated section's picks in their saved order, in the same light rows and
// with the same version fingerprint as a catalog order.
async function readCuratedOrder(key) {
  const section = await LandingSection.findById(curatedId(key)).select("source.products");
  if (!section) throw ApiError.notFound("Section not found");
  const ids = section.source.products.map(String);
  const rows = await Product.find({ _id: { $in: ids } }).select(sections.ORDER_FIELDS).lean();
  const byId = new Map(rows.map((p) => [String(p._id), p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return { key, items: ordered.map(sections.orderRow), version: sections.versionOf(ids) };
}

// Swaps the whole list in one conditional write: it only lands if the picks
// are still exactly what `version` was read from, so a concurrent edit (or
// a section form save) is never overwritten.
async function saveCuratedOrder(key, ids, version) {
  const section = await LandingSection.findById(curatedId(key)).select("source.products");
  if (!section) throw ApiError.notFound("Section not found");
  const current = section.source.products;
  const stale = () =>
    ApiError.conflict("Someone else changed this section while you were arranging it. The latest order has been loaded — please arrange it again.", {
      stale: true,
    });
  if (version !== sections.versionOf(current)) throw stale();
  sections.checkSameMembers(ids, current);
  const { matchedCount } = await LandingSection.updateOne(
    { _id: section._id, "source.products": current },
    { $set: { "source.products": ids } }
  );
  if (!matchedCount) throw stale();
}

// Every order — catalog or curated — is read and saved through these two.
const readAnyOrder = (key) => (String(key).startsWith("curated:") ? readCuratedOrder(key) : sections.readOrder(key));
const saveAnyOrder = (key, ids, version) =>
  String(key).startsWith("curated:") ? saveCuratedOrder(key, ids, version) : sections.saveOrder(key, ids, version);

// Before sections were configurable, the landing page was code: a Best
// Sellers row (the featured products), then one rail per top-level department
// in the nav. The first time sections are read, that page is written out as
// rows in the same order, and the featured products become Best Seller's
// members — so switching over changes nothing a shopper sees until the admin
// does. Runs once: after that the collection is never empty, because the
// three classification sections can't be deleted.
function ensureDefaults() {
  return sections.serial(QUEUE, async () => {
    if (await LandingSection.exists({})) return;

    if (!(await Product.exists({ sections: "best_seller" }))) {
      const featured = await Product.find({ status: "active", isFeatured: true }).select("_id").limit(12);
      if (featured.length) {
        await Product.updateMany({ _id: { $in: featured.map((p) => p._id) } }, { $addToSet: { sections: "best_seller" } });
        await sections.arrange("best_seller");
      }
    }

    const departments = await Category.find({ status: "active", level: 0, showInNav: true }).sort({ seq: 1 }).limit(6);
    const rows = [
      ...sections.SECTIONS.map((s) => ({
        slug: slugify(s.label),
        name: s.label,
        type: "classification",
        source: { classification: s.key },
        system: true,
      })),
      ...departments.map((c) => ({ slug: c.slug, name: c.name, type: "category", source: { category: c._id } })),
    ];
    await LandingSection.insertMany(rows.map((row, i) => ({ ...row, seq: i + 1 })));
  });
}

// Rewrites every section's place as 1..n, moving `id` to `position` first
// (clamped to the list) when both are given. Same idea as product ordering:
// renumbering the whole list each time leaves no gap or duplicate behind.
function arrangeSections(id = null, position = null) {
  return sections.serial(QUEUE, async () => {
    const all = await LandingSection.find().select("seq createdAt").sort({ seq: 1, createdAt: 1, _id: 1 });
    if (id && position !== null) {
      const from = all.findIndex((s) => String(s._id) === String(id));
      if (from >= 0) {
        const [moving] = all.splice(from, 1);
        const to = Math.min(Math.max(1, Math.trunc(position)), all.length + 1) - 1;
        all.splice(to, 0, moving);
      }
    }
    const ops = all
      .map((s, i) => ({ s, seq: i + 1 }))
      .filter(({ s, seq }) => s.seq !== seq)
      .map(({ s, seq }) => ({ updateOne: { filter: { _id: s._id }, update: { $set: { seq } } } }));
    if (ops.length) await LandingSection.bulkWrite(ops, { ordered: false });
    return all.map((s) => String(s._id));
  });
}

// Checks a create or edit against the section it would produce. `existing`
// is the saved section on an edit; only the fields sent are changed, the rest
// are kept as they are. Returns just the fields to write.
async function clean(body, existing = null) {
  const out = {};
  const fail = (message) => {
    throw ApiError.unprocessable(message);
  };

  if (body.name !== undefined || !existing) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) fail("Give the section a name");
    if (name.length > 60) fail("Keep the section name to 60 characters");
    const clash = await LandingSection.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      ...(existing ? { _id: { $ne: existing._id } } : {}),
    });
    if (clash) throw ApiError.conflict(`There is already a section called "${clash.name}"`);
    out.name = name;
  }

  if (body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    if (description.length > 200) fail("Keep the description to 200 characters");
    out.description = description;
  }

  for (const flag of ["showOnWebsite", "showOnApp"]) {
    if (body[flag] === undefined) continue;
    if (typeof body[flag] !== "boolean") fail(`${flag} must be on or off`);
    out[flag] = body[flag];
  }
  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status)) fail("Status is active or inactive");
    out.status = body.status;
  }

  const type = body.type ?? existing?.type;
  if (!["category", "classification", "curated"].includes(type)) fail("Pick a section type");
  if (existing?.system && type !== existing.type) {
    fail(`${existing.name} is a built-in section — its type can't change`);
  }
  if (body.type !== undefined) out.type = type;

  // The source that matters for the type must be valid whether or not it was
  // sent — a type change can't leave a section pointing at nothing.
  const source = { ...(existing?.source?.toObject?.() || existing?.source || {}), ...(body.source || {}) };
  if (type === "category") {
    if (!isId(source.category)) fail("Pick the category this section shows");
    const category = await Category.findById(source.category).select("_id");
    if (!category) fail("That category no longer exists");
    source.category = category._id;
  } else if (type === "classification") {
    if (!sections.SECTION_KEYS.includes(source.classification)) fail("Pick the classification this section shows");
    if (existing?.system && source.classification !== existing.source.classification) {
      fail(`${existing.name} is a built-in section — it always shows its own classification`);
    }
  } else {
    const ids = [...new Set((source.products || []).map(String))];
    if (!ids.length) fail("Pick at least one product for this section");
    if (ids.length > MAX_CURATED) fail(`A curated section can hold up to ${MAX_CURATED} products`);
    if (!ids.every(isId)) fail("Some of the chosen products aren't valid");
    const found = await Product.countDocuments({ _id: { $in: ids }, status: { $ne: "archived" } });
    if (found !== ids.length) fail("Some of the chosen products no longer exist — remove them and save again");
    source.products = ids;
  }
  if (body.source !== undefined || body.type !== undefined || !existing) {
    out.source = {
      category: source.category || null,
      classification: source.classification || null,
      products: source.products || [],
    };
  }

  return out;
}

// True when an edit changes which products a section shows — the admin is
// asked to confirm that before it is saved.
function changesSource(existing, next) {
  if (next.type && next.type !== existing.type) return true;
  if (!next.source) return false;
  const was = existing.source;
  if (existing.type === "category") return String(was.category) !== String(next.source.category);
  if (existing.type === "classification") return was.classification !== next.source.classification;
  return (was.products || []).map(String).join() !== next.source.products.map(String).join();
}

async function createSection(body, actor = null) {
  await ensureDefaults();
  const fields = await clean(body);
  const section = await LandingSection.create({
    ...fields,
    slug: await uniqueSlug(LandingSection, fields.name),
    seq: Number.MAX_SAFE_INTEGER, // placed by arrangeSections below
    createdBy: actor?.id,
  });
  const position = Number(body.position);
  await arrangeSections(section._id, Number.isInteger(position) && position >= 1 ? position : Number.MAX_SAFE_INTEGER);
  return LandingSection.findById(section._id);
}

module.exports = {
  ensureDefaults,
  arrangeSections,
  clean,
  changesSource,
  createSection,
  orderKeyOf,
  readAnyOrder,
  saveAnyOrder,
  MAX_CURATED,
};
