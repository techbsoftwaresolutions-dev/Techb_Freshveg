import { SITE_URL } from "@/lib/api";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind a sign-in, and nothing per-session, belongs in an index.
      disallow: ["/cart", "/checkout", "/account", "/orders", "/login", "/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
