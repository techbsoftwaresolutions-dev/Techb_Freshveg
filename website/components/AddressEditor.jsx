"use client";

import { useEffect } from "react";
import AddressForm from "@/components/AddressForm";

// Add / edit address as its own screen: full-screen on a phone, a centred card
// on a computer. `address` set = edit, unset = add.
export default function AddressEditor({ address, onClose, onSaved }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="ae-overlay" role="dialog" aria-modal="true" aria-label={address ? "Edit delivery address" : "Add delivery address"}>
      <div className="ae-screen">
        <header className="ae-head">
          <button type="button" className="ae-back" onClick={onClose} aria-label="Back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h2>{address ? "Edit delivery address" : "Add delivery address"}</h2>
        </header>
        <AddressForm address={address} onCancel={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}
