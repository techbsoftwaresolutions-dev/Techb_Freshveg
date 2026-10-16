// Account deletion: customers erase their own account (app and website),
// delivery employees request it and an admin completes it. Run with
// `npm test` — real HTTP API on a throwaway in-memory MongoDB (see helpers).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("account deletion through the real API", () => {
  let api;
  let models;

  const as = (token) => ({
    get: (path) => api.call("GET", path, { token }),
    post: (path, body = {}) => api.call("POST", path, { token, body }),
    patch: (path, body = {}) => api.call("PATCH", path, { token, body }),
  });
  const admin = () => as(api.adminToken);

  // The OTP routes are rate limited per IP, so each sign-in comes from its own
  // address (the app trusts one proxy hop).
  let clients = 0;
  async function otpLogin(phone, role = "customer") {
    clients += 1;
    const post = async (path, body) => {
      const response = await fetch(`${api.base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.9.0.${clients}` },
        body: JSON.stringify(body),
      });
      return { status: response.status, ...(await response.json()) };
    };
    const sent = await post("/auth/otp/request", { phone, role });
    return post("/auth/otp/verify", { phone, code: sent.devCode, role });
  }

  async function customerWithOrder(phone) {
    const login = await otpLogin(phone);
    const token = login.accessToken;
    const added = await as(token).post("/auth/me/addresses", {
      label: "Home", contactName: "Meera Test", line1: "12 Lake Road", landmark: "Near the temple",
      city: "Bengaluru", state: "Karnataka", pincode: api.customer.addresses[0].pincode,
    });
    const placed = await api.placeOrder({ note: "Ring twice" }, { token, address: added.addresses.at(-1).id });
    assert.equal(placed.status, 201, placed.error?.message);
    return { login, token, order: placed.order };
  }

  // Store-side steps to Ready for pickup, then assigned to `riderId`.
  async function readyAndAssign(orderId, riderId) {
    for (const status of ["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"]) {
      const moved = await admin().post(`/orders/${orderId}/status`, { status });
      assert.equal(moved.status, 200, moved.error?.message);
    }
    const assigned = await admin().post(`/orders/${orderId}/assign`, { partner: riderId });
    assert.equal(assigned.status, 200, assigned.error?.message);
  }

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    models = {
      User: require("../src/modules/auth/user.model"),
      Order: require("../src/modules/orders/order.model"),
      Cart: require("../src/modules/cart/cart.model"),
      Notification: require("../src/modules/notifications/notification.model"),
      WalletTransaction: require("../src/modules/wallet/walletTransaction.model"),
      AccountDeletion: require("../src/modules/auth/accountDeletion.model"),
      Payment: require("../src/modules/payments/payment.model"),
    };
  });

  after(async () => api?.stop());

  // ------------------------------------------------------------- customers

  it("needs the typed confirmation", async () => {
    const { token } = await customerWithOrder("9811100001");
    const refused = await as(token).post("/auth/me/deletion", {});
    assert.equal(refused.status, 400);
  });

  it("an order in progress blocks deletion, and says which one", async () => {
    const { token, order, login } = await customerWithOrder("9811100002");
    const check = await as(token).get("/auth/me/deletion");
    assert.equal(check.canDelete, false);
    assert.ok(check.blockers.some((b) => b.kind === "order" && b.ref === order.code));

    const refused = await as(token).post("/auth/me/deletion", { confirm: "DELETE" });
    assert.equal(refused.status, 409);
    assert.ok(refused.error.details.blockers.some((b) => b.ref === order.code));
    assert.equal((await models.User.findById(login.user.id)).status, "active", "nothing erased");
  });

  it("balances must be acknowledged; then the account is erased and its order kept anonymised", async () => {
    const { token, login, order } = await customerWithOrder("9811100003");
    const userId = login.user.id;
    await as(token).post(`/orders/${order.id}/cancel`, { reason: "Changed my mind" });
    const credited = await admin().post(`/customers/${userId}/wallet`, { amount: 2500, note: "Goodwill" });
    assert.equal(credited.status, 200, credited.error?.message);

    const check = await as(token).get("/auth/me/deletion");
    assert.equal(check.canDelete, true);
    assert.ok(check.warnings.some((w) => w.kind === "wallet" && w.amount === 2500));

    const unacknowledged = await as(token).post("/auth/me/deletion", { confirm: "DELETE" });
    assert.equal(unacknowledged.status, 400);
    assert.ok(unacknowledged.error.details.warnings.length);

    const done = await as(token).post("/auth/me/deletion", { confirm: "delete", acknowledge: true, source: "web" });
    assert.equal(done.status, 200, done.error?.message);
    assert.equal(done.deletion.status, "completed");
    assert.match(done.deletion.reference, /^DEL-[0-9A-F]{8}$/);

    // Every session ends at once — the access token and the refresh token.
    assert.equal((await as(token).get("/auth/me")).status, 401);
    assert.equal((await api.call("POST", "/auth/refresh", { body: { refreshToken: login.refreshToken } })).status, 401);

    const user = await models.User.findById(userId);
    assert.equal(user.status, "deleted");
    assert.equal(user.phone, `deleted-${userId}`);
    assert.equal(user.name, "Deleted customer");
    assert.equal(user.email, "");
    assert.equal(user.addresses.length, 0);
    assert.equal(user.referralCode, undefined);
    assert.equal(user.walletBalance, 0);

    // The order is a financial record: kept, amounts intact, person removed.
    const kept = await models.Order.findById(order.id);
    assert.ok(kept, "order is never deleted");
    assert.equal(kept.code, order.code);
    assert.equal(kept.pricing.total, order.pricing.total);
    assert.equal(kept.customerSnapshot.name, "Deleted customer");
    assert.equal(kept.customerSnapshot.phone, "");
    assert.equal(kept.delivery.address.line1, "");
    assert.equal(kept.delivery.address.landmark, "");
    assert.equal(kept.delivery.address.contactPhone, "");
    assert.equal(kept.delivery.instructions, "");
    assert.equal(kept.customerNote, "");
    assert.equal(kept.delivery.address.pincode, order.delivery.address.pincode, "place of supply stays");
    assert.ok(!kept.statusHistory.some((h) => String(h.by) === userId && h.byName !== "Deleted customer"));

    // The wallet write-off is in the ledger, and the receipt records it.
    assert.ok(await models.WalletTransaction.exists({ user: userId, amount: -2500, note: new RegExp(done.deletion.reference) }));
    const record = await models.AccountDeletion.findOne({ reference: done.deletion.reference });
    assert.equal(record.forfeited.walletBalance, 2500);
    assert.equal(record.source, "web");
    assert.equal(record.phoneMasked, "******0003");

    assert.equal(await models.Cart.countDocuments({ customer: userId }), 0);
    assert.equal(await models.Notification.countDocuments({ user: userId }), 0);
  });

  it("the erased number can sign up again as a new, separate account", async () => {
    const again = await otpLogin("9811100003");
    assert.equal(again.status, 200, again.error?.message);
    assert.equal(again.isNewUser, true);
    assert.equal(again.user.walletBalance, 0);
  });

  it("admins no longer list or edit an erased customer", async () => {
    const erased = await models.User.findOne({ status: "deleted", role: "customer" });
    const list = await admin().get("/customers?limit=200");
    assert.ok(!list.items.some((c) => c.id === erased.id));
    assert.equal((await admin().patch(`/customers/${erased.id}`, { status: "active" })).status, 409);
  });

  it("an admin can erase on a customer's behalf, with a note; a supervisor cannot", async () => {
    const { login } = await customerWithOrder("9811100004");
    const userId = login.user.id;
    const open = await models.Order.findOne({ customer: userId });
    await as(login.accessToken).post(`/orders/${open.id}/cancel`, {});

    assert.equal((await as(api.supervisorToken).post(`/customers/${userId}/erase`, { confirm: "DELETE", note: "x" })).status, 403);
    assert.equal((await admin().post(`/customers/${userId}/erase`, { confirm: "DELETE" })).status, 422);
    const done = await admin().post(`/customers/${userId}/erase`, { confirm: "DELETE", note: "Emailed from the account's address" });
    assert.equal(done.status, 200, done.error?.message);
    assert.equal((await models.AccountDeletion.findOne({ reference: done.deletion.reference })).source, "admin");
    assert.equal((await models.User.findById(userId)).status, "deleted");
  });

  // ------------------------------------------------------- delivery staff

  it("a delivery employee requests deletion; nothing changes until an admin acts", async () => {
    const created = await admin().post("/users", { name: "Ravi Rider", phone: "9811100010", role: "delivery_partner" });
    assert.equal(created.status, 201, created.error?.message);
    const rider = await otpLogin("9811100010", "delivery_partner");

    const asked = await as(rider.accessToken).post("/auth/me/deletion", { confirm: "DELETE", reason: "Leaving the job" });
    assert.equal(asked.status, 202);
    assert.equal(asked.deletion.status, "requested");
    assert.equal((await as(rider.accessToken).get("/auth/me")).status, 200, "still signed in");
    const again = await as(rider.accessToken).post("/auth/me/deletion", { confirm: "DELETE" });
    assert.equal(again.deletion.reference, asked.deletion.reference, "one open request at a time");

    const queue = await admin().get("/users/deletion-requests?status=requested");
    const row = queue.items.find((r) => r.reference === asked.deletion.reference);
    assert.equal(row.user.name, "Ravi Rider");
    assert.equal(row.reason, "Leaving the job");
    assert.equal((await as(api.supervisorToken).get("/users/deletion-requests")).status, 403);
  });

  it("an admin can decline a request, but must say why", async () => {
    const created = await admin().post("/users", { name: "Sita Rider", phone: "9811100011", role: "delivery_partner" });
    const rider = await otpLogin("9811100011", "delivery_partner");
    const asked = await as(rider.accessToken).post("/auth/me/deletion", { confirm: "DELETE" });
    const row = (await admin().get("/users/deletion-requests")).items.find((r) => r.reference === asked.deletion.reference);

    assert.equal((await admin().post(`/users/deletion-requests/${row.id}/reject`, {})).status, 422);
    const declined = await admin().post(`/users/deletion-requests/${row.id}/reject`, { note: "Records kept while you are employed" });
    assert.equal(declined.deletion.status, "rejected");
    const mine = await as(rider.accessToken).get("/auth/me/deletion");
    assert.equal(mine.request.status, "rejected");
    assert.equal(mine.request.note, "Records kept while you are employed");
    assert.equal(mine.canRequest, true);
    assert.equal((await models.User.findById(created.user.id)).status, "active");
  });

  it("riders see contact details only while the order is on their run", async () => {
    const rider = await models.User.findOne({ phone: "9811100010", role: "delivery_partner" });
    const riderLogin = await otpLogin("9811100010", "delivery_partner");
    const riderApi = as(riderLogin.accessToken);
    const { order } = await customerWithOrder("9811100005");
    await models.Order.updateOne({ _id: order.id }, { $set: { internalNote: "Staff only", "customerSnapshot.email": "meera@example.com" } });
    await readyAndAssign(order.id, rider.id);

    const live = (await riderApi.get(`/orders/${order.id}`)).order;
    assert.equal(live.delivery.address.line1, "12 Lake Road");
    assert.equal(live.customerSnapshot.phone, "9811100005");
    assert.equal(live.delivery.instructions, "Ring twice");
    assert.equal(live.customerSnapshot.email, undefined);
    assert.equal(live.internalNote, undefined);
    assert.equal(live.customer, undefined);
    assert.equal(live.delivery.otp, undefined);

    // Erasing the rider is refused while the run is in hand…
    const busy = await admin().post(`/users/${rider.id}/erase`, { confirm: "DELETE" });
    assert.equal(busy.status, 409);

    for (const status of ["PICKED_UP", "OUT_FOR_DELIVERY"]) {
      assert.equal((await riderApi.post(`/orders/${order.id}/status`, { status })).status, 200);
    }
    const { delivery } = await models.Order.findById(order.id);
    const delivered = await riderApi.post(`/orders/${order.id}/deliver`, { otp: delivery.otp });
    assert.equal(delivered.status, 200, delivered.error?.message);

    const after = (await riderApi.get(`/orders/${order.id}`)).order;
    assert.equal(after.delivery.address.line1, undefined);
    assert.equal(after.delivery.address.pincode, order.delivery.address.pincode);
    assert.equal(after.customerSnapshot.phone, undefined);
    assert.equal(after.delivery.instructions, undefined);
    const history = await riderApi.get("/orders/delivery/history");
    assert.ok(history.items.every((o) => !o.delivery.address.line1 && !o.customerSnapshot.phone));

    // …and while they hold the cash.
    const cash = await admin().post(`/users/${rider.id}/erase`, { confirm: "DELETE" });
    assert.equal(cash.status, 409);
    assert.match(cash.error.message, /cash/);
  });

  it("an admin erases the employee once the cash is settled; their delivered orders keep the name only", async () => {
    const rider = await models.User.findOne({ phone: "9811100010", role: "delivery_partner" });
    const riderLogin = await otpLogin("9811100010", "delivery_partner");
    const payments = await models.Payment.find({ codCollectedBy: rider._id, codSettledAt: null });
    const settled = await admin().post("/payments/cod/settle", { paymentIds: payments.map((p) => p.id) });
    assert.equal(settled.status, 200, settled.error?.message);

    assert.equal((await as(api.supervisorToken).post(`/users/${rider.id}/erase`, { confirm: "DELETE" })).status, 403);
    assert.equal((await admin().post(`/users/${rider.id}/erase`, {})).status, 400);
    const done = await admin().post(`/users/${rider.id}/erase`, { confirm: "DELETE", note: "Left the company" });
    assert.equal(done.status, 200, done.error?.message);
    assert.equal(done.deletion.status, "completed");

    const erased = await models.User.findById(rider.id);
    assert.equal(erased.status, "deleted");
    assert.equal(erased.name, "Former delivery staff");
    assert.equal(erased.phone, `deleted-${rider.id}`);
    assert.equal((await as(riderLogin.accessToken).get("/auth/me")).status, 401, "session ended");

    const theirOrders = await models.Order.find({ "delivery.partner": rider._id });
    assert.ok(theirOrders.length);
    assert.ok(theirOrders.every((o) => o.delivery.partnerName === "Ravi Rider" && o.delivery.partnerPhone === ""));

    // The request they raised is the one completed, and the account is frozen.
    const row = await models.AccountDeletion.findOne({ user: rider._id });
    assert.equal(row.status, "completed");
    assert.equal(row.processedByName.length > 0, true);
    assert.equal((await admin().patch(`/users/${rider.id}`, { status: "active" })).status, 409);
    assert.equal((await otpLogin("9811100010", "delivery_partner")).status, 403, "the number is no longer a rider");
  });

  it("deactivation is not deletion: a deactivated rider keeps their data", async () => {
    const created = await admin().post("/users", { name: "Anu Rider", phone: "9811100012", role: "delivery_partner" });
    const off = await admin().patch(`/users/${created.user.id}`, { status: "blocked" });
    assert.equal(off.status, 200);
    const user = await models.User.findById(created.user.id);
    assert.equal(user.status, "blocked");
    assert.equal(user.phone, "9811100012");
    assert.equal(user.name, "Anu Rider");
  });

  it("other staff cannot self-delete through the app route", async () => {
    const refused = await as(api.adminToken).post("/auth/me/deletion", { confirm: "DELETE" });
    assert.equal(refused.status, 403);
  });
});
