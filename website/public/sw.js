// Hosur Basket service worker.
//
// Deliberately conservative: prices, stock and the cart change by the minute,
// so pages and API calls always go to the network. What is cached is only
// what cannot go stale — Next's content-hashed build files, the app icons and
// the offline page — so a flaky connection still opens the app instantly and
// shows a proper "you're offline" screen instead of the browser's dinosaur.

const VERSION = "v3";
const STATIC_CACHE = `freshmart-static-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png?v=3", "/icons/icon-512.png?v=3", "/logo-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("freshmart-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Other origins (the image host, payment gateways) are none of our business.
  if (url.origin !== self.location.origin) return;
  // Live data is never served from a cache.
  if (url.pathname.startsWith("/api/")) return;

  // Pages: always the network, the offline screen only when there is none.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((page) => page || Response.error()))
    );
    return;
  }

  // Build output is content-hashed — a given URL never changes — so once
  // fetched it can be served from the cache for good.
  const immutable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
