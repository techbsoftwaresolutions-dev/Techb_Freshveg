import Link from "next/link";

// The friendly "nothing here yet" screen shared by My Orders and Your wishlist:
// artwork, a headline with one highlighted word, a line of text and a button.
export default function EmptyHero({ before = "No", word, after = "yet", text, cta = "Start Shopping", href = "/", onClick }) {
  return (
    <div className="empty-hero">
      <img className="empty-hero-art" src="/empty-state-art.png" alt="" width="560" height="373" />
      <h2 className="empty-hero-title">
        {before} <span>{word}</span> {after}
      </h2>
      {text ? <p className="empty-hero-text">{text}</p> : null}
      <Link href={href} className="empty-hero-btn" onClick={onClick}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
          <circle cx="9.5" cy="19.2" r="1.3" />
          <circle cx="17" cy="19.2" r="1.3" />
        </svg>
        <span>{cta}</span>
        <i aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </i>
      </Link>
    </div>
  );
}
