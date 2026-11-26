const config = require("../config");

// Redis when REDIS_URL is set, an in-process Map when it is not.
//
// The spec calls for Redis, but a single-store grocery business does not need
// it on day one and should not be blocked on running one. Every caller uses
// the same interface, so switching is an env var — not a code change.

let client = null;
let connecting = null;
const memory = new Map(); // key -> { value, expiresAt }

async function getClient() {
  if (!config.redisUrl) return null;
  if (client) return client;

  if (!connecting) {
    connecting = (async () => {
      try {
        // Required lazily so the dependency is optional: a deployment without
        // Redis does not need the package installed.
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        const { createClient } = require("redis");
        const c = createClient({ url: config.redisUrl });
        c.on("error", (err) => console.warn("[cache] redis error:", err.message));
        await c.connect();
        console.log("[cache] redis connected");
        client = c;
        return c;
      } catch (err) {
        console.warn(`[cache] redis unavailable (${err.message}) — using in-process cache`);
        return null;
      } finally {
        connecting = null;
      }
    })();
  }

  return connecting;
}

function sweep() {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt && entry.expiresAt <= now) memory.delete(key);
  }
}

async function get(key) {
  const redis = await getClient();
  if (redis) {
    const raw = await redis.get(key).catch(() => null);
    return raw ? JSON.parse(raw) : null;
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

async function set(key, value, ttlSeconds = 60) {
  const redis = await getClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds }).catch(() => {});
    return value;
  }

  // Keep the fallback from growing without bound in a long-lived process.
  if (memory.size > 5000) sweep();
  memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  return value;
}

async function del(pattern) {
  const redis = await getClient();
  if (redis) {
    if (!pattern.includes("*")) {
      await redis.del(pattern).catch(() => {});
      return;
    }
    // Small keyspaces only — scan rather than KEYS so this never blocks Redis.
    for await (const key of redis.scanIterator({ MATCH: pattern })) {
      await redis.del(key).catch(() => {});
    }
    return;
  }

  if (!pattern.includes("*")) {
    memory.delete(pattern);
    return;
  }
  const prefix = pattern.replace(/\*.*$/, "");
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

// Read-through: returns the cached value, or computes, stores and returns it.
async function remember(key, ttlSeconds, compute) {
  const hit = await get(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await compute();
  if (value !== null && value !== undefined) await set(key, value, ttlSeconds);
  return value;
}

module.exports = { get, set, del, remember };
