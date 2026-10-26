const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const LandingSection = require("./landingSection.model");
const Product = require("../catalog/product.model");
const landing = require("./landing.service");
const sections = require("../catalog/sections.service");
const audit = require("../audit/audit.service");

// Admin → Landing Page → Sections. Customers read the result through
// /storefront/home, which applies the same rules per platform.
const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("marketing.view");
const canManage = requirePermission("marketing.manage");

const populate = [
  { path: "source.category", select: "name slug status" },
  { path: "source.products", select: "name slug status media" },
];

// How many products a section would show a shopper right now — the same
// filter the storefront uses — so an empty section is visible as such here.
async function liveCount(section) {
  if (section.type === "curated") {
    const ids = (section.source.products || []).map((p) => p._id || p);
    return Product.countDocuments({ _id: { $in: ids }, status: "active" });
  }
  const key = landing.orderKeyOf(section);
  return key ? Product.countDocuments(sections.storefrontFilter(key)) : 0;
}

// `orderKey` is what the Arrange products view reads and saves.
const withCount = async (section) => ({
  ...section.toJSON(),
  orderKey: landing.orderKeyOf(section),
  liveProducts: await liveCount(section),
});

router.get(
  "/",
  canView,
  asyncHandler(async (_req, res) => {
    await landing.ensureDefaults();
    const rows = await LandingSection.find().sort({ seq: 1, _id: 1 }).populate(populate);
    res.json({
      success: true,
      items: await Promise.all(rows.map(withCount)),
      classifications: sections.SECTIONS,
    });
  })
);

router.post(
  "/",
  canManage,
  asyncHandler(async (req, res) => {
    const section = await landing.createSection(req.body, req.user);
    await audit.record({ req, action: "create", entity: "LandingSection", entityId: section._id, label: section.name });
    const fresh = await LandingSection.findById(section._id).populate(populate);
    res.status(201).json({ success: true, section: await withCount(fresh), message: `"${section.name}" section created` });
  })
);

// Edits only the fields sent, so the Website and Mobile App switches — each
// its own request — never overwrite each other or anything else. An edit that
// changes which products the section shows must say so (confirmSourceChange),
// so a stray save can't quietly repoint a live section.
router.patch(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const section = await LandingSection.findById(req.params.id);
    if (!section) throw ApiError.notFound("Section not found");

    const fields = await landing.clean(req.body, section);
    if (landing.changesSource(section, fields) && req.body.confirmSourceChange !== true) {
      throw ApiError.conflict("Saving this changes which products the section shows. Confirm to go ahead.", {
        needsConfirm: true,
      });
    }

    const before = section.toObject();
    Object.assign(section, fields, { updatedBy: req.user?.id });
    await section.save();

    const position = Number(req.body.position);
    if (Number.isInteger(position) && position >= 1 && position !== section.seq) {
      await landing.arrangeSections(section._id, position);
    }

    await audit.record({
      req, action: "update", entity: "LandingSection", entityId: section._id, label: section.name,
      before: Object.fromEntries(Object.keys(fields).map((k) => [k, before[k]])),
      after: fields,
    });
    const fresh = await LandingSection.findById(section._id).populate(populate);
    res.json({ success: true, section: await withCount(fresh), message: `"${section.name}" saved` });
  })
);

// Moves a section on the landing page; the products inside it don't move.
router.patch(
  "/:id/position",
  canManage,
  asyncHandler(async (req, res) => {
    const section = await LandingSection.findById(req.params.id).select("name");
    if (!section) throw ApiError.notFound("Section not found");
    const position = Number(req.body.position);
    if (!Number.isInteger(position) || position < 1) throw ApiError.badRequest("Enter a position of 1 or more");

    const ordered = await landing.arrangeSections(section._id, position);
    const at = ordered.indexOf(String(section._id)) + 1;
    await audit.record({ req, action: "update", entity: "LandingSection", entityId: section._id, label: section.name, after: { position: at } });
    res.json({ success: true, position: at, message: `"${section.name}" moved to position ${at}` });
  })
);

// Removes the section only — never a product, a category, a classification
// or anyone's place in a product order. The built-in classification sections
// can be switched off instead.
router.delete(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const section = await LandingSection.findById(req.params.id);
    if (!section) throw ApiError.notFound("Section not found");
    if (section.system) {
      throw ApiError.conflict(`${section.name} is built in and can't be deleted — set it to Inactive or hide it instead`);
    }
    await section.deleteOne();
    await landing.arrangeSections();
    await audit.record({ req, action: "delete", entity: "LandingSection", entityId: section._id, label: section.name });
    res.json({ success: true, message: `"${section.name}" section deleted` });
  })
);

module.exports = router;
