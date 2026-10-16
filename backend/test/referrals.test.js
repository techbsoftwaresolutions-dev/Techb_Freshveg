// Referral & Rewards — run with `npm test`. Real HTTP API on a throwaway
// in-memory MongoDB (see helpers). Orders are moved through their states with
// order.service directly, the way staff and the rider app would.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("referral & rewards", () => {
  let api;
  let orderService;
  let referralService;
  let couponService;
  let User;
  let Order;
  let Coupon;
  let Referral;

  const referrer = {}; // the seeded customer
  const friend = {}; // signs up with the referrer's code
  const other = {}; // a second friend, independent progress

  async function signUp(phone, extra = {}) {
    const otp = await api.call("POST", "/auth/otp/request", { body: { phone } });
    const res = await api.call("POST", "/auth/otp/verify", { body: { phone, code: otp.devCode, name: "Rahul Kumar", ...extra } });
    // New accounts have no address yet; give them the seeded one.
    const { id, _id, ...address } = api.customer.addresses[0];
    await User.updateOne({ _id: res.user.id }, { $push: { addresses: { ...address, isDefault: true } } });
    const me = await api.call("GET", "/auth/me", { token: res.accessToken });
    return { ...res, token: res.accessToken, id: res.user.id, addressId: me.user.addresses[0].id };
  }

  // Accounts made without the OTP flow — its limiter allows ten requests per
  // IP, which the signups above already use.
  async function makeCustomer(phone) {
    const { issueTokens } = require("../src/modules/auth/token.service");
    const { id, _id, ...address } = api.customer.addresses[0];
    const user = await User.create({ phone, role: "customer", name: "Test", addresses: [{ ...address, isDefault: true }] });
    return { id: user.id, token: issueTokens(user).accessToken, addressId: user.addresses[0].id };
  }

  const placeFor = (who, extra) => api.placeOrder(extra, { token: who.token, address: who.addressId });

  async function deliver(orderId) {
    const actor = { role: "admin", name: "Test" };
    let order = await Order.findById(orderId);
    for (const step of ["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP", "DELIVERED"]) {
      order = await orderService.transition(order, step, actor);
    }
    return order;
  }

  const coupons = (who, query = "") => api.call("GET", `/coupons${query}`, { token: who.token });
  const setRules = (body, token = api.adminToken) => api.call("PATCH", "/settings/referral", { token, body });
  const rules = {
    enabled: true,
    milestones: [
      { purchases: 1, reward: 1000 },
      { purchases: 3, reward: 2500 },
      { purchases: 5, reward: 5000 },
    ],
    repeatEvery: 0,
    repeatReward: 0,
    refereeReward: 500,
    minQualifyingOrderValue: 19900,
    couponExpiryDays: 30,
    couponMinOrderValue: 0,
    combinable: false,
    maxRewardsPerReferrer: 0,
    excludedCategories: [],
  };

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    orderService = require("../src/modules/orders/order.service");
    referralService = require("../src/modules/referrals/referral.service");
    couponService = require("../src/modules/referrals/coupon.service");
    User = require("../src/modules/auth/user.model");
    Order = require("../src/modules/orders/order.model");
    Coupon = require("../src/modules/referrals/coupon.model");
    Referral = require("../src/modules/referrals/referral.model");
    Object.assign(referrer, { token: api.customerToken, id: api.customer.id, addressId: api.addressId });
  });

  after(async () => api?.stop());

  describe("settings", () => {
    it("only settings managers can change the rules", async () => {
      assert.equal((await setRules(rules, api.customerToken)).status, 403);
    });

    it("rejects invalid rules", async () => {
      const bad = [
        { milestones: [{ purchases: 1, reward: 1000 }, { purchases: 1, reward: 2000 }] },
        { milestones: [{ purchases: 0, reward: 1000 }] },
        { milestones: [{ purchases: 2, reward: -5 }] },
        { milestones: [{ purchases: 2.5, reward: 100 }] },
        { couponExpiryDays: 0 },
        { minQualifyingOrderValue: -1 },
        { repeatEvery: 2, repeatReward: 0 },
        { milestones: [], repeatEvery: 0 },
      ];
      for (const patch of bad) {
        const res = await setRules({ ...rules, ...patch });
        assert.equal(res.status, 400, `accepted ${JSON.stringify(patch)}`);
      }
    });

    it("saves valid rules, sorted", async () => {
      const res = await setRules({ ...rules, milestones: [...rules.milestones].reverse() });
      assert.equal(res.status, 200);
      assert.deepEqual(res.settings.referral.milestones.map((m) => m.purchases), [1, 3, 5]);
    });
  });

  describe("attribution", () => {
    it("gives every customer a code and exposes no owner details publicly", async () => {
      const me = await api.call("GET", "/referrals/me", { token: referrer.token });
      assert.equal(me.status, 200);
      assert.ok(me.code);
      referrer.code = me.code;
      const check = await api.call("GET", `/referrals/check/${me.code}`);
      assert.equal(check.valid, true);
      assert.equal(JSON.stringify(check).includes("9876543210"), false);
      assert.equal((await api.call("GET", "/referrals/check/NOPE1234")).valid, false);
    });

    it("attributes a new account through signup with a link code", async () => {
      Object.assign(friend, await signUp("9111111111", { referralCode: referrer.code, referralSource: "link" }));
      assert.equal(friend.referral.applied, true);
      assert.ok(friend.user.referralCode, "new account gets its own code");
      assert.notEqual(friend.user.referralCode.slice(0, 4), "1111", "code is not derived from the phone");
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(String(referral.referrer), referrer.id);
      assert.equal(referral.source, "link");
    });

    it("cannot be overwritten or claimed twice", async () => {
      Object.assign(other, await signUp("9222222222", { referralCode: referrer.code }));
      const res = await api.call("POST", "/referrals/claim", { token: friend.token, body: { code: other.user.referralCode } });
      assert.equal(res.status, 409);
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(String(referral.referrer), referrer.id);
    });

    it("rejects self-referral, invalid codes and circular referrals", async () => {
      const lone = await signUp("9333333333");
      assert.equal((await api.call("POST", "/referrals/claim", { token: lone.token, body: { code: lone.user.referralCode } })).status, 400);
      assert.equal((await api.call("POST", "/referrals/claim", { token: lone.token, body: { code: "ZZZZ9999" } })).status, 400);
      // lone refers a new account, then tries to claim that account's code.
      const invitee = await signUp("9444444444", { referralCode: lone.user.referralCode });
      assert.equal(invitee.referral.applied, true);
      const circular = await api.call("POST", "/referrals/claim", { token: lone.token, body: { code: invitee.user.referralCode } });
      assert.equal(circular.status, 400);
      assert.match(circular.error.message, /referred/);
    });

    it("rejects a code after the first order", async () => {
      const shopper = await makeCustomer("9555555555");
      assert.equal((await placeFor(shopper)).status, 201);
      const res = await api.call("POST", "/referrals/claim", { token: shopper.token, body: { code: referrer.code } });
      assert.equal(res.status, 400);
    });

    it("lets a referrer refer many friends", async () => {
      assert.equal(await Referral.countDocuments({ referrer: referrer.id }), 2);
    });
  });

  describe("milestones", () => {
    let firstOrder;

    it("issues nothing at signup or on placing an order", async () => {
      const placed = await placeFor(friend);
      assert.equal(placed.status, 201);
      firstOrder = placed.order;
      assert.equal((await Coupon.countDocuments({ owner: referrer.id })), 0);
    });

    it("issues the first reward when the first qualifying order is delivered", async () => {
      const order = await deliver(firstOrder.id);
      assert.ok(order.pricing.qualifyingAmount >= 19900);
      const mine = await coupons(referrer);
      assert.equal(mine.items.length, 1);
      assert.equal(mine.items[0].amount, 1000);
      assert.equal(mine.items[0].status, "available");
      assert.equal(mine.items[0].milestone, 1);
      assert.equal(JSON.stringify(mine.items[0]).includes("Rahul"), false, "coupon does not name the friend");
      const welcome = await coupons(friend);
      assert.equal(welcome.items.length, 1);
      assert.equal(welcome.items[0].amount, 500);
    });

    it("re-processing the same order changes nothing, even concurrently", async () => {
      const order = await Order.findById(firstOrder.id);
      await Promise.all([1, 2, 3, 4, 5].map(() => referralService.recordPurchase(order)));
      await referralService.issueDue(await Referral.findOne({ referee: friend.id }));
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(referral.qualifyingPurchases, 1);
      assert.equal(referral.purchases.length, 1);
      assert.equal(await Coupon.countDocuments({ owner: referrer.id }), 1);
    });

    it("does not count an order below the qualifying minimum", async () => {
      await setRules({ ...rules, minQualifyingOrderValue: 9999900 });
      const placed = await placeFor(friend);
      await deliver(placed.order.id);
      await setRules(rules);
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(referral.qualifyingPurchases, 1);
      assert.equal(referral.purchases.find((p) => p.orderCode === placed.order.code).status, "ineligible");
    });

    it("does not count an undelivered order", async () => {
      const placed = await placeFor(friend);
      assert.equal(await referralService.recordPurchase(await Order.findById(placed.order.id)), null);
      await orderService.transition(await Order.findById(placed.order.id), "CANCELLED", { role: "admin" }, "test");
      assert.equal((await Referral.findOne({ referee: friend.id })).qualifyingPurchases, 1);
    });

    it("issues the configured reward at the third purchase, and only there", async () => {
      for (let i = 0; i < 2; i += 1) await deliver((await placeFor(friend)).order.id);
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(referral.qualifyingPurchases, 3);
      const amounts = (await Coupon.find({ owner: referrer.id }).sort({ milestone: 1 })).map((c) => [c.milestone, c.amount]);
      assert.deepEqual(amounts, [[1, 1000], [3, 2500]]);
    });

    it("keeps each friend's progress independent", async () => {
      await deliver((await placeFor(other)).order.id);
      const list = await api.call("GET", "/referrals/me/friends", { token: referrer.token });
      assert.equal(list.status, 200);
      const [second, first] = list.items; // newest first
      assert.equal(first.qualifyingPurchases, 3);
      assert.deepEqual(first.nextMilestone, { purchases: 5, reward: 5000, remaining: 2 });
      assert.equal(first.percent, 60);
      assert.equal(first.name, "Rahul K.");
      assert.equal(second.qualifyingPurchases, 1);
      assert.equal(second.nextMilestone.purchases, 3);
      assert.equal(JSON.stringify(list).includes("9111111111"), false, "no phone numbers");
      const summary = await api.call("GET", "/referrals/me", { token: referrer.token });
      assert.equal(summary.stats.referred, 2);
      assert.equal(summary.stats.friendsPurchased, 2);
      assert.equal(summary.stats.qualifyingPurchases, 4);
      assert.equal(summary.stats.couponsEarned, 3);
    });

    it("applies rule changes to future purchases only", async () => {
      await setRules({ ...rules, milestones: [{ purchases: 1, reward: 9900 }, { purchases: 2, reward: 7700 }, ...rules.milestones.slice(1)] });
      const first = await Coupon.findOne({ owner: referrer.id, milestone: 1, referral: (await Referral.findOne({ referee: friend.id }))._id });
      assert.equal(first.amount, 1000, "issued coupon untouched");
      // `other` is at 1; their next purchase reaches the new milestone 2.
      await deliver((await placeFor(other)).order.id);
      const otherReferral = await Referral.findOne({ referee: other.id });
      assert.equal((await Coupon.findOne({ referral: otherReferral._id, milestone: 2 })).amount, 7700);
      await setRules(rules);
    });
  });

  describe("coupons at checkout", () => {
    let coupon;

    before(async () => {
      coupon = (await coupons(referrer, "?status=available")).items.find((c) => c.amount === 1000);
    });

    async function fillCart(who) {
      const tomato = await api.call("GET", "/storefront/products/tomato");
      const variant = tomato.variants.find((v) => v.name === "1 KG").id;
      await api.call("POST", "/cart/items", { token: who.token, body: { variant, quantity: 2 } });
      const rice = await api.call("GET", "/storefront/products/india-gate-basmati-rice");
      await api.call("POST", "/cart/items", { token: who.token, body: { variant: rice.variants.find((v) => v.name === "5 KG").id, quantity: 1 } });
      return (await api.call("GET", "/cart", { token: who.token })).cart;
    }

    it("applies to the owner's cart, with the total computed by the server", async () => {
      const before = await fillCart(referrer);
      const res = await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: coupon.id, discount: 999999 } });
      assert.equal(res.status, 200);
      assert.equal(res.cart.summary.rewardDiscount, 1000);
      assert.equal(res.cart.rewardCoupon.ok, true);
      assert.ok(res.cart.summary.total <= before.summary.total - 1000 + 100, "total reduced by the coupon (± rounding)");
      assert.equal(res.cart.summary.qualifyingAmount, before.summary.qualifyingAmount, "qualifying basis excludes the coupon");
    });

    it("works typed into the coupon box, and can be removed", async () => {
      const removed = await api.call("DELETE", `/cart/coupon?code=${coupon.code}`, { token: referrer.token });
      assert.equal(removed.cart.summary.rewardDiscount, 0);
      const typed = await api.call("POST", "/cart/coupon", { token: referrer.token, body: { code: coupon.code } });
      assert.equal(typed.status, 200);
      assert.equal(typed.cart.summary.rewardDiscount, 1000);
    });

    it("cannot be used by another customer", async () => {
      await fillCart(friend);
      const res = await api.call("POST", "/cart/reward-coupon", { token: friend.token, body: { coupon: coupon.id } });
      assert.equal(res.status, 400);
      const typed = await api.call("POST", "/cart/coupon", { token: friend.token, body: { code: coupon.code } });
      assert.equal(typed.status, 400);
      await api.call("DELETE", "/cart", { token: friend.token });
    });

    it("never discounts more than the merchandise", async () => {
      const big = await Coupon.create({
        code: "RWBIGBIG99", owner: referrer.id, title: "Big", amount: 99999900, source: "referral",
        expiresAt: new Date(Date.now() + 86400000),
      });
      const preview = await require("../src/modules/cart/cart.service").summarise(
        await require("../src/modules/cart/cart.model").findOne({ customer: referrer.id, status: "active" }),
        { rewardCouponId: big.id }
      );
      assert.equal(preview.summary.rewardDiscount, preview.summary.qualifyingAmount);
      assert.ok(preview.summary.total >= 0);
      await big.deleteOne();
    });

    it("is redeemed by the order, and cannot be used twice", async () => {
      const cart = (await api.call("GET", "/cart", { token: referrer.token })).cart;
      const placed = await api.call("POST", "/orders", {
        token: referrer.token,
        body: { cart: cart.id, address: referrer.addressId, paymentMethod: "cod" },
      });
      assert.equal(placed.status, 201);
      assert.equal(placed.order.rewardCoupon.discount, 1000);
      assert.equal(placed.order.pricing.rewardDiscount, 1000);
      const saved = await Coupon.findById(coupon.id);
      assert.equal(saved.status, "redeemed");
      assert.equal(saved.orderCode, placed.order.code);

      await fillCart(referrer);
      const again = await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: coupon.id } });
      assert.equal(again.status, 400);
      assert.match(again.error.message, /already been used/);

      // Cancelled before delivery: the coupon comes back.
      await orderService.transition(await Order.findById(placed.order.id), "CANCELLED", { role: "admin" }, "test");
      assert.equal((await Coupon.findById(coupon.id)).status, "available");
    });

    it("lets exactly one of two racing checkouts take a coupon", async () => {
      const ids = [1, 2].map(() => new (require("mongoose").Types.ObjectId)());
      const results = await Promise.allSettled(
        ids.map((orderId) => couponService.reserve(coupon.id, referrer.id, { orderId, orderCode: "X", discount: 1000 }))
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const held = await Coupon.findById(coupon.id);
      await couponService.releaseForOrder({ _id: held.order, rewardCoupon: { coupon: held._id } });
      assert.equal((await Coupon.findById(coupon.id)).status, "available");
    });

    it("refuses expired and revoked coupons, and refuses an order that kept one", async () => {
      await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: coupon.id } });
      await Coupon.updateOne({ _id: coupon.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      const cart = (await api.call("GET", "/cart", { token: referrer.token })).cart;
      assert.equal(cart.rewardCoupon.ok, false);
      assert.match(cart.rewardCoupon.reason, /expired/);
      const placed = await api.call("POST", "/orders", {
        token: referrer.token,
        body: { cart: cart.id, address: referrer.addressId, paymentMethod: "cod" },
      });
      assert.equal(placed.status, 409);
      await api.call("DELETE", "/cart/reward-coupon", { token: referrer.token });

      const another = (await coupons(referrer, "?status=available")).items[0];
      const revoked = await api.call("POST", `/referrals/coupons/${another.id}/revoke`, { token: api.adminToken, body: { reason: "Test" } });
      assert.equal(revoked.status, 200);
      const res = await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: another.id } });
      assert.equal(res.status, 400);
      const AuditLog = require("../src/modules/audit/audit.model");
      assert.ok(await AuditLog.exists({ entity: "Coupon", action: "revoke" }));
      await api.call("DELETE", "/cart", { token: referrer.token });
    });

    it("cannot be stacked with an offer coupon unless allowed", async () => {
      const Offer = require("../src/modules/pricing/offer.model");
      await Offer.create({
        title: "Test 5", requiresCode: true, code: "TEST5", type: "fixed", status: "active",
        reward: { discountAmount: 500 }, combinable: true,
      });
      const fresh = await Coupon.create({
        code: "RWSTACK123", owner: referrer.id, title: "Stack", amount: 1000, source: "referral",
        expiresAt: new Date(Date.now() + 86400000),
      });
      await fillCart(referrer);
      await api.call("POST", "/cart/coupon", { token: referrer.token, body: { code: "TEST5" } });
      const blocked = await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: fresh.id } });
      assert.equal(blocked.status, 400);
      await setRules({ ...rules, combinable: true });
      const stacked = await api.call("POST", "/cart/reward-coupon", { token: referrer.token, body: { coupon: fresh.id } });
      assert.equal(stacked.status, 200);
      assert.equal(stacked.cart.summary.rewardDiscount, 1000);
      await setRules(rules);
      await api.call("DELETE", "/cart", { token: referrer.token });
      await fresh.deleteOne();
    });
  });

  describe("reversals and recovery", () => {
    it("a full refund reverses the purchase and withdraws its unused coupon", async () => {
      // `other` has 2 purchases; the second earned the milestone-2 coupon.
      const referral = await Referral.findOne({ referee: other.id });
      const second = referral.purchases.find((p) => p.ordinal === 2);
      const order = await Order.findById(second.order);
      const res = await api.call("POST", `/payments/orders/${order.id}/refund`, { token: api.adminToken, body: { reason: "test" } });
      assert.equal(res.status, 200);
      const after = await Referral.findOne({ referee: other.id });
      assert.equal(after.qualifyingPurchases, 1);
      assert.equal(after.purchases.find((p) => p.ordinal === 2).status, "reversed");
      assert.equal((await Coupon.findOne({ referral: referral._id, milestone: 2 })).status, "revoked");
      // Repeating the review changes nothing.
      await referralService.reviewOrder(await Order.findById(order.id));
      assert.equal((await Referral.findOne({ referee: other.id })).qualifyingPurchases, 1);
    });

    it("a failed issuance is retried by the sweep exactly once", async () => {
      const referral = await Referral.findOne({ referee: friend.id });
      const third = referral.purchases.find((p) => p.ordinal === 3);
      await Coupon.deleteOne({ referral: referral._id, milestone: 3, source: "referral" });
      await Referral.updateOne({ _id: referral._id, "purchases._id": third._id }, { $unset: { "purchases.$.issuedAt": 1 } });
      await referralService.sweep();
      await referralService.sweep();
      assert.equal(await Coupon.countDocuments({ referral: referral._id, milestone: 3, source: "referral" }), 1);
    });

    it("recalculation recovers a delivery that was never recorded", async () => {
      const placed = await placeFor(friend);
      const order = await deliver(placed.order.id);
      await Referral.updateOne(
        { referee: friend.id },
        { $pull: { purchases: { order: order._id } }, $inc: { qualifyingPurchases: -1 } }
      );
      const referral = await Referral.findOne({ referee: friend.id });
      const res = await api.call("POST", `/referrals/${referral.id}/recalculate`, { token: api.adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.referral.qualifyingPurchases, 4);
      assert.equal(await Coupon.countDocuments({ referral: referral._id, source: "referral" }), 2, "no milestone at 4");
    });
  });

  describe("programme switched off", () => {
    it("blocks new attributions and does not count deliveries", async () => {
      await setRules({ ...rules, enabled: false });
      const late = await makeCustomer("9666666666");
      const claim = await api.call("POST", "/referrals/claim", { token: late.token, body: { code: referrer.code } });
      assert.equal(claim.status, 400);
      assert.match(claim.error.message, /not running/);
      const before = (await Referral.findOne({ referee: friend.id })).qualifyingPurchases;
      await deliver((await placeFor(friend)).order.id);
      const referral = await Referral.findOne({ referee: friend.id });
      assert.equal(referral.qualifyingPurchases, before);
      assert.match(referral.purchases[referral.purchases.length - 1].note, /off/);
      assert.ok((await coupons(referrer)).items.length > 0, "issued coupons stay");
      await setRules(rules);
    });
  });

  describe("admin", () => {
    it("reports totals and searches referrals", async () => {
      const stats = await api.call("GET", "/referrals/stats", { token: api.adminToken });
      assert.equal(stats.status, 200);
      assert.ok(stats.stats.referred >= 3);
      assert.ok(stats.stats.couponsIssued >= 4);
      assert.ok(stats.stats.valueRedeemed >= 0);
      const search = await api.call("GET", `/referrals?search=${referrer.code}`, { token: api.adminToken });
      assert.equal(search.items.length, 2);
      const detail = await api.call("GET", `/referrals/${search.items[0].id}`, { token: api.adminToken });
      assert.equal(detail.status, 200);
      assert.ok(Array.isArray(detail.referral.purchases));
      assert.equal((await api.call("GET", "/referrals/stats", { token: friend.token })).status, 403);
    });

    it("voiding is audited and stops progress", async () => {
      const referral = await Referral.findOne({ referee: other.id });
      assert.equal((await api.call("POST", `/referrals/${referral.id}/void`, { token: api.adminToken, body: {} })).status, 400);
      const res = await api.call("POST", `/referrals/${referral.id}/void`, { token: api.adminToken, body: { reason: "Test" } });
      assert.equal(res.status, 200);
      await deliver((await placeFor(other)).order.id);
      assert.equal((await Referral.findById(referral._id)).qualifyingPurchases, 1);
    });
  });
});
