"use client";

import { useEffect, useRef, useState } from "react";

// Two ways to pass a product on: WhatsApp (left) and a plain link copy (right).
// The link is read from the address bar when tapped, so it is always the page
// the shopper is actually on, whatever domain the site is served from.
export default function ShareRow({ name }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pageUrl = () => (typeof window === "undefined" ? "" : window.location.href.split("#")[0]);

  function shareOnWhatsApp(event) {
    // The href is only a fallback for "open in new tab"; build the real one now.
    event.preventDefault();
    const text = `Check out ${name} on Hosur Basket: ${pageUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const url = pageUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API refuses on plain http or old browsers: select-and-copy.
      const box = document.createElement("textarea");
      box.value = url;
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      try {
        document.execCommand("copy");
      } catch {}
      box.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pdp-share">
      <a
        className="pdp-share-btn whatsapp"
        href="https://wa.me/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={shareOnWhatsApp}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.2A8.5 8.5 0 1 1 20.5 11.5Z" />
          <path d="M9.2 8.9c.3 2.4 2.7 4.8 5.1 5.1l1.2-1.3-1.9-1-.9.7a4 4 0 0 1-1.8-1.8l.7-.9-1-1.9Z" />
        </svg>
        <span className="pdp-share-label"><span className="pdp-share-prefix">Share on </span>WhatsApp</span>
      </a>
      <button type="button" className="pdp-share-btn" onClick={copyLink}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
        </svg>
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
