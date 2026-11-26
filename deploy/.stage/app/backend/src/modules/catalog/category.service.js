const Category = require("./category.model");
const Product = require("./product.model");
const Variant = require("./variant.model");
const ApiError = require("../../core/ApiError");
const { uniqueSlug } = require("../../core/slugify");

// Moving a category has to drag its whole subtree with it: every descendant's
// ancestors / path / level is derived from its parent's. This walks down from
// the moved node and rewrites them, breadth-first.
async function rebuildSubtree(rootId) {
  const root = await Category.findById(rootId);
  if (!root) return 0;

  let touched = 0;
  const queue = [root];

  while (queue.length) {
    const node = queue.shift();
    const children = await Category.find({ parent: node._id });

    for (const child of children) {
      child.ancestors = [...node.ancestors, node._id];
      child.level = node.level + 1;
      child.path = `${node.path}/${child.slug}`;
      await child.save();
      touched += 1;
      queue.push(child);
    }
  }

  return touched;
}

// Products cache their category chain for subtree browsing, so a move has to
// refresh them too — otherwise a product would stay browsable under the
// category its parent used to sit in.
async function syncProductPaths(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) return 0;

  const path = [...category.ancestors, category._id];
  const result = await Product.updateMany({ category: categoryId }, { categoryPath: path });
  await Variant.updateMany({ category: categoryId }, { categoryPath: path });
  return result.modifiedCount;
}

async function createCategory(payload) {
  const slug = await uniqueSlug(Category, payload.slug || payload.name);

  if (payload.parent) {
    const parentExists = await Category.exists({ _id: payload.parent });
    if (!parentExists) throw ApiError.badRequest("Parent category does not exist");
  }

  const category = new Category({ ...payload, slug });
  await category.recomputeLineage();
  await category.save();
  return category;
}

async function updateCategory(id, payload) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound("Category not found");

  const reparenting =
    payload.parent !== undefined && String(payload.parent || "") !== String(category.parent || "");

  if (reparenting && payload.parent) {
    // A category cannot be moved under itself or under one of its own
    // descendants — that would make the tree a cycle and rebuildSubtree would
    // never terminate.
    if (String(payload.parent) === String(id)) {
      throw ApiError.badRequest("A category cannot be its own parent");
    }
    const target = await Category.findById(payload.parent);
    if (!target) throw ApiError.badRequest("Parent category does not exist");
    if (target.ancestors.map(String).includes(String(id))) {
      throw ApiError.badRequest("Cannot move a category beneath one of its own subcategories");
    }
  }

  const slugChanged = payload.slug && payload.slug !== category.slug;
  if (slugChanged) {
    payload.slug = await uniqueSlug(Category, payload.slug, category._id);
  }

  Object.assign(category, payload);

  if (reparenting || slugChanged) {
    await category.recomputeLineage();
  }
  await category.save();

  if (reparenting || slugChanged) {
    await rebuildSubtree(category._id);
    await syncProductPaths(category._id);
  }

  return category;
}

async function deleteCategory(id) {
  const childCount = await Category.countDocuments({ parent: id });
  if (childCount) {
    throw ApiError.conflict(
      `This category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`
    );
  }

  // Archived products don't block this — they're already off the live
  // catalog (same reason the products list hides them by default), so a
  // category with only dead products under it should still be deletable
  // rather than stuck forever because of something no one can see anymore.
  const productCount = await Product.countDocuments({ category: id, status: { $ne: "archived" } });
  if (productCount) {
    // The admin can't reassign what it can't find — the bare count used to
    // be a dead end. Naming a few of the actual products lets the UI link
    // straight to them instead of sending the admin off to hunt.
    const sample = await Product.find({ category: id, status: { $ne: "archived" } })
      .select("name status")
      .limit(5)
      .lean();
    throw ApiError.conflict(
      `${productCount} product(s) are filed under this category. Reassign them first.`,
      {
        productCount,
        products: sample.map((p) => ({ id: String(p._id), name: p.name, status: p.status })),
      }
    );
  }

  await Category.findByIdAndDelete(id);
  return true;
}

// Nested tree for the admin sidebar and the app's category screen. Built in
// memory from one flat query rather than one query per level.
async function buildTree({ status = "active", rootId = null, maxDepth = 10 } = {}) {
  const filter = {};
  if (status !== "all") filter.status = status;

  const all = await Category.find(filter).sort({ level: 1, seq: 1, name: 1 }).lean({ virtuals: true });

  const byId = new Map(all.map((c) => [String(c._id), { ...c, id: String(c._id), children: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    const parentId = node.parent ? String(node.parent) : null;
    if (parentId && byId.has(parentId)) byId.get(parentId).children.push(node);
    else roots.push(node);
  }

  if (rootId) {
    const subtree = byId.get(String(rootId));
    return subtree ? [subtree] : [];
  }

  const prune = (nodes, depth) =>
    nodes.map((n) => ({ ...n, children: depth >= maxDepth ? [] : prune(n.children, depth + 1) }));

  return prune(roots, 1);
}

// Every category id at or beneath `id` — what a "browse this department" query
// filters on.
async function descendantIds(id) {
  const descendants = await Category.find({ ancestors: id }).select("_id");
  return [id, ...descendants.map((d) => d._id)];
}

// Keeps Category.productCount honest. Called after product writes; cheap
// enough to run inline because it is one aggregation over an indexed field.
async function refreshProductCounts() {
  const counts = await Product.aggregate([
    { $match: { status: "active" } },
    { $unwind: "$categoryPath" },
    { $group: { _id: "$categoryPath", count: { $sum: 1 } } },
  ]);

  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  const all = await Category.find().select("_id productCount");

  const writes = all
    .filter((c) => (byId.get(String(c._id)) || 0) !== c.productCount)
    .map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        update: { productCount: byId.get(String(c._id)) || 0 },
      },
    }));

  if (writes.length) await Category.bulkWrite(writes);
  return writes.length;
}

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  rebuildSubtree,
  syncProductPaths,
  buildTree,
  descendantIds,
  refreshProductCounts,
};
