import { SITE_URL } from "./api";
import { rupees } from "./format";

// Your official profiles. Listing them as `sameAs` is how Google connects this website to the
// Instagram / YouTube / Facebook pages and shows them with the brand in search.
export const SOCIAL_LINKS = [
  "https://www.instagram.com/hosurbasket23/",
  "https://www.youtube.com/@Hosurbasket",
  "https://www.facebook.com/share/1CiLbxkfMn/",
];

// Search engines need absolute image/page links; local files like /products/x.jpg are relative.
export const absolute = (url) => (!url ? undefined : /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`);

// Who we are, and what this site is called (the name Google shows above the result).
export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Hosur Basket",
  alternateName: ["HosurBasket", "Hosur Basket Online"],
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  sameAs: SOCIAL_LINKS,
  contactPoint: [{ "@type": "ContactPoint", telephone: "+919003597158", contactType: "customer service", areaServed: "IN", availableLanguage: ["en", "ta"] }],
};

export const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Hosur Basket",
  alternateName: ["HosurBasket", "Hosur Basket - online grocery in Hosur"],
  url: SITE_URL,
  inLanguage: "en-IN",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

// lib/api returns null when a call fails, and a page or sitemap built from null silently loses
// every category or product. Try a few times before accepting that. `isGood` lets an empty
// list count as a failure too (an empty answer is "successful" to fetch, but wrong for us).
export async function withRetry(call, isGood = Boolean, tries = 3) {
  let last = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    last = await call();
    if (isGood(last)) return last;
    if (attempt < tries) await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return last;
}

// The text for a product page in Google results AND in WhatsApp / Facebook link previews (both read
// the same title and description). A description someone typed as "as" is not a description, so
// anything under MIN_OWN characters is replaced by one built from the product's real details.
const MIN_OWN = 40;
export function productShare(product, variants = [], categoryName = "") {
  const name = product.name;
  const brand = product.brand?.name;
  const own = (product.shortDescription || "").trim();
  const packs = [...new Set(variants.map((v) => v.name).filter(Boolean))].slice(0, 4);
  const lowest = variants.length ? Math.min(...variants.map((v) => v.sellingPrice)) : 0;

  const built =
    `Buy ${name}${brand ? ` by ${brand}` : ""} online in Hosur.` +
    (packs.length ? ` Available in ${packs.join(", ")}.` : "") +
    (lowest ? ` From ${rupees(lowest)}.` : "") +
    " Fresh, same-day delivery from Hosur Basket.";

  const title = product.seo?.title || `Buy ${name} online in Hosur`;
  return {
    // The browser tab / Google headline; the layout appends " | Hosur Basket".
    title,
    // The link-preview headline: longer, with the category, because there is room for it.
    shareTitle: `${product.seo?.title || `Buy ${name} Online in Hosur`}${categoryName ? ` - ${categoryName}` : ""} | Hosur Basket`,
    description: (product.seo?.description || (own.length >= MIN_OWN ? `${own} ${lowest ? `From ${rupees(lowest)}. ` : ""}Same-day delivery in Hosur.` : built)).slice(0, 200),
  };
}
