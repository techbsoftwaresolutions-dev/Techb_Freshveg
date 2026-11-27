import Link from "next/link";
import { getPosts, SITE_URL } from "@/lib/api";
import { absolute } from "@/lib/seo";
import BlogCard, { postDate } from "@/components/BlogCard";
import BlogSidebar from "@/components/BlogSidebar";
import { img } from "@/lib/format";

// The blog list: server-rendered and paged with ?page=, so every post is reachable by a plain link.
export const revalidate = 60;

const PAGE_SIZE = 12;
const MAX_SHOW = 50;

export async function generateMetadata({ searchParams }) {
  const query = await searchParams;
  const page = 1;
  const show = Math.min(MAX_SHOW, Math.max(PAGE_SIZE, Number(query.show) || PAGE_SIZE));
  const tag = query.tag ? String(query.tag) : "";
  const category = query.category ? String(query.category) : "";
  const data = await getPosts({ page, limit: show, tag, category });
  const title = category ? `${category} - Hosur Basket blog` : tag ? `${tag} - Hosur Basket blog` : "Hosur Basket blog - fresh food tips and grocery guides";
  return {
    title,
    description:
      "Shopping tips, seasonal produce guides and everyday grocery advice from Hosur Basket, your online supermarket in Hosur.",
    alternates: { canonical: `/blog${page > 1 || tag || category ? `?${new URLSearchParams({ ...(category ? { category } : {}), ...(tag ? { tag } : {}), ...(page > 1 ? { page } : {}) })}` : ""}` },
    // A blog with nothing in it yet is a thin page: keep it out of search until the first post is live.
    robots: data?.items?.length ? undefined : { index: false, follow: true },
  };
}

export default async function BlogPage({ searchParams }) {
  const query = await searchParams;
  const page = 1;
  const show = Math.min(MAX_SHOW, Math.max(PAGE_SIZE, Number(query.show) || PAGE_SIZE));
  const tag = query.tag ? String(query.tag) : "";
  const category = query.category ? String(query.category) : "";
  const [data, recent] = await Promise.all([getPosts({ page, limit: show, tag, category }), getPosts({ limit: 4 })]);
  const all = data?.items || [];
  // The newest post of an unfiltered first page is shown large; the rest go in the grid.
  const featured = page === 1 && !tag && !category ? all[0] : null;
  const posts = featured ? all.slice(1) : all;
  const meta = data?.meta;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Hosur Basket blog",
    url: `${SITE_URL}/blog`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: all.map((post, i) => ({
        "@type": "ListItem",
        position: (page - 1) * PAGE_SIZE + i + 1,
        url: `${SITE_URL}/blog/${post.slug}`,
        name: post.title,
        image: absolute(post.coverImage),
      })),
    },
  };

  return (
    <div className="wrap blog-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}Blog
      </nav>

      <h1 className="sr-only">{category || (tag ? `Posts tagged "${tag}"` : "Hosur Basket Blog")}</h1>
      <div className="blog-layout">
        <div className="blog-main">
          {tag ? <p><Link href="/blog">← All posts</Link></p> : null}

          {featured ? (
            <article className="blog-feature" lang={featured.lang === "ta" ? "ta" : undefined}>
              <Link href={`/blog/${featured.slug}`} className="blog-feature-img" tabIndex={-1} aria-hidden="true">
                {featured.coverImage ? <img src={img(featured.coverImage, 900)} alt={featured.coverAlt || featured.title} width="900" height="600" fetchPriority="high" /> : <span className="blog-card-noimg" />}
              </Link>
              <div className="blog-feature-body">
                <span className="blog-feature-label">Featured</span>
                {featured.category ? <span className="blog-tag">{featured.category}</span> : null}
                <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
                {featured.excerpt ? <p>{featured.excerpt}</p> : null}
                <span className="blog-meta">{postDate(featured.publishedAt)} · {featured.readingMinutes} min read</span>
                <Link href={`/blog/${featured.slug}`} className="bs-btn">Read More →</Link>
              </div>
            </article>
          ) : null}

          {posts.length ? (
            <div className="blog-grid">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          ) : all.length ? null : (
            <p>No posts here yet. Check back soon.</p>
          )}

{meta?.hasNext && show < MAX_SHOW ? (
            <p className="blog-more-wrap">
              <Link href={`/blog?${new URLSearchParams({ ...(category ? { category } : {}), ...(tag ? { tag } : {}), show: show + PAGE_SIZE })}`} scroll={false} className="bs-btn">
                Load more
              </Link>
            </p>
          ) : null}
        </div>
        <BlogSidebar posts={recent?.items || []} />
      </div>
    </div>
  );
}
