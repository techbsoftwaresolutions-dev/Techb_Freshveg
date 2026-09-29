const mongoose = require("mongoose");
const config = require("./index");

// One connection for the whole process. Multi-store is modelled as a `store`
// field on the documents that need it (inventory, orders, pricing) rather than
// as a database per store — stores share a catalog, so splitting databases
// would mean copying every product row per branch.
async function connectDb() {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
  } catch (err) {
    console.error("\n[db] Could not connect to MongoDB.");
    console.error(`[db] URI: ${config.mongoUri.replace(/\/\/.*@/, "//<credentials>@")}`);
    console.error(`[db] ${err.message}\n`);
    throw err;
  }

  const { name, host } = mongoose.connection;
  console.log(`[db] connected — ${name} @ ${host}`);

  mongoose.connection.on("disconnected", () => console.warn("[db] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[db] reconnected"));

  return mongoose.connection;
}

module.exports = { connectDb, mongoose };
