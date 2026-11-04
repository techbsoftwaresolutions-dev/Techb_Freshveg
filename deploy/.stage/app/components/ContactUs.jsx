"use client";

import { useEffect, useState } from "react";

const PHONE = "+919003597158";
const PHONE_LABEL = "+91 90035 97158";

// "Contact Us" link that opens an in-page popup with the store's details,
// instead of firing a tel: link (which the browser answers with a "pick an
// app" alert on a computer).
export default function ContactUs({ className = "footer-link-btn", children = "Contact Us" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_LABEL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the number is on screen to read out
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open ? (
        <div className="confirm-backdrop" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div className="confirm-dialog contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-title">
            <button type="button" className="contact-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="confirm-icon contact-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <h2 id="contact-title">Contact us</h2>
            <p>Call and we will help with an order, a payment or anything else.</p>

            <ul className="contact-list">
              <li>
                <span>Phone</span>
                <strong>{PHONE_LABEL}</strong>
              </li>
              <li>
                <span>Website</span>
                <strong>hosurbasket.com</strong>
              </li>
              <li>
                <span>Address</span>
                <strong>Hosur, Tamil Nadu</strong>
              </li>
            </ul>

            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={copy}>
                {copied ? "Copied ✓" : "Copy number"}
              </button>
              <a href={`tel:${PHONE}`} className="confirm-btn contact-call">
                Call now
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
