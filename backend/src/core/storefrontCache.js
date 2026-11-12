// Speed for the public storefront (website + customer app).
//
// The database is remote, so every query is a network round trip (~40-50ms).
// Two layers keep storefront reads well under 300ms:
//
//   1. cacheResponse(ttl): a whole JSON reply, keyed by URL (+ delivery
//      pincode header), served for a few seconds. Uses core/cache, so it is
//      shared through Redis when REDIS_URL is set.
//   2. memo(key, ttl, fn): in-process memo for lookups that return live
//      documents (the serving store, category schemas) and so can't go through
//      JSON. Concurrent callers share one in-flight query.
//
// Freshness: invalidateOnWrite clears both layers the moment anything that
// shows on the storefront changes — an admin save, an order, a POS bill — so
// the TTL only bounds how long an *unchanged* answer is reused.
const cache = require("./cache");

const PREFIX = "sf:";
const memos = new Map(); // key -> { promise, expiresAt }

function memo(key, ttlMs, compute) {
  const hit = memos.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = Promise.resolve().then(compute);
  // A failed lookup is never remembered.
  promise.catch(() => {
    if (memos.get(key)?.promise === promise) memos.delete(key);
  });

  // Expired but settled: answer with the previous value straight away and
  // refresh behind it (stale-while-revalidate). Only time-based expiry works
  // this way — a write clears the memo outright, so edits are never hidden.
  if (hit?.settled) {
    hit.expiresAt = Date.now() + ttlMs; // one refresh at a time
    promise
      .then(() => memos.set(key, { promise, settled: true, expiresAt: Date.now() + ttlMs }))
      .catch(() => {});
    return hit.promise;
  }

  if (memos.size > 2000) memos.clear();
  const entry = { promise, settled: false, expiresAt: Date.now() + ttlMs };
  memos.set(key, entry);
  promise.then(() => { entry.settled = true; }).catch(() => {});
  return promise;
}

// Called after each clear (debounced), e.g. to rebuild shared lookups in the
// background so the next shopper does not pay for them.
const clearHooks = [];
let warmTimer = null;
function onClear(fn) {
  clearHooks.push(fn);
}

function clearStorefront() {
  memos.clear();
  cache.del(`${PREFIX}*`).catch(() => {});
  clearTimeout(warmTimer);
  warmTimer = setTimeout(() => clearHooks.forEach((fn) => fn()), 300);
}

function cacheResponse(ttlSeconds) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();
    const key = `${PREFIX}${req.headers["x-delivery-pincode"] || ""}:${req.originalUrl}`;

    const hit = await cache.get(key).catch(() => null);
    if (hit) {
      res.set("X-Cache", "HIT");
      return res.json(hit);
    }

    const send = res.json.bind(res);
    res.json = (body) => {
      res.set("X-Cache", "MISS");
      if (res.statusCode === 200 && body && body.success !== false) {
        // A plain snapshot, so later changes to live documents can't leak in.
        try {
          cache.set(key, JSON.parse(JSON.stringify(body)), ttlSeconds).catch(() => {});
        } catch {
          /* not serialisable: just don't cache */
        }
      }
      return send(body);
    };
    return next();
  };
}

// API areas whose writes change what the storefront shows (catalogue, prices,
// stock, offers, stores, settings, banners). Cart and wishlist writes do not.
const AFFECTS_STOREFRONT = /^\/(catalog|inventory|stores|settings|marketing|banners|pos|orders|returns|delivery|maintenance)(\/|$)/;

function invalidateOnWrite(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!AFFECTS_STOREFRONT.test(req.path)) return next();
  res.on("finish", () => {
    if (res.statusCode < 400) clearStorefront();
  });
  return next();
}

module.exports = { memo, cacheResponse, invalidateOnWrite, clearStorefront, onClear };
