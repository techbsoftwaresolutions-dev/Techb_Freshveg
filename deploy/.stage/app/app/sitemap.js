import { getCategories, getProducts, SITE_URL } from "@/lib/api";

// Built from the live catalogue, so a department or product added in the admin
// is submittable to search engines without anyone editing a list. Category and
// product entries carry their photos too (an image sitemap), which is how
// Google Images finds them.
export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();

  const entries = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1, images: [`${SITE_URL}/og-image.jpg`] },
    { url: `${SITE_URL}/c`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryData = await getCategories();
  const walk = (nodes) => {
    for (const node of nodes || []) {
      entries.push({
        url: `${SITE_URL}/c/${node.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        ...(node.image ? { images: [node.image] } : {}),
      });
      walk(node.children);
    }
  };
  walk(categoryData?.categories);

  // Every product page, 100 at a time.
  for (let page = 1; page <= 50; page += 1) {
    const productData = await getProducts({ limit: 100, page });
    const items = productData?.items || [];
    for (const product of items) {
      const images = (product.media || []).map((m) => m?.url).filter(Boolean);
      entries.push({
        url: `${SITE_URL}/p/${product.slug}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
        changeFrequency: "daily",
        priority: 0.7,
        ...(images.length ? { images } : {}),
      });
    }
    if (!productData?.meta || page >= productData.meta.pages) break;
  }

  return entries;
}
