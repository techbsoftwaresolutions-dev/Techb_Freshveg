import { getCategories, getPosts, getProducts, SITE_URL } from "@/lib/api";
import { productMedia, categoryImage } from "@/lib/format";
import { absolute, withRetry } from "@/lib/seo";

// Built from the live catalogue, so a department or product added in the admin
// is submittable to search engines without anyone editing a list.
// Rebuilt every 10 minutes (it was an hour): if a data call ever fails while it is built, the
// gap closes quickly instead of lasting.
export const revalidate = 600;

export default async function sitemap() {
  const now = new Date();

  const entries = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/c`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/delivery-areas`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryData = await withRetry(getCategories, (r) => r?.categories?.length);
  const walk = (nodes) => {
    for (const node of nodes || []) {
      const image = absolute(categoryImage(node));
      entries.push({
        url: `${SITE_URL}/c/${node.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
        // Image entries are what lets the picture itself appear in Google Images.
        ...(image ? { images: [image] } : {}),
      });
      walk(node.children);
    }
  };
  walk(categoryData?.categories);

  // The API caps a page at 100, so walk every page. 50 pages (5,000 products)
  // is one sitemap file's sensible ceiling; past that, split into several.
  const first = await withRetry(() => getProducts({ limit: 100, page: 1 }), (r) => r?.items?.length);
  const pages = Math.min(first?.meta?.pages || 1, 50);
  const batches = [first];
  for (let page = 2; page <= pages; page++) {
    batches.push(await withRetry(() => getProducts({ limit: 100, page }), (r) => r?.items?.length));
  }
  const seen = new Set();
  for (const batch of batches) {
    for (const product of batch?.items || []) {
      if (!product.slug || seen.has(product.slug)) continue;
      seen.add(product.slug);
      const images = productMedia(product).map((m) => absolute(m.url)).filter(Boolean).slice(0, 5);
      entries.push({
        url: `${SITE_URL}/p/${product.slug}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
        changeFrequency: "daily",
        priority: 0.7,
        ...(images.length ? { images } : {}),
      });
    }
  }

  // Blog posts (only published ones ever come back). The list page is added only when there is a post.
  const firstPosts = await getPosts({ limit: 50, page: 1 });
  if (firstPosts?.items?.length) {
    entries.push({ url: `${SITE_URL}/blog`, lastModified: new Date(firstPosts.items[0].publishedAt), changeFrequency: "weekly", priority: 0.6 });
    const postBatches = [firstPosts];
    for (let page = 2; page <= Math.min(firstPosts.meta?.pages || 1, 20); page += 1) postBatches.push(await getPosts({ limit: 50, page }));
    for (const batch of postBatches) {
      for (const post of batch?.items || []) {
        const image = absolute(post.coverImage);
        entries.push({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: new Date(post.publishedAt),
          changeFrequency: "monthly",
          priority: 0.6,
          ...(image ? { images: [image] } : {}),
        });
      }
    }
  }

  return entries;
}
