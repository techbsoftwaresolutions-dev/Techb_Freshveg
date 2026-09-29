import { getCategories, getProducts, SITE_URL } from "@/lib/api";

// Built from the live catalogue, so a department or product added in the admin
// is submittable to search engines without anyone editing a list.
export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();

  const entries = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/c`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
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

  // One page of products is enough for a demo catalogue; page through here
  // when the catalogue outgrows it.
  const productData = await getProducts({ limit: 100 });
  for (const product of productData?.items || []) {
    entries.push({
      url: `${SITE_URL}/p/${product.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return entries;
}
