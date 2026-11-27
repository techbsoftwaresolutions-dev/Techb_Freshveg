import { getProducts, SITE_URL } from "@/lib/api";
import { absolute, withRetry } from "@/lib/seo";
import { productMedia } from "@/lib/format";

// Product feed for Google Merchant Center (free listings in Google Shopping / Search).
// Add https://hosurbasket.com/feed/google-merchant in Merchant Center -> Products -> Feeds
// (scheduled fetch). Built from the live catalogue and refreshed hourly.
//
// Prices and stock are what the product page shows, because Merchant Center compares them and
// disapproves a mismatch. Items have no barcode (GTIN) of their own, so identifier_exists=no.
export const revalidate = 3600;

const esc = (value) =>
  String(value ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
const money = (paise) => `${(paise / 100).toFixed(2)} INR`;

export async function GET() {
  const first = await withRetry(() => getProducts({ limit: 100, page: 1 }), (r) => r?.items?.length);
  const pages = Math.min(first?.meta?.pages || 1, 50);
  const batches = [first];
  for (let page = 2; page <= pages; page += 1) {
    batches.push(await withRetry(() => getProducts({ limit: 100, page }), (r) => r?.items?.length));
  }

  const items = [];
  const seen = new Set();
  for (const batch of batches) {
    for (const p of batch?.items || []) {
      if (!p.slug || seen.has(p.slug)) continue;
      seen.add(p.slug);
      const images = productMedia(p).map((m) => absolute(m.url)).filter(Boolean);
      // Merchant Center requires an image and a price; an item without them would be rejected.
      if (!images.length || !(p.priceFrom > 0)) continue;

      const onSale = p.mrpFrom > p.priceFrom;
      const brand = p.brand && typeof p.brand === "object" ? p.brand.name : "";
      items.push(`<item>
<g:id>${esc(p.slug)}</g:id>
<g:title>${esc(`${p.name}${p.packLabel ? ` ${p.packLabel}` : ""}`.slice(0, 150))}</g:title>
<g:description>${esc((p.shortDescription || p.name).slice(0, 4900))}</g:description>
<g:link>${esc(`${SITE_URL}/p/${p.slug}`)}</g:link>
<g:image_link>${esc(images[0])}</g:image_link>
${images.slice(1, 4).map((url) => `<g:additional_image_link>${esc(url)}</g:additional_image_link>`).join("\n")}
<g:availability>${p.inStock === false ? "out of stock" : "in stock"}</g:availability>
<g:price>${money(onSale ? p.mrpFrom : p.priceFrom)}</g:price>
${onSale ? `<g:sale_price>${money(p.priceFrom)}</g:sale_price>` : ""}
<g:brand>${esc(brand || "Hosur Basket")}</g:brand>
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
</item>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Hosur Basket</title>
<link>${esc(SITE_URL)}</link>
<description>Fresh fruit, vegetables and groceries delivered in Hosur</description>
${items.join("\n")}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
