import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost, SITE_URL } from "@/lib/api";
import { img } from "@/lib/format";
import { absolute } from "@/lib/seo";
import BlogCard, { postDate } from "@/components/BlogCard";
import BlogSidebar from "@/components/BlogSidebar";

export const revalidate = 60;

// Plain text from the start of a Markdown body, for a description when the author wrote no summary.
const plain = (markdown) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getPost(slug);
  if (!data) return { title: "Post not found", robots: { index: false } };

  const { post } = data;
  const description = (post.seo?.description || post.excerpt || plain(post.body)).slice(0, 200);
  const image = absolute(post.coverImage ? img(post.coverImage, 1200) : "/og-image.png");
  const title = post.seo?.title || post.title;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Hosur Basket`,
      description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags,
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

// Markdown becomes React elements (never raw HTML), so what staff type cannot inject anything.
const components = {
  // The page title is the only h1; a "# " in the body becomes a second-level heading.
  h1: ({ children }) => <h2>{children}</h2>,
  a: ({ href = "", children }) =>
    /^https?:\/\//.test(href) && !href.startsWith(SITE_URL) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <a href={href}>{children}</a>
    ),
  img: ({ src, alt }) => <img src={src} alt={alt || ""} loading="lazy" />,
};

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const data = await getPost(slug);
  if (!data) notFound();

  const { post, more = [] } = data;
  const url = `${SITE_URL}/blog/${post.slug}`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title.slice(0, 110),
    description: post.excerpt || plain(post.body).slice(0, 200) || undefined,
    image: post.coverImage ? [absolute(post.coverImage)] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { "@type": "Person", name: post.authorName || "Hosur Basket" },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: post.lang === "ta" ? "ta" : "en-IN",
    articleSection: post.category || undefined,
    keywords: post.tags?.length ? post.tags.join(", ") : undefined,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return (
    <div className="wrap blog-wrap">
      {[articleLd, breadcrumbLd].map((ld) => (
        <script key={ld["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}
        <Link href="/blog">Blog</Link>
        {" › "}
        {post.title}
      </nav>

      <div className="blog-layout">
      <article className="blog-article" lang={post.lang === "ta" ? "ta" : undefined}>
        <h1>{post.title}</h1>
        <p className="blog-meta">
          {post.authorName ? `${post.authorName} · ` : ""}
          <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time> · {post.readingMinutes} min read
        </p>

        {post.coverImage ? (
          <div className="blog-cover-wrap">
            <img
              className="blog-cover"
              src={img(post.coverImage, 1200)}
              alt={post.coverAlt || post.title}
              fetchPriority="high"
            />
            {post.category ? (
              <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="blog-tag blog-cover-tag">
                {post.category}
              </Link>
            ) : null}
          </div>
        ) : post.category ? (
          <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="blog-tag">{post.category}</Link>
        ) : null}

        <div className="prose">
          <Markdown components={components} remarkPlugins={[remarkGfm]}>{post.body}</Markdown>
        </div>

        {post.tags?.length ? (
          <p className="blog-tags">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="blog-tag">
                {tag}
              </Link>
            ))}
          </p>
        ) : null}
      </article>
      <BlogSidebar posts={more} postsTitle="Related Blogs" />
      </div>

      {more.length ? (
        <section className="blog-more">
          <h2>Similar Blogs</h2>
          <div className="blog-grid">
            {more.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
