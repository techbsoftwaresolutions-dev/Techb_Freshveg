import Link from "next/link";
import { img } from "@/lib/format";
import { SOCIAL_LINKS } from "@/lib/seo";
import { postDate } from "@/components/BlogCard";

// Right column on the blog list and post pages: related/recent posts, categories and a follow box.
export default function BlogSidebar({ posts = [], postsTitle = "Recent Posts" }) {
  const follow = SOCIAL_LINKS.find((u) => u.includes("instagram")) || SOCIAL_LINKS[0];
  return (
    <aside className="blog-side">
      {posts.length ? (
        <section className="bs-card">
          <h2>{postsTitle}</h2>
          <ul className="bs-posts">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`}>
                  {p.coverImage ? <img src={img(p.coverImage, 160)} alt="" loading="lazy" width="72" height="72" /> : <span className="bs-noimg" />}
                  <span>
                    <b>{p.title}</b>
                    <small>{postDate(p.publishedAt)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bs-card bs-follow">
        <h2>Stay Updated!</h2>
        <p>Get launch updates, fresh offers and grocery tips from Hosur Basket.</p>
        <a href={follow} target="_blank" rel="noopener noreferrer" className="bs-btn">
          Follow for Updates
        </a>
      </section>
    </aside>
  );
}
