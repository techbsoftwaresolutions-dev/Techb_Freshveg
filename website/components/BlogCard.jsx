import Link from "next/link";
import { img } from "@/lib/format";

export const postDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

// One post on the blog list, the "more to read" row and the home page.
export default function BlogCard({ post, arrow = false }) {
  const href = `/blog/${post.slug}`;
  return (
    <article className={`blog-card${arrow ? " with-go" : ""}`} lang={post.lang === "ta" ? "ta" : undefined}>
      <Link href={href} className="blog-card-img" tabIndex={-1} aria-hidden="true">
        {post.coverImage ? (
          <img src={img(post.coverImage, 640)} alt={post.coverAlt || post.title} loading="lazy" width="640" height="427" />
        ) : (
          <span className="blog-card-noimg" />
        )}
      </Link>
      <div className="blog-card-body">
        {post.category || post.tags?.[0] ? <span className="blog-tag">{post.category || post.tags[0]}</span> : null}
        <h3>
          <Link href={href}>{post.title}</Link>
        </h3>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        {arrow ? (
          <div className="blog-foot">
            <span className="blog-meta">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              {postDate(post.publishedAt)}
            </span>
            <span className="blog-meta">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {post.readingMinutes} min read
            </span>
            <Link href={href} className="blog-go" aria-label={`Read ${post.title}`}>→</Link>
          </div>
        ) : (
          <span className="blog-meta">
            {postDate(post.publishedAt)} · {post.readingMinutes} min read
          </span>
        )}
      </div>
    </article>
  );
}
