const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { optionalAuth, requireAuth } = require("../../middleware/auth");
const cartService = require("./cart.service");
const Cart = require("./cart.model");

const router = express.Router();

// Guests get a cart too — the phone sends an X-Session-Id it generated, and
// signing in merges that cart into the account's.
router.use(optionalAuth);

const ownerOf = (req) => ({
  userId: req.user?.id || null,
  sessionId: req.headers["x-session-id"] || req.query.sessionId || null,
  storeId: req.body.store || req.query.store || req.headers["x-store-id"] || null,
});

// Changes to one cart run one at a time. Two "add" taps that arrive together
// would otherwise both read the cart without the item and both push it — a
// duplicate line — or one save would overwrite the other's quantity. Each
// change waits for the previous one on the same cart to finish responding.
// ponytail: in-process queue — right for a single API process; with several
// instances, switch to Mongoose optimisticConcurrency on the cart and retry.
const queues = new Map();
function oneAtATime(req, res, next) {
  if (req.method === "GET") return next();
  const { userId, sessionId, storeId } = ownerOf(req);
  const key = `${userId || sessionId}|${storeId}`;
  const previous = queues.get(key) || Promise.resolve();
  let done;
  const tail = previous.then(() => new Promise((resolve) => (done = resolve)));
  queues.set(key, tail);
  res.once("close", () => {
    done?.();
    if (queues.get(key) === tail) queues.delete(key);
  });
  previous.then(() => (res.writableEnded || res.destroyed ? done() : next()));
}
router.use(oneAtATime);

const loadCart = asyncHandler(async (req, _res, next) => {
  req.cart = await cartService.getOrCreateCart(ownerOf(req));
  next();
});

router.get(
  "/",
  loadCart,
  asyncHandler(async (req, res) => {
    const summary = await cartService.summarise(req.cart, {
      paymentMethod: req.query.paymentMethod,
    });
    res.json({ success: true, cart: summary });
  })
);

router.post(
  "/items",
  loadCart,
  asyncHandler(async (req, res) => {
    if (!req.body.variant) throw ApiError.badRequest("variant is required");
    await cartService.addItem(req.cart, req.body.variant, req.body.quantity ?? null);
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

router.patch(
  "/items/:variantId",
  loadCart,
  asyncHandler(async (req, res) => {
    await cartService.setQuantity(req.cart, req.params.variantId, Number(req.body.quantity));
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

router.delete(
  "/items/:variantId",
  loadCart,
  asyncHandler(async (req, res) => {
    await cartService.removeItem(req.cart, req.params.variantId);
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

router.post(
  "/items/:variantId/save-for-later",
  loadCart,
  asyncHandler(async (req, res) => {
    const item = req.cart.findItem(req.params.variantId);
    if (!item) throw ApiError.notFound("That item is not in your cart");
    item.savedForLater = req.body.saved !== false;
    await req.cart.save();
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

// Applying a coupon prices the cart with it before storing it, so an invalid
// code is rejected with the reason rather than silently kept.
router.post(
  "/coupon",
  loadCart,
  asyncHandler(async (req, res) => {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) throw ApiError.badRequest("Enter a coupon code");

    const preview = await cartService.summarise(req.cart, { couponCode: code });
    const applied = preview.offers.applied.find((o) => o.code === code);

    if (!applied) {
      const rejection = preview.offers.rejected.find((o) => o.code === code);
      throw ApiError.badRequest(rejection?.reason || "That coupon is not valid for this cart", {
        code,
        shortfall: rejection?.shortfall,
      });
    }

    req.cart.couponCode = code;
    await req.cart.save();
    res.json({ success: true, cart: preview });
  })
);

router.delete(
  "/coupon",
  loadCart,
  asyncHandler(async (req, res) => {
    req.cart.couponCode = "";
    await req.cart.save();
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

// How much wallet balance / how many loyalty points to put against this order.
// The pricing service caps both at the balance actually held.
router.post(
  "/credits",
  requireAuth,
  loadCart,
  asyncHandler(async (req, res) => {
    if (req.body.wallet !== undefined) req.cart.walletRequested = Math.max(0, Number(req.body.wallet) || 0);
    if (req.body.loyaltyPoints !== undefined) {
      req.cart.loyaltyPointsRequested = Math.max(0, Number(req.body.loyaltyPoints) || 0);
    }
    await req.cart.save();
    const summary = await cartService.summarise(req.cart);
    res.json({ success: true, cart: summary });
  })
);

router.post(
  "/merge",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = req.headers["x-session-id"] || req.body.sessionId;
    const cart = await cartService.mergeGuestCart(sessionId, req.user.id, req.body.store);
    const target = cart || (await cartService.getOrCreateCart(ownerOf(req)));
    res.json({ success: true, cart: await cartService.summarise(target) });
  })
);

router.delete(
  "/",
  loadCart,
  asyncHandler(async (req, res) => {
    req.cart.items = [];
    req.cart.couponCode = "";
    await req.cart.save();
    res.json({ success: true, cart: await cartService.summarise(req.cart) });
  })
);

module.exports = router;
