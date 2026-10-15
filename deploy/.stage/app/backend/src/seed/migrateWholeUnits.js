/* eslint-disable no-console */
// One-off: cart quantities count packs or pieces, never kilos. Rounds the
// order-quantity rules on variants and category defaults (0.25 -> 1), and any
// fractional quantity already sitting in an active cart, to whole units.
// Safe to run more than once.
//
//   npm run migrate:whole-units

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

const whole = (field) => ({ $max: [1, { $ceil: `$${field}` }] });

async function run() {
  await connectDb();
  const db = mongoose.connection.db;

  for (const field of ["stepQty", "minOrderQty"]) {
    const v = await db
      .collection("variants")
      .updateMany({ [field]: { $lt: 1 } }, [{ $set: { [field]: whole(field) } }]);
    const c = await db
      .collection("categories")
      .updateMany({ [`defaults.${field}`]: { $ne: null, $lt: 1 } }, [{ $set: { [`defaults.${field}`]: whole(`defaults.${field}`) } }]);
    console.log(`${field}: ${v.modifiedCount} variants, ${c.modifiedCount} categories`);
  }

  const carts = await db.collection("carts").updateMany(
    // ($mod truncates doubles first, so 0.25 would pass as whole — compare with $floor.)
    {
      status: "active",
      $expr: { $anyElementTrue: [{ $map: { input: "$items", as: "i", in: { $ne: ["$$i.quantity", { $floor: "$$i.quantity" }] } } }] },
    },
    [
      {
        $set: {
          items: {
            $map: {
              input: "$items",
              as: "i",
              in: { $mergeObjects: ["$$i", { quantity: { $max: [1, { $round: ["$$i.quantity", 0] }] } }] },
            },
          },
        },
      },
    ]
  );
  console.log(`carts: ${carts.modifiedCount} with fractional lines rounded`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
