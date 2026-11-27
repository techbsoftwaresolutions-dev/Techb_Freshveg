const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { slugify, uniqueSlug } = require("../../core/slugify");
const { requireAuth, requirePermission } = require("../../middleware/auth");
const { cacheResponse } = require("../../core/storefrontCache");

const Post = require("./post.model");
const audit = require("../audit/audit.service");

const router = express.Router();

// ---- Public (the website) --------------------------------------------------
// Only published posts whose publish time has come. Never a draft, never a body in the list.

const live = () => ({ status: "published", publishedAt: { $lte: new Date() } });
const LIST_FIELDS = "title slug excerpt coverImage coverAlt category tags lang authorName publishedAt readingMinutes";

// Every category with how many live posts it has (0 included), and the total number of live posts.
router.get(
  "/public/categories",
  cacheResponse(30),
  asyncHandler(async (_req, res) => {
    const rows = await Post.aggregate([
      { $match: { ...live(), category: { $ne: "" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const counts = new Map(rows.map((r) => [r._id, r.count]));
    const total = await Post.countDocuments(live());
    res.json({ success: true, total, categories: Post.CATEGORIES.map((name) => ({ name, count: counts.get(name) || 0 })) });
  })
);

router.get(
  "/public",
  cacheResponse(30),
  asyncHandler(async (req, res) => {
    const filter = live();
    if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
    if (req.query.category) filter.category = String(req.query.category);
    const result = await paginate(Post, filter, { ...req.query, limit: Math.min(Number(req.query.limit) || 12, 50) }, {
      defaultSort: { publishedAt: -1 },
      select: LIST_FIELDS,
      lean: true,
    });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/public/:slug",
  cacheResponse(30),
  asyncHandler(async (req, res) => {
    const post = await Post.findOne({ slug: String(req.params.slug).toLowerCase(), ...live() }).lean();
    if (!post) throw ApiError.notFound("Post not found");

    // Related: the same category first, then the latest other posts to fill the row of three.
    const others = { ...live(), _id: { $ne: post._id } };
    const fetch = (filter, n) => Post.find(filter).sort({ publishedAt: -1 }).limit(n).select(LIST_FIELDS).lean();
    let more = post.category ? await fetch({ ...others, category: post.category }, 3) : [];
    if (more.length < 3) {
      const filler = await fetch({ ...others, _id: { $nin: [post._id, ...more.map((m) => m._id)] } }, 3 - more.length);
      more = [...more, ...filler];
    }
    const shape = (p) => ({ ...p, id: String(p._id), _id: undefined, __v: undefined });
    res.json({ success: true, post: shape(post), more: more.map(shape) });
  })
);

// ---- Staff (the admin) -----------------------------------------------------

router.use(requireAuth);

// The choices for the admin's Category dropdown.
router.get("/categories", requirePermission("marketing.view"), (_req, res) => res.json({ success: true, categories: Post.CATEGORIES }));

// Only the fields staff may set; counters and ownership are not editable.
function clean(input, { partial = false } = {}) {
  const out = {};
  const text = (key) => {
    if (input[key] !== undefined) out[key] = String(input[key] ?? "").trim();
  };
  ["title", "excerpt", "body", "coverImage", "coverAlt", "authorName"].forEach(text);
  if (input.category !== undefined) out.category = Post.CATEGORIES.includes(input.category) ? input.category : "";
  if (input.lang !== undefined) out.lang = input.lang === "ta" ? "ta" : "en";
  if (input.status !== undefined) out.status = input.status === "published" ? "published" : "draft";
  if (input.publishedAt !== undefined) out.publishedAt = input.publishedAt ? new Date(input.publishedAt) : undefined;
  if (input.tags !== undefined) {
    const tags = (Array.isArray(input.tags) ? input.tags : String(input.tags).split(","))
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    out.tags = [...new Set(tags)].slice(0, 10);
  }
  if (input.seo !== undefined) {
    out.seo = { title: String(input.seo?.title || "").trim(), description: String(input.seo?.description || "").trim() };
  }
  if (!partial && !out.title) throw ApiError.badRequest("A post needs a title");
  if (out.publishedAt && Number.isNaN(out.publishedAt.getTime())) throw ApiError.badRequest("Invalid publish date");
  return out;
}

router.get(
  "/",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q)), "i");
    const result = await paginate(Post, filter, req.query, {
      defaultSort: { updatedAt: -1 },
      select: "title slug excerpt coverImage category tags lang status publishedAt readingMinutes updatedAt",
    });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/:id",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");
    res.json({ success: true, post });
  })
);

router.post(
  "/",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const data = clean(req.body);
    // A Tamil title has no letters to make an address from: the slug can be typed by hand, and if it
    // is not, a short neutral one is made (post-xxxx) rather than a bare "item".
    const wanted = req.body.slug || data.title;
    const slug = await uniqueSlug(Post, slugify(wanted) ? wanted : `post-${Date.now().toString(36)}`);
    const post = await Post.create({
      ...data,
      slug,
      authorName: data.authorName || req.user.name,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    await audit.record({ req, action: "create", entity: "Post", entityId: post._id, label: post.title });
    res.status(201).json({ success: true, post });
  })
);

router.patch(
  "/:id",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");

    const before = audit.snapshot(post);
    Object.assign(post, clean(req.body, { partial: true }), { updatedBy: req.user.id });
    if (req.body.slug && req.body.slug !== post.slug) post.slug = await uniqueSlug(Post, req.body.slug, post._id);
    await post.save();

    await audit.record({
      req, action: "update", entity: "Post", entityId: post._id,
      label: post.title, before, after: audit.snapshot(post),
    });
    res.json({ success: true, post });
  })
);

router.delete(
  "/:id",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");
    const before = audit.snapshot(post);
    await post.deleteOne();
    await audit.record({ req, action: "delete", entity: "Post", entityId: post._id, label: post.title, before, after: null });
    res.json({ success: true, deleted: post.id });
  })
);

module.exports = router;
