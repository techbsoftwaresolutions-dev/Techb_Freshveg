"use client";

import { useEffect, useState } from "react";

// A "Call" button that opens an in-page popup (name, number, Copy, Call now)
// instead of firing a tel: link straight away — on a computer the browser
// answers a tel: link with an "Open Pick an app?" alert. On a phone the tap
// dials at once, as people expect.
export default function CallButton({ phone, name = "", title = "Call", className = "btn sm primary", children = "Call", label }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const number = String(phone || "").trim();
  const shown = label || number;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!number) return null;

  const press = () => {
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (touch) window.location.href = `tel:${number}`;
    else setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the number is on screen to read out
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={press}>
        {children}
      </button>

      {open ? (
        <div className="confirm-backdrop" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div className="confirm-dialog contact-dialog" role="dialog" aria-modal="true" aria-labelledby="call-title">
            <button type="button" className="contact-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="confirm-icon contact-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <h2 id="call-title">{title}</h2>
            {name ? <p>{name}</p> : null}

            <ul className="contact-list">
              <li>
                <span>Phone</span>
                <strong>{shown}</strong>
              </li>
            </ul>

            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={copy}>
                {copied ? "Copied ✓" : "Copy number"}
              </button>
              <a href={`tel:${number}`} className="confirm-btn contact-call">
                Call now
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
