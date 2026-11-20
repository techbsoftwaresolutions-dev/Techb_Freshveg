const { AsyncLocalStorage } = require("async_hooks");

// Where the shopper says they are (pincode + named area). The apps send it as
// headers on every request; the cart pricing reads it from here so every route
// that prices a cart — cart, checkout, order — sees the same area without each
// one passing it along.
const storage = new AsyncLocalStorage();

function middleware(req, _res, next) {
  const clean = (v) => String(v || "").trim().slice(0, 60);
  let area = clean(req.headers["x-delivery-area"]);
  try { area = decodeURIComponent(area); } catch { /* keep raw */ }
  storage.run({ area, pincode: clean(req.headers["x-delivery-pincode"]) }, next);
}

const current = () => storage.getStore() || { area: "", pincode: "" };

module.exports = { middleware, current };
