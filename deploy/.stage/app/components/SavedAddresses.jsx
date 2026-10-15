"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import AddressForm from "@/components/AddressForm";
import { useServiceability } from "@/lib/use-serviceability";

const fullAddress = (a) => [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ");

// The account page's address card, all in place — no popups. It shows the
// address orders go to with a "Change" button; pressing it opens the list right
// here (pick one, Edit, Delete, or Add new address), and Edit / Add open the
// form in the same card.
export default function SavedAddresses() {
  const { user, refreshUser } = useAuth();
  const addresses = user?.addresses || [];
  const current = addresses.find((a) => a.isDefault) || addresses[0] || null;
  const serviceable = useServiceability(addresses.map((a) => a.pincode));

  // "view" | "list" | "form"
  const [mode, setMode] = useState("view");
  const [editing, setEditing] = useState(null); // address being edited; null = adding
  const [confirmId, setConfirmId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const finish = async (text) => {
    await refreshUser();
    setEditing(null);
    setConfirmId(null);
    setMode("view");
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  async function choose(id) {
    setError("");
    if (current?.id === id) {
      setMode("view");
      return;
    }
    try {
      await api.patch(`/auth/me/addresses/${id}`, { isDefault: true });
      await finish("Default address updated");
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(address) {
    setError("");
    try {
      await api.del(`/auth/me/addresses/${address.id}`);
      await finish("Address removed");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="addr-book">
      {message ? <p className="notice ok addr-note">{message}</p> : null}
      {error ? <p className="notice error addr-note">{error}</p> : null}

      {/* The form, in place */}
      {mode === "form" ? (
        <div className="ae-inline">
          <div className="addr-inline-head">
            <strong>{editing ? "Edit delivery address" : "Add delivery address"}</strong>
            <button type="button" className="ap-link" onClick={() => { setEditing(null); setMode(addresses.length ? "list" : "view"); }}>
              Cancel
            </button>
          </div>
          <AddressForm
            address={editing || undefined}
            onCancel={() => setMode(addresses.length ? "list" : "view")}
            onSaved={() => finish(editing ? "Address updated" : "Address added")}
          />
        </div>
      ) : null}

      {/* The list, in place */}
      {mode === "list" ? (
        <div className="addr-inline-list">
          <div className="addr-inline-head">
            <strong>Change delivery address</strong>
            <button type="button" className="ap-link" onClick={() => { setConfirmId(null); setMode("view"); }}>
              Close
            </button>
          </div>

          <button type="button" className="ap-add addr-inline-add" onClick={() => { setEditing(null); setMode("form"); }}>
            + Add new address
          </button>

          <div className="ap-list">
            {addresses.map((address) => {
              const blocked = serviceable(address.pincode) === false;
              const selected = current?.id === address.id;
              return (
                <div key={address.id} className={`ap-item${selected ? " on" : ""}${blocked ? " blocked" : ""}`}>
                  {blocked ? <span className="ap-unserv">Unserviceable</span> : null}
                  <button type="button" className="ap-pick" disabled={blocked} onClick={() => choose(address.id)} aria-pressed={selected}>
                    <span className="ap-copy">
                      <strong>
                        {address.contactName || address.label}
                        <span className="ap-tag">{address.label}</span>
                        {address.isDefault ? <span className="ap-tag brand">Default</span> : null}
                      </strong>
                      <span className="ap-text">{fullAddress(address)}</span>
                      {address.contactPhone ? (
                        <span className="ap-phone">+91 {address.contactPhone.replace(/\D/g, "").slice(-10)}</span>
                      ) : null}
                    </span>
                    <span className={`ap-radio${selected ? " on" : ""}`} aria-hidden="true" />
                  </button>

                  {confirmId === address.id ? (
                    <div className="ap-actions">
                      <span className="ap-confirm">Delete this address?</span>
                      <button type="button" className="ap-link danger" onClick={() => remove(address)}>
                        Yes, delete
                      </button>
                      <button type="button" className="ap-link" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="ap-actions">
                      <button type="button" className="ap-link" onClick={() => { setEditing(address); setMode("form"); }}>
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
      ) : null}

      {/* Just the address, and the one button */}
      {mode === "view" ? (
        current ? (
          <div className="addr-item">
            <div className="addr-top">
              <strong>
                {current.label}
                {current.isDefault ? <span className="addr-badge">Default</span> : null}
              </strong>
              <button type="button" className="addr-btn" onClick={() => setMode("list")}>
                Change
              </button>
            </div>
            <div className="addr-main">
              {current.contactName || current.contactPhone ? (
                <span className="addr-contact">
                  {[current.contactName, current.contactPhone].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              <span className="addr-text">{fullAddress(current)}</span>
            </div>
          </div>
        ) : (
          <>
            <p className="addr-empty">No addresses saved yet. Add one so checkout is quicker next time.</p>
            <button type="button" className="addr-add" onClick={() => { setEditing(null); setMode("form"); }}>
              + Add address
            </button>
          </>
        )
      ) : null}
    </div>
  );
}
