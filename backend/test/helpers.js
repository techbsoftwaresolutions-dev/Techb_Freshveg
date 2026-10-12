// Shared setup for the API tests: a throwaway in-memory MongoDB with the demo
// seed, the real app on a random port, and the seeded admin and customer
// signed in — the same ground the smoke test (src/seed/smoke.js) stands on.

async function startTestApi() {
  const memory = require("../src/seed/memoryServer");
  await memory.startMemoryMongo();
  const { run: seed } = require("../src/seed/run");
  const app = require("../src/app");
  const config = require("../src/config");
  const log = console.log;
  console.log = () => {}; // the seed is chatty
  try {
    await seed({ keepOpen: true });
  } finally {
    console.log = log;
  }

  // Seeded stores keep real opening hours; a test must not depend on the clock.
  await require("../src/modules/stores/store.model").updateMany({}, {
    $set: {
      "settings.acceptingOrders": true,
      timings: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "00:00", close: "23:59", closed: false })),
    },
  });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}${config.apiPrefix}`;
  const call = async (method, path, { token, body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, ...json };
  };

  const adminToken = (await call("POST", "/auth/staff/login", { body: { phone: "9000000001", password: "admin123" } })).accessToken;
  const supervisorToken = (await call("POST", "/auth/staff/login", { body: { phone: "9000000002", password: "manager123" } })).accessToken;
  const otp = await call("POST", "/auth/otp/request", { body: { phone: "9876543210" } });
  const login = await call("POST", "/auth/otp/verify", { body: { phone: "9876543210", code: otp.devCode } });

  // A COD order of tomatoes and rice (over the minimum order value).
  const tomato = await call("GET", "/storefront/products/tomato");
  const rice = await call("GET", "/storefront/products/india-gate-basmati-rice");
  const cartLines = [
    { id: tomato.variants.find((v) => v.name === "1 KG").id, quantity: 2 },
    { id: rice.variants.find((v) => v.name === "5 KG").id, quantity: 1 },
  ];
  async function placeOrder(extra = {}, { token = login.accessToken, address = login.user.addresses[0].id } = {}) {
    for (const { id, quantity } of cartLines) {
      await call("POST", "/cart/items", { token, body: { variant: id, quantity } });
    }
    const cart = await call("GET", "/cart", { token });
    return call("POST", "/orders", { token, body: { cart: cart.cart.id, address, paymentMethod: "cod", ...extra } });
  }

  async function stop() {
    server.close();
    await require("mongoose").disconnect();
    await memory.stopMemoryMongo();
  }

  return {
    base, call, placeOrder, stop,
    adminToken, supervisorToken,
    customerToken: login.accessToken,
    customer: login.user,
    addressId: login.user.addresses[0].id,
  };
}

module.exports = { startTestApi };
