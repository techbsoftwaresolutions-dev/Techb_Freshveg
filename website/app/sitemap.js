import { getCategories, getProducts, SITE_URL } from "@/lib/api";

// Built from the live catalogue, so a department or product added in the admin
// is submittable to search engines without anyone editing a list.
export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();

  const entries = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/c`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryData = await getCategories();
  const walk = (nodes) => {
    for (const node of nodes || []) {
      entries.push({
        url: `${SITE_URL}/c/${node.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
      walk(node.children);
    }
  };
  walk(categoryData?.categories);

  // The API caps a page at 100, so walk every page. 50 pages (5,000 products)
  // is one sitemap file's sensible ceiling; past that, split into several.
  const first = await getProducts({ limit: 100, page: 1 });
  const pages = Math.min(first?.meta?.pages || 1, 50);
  const batches = [first];
  for (let page = 2; page <= pages; page++) {
    batches.push(await getProducts({ limit: 100, page }));
  }
  const seen = new Set();
  for (const batch of batches) {
    for (const product of batch?.items || []) {
      if (!product.slug || seen.has(product.slug)) continue;
      seen.add(product.slug);
      entries.push({
        url: `${SITE_URL}/p/${product.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  return entries;
}
