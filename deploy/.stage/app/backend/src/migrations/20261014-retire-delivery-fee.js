/* eslint-disable no-console */
// Retires the per-delivery fee (settings.partnerFeePerDelivery) from saved
// stores. Delivery boys are store employees on a salary, not paid per
// delivery; the app's "earned today" figure was the only thing that read it.
//
//   npm run migrate:retire-delivery-fee            dry run: lists what would change
//   npm run migrate:retire-delivery-fee -- --apply  removes the field
//
// Safe to run again: stores without the field are left alone. Nothing else on
// the store is touched, and no orders, payments or accounts are read or
// written. Earnings were always computed on the fly, never stored, so there is
// no earnings history to keep; each store's old rate is written to the audit
// log before it is removed, so the value stays on record.

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const audit = require("../modules/audit/audit.service");

const apply = process.argv.includes("--apply");
const FIELD = "settings.partnerFeePerDelivery";

async function retireDeliveryFee({ write = false, log = console.log } = {}) {
  const stores = mongoose.connection.collection("stores");
  const affected = await stores.find({ [FIELD]: { $exists: true } }, { projection: { code: 1, name: 1, [FIELD]: 1 } }).toArray();

  for (const store of affected) {
    const paise = store.settings.partnerFeePerDelivery;
    log(`  ${store.code || store._id}  ${store.name || ""}  fee ₹${(paise / 100).toFixed(2)}${write ? "  -> removed" : ""}`);
    if (!write) continue;
    // The record first: if it can't be written, the fee stays where it is.
    const recorded = await audit.record({
      action: "migrate",
      entity: "Store",
      entityId: store._id,
      label: store.code || store.name || String(store._id),
      summary: `Retired the per-delivery fee (was ₹${(paise / 100).toFixed(2)}): delivery boys are salaried store employees`,
    });
    if (!recorded) throw new Error(`Couldn't write the audit record for ${store.code || store._id}; nothing was removed from it`);
    await stores.updateOne({ _id: store._id }, { $unset: { [FIELD]: "" } });
  }
  return affected.length;
}

module.exports = { retireDeliveryFee };

if (require.main === module) {
  (async () => {
    await connectDb();
    console.log(`\n${apply ? "Removing" : "Dry run — would remove"} ${FIELD} on database "${mongoose.connection.name}":`);
    const count = await retireDeliveryFee({ write: apply });
    if (!count) console.log("  nothing to do: no store has the field");
    else if (!apply) console.log(`\n${count} store(s). Re-run with --apply to remove the field.`);
    else console.log(`\nDone: ${count} store(s) updated, each recorded in the audit log.`);
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error(`\nMigration failed: ${err.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
