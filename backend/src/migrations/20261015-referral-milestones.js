/* eslint-disable no-console */
// Moves referrals from the old one-off wallet credit to milestone coupons.
//
//   npm run migrate:referral-milestones            dry run: lists what would change
//   npm run migrate:referral-milestones -- --apply  writes it
//
// - Settings: the old referrerReward becomes the first milestone (1 purchase)
//   and minFirstOrderValue becomes minQualifyingOrderValue, unless the new
//   fields were already saved. The old fields are removed.
// - Referrals already "rewarded" (wallet credit paid) become active with one
//   counted purchase that earns nothing more, so the first milestone is never
//   paid twice and the friend's next purchase counts as their second.
// Safe to run again: anything already migrated is skipped.

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

const apply = process.argv.includes("--apply");

async function migrateReferrals({ write = false, log = console.log } = {}) {
  const db = mongoose.connection;
  const settings = db.collection("settings");
  const referrals = db.collection("referrals");
  let changed = 0;

  const doc = await settings.findOne({ key: "global" });
  const old = doc?.referral || {};
  if (doc && ("referrerReward" in old || "minFirstOrderValue" in old)) {
    const set = {};
    if (!old.milestones) set["referral.milestones"] = old.referrerReward > 0 ? [{ purchases: 1, reward: old.referrerReward }] : [];
    if (old.minQualifyingOrderValue === undefined && old.minFirstOrderValue !== undefined) {
      set["referral.minQualifyingOrderValue"] = old.minFirstOrderValue;
    }
    log(`  settings: ${JSON.stringify(set)}${write ? "  -> written" : ""}`);
    if (write) {
      await settings.updateOne(
        { _id: doc._id },
        { $set: set, $unset: { "referral.referrerReward": "", "referral.minFirstOrderValue": "" } }
      );
    }
    changed += 1;
  }

  const rewarded = await referrals.find({ status: "rewarded" }).toArray();
  for (const referral of rewarded) {
    log(`  referral ${referral.code} (${referral._id}) -> active, 1 purchase${write ? "  -> written" : ""}`);
    if (!write) continue;
    const at = referral.rewardedAt || new Date();
    await referrals.updateOne(
      { _id: referral._id, status: "rewarded" },
      {
        $set: { status: "active", qualifyingPurchases: 1, lastQualifiedAt: at },
        $push: {
          purchases: {
            _id: new mongoose.Types.ObjectId(),
            order: referral.qualifyingOrder || new mongoose.Types.ObjectId(),
            orderCode: referral.qualifyingOrderCode || "",
            amount: 0,
            status: "counted",
            note: "Rewarded to the wallet before milestone coupons",
            ordinal: 1,
            referrerReward: 0,
            refereeReward: 0,
            issuedAt: at,
            countedAt: at,
          },
        },
      }
    );
  }
  return changed + rewarded.length;
}

module.exports = { migrateReferrals };

if (require.main === module) {
  (async () => {
    await connectDb();
    console.log(`\n${apply ? "Migrating" : "Dry run —"} referrals on database "${mongoose.connection.name}":`);
    const count = await migrateReferrals({ write: apply });
    if (!count) console.log("  nothing to do");
    else if (!apply) console.log(`\n${count} change(s). Re-run with --apply to write them.`);
    else console.log(`\nDone: ${count} change(s).`);
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error(`\nMigration failed: ${err.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
