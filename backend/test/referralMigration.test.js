// The referral milestones migration (src/migrations) — run with `npm test`.
// Its own file: each test file gets one in-memory MongoDB.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("referral milestones migration", () => {
  let api;
  let db;
  let migrateReferrals;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    db = require("mongoose").connection;
    ({ migrateReferrals } = require("../src/migrations/20261015-referral-milestones"));
    // As saved by the wallet-credit version.
    await db.collection("settings").updateOne(
      { key: "global" },
      { $set: { referral: { enabled: true, referrerReward: 4000, refereeReward: 2000, minFirstOrderValue: 25000 } } },
      { upsert: true }
    );
    const { ObjectId } = require("mongoose").Types;
    await db.collection("referrals").insertOne({
      referrer: new ObjectId(), referee: new ObjectId(), code: "OLD1", status: "rewarded",
      qualifyingOrder: new ObjectId(), qualifyingOrderCode: "ORD-1", rewardedAt: new Date(),
    });
  });

  after(async () => api?.stop());

  it("a dry run changes nothing", async () => {
    assert.equal(await migrateReferrals({ log: () => {} }), 2);
    assert.equal((await db.collection("referrals").findOne({ code: "OLD1" })).status, "rewarded");
  });

  it("--apply maps the old reward to milestone 1 and is safe to repeat", async () => {
    await migrateReferrals({ write: true, log: () => {} });
    const { referral } = await db.collection("settings").findOne({ key: "global" });
    assert.deepEqual(referral.milestones, [{ purchases: 1, reward: 4000 }]);
    assert.equal(referral.minQualifyingOrderValue, 25000);
    assert.equal(referral.referrerReward, undefined);
    const migrated = await db.collection("referrals").findOne({ code: "OLD1" });
    assert.equal(migrated.status, "active");
    assert.equal(migrated.qualifyingPurchases, 1);
    assert.equal(migrated.purchases[0].referrerReward, 0, "never paid twice");
    assert.equal(await migrateReferrals({ write: true, log: () => {} }), 0);
  });
});
