const dns = require("dns");
const mongoose = require("mongoose");
const config = require("./index");

// Connections kept open and warm. A page that fires a dozen queries at once (the shop's home
// page does) needs a dozen connections, and opening one costs 300-600 ms to a cloud database.
const POOL_MIN = 15;

// One connection for the whole process. Multi-store is modelled as a `store`
// field on the documents that need it (inventory, orders, pricing) rather than
// as a database per store — stores share a catalog, so splitting databases
// would mean copying every product row per branch.
async function connectDb() {
  mongoose.set("strictQuery", true);

  // A mongodb+srv:// URI needs an SRV lookup, which goes through Node's own
  // resolver rather than the OS one. On some Windows machines Node cannot read
  // the adapter's DNS list and falls back to 127.0.0.1, so the lookup fails
  // with "querySrv ECONNREFUSED" while nslookup works fine. DNS_SERVERS
  // points Node at real resolvers instead.
  if (config.dnsServers.length) dns.setServers(config.dnsServers);

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      // A cloud database is ~35 ms away per query, and opening a new connection
      // (TLS) costs 300-600 ms more. Keep a few connections open so a page that fires
      // several calls at once never waits on a handshake.
      minPoolSize: POOL_MIN,
      maxPoolSize: 30,
      // Close connections idle for 2 min instead of keeping one a router/NAT has
      // silently dropped (the next request on it hangs for many seconds).
      maxIdleTimeMS: 120000,
      // Fail a dead socket quickly so the driver retries on a fresh connection.
      socketTimeoutMS: 30000,
    });
  } catch (err) {
    console.error("\n[db] Could not connect to MongoDB.");
    console.error(`[db] URI: ${config.mongoUri.replace(/\/\/.*@/, "//<credentials>@")}`);
    console.error(`[db] ${err.message}\n`);
    throw err;
  }

  const { name, host } = mongoose.connection;
  console.log(`[db] connected — ${name} @ ${host}`);

  // Touch every pooled connection every 30 s so none goes stale while the app is idle
  // (the first request after a quiet spell used to stall for several seconds).
  setInterval(() => {
    const ping = () => mongoose.connection.db.admin().ping().catch(() => {});
    Promise.all(Array.from({ length: POOL_MIN }, ping));
  }, 30000).unref();

  mongoose.connection.on("disconnected", () => console.warn("[db] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[db] reconnected"));

  return mongoose.connection;
}

module.exports = { connectDb, mongoose };
