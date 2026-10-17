// Seeds create accounts with well-known passwords and codes, and `--reset`
// empties the database — so a seed only writes to a database that is plainly
// a development one: a local MongoDB (or the in-memory one the tests use), or
// one the operator names on purpose with SEED_ALLOW_DATABASE=<database name>.
// NODE_ENV=production is refused outright.
const config = require("../config");

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|mongo|mongodb)(:\d+)?$/i;

// "mongodb+srv://user:pw@cluster0.x.mongodb.net/shop?retry=1" -> hosts + name.
function describeUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/?([^?]*)/.exec(String(uri || ""));
  if (!match) return { hosts: [], name: "" };
  return { hosts: match[1].split(","), name: decodeURIComponent(match[2]) || "test" };
}

function assertDevDatabase(label) {
  if (config.isProd) {
    throw new Error(`${label} does not run with NODE_ENV=production.`);
  }
  const { hosts, name } = describeUri(config.mongoUri);
  if (hosts.length && hosts.every((host) => LOCAL_HOST.test(host))) return { name, local: true };
  if (name && process.env.SEED_ALLOW_DATABASE === name) return { name, local: false };

  throw new Error(
    `${label} will not write to "${name || "?"}" on ${hosts.join(", ") || "an unrecognised host"}: ` +
      "it is not a local database. Point MONGODB_URI at a development database, or — if this really " +
      `is one — run with SEED_ALLOW_DATABASE=${name || "<database name>"}.`
  );
}

module.exports = { assertDevDatabase, describeUri };

// Self-check: node src/seed/guard.js
if (require.main === module) {
  const assert = require("node:assert/strict");
  assert.deepEqual(describeUri("mongodb://127.0.0.1:27017/commerce_engine"), { hosts: ["127.0.0.1:27017"], name: "commerce_engine" });
  assert.deepEqual(describeUri("mongodb+srv://u:p%40w@c0.ab.mongodb.net/farmers-basket?retryWrites=true"), {
    hosts: ["c0.ab.mongodb.net"], name: "farmers-basket",
  });
  assert.deepEqual(describeUri("mongodb://a:1,b:2/x"), { hosts: ["a:1", "b:2"], name: "x" });
  assert.equal(describeUri("mongodb://localhost").name, "test");
  console.log("guard ok");
}
