"use client";

import { useEffect, useState } from "react";
import { useServiceability } from "@/lib/use-serviceability";

const fullAddress = (a) => [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ");

// "Change delivery address": a bottom sheet on a phone (a centred card on a
// computer) listing every saved address with a radio, an Add new address row
// on top, and an "Unserviceable" tag on addresses we don't deliver to.
export default function AddressPicker({ addresses, selectedId, onSelect, onAdd, onEdit, onDelete, onClose }) {
  const serviceable = useServiceability(addresses.map((a) => a.pincode));
  const [confirmId, setConfirmId] = useState(null);

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
    <div className="ap-overlay" onClick={onClose}>
      <div className="ap-sheet" role="dialog" aria-modal="true" aria-label="Change delivery address" onClick={(e) => e.stopPropagation()}>
        <header className="ap-head">
          <h2>Change delivery address</h2>
          <button type="button" className="ap-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <button type="button" className="ap-add" onClick={onAdd}>
          + Add new address
        </button>

        <div className="ap-list">
          {addresses.map((address) => {
            const ok = serviceable(address.pincode);
            const blocked = ok === false;
            const selected = selectedId === address.id;
            return (
              <div key={address.id} className={`ap-item${selected ? " on" : ""}${blocked ? " blocked" : ""}`}>
                {blocked ? <span className="ap-unserv">Unserviceable</span> : null}
                <button
                  type="button"
                  className="ap-pick"
                  disabled={blocked}
                  onClick={() => onSelect(address.id)}
                  aria-pressed={selected}
                >
                  <span className="ap-copy">
                    <strong>
                      {address.contactName || address.label}
                      <span className="ap-tag">{address.label}</span>
                      {address.isDefault ? <span className="ap-tag brand">Default</span> : null}
                    </strong>
                    <span className="ap-text">{fullAddress(address)}</span>
                    {address.contactPhone ? <span className="ap-phone">+91 {address.contactPhone.replace(/\D/g, "").slice(-10)}</span> : null}
                  </span>
                  <span className={`ap-radio${selected ? " on" : ""}`} aria-hidden="true" />
                </button>

                {confirmId === address.id ? (
                  <div className="ap-actions">
                    <span className="ap-confirm">Delete this address?</span>
                    <button type="button" className="ap-link danger" onClick={() => { setConfirmId(null); onDelete(address); }}>
                      Yes, delete
                    </button>
                    <button type="button" className="ap-link" onClick={() => setConfirmId(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="ap-actions">
                    <button type="button" className="ap-link" onClick={() => onEdit(address)}>
                      Edit
                    </button>
                    <button type="button" className="ap-link danger" onClick={() => setConfirmId(address.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
