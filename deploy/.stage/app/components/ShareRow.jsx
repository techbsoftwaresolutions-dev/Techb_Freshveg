"use client";

import { useEffect, useRef, useState } from "react";

// Two ways to pass a product on: WhatsApp (left) and a plain link copy (right).
// The link is read from the address bar when tapped, so it is always the page
// the shopper is actually on, whatever domain the site is served from.
export default function ShareRow({ name }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const dismissOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pageUrl = () => (typeof window === "undefined" ? "" : window.location.href.split("#")[0]);

  function shareOnWhatsApp(event) {
    // The href is only a fallback for "open in new tab"; build the real one now.
    event.preventDefault();
    const text = `Check out ${name} on Hosur Basket: ${pageUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function shareTo(target) {
    const url = pageUrl();
    const text = `Check out ${name} on Hosur Basket: ${url}`;
    if (target === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
      return;
    }
    // Instagram and ShareChat don't expose a public web URL for composing a
    // post with a link. Copy the product URL first, then open the app/site.
    copyLink().then(() => {
      window.open(target === "instagram" ? "https://www.instagram.com/" : "https://sharechat.com/", "_blank", "noopener,noreferrer");
    });
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
    <div className="pdp-share" ref={rootRef}>
      <button type="button" className="pdp-share-trigger" aria-label="Share product" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <SocialIcon type="share" />
      </button>
      {open ? (
        <div className="pdp-share-menu" aria-label="Share this product">
          <a className="pdp-share-btn whatsapp" href="https://wa.me/" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="WhatsApp" onClick={(event) => { setOpen(false); shareOnWhatsApp(event); }}>
            <SocialIcon type="whatsapp" />
          </a>
          <button type="button" className="pdp-share-btn instagram" aria-label="Share on Instagram" title="Instagram" onClick={() => { setOpen(false); shareTo("instagram"); }}><SocialIcon type="instagram" /></button>
          <button type="button" className="pdp-share-btn facebook" aria-label="Share on Facebook" title="Facebook" onClick={() => { setOpen(false); shareTo("facebook"); }}><SocialIcon type="facebook" /></button>
          <button type="button" className="pdp-share-btn copy-share" aria-label={copied ? "Link copied" : "Copy link"} title={copied ? "Copied" : "Copy link"} onClick={() => { setOpen(false); copyLink(); }}><SocialIcon type="link" /></button>
        </div>
      ) : null}
    </div>
  );
}

function SocialIcon({ type }) {
  const common = { viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": true };
  if (type === "share") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/></svg>;
  if (type === "facebook") return <svg {...common} fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2V10H7.5v3h2.8v8h3.2Z" /></svg>;
  if (type === "instagram") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.7" cy="6.7" r=".8" fill="currentColor" stroke="none"/></svg>;
  if (type === "whatsapp") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.2A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M9.2 8.9c.3 2.4 2.7 4.8 5.1 5.1l1.2-1.3-1.9-1-.9.7a4 4 0 0 1-1.8-1.8l.7-.9-1-1.9Z"/></svg>;
  if (type === "sharechat") return <svg {...common} fill="currentColor"><path d="M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Zm-3.8 6a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 0 1-3.6 0Zm4.1 6.2a1.7 1.7 0 1 1 3.4 0 1.7 1.7 0 0 1-3.4 0Zm-4.8 1.7a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0Z"/></svg>;
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/></svg>;
}
