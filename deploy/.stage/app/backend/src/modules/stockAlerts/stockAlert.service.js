const StockAlert = require("./stockAlert.model");
const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const notificationService = require("../notifications/notification.service");

// Turns waiting alerts whose item is in stock again into "ready" ones and tells
// each customer once (push / in-app / WhatsApp, per the BACK_IN_STOCK template
// and their preferences). `filter` narrows the sweep, e.g. to one customer.
async function sweep(filter = {}, { limit = 500 } = {}) {
  const waiting = await StockAlert.find({ status: "waiting", ...filter }).limit(limit);
  if (!waiting.length) return { checked: 0, ready: 0 };

  const variantIds = [...new Set(waiting.map((a) => String(a.variant)))];
  const variants = await Variant.find({ _id: { $in: variantIds } }).select("inStock product status");
  const productIds = [...new Set(variants.map((v) => String(v.product)))];
  const products = await Product.find({ _id: { $in: productIds } }).select("name slug inStock soldOut status");
  const variantById = new Map(variants.map((v) => [String(v._id), v]));
  const productById = new Map(products.map((p) => [String(p._id), p]));

  let ready = 0;
  for (const alert of waiting) {
    const variant = variantById.get(String(alert.variant));
    const product = productById.get(String(alert.product));
    if (!variant || !product) continue;
    const available =
      variant.inStock && variant.status === "active" && product.status === "active" && !product.soldOut;
    if (!available) continue;

    // Flip first, so two sweeps running together can't both send the message.
    const flipped = await StockAlert.findOneAndUpdate(
      { _id: alert._id, status: "waiting" },
      { status: "ready", readyAt: new Date() },
      { new: true }
    );
    if (!flipped) continue;
    ready += 1;
    notificationService
      .notify(alert.customer, "BACK_IN_STOCK", { product: product.name, slug: product.slug })
      .catch(() => {});
  }
  return { checked: waiting.length, ready };
}

module.exports = { sweep };
