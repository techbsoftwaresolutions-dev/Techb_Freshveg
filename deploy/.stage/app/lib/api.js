// Server-side data access. Only server components and route handlers import
// this — it talks straight to the API over the private network, so nothing
// here ships to the browser.

const API = process.env.API_BASE_URL || "http://localhost:5055";
const BASE = `${API}/api/v1`;

export const SITE_URL = process.env.SITE_URL || "http://localhost:3100";

/**
 * Catalog reads are cached briefly and revalidated on a timer rather than
 * fetched per request, so a product page hit by a hundred shoppers is not a
 * hundred round trips. The windows are short on purpose: when an admin deletes
 * a product, changes a price or pauses a banner, the storefront should show it
 * within seconds, not minutes.
 */
async function get(path, { query, revalidate = 10 } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }

  const url = `${BASE}${path}${search.toString() ? `?${search}` : ""}`;

  let response;
  try {
    response = await fetch(url, { next: { revalidate } });
  } catch {
    // The site should degrade to an empty shelf, not a 500 page, when the API
    // is down — a shopper can still read the header and try again.
    return null;
  }

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!payload?.success) return null;
  return payload;
}

export const getHome = (store) => get("/storefront/home", { query: { store }, revalidate: 10 });

export const getCategories = () => get("/storefront/categories", { query: { depth: 3 }, revalidate: 30 });

export const getCategory = (slug) => get(`/storefront/categories/${slug}`, { revalidate: 30 });

export const getProducts = (query) => get("/storefront/products", { query, revalidate: 10 });

export const getProduct = (slug) => get(`/storefront/products/${slug}`, { revalidate: 10 });

export const search = (q, query) =>
  get("/storefront/search", { query: { q, ...query }, revalidate: 10 });

export const getBanners = (placement) =>
  get("/banners/live", { query: { placement }, revalidate: 30 });

export const getStores = () => get("/stores/public", { revalidate: 60 });

export const checkPincode = (pincode) =>
  get("/storefront/serviceability", { query: { pincode }, revalidate: 0 });
