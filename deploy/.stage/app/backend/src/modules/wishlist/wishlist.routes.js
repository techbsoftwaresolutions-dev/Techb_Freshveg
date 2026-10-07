const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth } = require("../../middleware/auth");

const Wishlist = require("./wishlist.model");
const Product = require("../catalog/product.model");
const Variant = require("../catalog/variant.model");
const inventoryService = require("../inventory/inventory.service");

const router = express.Router();
router.use(requireAuth);

const listFor = async (userId) =>
  (await Wishlist.findOne({ customer: userId })) ||
  (await Wishlist.create({ customer: userId, items: [] }));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const wishlist = await listFor(req.user.id);
    if (!wishlist.items.length) return res.json({ success: true, items: [] });

    const [products, variants] = await Promise.all([
      Product.find({ _id: { $in: wishlist.items.map((i) => i.product) } })
        .select("name slug media priceFrom priceTo mrpFrom inStock unit defaultVariant variantCount status"),
      Variant.find({ _id: { $in: wishlist.items.map((i) => i.variant).filter(Boolean) } }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const items = wishlist.items
      .map((item) => {
        const product = productById.get(String(item.product));
        if (!product || product.status !== "active") return null;
        const variant = item.variant ? variantById.get(String(item.variant)) : null;
        const price = variant?.sellingPrice ?? product.priceFrom;

        return {
          id: item.id,
          product: {
            id: product.id, name: product.name, slug: product.slug,
            media: product.media, unit: product.unit, inStock: product.inStock,
            defaultVariant: product.defaultVariant, variantCount: product.variantCount,
            priceFrom: product.priceFrom, mrpFrom: product.mrpFrom,
          },
          variant: variant
            ? { id: variant.id, name: variant.name, sellingPrice: variant.sellingPrice, mrp: variant.mrp }
            : null,
          addedAt: item.addedAt,
          priceWhenAdded: item.priceWhenAdded,
          // The two reasons to have saved it in the first place.
          priceDropped: item.priceWhenAdded > 0 && price < item.priceWhenAdded,
          priceDrop: Math.max(0, item.priceWhenAdded - price),
          backInStock: product.inStock,
        };
      })
      .filter(Boolean);

    res.json({ success: true, items });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.body.product);
    if (!product) throw ApiError.notFound("Product not found");

    const wishlist = await listFor(req.user.id);
    const already = wishlist.items.find(
      (i) => String(i.product) === String(req.body.product) &&
        String(i.variant || "") === String(req.body.variant || "")
    );
    if (already) return res.json({ success: true, wishlist, alreadySaved: true });

    const variant = req.body.variant ? await Variant.findById(req.body.variant) : null;

    wishlist.items.push({
      product: product._id,
      variant: variant?._id,
      // Snapshotted so a later price drop is measurable rather than guessed.
      priceWhenAdded: variant?.sellingPrice ?? product.priceFrom,
    });
    await wishlist.save();

    res.status(201).json({ success: true, count: wishlist.items.length });
  })
);

router.delete(
  "/:productId",
  asyncHandler(async (req, res) => {
    const wishlist = await listFor(req.user.id);
    wishlist.items = wishlist.items.filter((i) => String(i.product) !== String(req.params.productId));
    await wishlist.save();
    res.json({ success: true, count: wishlist.items.length });
  })
);

// Lets a product page show a filled heart without fetching the whole list.
router.get(
  "/contains/:productId",
  asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOne({
      customer: req.user.id,
      "items.product": req.params.productId,
    }).select("_id");
    res.json({ success: true, saved: Boolean(wishlist) });
  })
);

// Moves a saved item into the cart in one step — the point of a wishlist.
router.post(
  "/:productId/move-to-cart",
  asyncHandler(async (req, res) => {
    const wishlist = await listFor(req.user.id);
    const item = wishlist.items.find((i) => String(i.product) === String(req.params.productId));
    if (!item) throw ApiError.notFound("That item is not in your list");

    const variantId = item.variant || (await Product.findById(item.product))?.defaultVariant;
    if (!variantId) throw ApiError.badRequest("This product has nothing to add");

    const cartService = require("../cart/cart.service");
    const cart = await cartService.getOrCreateCart({
      userId: req.user.id,
      storeId: req.body.store,
    });

    await cartService.addItem(cart, variantId, req.body.quantity ?? null);

    wishlist.items = wishlist.items.filter((i) => String(i.product) !== String(req.params.productId));
    await wishlist.save();

    res.json({ success: true, cart: await cartService.summarise(cart) });
  })
);

module.exports = router;
