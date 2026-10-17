/* eslint-disable no-console */
// End-to-end smoke test against an in-memory MongoDB.
//
// Drives the real HTTP API — same routers, same auth middleware — through a
// whole customer journey: browse, add to cart, apply a coupon, check out, then
// walk the order through picking, delivery and stock deduction.
//
//   npm run smoke

const { startMemoryMongo, stopMemoryMongo } = require("./memoryServer");

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  await startMemoryMongo();

  // Required only after MONGODB_URI is set, because config reads it on load.
  const { run: seed } = require("./run");
  const app = require("../app");
  const config = require("../config");

  console.log("\n=== Seeding ===");
  await seed({ keepOpen: true });

  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}${config.apiPrefix}`;

  const call = async (method, path, { token, body, headers = {} } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, ...json };
  };

  // The seeded stores keep realistic opening hours, which means this suite
  // would start failing every night after closing time — a test that depends
  // on the wall clock is a time bomb. The stores are forced open for the run.
  const StoreModel = require("../modules/stores/store.model");
  await StoreModel.updateMany(
    {},
    {
      $set: {
        "settings.acceptingOrders": true,
        timings: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          open: "00:00",
          close: "23:59",
          closed: false,
        })),
      },
    }
  );

  console.log("\n=== Smoke test ===");

  // ---------------------------------------------------------------- storefront
  section("Storefront (anonymous)");

  const home = await call("GET", "/storefront/home");
  check("home loads", home.success === true, home.error);
  check("five seeded departments on the home screen", home.categories.length === 5, {
    got: home.categories.map((c) => c.name),
  });
  check("merchandising rails are populated", home.rails.length > 0);
  check("live offers are returned", home.offers.length > 0);

  const service = await call("GET", "/storefront/serviceability?pincode=635109");
  check("Hosur pincode is serviceable", service.serviceable === true, service);

  const noService = await call("GET", "/storefront/serviceability?pincode=110001");
  check("unknown pincode is refused", noService.serviceable === false);

  const veg = await call("GET", "/storefront/products?category=fresh-vegetables");
  check("category browse returns products", veg.items.length >= 2, { total: veg.meta?.total });

  // Product.inStock is a rollup written at save time, before any stock is
  // received. If receiving does not walk back up to it, every card on the
  // storefront reads "out of stock" over a full warehouse.
  check(
    "stocked products report as in stock to the storefront",
    veg.items.length > 0 && veg.items.every((p) => p.inStock === true),
    { notInStock: veg.items.filter((p) => !p.inStock).map((p) => p.name) }
  );

  const inStockOnly = await call("GET", "/storefront/products?category=fresh-vegetables&inStock=true");
  check("the inStock filter returns them too", inStockOnly.items.length === veg.items.length, {
    all: veg.items.length,
    filtered: inStockOnly.items.length,
  });

  // Lean queries skip Mongoose's toJSON transform, so a list endpoint can
  // quietly return _id where every other response returns id — which breaks
  // React keys on the website and keyExtractor in the apps.
  check(
    "listed products expose id, not _id",
    veg.items.every((p) => p.id && p._id === undefined),
    { sample: veg.items[0] && Object.keys(veg.items[0]).filter((k) => k === "id" || k === "_id") }
  );
  check(
    "home rails and featured expose id too",
    home.featured.every((p) => p.id && p._id === undefined) &&
      home.rails.every((r) => r.products.every((p) => p.id && p._id === undefined)),
    { featured: home.featured[0] && Object.keys(home.featured[0]).filter((k) => k === "id" || k === "_id") }
  );

  const search = await call("GET", "/storefront/search?q=rice");
  check("search finds basmati", search.items.some((p) => /basmati/i.test(p.name)), {
    got: search.items.map((i) => i.name),
  });

  // A named sort has to reach the database as a sort spec. Passing the mapped
  // spec as paginate's *fallback* looks right and silently does nothing the
  // moment a sort is actually asked for — the raw name is then treated as a
  // field, and rows come back in storage order with no error anywhere.
  const cheapest = await call("GET", "/storefront/products?sort=price_asc&limit=50");
  const ascending = cheapest.items.map((p) => p.priceFrom);
  check(
    "price_asc actually sorts by price",
    ascending.every((v, i) => i === 0 || ascending[i - 1] <= v),
    { prices: ascending }
  );

  const dearest = await call("GET", "/storefront/products?sort=price_desc&limit=50");
  const descending = dearest.items.map((p) => p.priceFrom);
  check(
    "price_desc sorts the other way",
    descending.every((v, i) => i === 0 || descending[i - 1] >= v),
    { prices: descending }
  );

  // Paging has to walk the same ordering, or page 2 repeats page 1's rows.
  const firstPage = await call("GET", "/storefront/products?sort=price_asc&limit=5&page=1");
  const secondPage = await call("GET", "/storefront/products?sort=price_asc&limit=5&page=2");
  const overlap = firstPage.items.filter((a) => secondPage.items.some((b) => b.id === a.id));
  check("paging a sorted list does not repeat rows", overlap.length === 0, {
    repeated: overlap.map((p) => p.name),
  });
  check(
    "page 2 continues where page 1 stopped",
    secondPage.items[0].priceFrom >= firstPage.items[firstPage.items.length - 1].priceFrom,
    {
      lastOfPage1: firstPage.items[firstPage.items.length - 1]?.priceFrom,
      firstOfPage2: secondPage.items[0]?.priceFrom,
    }
  );

  const nonsense = await call("GET", "/storefront/products?sort=; drop database&limit=5");
  check("an unknown sort name falls back instead of reaching the database",
    nonsense.success === true && nonsense.items.length > 0, nonsense.error);

  // A price with no size beside it cannot be compared: ₹155 means nothing
  // until you know it buys 5 kg.
  const carded = await call("GET", "/storefront/products?limit=50");
  check(
    "every card carries the pack size its price refers to",
    carded.items.every((p) => typeof p.packLabel === "string" && p.packLabel.length > 0),
    { missing: carded.items.filter((p) => !p.packLabel).map((p) => p.name) }
  );
  check(
    "rice is priced by its 5 kg pack, not by an abstract unit",
    carded.items.find((p) => /Basmati/.test(p.name))?.packLabel === "5 kg",
    { got: carded.items.find((p) => /Basmati/.test(p.name))?.packLabel }
  );
  // Half a litre is written the way a shelf label writes it.
  check(
    "a fraction of a litre is shown in millilitres",
    carded.items.find((p) => /Amul Gold/.test(p.name))?.packLabel === "500 ml",
    { got: carded.items.find((p) => /Amul Gold/.test(p.name))?.packLabel }
  );

  // ---------------------------------------------- the configurability claim
  section("Configurable catalog (the point of the engine)");

  const riceCat = await call("GET", "/storefront/categories/rice");
  const riceFields = riceCat.filters.map((f) => f.code);
  check(
    "Rice inherits Grocery's fields and adds its own",
    riceFields.includes("grain_length") && riceFields.includes("pack_size"),
    { got: riceFields }
  );

  const vegCat = await call("GET", "/storefront/categories/fresh-vegetables");
  const vegFields = vegCat.filters.map((f) => f.code);
  check(
    "Vegetables get a different field set entirely",
    vegFields.includes("variety") && vegFields.includes("organic") && !vegFields.includes("grain_length"),
    { got: vegFields }
  );

  check(
    "produce inherits perishable + weight-based from its parent",
    vegCat.features.perishable === true && vegCat.features.weightBased === true,
    vegCat.features
  );
  check(
    "grocery is not perishable",
    riceCat.features.perishable === false && riceCat.features.batchTracking === true,
    riceCat.features
  );

  const skinCare = await call("GET", "/storefront/categories/skin-care");
  const skinFilters = skinCare.filters.map((f) => f.code);
  check(
    "Skin Care overrides its parent's variant axis",
    skinFilters.includes("skin_type") && !skinFilters.includes("colour"),
    { got: skinFilters }
  );

  const tomato = await call("GET", "/storefront/products/tomato");
  check("product detail resolves specs from the schema", tomato.specs.length > 0, tomato.specs);
  check("tomato has three pack sizes", tomato.variants.length === 3, { got: tomato.variants.length });
  check(
    "per-store stock is attached to each variant",
    tomato.variants.every((v) => v.availability && typeof v.availability.available === "number")
  );
  // Tomato is merchandised as packs, so it steps a whole pack at a time even
  // though its department says 0.25 — you cannot buy a quarter of a sealed
  // 1 KG pack.
  check(
    "a packaged product steps in whole packs",
    tomato.variants.every((v) => v.stepQty === 1),
    { got: tomato.variants.map((v) => v.stepQty) }
  );

  const loose = await call("GET", "/storefront/products/potato-loose");
  check(
    "a loose product is also carted in whole units",
    loose.variants[0].stepQty === 1 && loose.variants[0].minOrderQty === 1,
    { step: loose.variants[0]?.stepQty, min: loose.variants[0]?.minOrderQty }
  );
  check("cost price never reaches the storefront", tomato.variants.every((v) => v.costPrice === undefined));

  // ---------------------------------------------------------------- auth
  section("Auth");

  const otp = await call("POST", "/auth/otp/request", { body: { phone: "9876543210" } });
  check("OTP issued", otp.success === true && Boolean(otp.devCode), otp.error);

  const login = await call("POST", "/auth/otp/verify", {
    body: { phone: "9876543210", code: otp.devCode },
  });
  check("OTP verified and token issued", Boolean(login.accessToken), login.error);
  const customerToken = login.accessToken;
  const addressId = login.user.addresses[0]?.id || login.user.addresses[0]?._id;

  // Embedded subdocuments must expose `id`, not `_id`: the checkout address
  // picker selects by it, so a raw _id leaves "Place order" permanently
  // disabled with nothing on screen to explain why.
  check(
    "saved addresses expose id, not _id",
    Boolean(login.user.addresses[0]?.id) && login.user.addresses[0]._id === undefined,
    { got: Object.keys(login.user.addresses[0] || {}) }
  );

  const badOtp = await call("POST", "/auth/otp/verify", {
    body: { phone: "9876543210", code: "000000" },
  });
  check("wrong OTP rejected", badOtp.status === 400, badOtp);

  const staff = await call("POST", "/auth/staff/login", {
    body: { phone: "9000000001", password: "admin123" },
  });
  check("staff password login works", Boolean(staff.accessToken), staff.error);
  const adminToken = staff.accessToken;

  const badStaff = await call("POST", "/auth/staff/login", {
    body: { phone: "9000000001", password: "wrong" },
  });
  check("wrong password rejected", badStaff.status === 401);

  const noAuth = await call("GET", "/catalog/products");
  check("admin catalog requires a token", noAuth.status === 401, noAuth);

  const asCustomer = await call("GET", "/catalog/products", { token: customerToken });
  check("a customer cannot read the admin catalog", asCustomer.status === 403, asCustomer);

  // ---------------------------------------------------------------- cart
  section("Cart and pricing");

  const tomato1kg = tomato.variants.find((v) => v.name === "1 KG");
  const riceDetail = await call("GET", "/storefront/products/india-gate-basmati-rice");
  const rice5kg = riceDetail.variants.find((v) => v.name === "5 KG");

  // An empty cart must cost nothing — delivery and packaging charges on zero
  // items show up as a basket total in the storefront header.
  const emptyCart = await call("GET", "/cart", { token: customerToken });
  check(
    "an empty cart costs nothing",
    emptyCart.cart.summary.total === 0 &&
      emptyCart.cart.summary.deliveryCharge === 0 &&
      emptyCart.cart.summary.packagingCharge === 0,
    emptyCart.cart.summary
  );
  check(
    "an empty cart cannot be checked out",
    emptyCart.cart.summary.meetsMinimum === false,
    { meetsMinimum: emptyCart.cart.summary.meetsMinimum }
  );

  let cart = await call("POST", "/cart/items", {
    token: customerToken,
    body: { variant: tomato1kg.id, quantity: 2 },
  });
  check("tomato added to cart", cart.cart?.items.length === 1, cart.error);

  cart = await call("POST", "/cart/items", {
    token: customerToken,
    body: { variant: rice5kg.id, quantity: 1 },
  });
  check("rice added to cart", cart.cart.items.length === 2);

  const autoOffer = cart.cart.offers.applied.find((o) => /vegetable/i.test(o.title));
  check("20%-off-vegetables applied automatically", Boolean(autoOffer), cart.cart.offers.applied);
  check(
    "the discount only touched the vegetable line",
    cart.cart.lines.find((l) => l.name === "Tomato").discount > 0 &&
      cart.cart.lines.find((l) => /Basmati/.test(l.name)).discount === 0,
    cart.cart.lines.map((l) => ({ name: l.name, discount: l.discount }))
  );

  const subtotalCheck =
    cart.cart.summary.subtotal === 2 * tomato1kg.sellingPrice + rice5kg.sellingPrice;
  check("subtotal adds up", subtotalCheck, {
    subtotal: cart.cart.summary.subtotal,
    expected: 2 * tomato1kg.sellingPrice + rice5kg.sellingPrice,
  });

  check(
    "free delivery unlocked above the threshold",
    cart.cart.summary.deliveryFree === true && cart.cart.summary.deliveryCharge === 0,
    cart.cart.summary
  );

  // A packed item rounds to whole packs; the loose one rounds to its quarter.
  const packRound = await call("PATCH", `/cart/items/${tomato1kg.id}`, {
    token: customerToken,
    body: { quantity: 1.3 },
  });
  check(
    "a packed item rounds to a whole pack",
    packRound.cart.items.find((i) => i.variant === tomato1kg.id).quantity === 1,
    { got: packRound.cart.items.find((i) => i.variant === tomato1kg.id)?.quantity }
  );

  const looseVariantId = loose.variants[0].id;
  await call("POST", "/cart/items", { token: customerToken, body: { variant: looseVariantId } });
  const quarter = await call("PATCH", `/cart/items/${looseVariantId}`, {
    token: customerToken,
    body: { quantity: 1.3 },
  });
  check(
    "a loose item snaps to the 0.25 kg step",
    quarter.cart.items.find((i) => i.variant === looseVariantId).quantity === 1.25,
    { got: quarter.cart.items.find((i) => i.variant === looseVariantId)?.quantity }
  );
  await call("DELETE", `/cart/items/${looseVariantId}`, { token: customerToken });

  await call("PATCH", `/cart/items/${tomato1kg.id}`, { token: customerToken, body: { quantity: 2 } });

  const badCoupon = await call("POST", "/cart/coupon", {
    token: customerToken,
    body: { code: "NOPE404" },
  });
  check("unknown coupon rejected with a reason", badCoupon.status === 400, badCoupon);

  const coupon = await call("POST", "/cart/coupon", {
    token: customerToken,
    body: { code: "WEEKEND100" },
  });
  const weekendApplies = [0, 5, 6].includes(new Date().getDay());
  check(
    weekendApplies ? "WEEKEND100 applied" : "WEEKEND100 correctly refused outside its days",
    weekendApplies ? coupon.success === true : coupon.status === 400,
    coupon.error || coupon.cart?.offers?.applied
  );

  const first30 = await call("POST", "/cart/coupon", {
    token: customerToken,
    body: { code: "FIRST30" },
  });
  check("first-order coupon applies", first30.success === true, first30.error);
  check(
    "percentage discount is capped at its maximum",
    first30.cart.offers.applied.find((o) => o.code === "FIRST30").discount <= 15000,
    first30.cart.offers.applied
  );

  const cartId = first30.cart.id;
  const totalBefore = first30.cart.summary.total;
  check("total is a whole number of rupees", totalBefore % 100 === 0, { total: totalBefore });

  // ---------------------------------------------------------------- checkout
  section("Checkout and the order lifecycle");

  const placed = await call("POST", "/orders", {
    token: customerToken,
    body: { cart: cartId, address: addressId, paymentMethod: "cod" },
  });
  check("order placed", placed.success === true, placed.error);
  const orderId = placed.order?.id;
  check("COD order goes straight to confirmed", placed.order?.status === "ORDER_CONFIRMED", {
    got: placed.order?.status,
  });
  check("order total matches the cart", placed.order?.pricing.total === totalBefore, {
    order: placed.order?.pricing.total,
    cart: totalBefore,
  });
  check("a delivery OTP was generated", Boolean(placed.order?.delivery.otp));

  const stockAfterOrder = await call("GET", `/inventory?product=${tomato1kg.product}`, { token: adminToken });
  const tomatoRow = stockAfterOrder.items.find((i) => i.variant.sku === tomato1kg.sku);
  check("checkout reserved stock without removing it", tomatoRow.reserved === 2 && tomatoRow.onHand === 60, {
    onHand: tomatoRow.onHand,
    reserved: tomatoRow.reserved,
  });

  const illegal = await call("POST", `/orders/${orderId}/status`, {
    token: adminToken,
    body: { status: "DELIVERED" },
  });
  check("the state machine blocks an illegal jump", illegal.status === 409, illegal);

  for (const status of ["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"]) {
    const step = await call("POST", `/orders/${orderId}/status`, {
      token: adminToken,
      body: { status },
    });
    check(`advanced to ${status}`, step.success === true, step.error);
  }

  const partners = await call("GET", "/orders/statuses", { token: adminToken });
  check("the status table is exposed to clients", partners.statuses.length === 19, {
    got: partners.statuses.length,
  });

  const User = require("../modules/auth/user.model");
  const partner = await User.findOne({ role: "delivery_partner" });

  const assigned = await call("POST", `/orders/${orderId}/assign`, {
    token: adminToken,
    body: { partner: partner._id.toString() },
  });
  check("delivery boy assigned", assigned.order?.status === "ASSIGNED_TO_DELIVERY", assigned.error);

  const partnerOtp = await call("POST", "/auth/otp/request", {
    body: { phone: partner.phone, role: "delivery_partner" },
  });
  const partnerLogin = await call("POST", "/auth/otp/verify", {
    body: { phone: partner.phone, code: partnerOtp.devCode, role: "delivery_partner" },
  });
  const partnerToken = partnerLogin.accessToken;
  check("delivery boy signs in", Boolean(partnerToken), partnerLogin.error);

  const queue = await call("GET", "/orders/delivery/queue", { token: partnerToken });
  check("the order shows in the partner's queue", queue.orders.length === 1, queue.stats);
  // The partner app navigates to the store first, so the queue has to carry
  // the pickup location — otherwise the app needs a lookup per card.
  check(
    "the queue carries the pickup store for navigation",
    Boolean(queue.orders[0].pickup?.name && queue.orders[0].pickup?.address),
    { pickup: queue.orders[0].pickup }
  );

  await call("POST", `/orders/${orderId}/status`, { token: partnerToken, body: { status: "PICKED_UP" } });
  const out = await call("POST", `/orders/${orderId}/status`, {
    token: partnerToken,
    body: { status: "OUT_FOR_DELIVERY" },
  });
  check("delivery boy moved it out for delivery", out.order?.status === "OUT_FOR_DELIVERY", out.error);

  const wrongOtp = await call("POST", `/orders/${orderId}/deliver`, {
    token: partnerToken,
    body: { otp: "0000" },
  });
  check("delivery refused without the right OTP", wrongOtp.status === 400, wrongOtp);

  const delivered = await call("POST", `/orders/${orderId}/deliver`, {
    token: partnerToken,
    body: { otp: placed.order.delivery.otp, photo: "proof.jpg" },
  });
  check("delivered with OTP", delivered.order?.status === "DELIVERED", delivered.error);
  check("COD marked paid on delivery", delivered.order?.payment.status === "paid");

  const finalStock = await call("GET", `/inventory?product=${tomato1kg.product}`, { token: adminToken });
  const finalRow = finalStock.items.find((i) => i.variant.sku === tomato1kg.sku);
  check("delivery removed the stock and cleared the reservation", finalRow.onHand === 58 && finalRow.reserved === 0, {
    onHand: finalRow.onHand,
    reserved: finalRow.reserved,
  });

  const me = await call("GET", "/auth/me", { token: customerToken });
  check("loyalty points credited on delivery", me.user.loyaltyPoints > 0, {
    points: me.user.loyaltyPoints,
  });

  const tracking = await call("GET", `/orders/${orderId}/track`, { token: customerToken });
  const steps = tracking.tracking.timeline;
  check("tracking timeline has nothing left pending", !steps.some((s) => s.state === "pending"), {
    pending: steps.filter((s) => s.state === "pending").map((s) => s.status),
  });
  check(
    "delivered is the active step",
    steps.find((s) => s.status === "DELIVERED")?.state === "active",
    { got: steps.find((s) => s.status === "DELIVERED")?.state }
  );
  // A cash-on-delivery order never passes through "payment received", so that
  // step must read as skipped rather than as something the customer did.
  check(
    "COD order does not claim payment was received up front",
    steps.find((s) => s.status === "PAYMENT_CONFIRMED")?.state === "skipped",
    { got: steps.find((s) => s.status === "PAYMENT_CONFIRMED")?.state }
  );

  // --- delivery boy's day and history ---
  const stores = await call("GET", "/stores", { token: adminToken });
  const hosur = stores.items.find((st) => st.code === "HSR01");

  const afterQueue = await call("GET", "/orders/delivery/queue", { token: partnerToken });
  check("the delivered run left the queue", afterQueue.orders.length === 0, afterQueue.stats);
  check("delivery counted for today", afterQueue.stats.deliveredToday === 1, afterQueue.stats);
  // Delivery boys are salaried store employees: no per-delivery earnings.
  check("no per-delivery earnings are reported", !("earnings" in afterQueue.stats), afterQueue.stats);
  check(
    "cash-on-delivery money shows as cash to deposit",
    afterQueue.stats.codCollected === placed.order.pricing.total,
    { collected: afterQueue.stats.codCollected, orderTotal: placed.order.pricing.total }
  );

  const history = await call("GET", "/orders/delivery/history", { token: partnerToken });
  check("the run appears in the delivery boy's history", history.items.some((o) => o.id === orderId), {
    got: history.items.map((o) => o.code),
  });

  // ------------------------------------------------- money, ledgers, rewards
  section("Payments, wallet and loyalty");

  const payments = await call("GET", `/payments?search=${placed.order.code}`, { token: adminToken });
  const codPayment = payments.items.find((p) => p.method === "cod");
  check("the delivered COD order recorded a captured payment", codPayment?.status === "captured", {
    got: codPayment?.status,
  });
  check("cash is recorded against the partner who took it", Boolean(codPayment?.codCollectedBy), {
    collectedBy: codPayment?.codCollectedBy,
  });

  const outstanding = await call("GET", "/payments/cod/outstanding", { token: adminToken });
  check(
    "uncollected cash shows as outstanding against the partner",
    outstanding.total === placed.order.pricing.total,
    { outstanding: outstanding.total, expected: placed.order.pricing.total }
  );

  // Delivery credits loyalty through the ledger, not by incrementing the user.
  const meAfter = await call("GET", "/auth/me", { token: customerToken });
  check("loyalty points were earned on delivery", meAfter.user.loyaltyPoints > 0, {
    points: meAfter.user.loyaltyPoints,
  });

  const LoyaltyTxn = require("../modules/loyalty/loyaltyTransaction.model");
  const earnedRows = await LoyaltyTxn.find({ reason: "earned" });
  check(
    "the loyalty ledger explains the balance",
    earnedRows.length > 0 &&
      earnedRows.reduce((sum, r) => sum + r.points, 0) === meAfter.user.loyaltyPoints,
    { ledger: earnedRows.reduce((sum, r) => sum + r.points, 0), balance: meAfter.user.loyaltyPoints }
  );

  // A refund must move money *and* leave a row explaining it.
  const refunded = await call("POST", `/payments/orders/${orderId}/refund`, {
    token: adminToken,
    body: { amount: 5000, reason: "Smoke test partial refund", destination: "wallet" },
  });
  check("a partial refund is accepted", refunded.success === true, refunded.error);

  const walletService = require("../modules/wallet/wallet.service");
  const reconciled = await walletService.reconcile(login.user.id);
  check("the wallet ledger reconciles with the stored balance", reconciled.ok, reconciled);

  // ------------------------------------------------- notifications
  section("Notifications");

  const feed = await call("GET", "/notifications", { token: customerToken });
  check("the customer has an in-app notification feed", feed.items.length > 0, {
    count: feed.items.length,
  });
  check(
    "order milestones were announced",
    feed.items.some((n) => n.event === "DELIVERED") && feed.items.some((n) => n.event === "ORDER_PLACED"),
    { events: feed.items.map((n) => n.event) }
  );
  // A channel with no provider configured must say so rather than claim to
  // have sent something.
  const outForDelivery = feed.items.find((n) => n.event === "OUT_FOR_DELIVERY");
  check(
    "an unconfigured channel reports skipped, not sent",
    outForDelivery?.channels.some((c) => c.channel === "sms" && c.status === "skipped"),
    { channels: outForDelivery?.channels }
  );

  // A campaign names a segment; the server decides who that is. A caller able
  // to hand over its own database filter could address anyone.
  const toEveryone = await call("POST", "/notifications/broadcast", {
    token: adminToken,
    body: { event: "NEW_OFFER", segment: "all", context: { title: "Smoke", body: "Smoke" } },
  });
  check("a campaign to everyone reaches the seeded customers", toEveryone.audience > 0, toEveryone);

  // This customer has exactly one delivered order, so "ordered more than once"
  // must not include them — the segment is resolved, not rubber-stamped.
  const toRepeat = await call("POST", "/notifications/broadcast", {
    token: adminToken,
    body: { event: "NEW_OFFER", segment: "repeat", context: { title: "Smoke", body: "Smoke" } },
  });
  check(
    "a segment narrows the audience rather than being ignored",
    toRepeat.audience < toEveryone.audience,
    { repeat: toRepeat.audience, all: toEveryone.audience }
  );

  const madeUpSegment = await call("POST", "/notifications/broadcast", {
    token: adminToken,
    body: { event: "NEW_OFFER", segment: "everyone-i-like" },
  });
  check("an unknown segment is refused", madeUpSegment.success === false, madeUpSegment);

  // Transactional copy is not a campaign — sending "your order is on the way"
  // to a mailing list is how a shop loses the right to send it at all.
  const notMarketing = await call("POST", "/notifications/broadcast", {
    token: adminToken,
    body: { event: "ORDER_PLACED", segment: "all" },
  });
  check("a transactional template cannot be broadcast", notMarketing.success === false, notMarketing);

  // ------------------------------------------------- reviews
  section("Reviews");

  const pendingReviews = await call("GET", "/reviews/pending", { token: customerToken });
  check("the delivered order is offered for review", pendingReviews.pending.length > 0, {
    pending: pendingReviews.pending.length,
  });

  const reviewProduct = pendingReviews.pending[0]?.items[0];
  const review = await call("POST", "/reviews", {
    token: customerToken,
    body: {
      order: orderId,
      product: reviewProduct?.product,
      productRating: 5,
      deliveryRating: 4,
      packagingRating: 5,
      comment: "Fresh and on time.",
    },
  });
  check("a review can be left on a delivered order", review.success === true, review.error);
  check("it is held for moderation by default", review.review?.status === "pending", {
    status: review.review?.status,
  });

  const unmoderated = await call("GET", `/reviews/product/${reviewProduct?.product}`);
  check("an unmoderated review is not public yet", unmoderated.items.length === 0, {
    visible: unmoderated.items.length,
  });

  await call("POST", `/reviews/${review.review.id}/moderate`, {
    token: adminToken,
    body: { status: "published" },
  });
  const published = await call("GET", `/reviews/product/${reviewProduct?.product}`);
  check("publishing makes it visible", published.items.length === 1, { visible: published.items.length });

  const ratedProduct = await call("GET", `/storefront/products/${tomato.product.slug}`);
  check(
    "the product's rating reflects published reviews",
    ratedProduct.product.rating.count >= 0,
    { rating: ratedProduct.product.rating }
  );

  // A review needs a purchase behind it. The hair clip was never in this
  // order, so reviewing it against this order must be refused.
  const hairClip = await call("GET", "/storefront/products/hair-clip-set");
  const fakeReview = await call("POST", "/reviews", {
    token: customerToken,
    body: { order: orderId, product: hairClip.product.id, productRating: 1 },
  });
  check("reviewing an item you did not buy is refused", fakeReview.status === 400, {
    status: fakeReview.status,
    message: fakeReview.error?.message,
  });

  // ------------------------------------------------- wishlist
  section("Wishlist");

  await call("POST", "/wishlist", { token: customerToken, body: { product: tomato.product.id } });
  const wishlist = await call("GET", "/wishlist", { token: customerToken });
  check("a product can be saved for later", wishlist.items.length === 1, {
    items: wishlist.items.length,
  });

  const contains = await call("GET", `/wishlist/contains/${tomato.product.id}`, { token: customerToken });
  check("the product page can tell it is saved", contains.saved === true);

  // ------------------------------------------------- support
  section("Support");

  const ticket = await call("POST", "/support", {
    token: customerToken,
    body: {
      order: orderId,
      category: "missing_product",
      subject: "One item was missing",
      message: "The milk wasn't in the bag.",
    },
  });
  check("a support ticket can be raised against an order", ticket.success === true, ticket.error);
  check("a missing-item ticket is prioritised", ticket.ticket?.priority === "high", {
    priority: ticket.ticket?.priority,
  });

  const resolved = await call("POST", `/support/${ticket.ticket.id}/resolve`, {
    token: adminToken,
    body: { type: "refund", amount: 3400, note: "Refunded the missing milk" },
  });
  check("resolving with a refund moves the money", resolved.refund?.amount === 3400, {
    refund: resolved.refund?.amount,
  });
  check("the ticket closes with the resolution recorded", resolved.ticket?.status === "resolved", {
    status: resolved.ticket?.status,
  });

  // ------------------------------------------------- delivery ops
  section("Delivery operations");

  const slots = await call("GET", `/delivery/slots?store=${hosur.id}`);
  check("bookable delivery slots are offered", slots.days?.length > 0, {
    days: slots.days?.length,
  });
  check(
    "each slot reports its remaining capacity",
    slots.days?.[0]?.slots?.every((s) => typeof s.remaining === "number"),
    { sample: slots.days?.[0]?.slots?.[0] }
  );

  const deliveryQuote = await call("GET", `/delivery/quote?store=${hosur.id}&pincode=635109&cartValue=50000`);
  check("a delivery quote is returned for a served pincode", deliveryQuote.success === true, deliveryQuote);

  const deliveryReport = await call("GET", "/delivery/report", { token: adminToken });
  check("the delivery report lists completed runs", deliveryReport.items.length > 0, {
    rows: deliveryReport.items.length,
  });
  check(
    "the report breaks the run into pickup and transit time",
    deliveryReport.items.some((r) => r.totalMinutes !== null),
    { sample: deliveryReport.items[0] }
  );

  // ------------------------------------------------- reports & audit
  section("Reports and audit");

  const dashboard = await call("GET", "/reports/dashboard", { token: adminToken });
  check("the dashboard reports today's figures", dashboard.today.orders > 0, dashboard.today);
  check(
    "revenue counts delivered orders only",
    dashboard.today.revenue === placed.order.pricing.total,
    { revenue: dashboard.today.revenue, order: placed.order.pricing.total }
  );

  const salesReport = await call("GET", "/reports/sales", { token: adminToken });
  check("the sales report totals the period", salesReport.totals.orders > 0, salesReport.totals);

  const profitReport = await call("GET", "/reports/profit", { token: adminToken });
  check("profit is costed from cost price", profitReport.revenue > 0 && profitReport.cost > 0, {
    revenue: profitReport.revenue,
    cost: profitReport.cost,
  });

  const auditLog = await call("GET", "/audit", { token: adminToken });
  check("admin actions are written to the audit trail", auditLog.items.length > 0, {
    entries: auditLog.items.length,
  });
  check(
    "an audit entry explains what changed",
    auditLog.items.some((entry) => entry.summary),
    { sample: auditLog.items[0] }
  );

  // ------------------------------------------------- maintenance
  section("Maintenance");

  const schedule = await call("GET", "/maintenance/schedule", { token: adminToken });
  const assetCount = (schedule.overdue?.length || 0) + (schedule.upcoming?.length || 0);
  check("assets have a service schedule", assetCount > 0, {
    overdue: schedule.overdue?.length,
    upcoming: schedule.upcoming?.length,
  });

  const assets = await call("GET", "/maintenance/assets", { token: adminToken });
  const freezer = assets.items.find((a) => a.type === "freezer");
  const job = await call("POST", "/maintenance/requests", {
    token: adminToken,
    body: {
      asset: freezer.id,
      type: "breakdown",
      priority: "critical",
      title: "Not holding temperature",
      labourCost: 80000,
      partsUsed: [{ name: "Thermostat", quantity: 1, unitCost: 120000, total: 120000 }],
    },
  });
  check("a maintenance job can be raised", job.success === true, job.error);
  check("job cost is derived from parts plus labour", job.request?.totalCost === 200000, {
    total: job.request?.totalCost,
  });

  const completed = await call("PATCH", `/maintenance/requests/${job.request.id}`, {
    token: adminToken,
    body: { status: "completed", resolutionNote: "Thermostat replaced" },
  });
  check("completing a job closes it", completed.request?.status === "completed", completed.error);

  const freezerAfter = await call("GET", `/maintenance/assets/${freezer.id}`, { token: adminToken });
  check(
    "completing a service resets the asset's clock and status",
    freezerAfter.asset.status === "operational" &&
      new Date(freezerAfter.asset.nextServiceDue) > new Date(),
    { status: freezerAfter.asset.status, due: freezerAfter.asset.nextServiceDue }
  );
  check("the asset carries its lifetime maintenance cost", freezerAfter.asset.lifetimeMaintenanceCost === 200000, {
    cost: freezerAfter.asset.lifetimeMaintenanceCost,
  });

  // ------------------------------------------------- automated rules
  section("Automated rules");

  const rules = require("../jobs/rules");

  // Build a cart and age it past the reminder threshold.
  await call("POST", "/cart/items", { token: customerToken, body: { variant: rice5kg.id, quantity: 1 } });
  const CartModel = require("../modules/cart/cart.model");
  await CartModel.updateMany(
    { customer: login.user.id, status: "active" },
    { lastActivityAt: new Date(Date.now() - 2 * 3600000), remindersSent: 0 }
  );

  const abandoned = await rules.abandonedCarts();
  check("the abandoned-cart rule nudges a stale cart", abandoned.firstReminders > 0, abandoned);

  // Running it again must not send the same nudge twice.
  const abandonedAgain = await rules.abandonedCarts();
  check("it does not nudge the same cart twice", abandonedAgain.firstReminders === 0, abandonedAgain);

  const settingsCheck = await call("GET", "/settings/public");
  check("clients can read public settings before signing in", settingsCheck.success === true, settingsCheck);

  const movements = await call("GET", `/inventory/movements?variant=${tomato1kg.id}`, { token: adminToken });
  check("every stock change is in the movement log", movements.items.length >= 3, {
    types: movements.items.map((m) => m.type),
  });

  // ------------------------------------------------- returns
  //
  // Last, because a return moves the delivered order out of DELIVERED and the
  // reports above are asserted against it.
  section("Returns");

  const returnable = await call("GET", `/returns/orders/${orderId}/returnable`, {
    token: customerToken,
  });
  check("a delivered order can be assessed for return", returnable.success === true, returnable.error);

  // The two lines sit in different departments, and each department sets its
  // own window: Grocery gives a week, Fruits & Vegetables gives a day. Neither
  // number is written here or anywhere in the code.
  const riceLine = returnable.items?.find((i) => /Basmati/.test(i.name));
  const tomatoLine = returnable.items?.find((i) => /Tomato/.test(i.name));
  check("a returnable category offers the item", riceLine?.eligible === true, riceLine);
  check("the window comes from the category, not the code", riceLine?.windowDays === 7, riceLine);
  check(
    "a perishable department gets its own, shorter window",
    tomatoLine?.windowDays === 1,
    tomatoLine
  );
  // The category has to have actually been consulted. Before the leaf category
  // was snapshotted onto the order line, every item silently fell through to
  // the default window — which looked identical to a policy being applied.
  check(
    "the policy is read off the order line's category, not defaulted",
    riceLine?.byDefault === false && tomatoLine?.byDefault === false,
    { rice: riceLine?.byDefault, tomato: tomatoLine?.byDefault }
  );

  const requested = await call("POST", `/returns/orders/${orderId}/request`, {
    token: customerToken,
    body: { items: [{ orderItem: riceLine.orderItem }], reason: "Packet was torn" },
  });
  check("a return request moves the order, not a parallel object",
    requested.order?.status === "RETURN_REQUESTED", requested.error);

  const returnQueue = await call("GET", "/returns?status=RETURN_REQUESTED", { token: adminToken });
  check("the return appears in the staff queue", returnQueue.items?.some((o) => o.id === orderId), {
    ids: returnQueue.items?.map((o) => o.id),
  });

  const approved = await call("POST", `/returns/orders/${orderId}/approve`, {
    token: adminToken,
    body: { note: "Approved — send the rider" },
  });
  check("staff can approve a return", approved.order?.status === "RETURN_APPROVED", approved.error);

  const stockBefore = await call("GET", `/inventory?variant=${rice5kg.id}`, { token: adminToken });
  const onHandBefore = stockBefore.items?.[0]?.onHand;

  const collected = await call("POST", `/returns/orders/${orderId}/collected`, {
    token: adminToken,
    body: { note: "Collected on the evening run", restock: true },
  });
  check("collecting the goods moves it on", collected.order?.status === "RETURN_PICKED", collected.error);

  const stockAfter = await call("GET", `/inventory?variant=${rice5kg.id}`, { token: adminToken });
  check(
    "restocking a return puts the units back on the shelf",
    stockAfter.items?.[0]?.onHand > onHandBefore,
    { before: onHandBefore, after: stockAfter.items?.[0]?.onHand }
  );

  const returnRefund = await call("POST", `/returns/orders/${orderId}/refund`, {
    token: adminToken,
    body: { reason: "Returned — torn packet", destination: "wallet" },
  });
  check("the refund closes the return", returnRefund.order?.status === "REFUNDED", returnRefund.error);
  // This order has already been refunded twice earlier in the run (a partial
  // payment refund and a support ticket), so the returned line's full value is
  // more than what is left. The refund must stop at what was actually paid —
  // refunding past that is how a shop gives away money it never took.
  check(
    "a return refund is capped at what remains unrefunded",
    returnRefund.refund?.amount > 0 && returnRefund.refund.amount <= riceLine.amount,
    { refunded: returnRefund.refund?.amount, line: riceLine.amount }
  );

  const walletAfterReturn = require("../modules/wallet/wallet.service");
  const reconciledAfterReturn = await walletAfterReturn.reconcile(login.user.id);
  check(
    "the wallet still reconciles after a return refund",
    reconciledAfterReturn.ok,
    reconciledAfterReturn
  );

  // ------------------------------------------------- adding a category live
  section("Adding a new department with no code change");

  const newAttribute = await call("POST", "/catalog/attributes", {
    token: adminToken,
    body: {
      code: "battery_type",
      name: "Battery Type",
      inputType: "select",
      isFilterable: true,
      group: "Electrical",
      options: [
        { value: "aa", label: "AA" },
        { value: "aaa", label: "AAA" },
      ],
    },
  });
  check("new attribute created", newAttribute.success === true, newAttribute.error);

  const newCategory = await call("POST", "/catalog/categories", {
    token: adminToken,
    body: {
      name: "Electricals",
      icon: "🔌",
      features: { returnable: true, fragile: true },
      defaults: { unit: "pcs", taxRatePct: 18, returnWindowDays: 10 },
      attributeBindings: [{ attribute: newAttribute.attribute.id, required: true }],
    },
  });
  check("new department created", newCategory.success === true, newCategory.error);

  const newSchema = await call("GET", `/catalog/categories/${newCategory.category.id}/schema`, {
    token: adminToken,
  });
  check(
    "its form schema is live immediately",
    newSchema.fields.some((f) => f.code === "battery_type" && f.required),
    newSchema.fields
  );

  const newProduct = await call("POST", "/catalog/products", {
    token: adminToken,
    body: {
      name: "Torch Light",
      category: newCategory.category.id,
      status: "active",
      attributes: { battery_type: "aa" },
      variants: [{ mrp: 24900, sellingPrice: 19900, isDefault: true }],
    },
  });
  check("a product in the new department saves", newProduct.success === true, newProduct.error);
  check("category defaults were applied to it", newProduct.product?.taxRatePct === 18, {
    got: newProduct.product?.taxRatePct,
  });

  const invalid = await call("POST", "/catalog/products", {
    token: adminToken,
    body: {
      name: "Broken Torch",
      category: newCategory.category.id,
      attributes: { battery_type: "car-battery" },
      variants: [{ sellingPrice: 100 }],
    },
  });
  check("an invalid attribute value is rejected per-field", invalid.status === 422, invalid);

  // ---------------------------------------------------------------- done
  server.close();
  await stopMemoryMongo();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nSmoke test crashed:", err);
  await stopMemoryMongo().catch(() => {});
  process.exit(1);
});
