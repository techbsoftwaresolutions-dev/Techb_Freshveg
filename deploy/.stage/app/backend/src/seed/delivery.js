/* eslint-disable no-console */
// Development fixtures for the delivery app (delivery-app/): riders, and the
// test customer's orders parked at each stage of a run, all made through the
// real order services so stock, payments and timelines are what production
// would produce.
//
//   npm run seed:delivery:dev                 add whatever is missing
//   npm run seed:delivery:clean -- --yes      cancel and remove the fixtures
//
// Safe to run again: riders are matched by phone, orders by a tag in their
// customer note, and nothing that exists is changed — a re-run tops up, it
// never rewinds an order a tester has moved on. The base catalog (npm run
// seed) is seeded first when it is missing. Like every seed, it refuses any
// database that is not plainly a development one (seed/guard.js).
//
// Riders sign in with an OTP; outside production the code is shown on the
// delivery app's screen (config.otpOnScreen), so no password exists to leak.

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { assertDevDatabase } = require("./guard");

const User = require("../modules/auth/user.model");
const Store = require("../modules/stores/store.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Order = require("../modules/orders/order.model");
const Payment = require("../modules/payments/payment.model");
const cartService = require("../modules/cart/cart.service");
const orderService = require("../modules/orders/order.service");
const { canTransition } = require("../modules/orders/orderStatus");

const STORE_CODE = "HSR01";
// The fixtures' own customer, so seeding never touches the main test
// customer's (9876543210) cart or order history.
const CUSTOMER = {
  name: "Delivery Test Customer",
  phone: "9876500010",
  address: {
    label: "Home",
    contactName: "Delivery Test Customer",
    contactPhone: "9876500010",
    line1: "45, Gandhi Nagar",
    landmark: "Near the bus stand",
    city: "Hosur",
    state: "Tamil Nadu",
    pincode: "635109",
    isDefault: true,
  },
};
const TAG = "[dev-seed:delivery]";

// Placeholder numbers in the seed's own 9000000xxx range — never real people.
const RIDERS = [
  { key: "kumar", name: "Kumar (Delivery)", phone: "9000000003", status: "active" },
  { key: "ravi", name: "Ravi (Delivery)", phone: "9000000004", status: "active" },
  // Deactivated in admin: must be refused at sign-in.
  { key: "inactive", name: "Inactive Rider (dev)", phone: "9000000005", status: "blocked" },
];

// One order per stage a rider can meet, plus one waiting for an admin to assign.
const ORDERS = [
  { key: "ready", stage: "READY_FOR_PICKUP", rider: null, note: "waiting for an admin to assign it" },
  { key: "kumar-assigned", stage: "ASSIGNED_TO_DELIVERY", rider: "kumar", note: "Kumar: go to the store" },
  { key: "kumar-out", stage: "OUT_FOR_DELIVERY", rider: "kumar", note: "Kumar: on the way" },
  { key: "kumar-arrived", stage: "ARRIVED", rider: "kumar", note: "Kumar: at the door, needs the handover code" },
  { key: "kumar-delivered", stage: "DELIVERED", rider: "kumar", note: "Kumar: delivered today (history, cash to hand in)" },
  { key: "ravi-assigned", stage: "ASSIGNED_TO_DELIVERY", rider: "ravi", note: "Ravi's — Kumar must not see it" },
];

// What goes in each order's bag: over the store's minimum, under its COD cap.
const BASKET = [
  { product: "tomato", variant: "1 KG", quantity: 2 },
  { product: "india-gate-basmati-rice", variant: "5 KG", quantity: 1 },
];

const STORE_STEPS = ["ORDER_CONFIRMED", "ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"];
const RIDER_STEPS = ["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];

const tagFor = (key) => `${TAG} ${key}`;

async function ensureBaseCatalog() {
  if (await Store.exists({ code: STORE_CODE })) return;
  console.log(`  no store ${STORE_CODE} — running the base seed first`);
  const { run } = require("./run");
  await run({ keepOpen: true });
}

async function ensureCustomer(log) {
  let customer = await User.findOne({ phone: CUSTOMER.phone, role: "customer" });
  if (customer) {
    log.skipped.push(`customer ${CUSTOMER.phone}`);
  } else {
    customer = await User.create({
      name: CUSTOMER.name,
      phone: CUSTOMER.phone,
      role: "customer",
      status: "active",
      referralCode: `DEVDLV${CUSTOMER.phone.slice(-4)}`,
      addresses: [CUSTOMER.address],
    });
    log.created.push(`customer ${CUSTOMER.phone}`);
  }
  return customer;
}

async function upsertRiders(log) {
  const byKey = {};
  for (const rider of RIDERS) {
    let user = await User.findOne({ phone: rider.phone, role: "delivery_partner" });
    if (user) {
      log.skipped.push(`rider ${rider.phone}`);
    } else {
      user = await User.create({ name: rider.name, phone: rider.phone, role: "delivery_partner", status: rider.status });
      log.created.push(`rider ${rider.phone} (${rider.status})`);
    }
    byKey[rider.key] = user;
  }
  return byKey;
}

async function basketVariants() {
  const lines = [];
  for (const line of BASKET) {
    const product = await Product.findOne({ slug: line.product }).select("_id");
    const variant = product && (await Variant.findOne({ product: product._id, name: line.variant }).select("_id"));
    if (!variant) throw new Error(`The base catalog has no ${line.product} ${line.variant} — run npm run seed`);
    lines.push({ variant: variant._id, quantity: line.quantity });
  }
  return lines;
}

// Fixtures are not shoppers: they are placed whatever the time of day. Only
// this process's copy of the store is treated as open; nothing about the
// store is saved.
async function placeFixtureOrder({ customer, store, lines, tag }) {
  const cart = await cartService.getOrCreateCart({ userId: customer._id, storeId: store._id });
  cart.items = [];
  await cart.save();
  for (const line of lines) await cartService.addItem(cart, line.variant, line.quantity);

  const isOpenNow = Store.prototype.isOpenNow;
  Store.prototype.isOpenNow = () => true;
  try {
    return await orderService.placeOrder({
      cartId: cart._id,
      userId: customer._id,
      addressId: customer.defaultAddress()?._id,
      paymentMethod: "cod",
      note: tag,
      source: "app",
    });
  } finally {
    Store.prototype.isOpenNow = isOpenNow;
  }
}

// Walks an order forward through the state machine, as the store and the
// rider would, until it reaches `stage`.
async function advance(order, stage, { admin, rider }) {
  const adminActor = { id: admin.id, name: "Dev seed", role: "admin" };
  for (const to of STORE_STEPS) {
    if (order.status === stage) return order;
    if (canTransition(order.status, to)) await orderService.transition(order, to, adminActor, "Dev seed");
  }
  if (order.status === stage || !rider) return order;

  await orderService.assignDeliveryPartner(order, rider.id, adminActor);
  const riderActor = { id: rider.id, name: rider.name, role: "delivery_partner" };
  for (const to of RIDER_STEPS) {
    if (order.status === stage) return order;
    await orderService.transition(order, to, riderActor);
  }
  if (stage === "DELIVERED") await orderService.completeDelivery(order, { otp: order.delivery.otp }, riderActor);
  return order;
}

async function seedDelivery() {
  const log = { created: [], skipped: [] };

  await ensureBaseCatalog();
  const [store, admin] = await Promise.all([
    Store.findOne({ code: STORE_CODE }),
    User.findOne({ role: { $in: ["admin", "super_admin"] }, status: "active" }),
  ]);
  if (!admin) throw new Error("No active admin account — run npm run seed");

  const customer = await ensureCustomer(log);
  const riders = await upsertRiders(log);
  const lines = await basketVariants();

  const orders = [];
  for (const fixture of ORDERS) {
    const tag = tagFor(fixture.key);
    let order = await Order.findOne({ customerNote: tag });
    if (order) {
      log.skipped.push(`order ${fixture.key} (${order.code}, now ${order.status})`);
    } else {
      order = await placeFixtureOrder({ customer, store, lines, tag });
      await advance(order, fixture.stage, { admin, rider: riders[fixture.rider] });
      log.created.push(`order ${fixture.key} (${order.code}, ${order.status})`);
    }
    orders.push({ fixture, order });
  }

  return { log, riders, customer, orders };
}

// Cancels the open fixture orders (which releases their stock through the
// normal cancellation path), then removes every fixture order and its payment
// rows. The rider and customer accounts stay, so a re-seed signs in as before.
async function cleanDelivery() {
  const fixtures = await Order.find({ customerNote: { $regex: `^${TAG.replace(/[[\]]/g, "\\$&")}` } });
  const admin = await User.findOne({ role: { $in: ["admin", "super_admin"] }, status: "active" });
  for (const order of fixtures) {
    if (canTransition(order.status, "CANCELLED")) {
      await orderService.transition(order, "CANCELLED", { id: admin?.id, name: "Dev seed", role: "admin" }, "Dev seed clean-up");
    }
  }
  const ids = fixtures.map((order) => order._id);
  const payments = await Payment.deleteMany({ order: { $in: ids } });
  const removed = await Order.deleteMany({ _id: { $in: ids } });
  return { orders: removed.deletedCount, payments: payments.deletedCount };
}

function printSummary({ log, riders, orders }) {
  for (const line of log.created) console.log(`  created  ${line}`);
  for (const line of log.skipped) console.log(`  exists   ${line}`);

  console.log("\nDelivery app sign-in (OTP — the code shows on screen outside production):");
  for (const rider of RIDERS) {
    console.log(`  ${rider.phone}  ${riders[rider.key].name}${rider.status === "active" ? "" : "  (inactive: sign-in is refused)"}`);
  }
  console.log(`\nOrders, all for ${CUSTOMER.name} (${CUSTOMER.phone}), cash on delivery:`);
  for (const { fixture, order } of orders) {
    const code = order.status === "ARRIVED" ? `  handover code ${order.delivery.otp}` : "";
    console.log(`  ${order.code}  ${order.status.padEnd(20)} ${fixture.note}${code}`);
  }
}

module.exports = { seedDelivery, cleanDelivery, RIDERS, ORDERS, CUSTOMER, TAG };

if (require.main === module) {
  const clean = process.argv.includes("--clean");
  (async () => {
    const target = assertDevDatabase(clean ? "npm run seed:delivery:clean" : "npm run seed:delivery:dev");
    if (clean && !process.argv.includes("--yes")) {
      throw new Error(`This cancels and deletes every delivery fixture order in "${target.name}". Re-run with --yes to go ahead.`);
    }
    await connectDb();
    if (clean) {
      const { orders, payments } = await cleanDelivery();
      console.log(`\nRemoved ${orders} fixture orders and ${payments} payment rows. Rider and customer accounts were kept.\n`);
    } else {
      console.log("\nSeeding delivery fixtures:");
      printSummary(await seedDelivery());
      console.log("");
    }
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error(`\nDelivery seed failed: ${err.message}`);
    if (err.details) console.error(err.details);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
