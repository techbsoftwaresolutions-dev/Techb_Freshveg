// Next.js calls register() once when its server starts (and in the build).
//
// The site's server-rendered pages read the catalog with fetch() from
// API_BASE_URL. The API runs in this same process, so those reads are served
// in memory: API_BASE_URL is set to a private name, and fetch() calls to it go
// straight to the Express app.
//
// Not over HTTP to the site's own address: Hostinger runs Node under LiteSpeed
// (no second port, and the logged ":3000" is not connectable), and the public
// address sits behind Hostinger's CDN, whose bot check answers server-to-server
// requests with a "Checking your browser" page.
const INTERNAL = "http://farmersbasket.internal";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__farmersBasketFetch) return;

  process.env.API_BASE_URL = INTERNAL;

  const { inject } = await import("./backend/start.js");
  const passThrough = globalThis.fetch;

  globalThis.__farmersBasketFetch = true;
  globalThis.fetch = async function farmersBasketFetch(input, init = {}) {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (!href || !href.startsWith(INTERNAL)) return passThrough(input, init);

    const url = new URL(href);
    const result = await inject({
      method: init.method || (typeof input === "object" && input.method) || "GET",
      path: url.pathname + url.search,
      headers: init.headers || {},
      body: init.body,
    });

    const headers = new Headers();
    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
    const noBody = result.status === 204 || result.status === 304 || result.body.length === 0;
    return new Response(noBody ? null : result.body, { status: result.status, headers });
  };
}
