import Link from "next/link";
import { LAST_UPDATED, LEGAL_PAGES, POLICY_VERSION, loadPolicy } from "@/lib/legal";

// A policy page from content/legal/<file>.md (see lib/legal.js), in the
// layout the Terms page introduced: hero, contents, numbered sections.
export function legalMetadata(file, description) {
  const page = LEGAL_PAGES.find((p) => p.file === file);
  return { title: page.label, description, alternates: { canonical: page.href } };
}

// **bold** and [text](href) — all the inline markup the policies use.
function Inline({ text }) {
  const parts = [];
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<strong key={match.index}>{match[1]}</strong>);
    else {
      const [, , label, href] = match;
      parts.push(
        href.startsWith("/") || href.startsWith("#") ? (
          <Link key={match.index} href={href}>{label}</Link>
        ) : (
          <a key={match.index} href={href} rel="noopener noreferrer">{label}</a>
        )
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function LegalDocument({ file, children }) {
  const { title, lede, sections } = loadPolicy(file);
  const others = LEGAL_PAGES.filter((p) => p.file !== file);

  return (
    <div className="legal">
      <header className="legal-hero">
        <div className="wrap">
          <nav className="legal-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">›</span>
            <span>{title}</span>
          </nav>
          <h1>{title}</h1>
          {lede.map((text) => (
            <p key={text.slice(0, 40)} className="legal-lede"><Inline text={text} /></p>
          ))}
          <div className="legal-meta">
            <span>Last updated {LAST_UPDATED}</span>
            <span>Effective {LAST_UPDATED}</span>
            <span>Version {POLICY_VERSION}</span>
          </div>
        </div>
      </header>

      <div className="wrap legal-body">
        <aside className="legal-toc" aria-label="On this page">
          <div className="legal-toc-inner">
            <strong>On this page</strong>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="legal-main">
          {children}
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>
                <span className="legal-num">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              {section.blocks.map((block, i) =>
                block.kind === "ul" ? (
                  <ul key={i} className="legal-list">
                    {block.items.map((item) => (
                      <li key={item.slice(0, 50)}><Inline text={item} /></li>
                    ))}
                  </ul>
                ) : block.kind === "h3" ? (
                  <h3 key={i} className="legal-h3">{block.text}</h3>
                ) : (
                  <p key={i}><Inline text={block.text} /></p>
                )
              )}
            </section>
          ))}

          <p className="legal-foot">
            Related:{" "}
            {others.map((page, i) => (
              <span key={page.href}>
                {i ? " · " : ""}
                <Link href={page.href}>{page.label}</Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
