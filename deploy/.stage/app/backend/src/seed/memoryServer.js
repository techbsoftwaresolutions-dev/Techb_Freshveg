/* eslint-disable no-console */
// Starts a throwaway in-memory MongoDB and points the process at it, so the
// seed and the smoke test can run on a machine with no MongoDB installed.
//
// Development only — nothing here is required by the API itself.
const { MongoMemoryServer } = require("mongodb-memory-server");

let server = null;

async function startMemoryMongo() {
  server = await MongoMemoryServer.create({ instance: { dbName: "commerce_engine" } });
  const uri = server.getUri();
  process.env.MONGODB_URI = uri;
  console.log(`[db] in-memory MongoDB at ${uri}`);
  return uri;
}

async function stopMemoryMongo() {
  if (server) await server.stop();
  server = null;
}

module.exports = { startMemoryMongo, stopMemoryMongo };
