"use client";

import { useId, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";

const LABELS = ["Home", "Work", "Other"];

// Pulls an address out of OpenStreetMap's reverse-geocoding answer. Only what
// it reliably knows is filled in; the rest is left for the customer to type.
async function lookupAddress(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("lookup failed");
  const data = await response.json();
  const a = data.address || {};
  return {
    pincode: String(a.postcode || "").replace(/\D/g, "").slice(0, 6),
    city: a.city || a.town || a.village || a.municipality || a.state_district || a.county || "",
    line1: [a.house_number, a.road, a.neighbourhood || a.suburb].filter(Boolean).join(", "),
    landmark: "",
  };
}

// Add or edit a delivery address — the same two steps as the shopping apps
// people already know: who it is for, then where (pick it from the phone's
// location, or type it in). Used by checkout and by the account page.
export default function AddressForm({ address, onSaved, onCancel }) {
  const { user } = useAuth();
  const uid = useId();
  const id = (name) => `${uid}-${name}`;

  const [form, setForm] = useState(
    address
      ? {
          label: address.label || "Home",
          contactName: address.contactName || "",
          contactPhone: (address.contactPhone || "").replace(/\D/g, "").slice(-10),
          line1: address.line1 || "",
          landmark: address.landmark || "",
          city: address.city || "",
          pincode: address.pincode || "",
          isDefault: Boolean(address.isDefault),
        }
      : {
          label: "Home",
          contactName: user?.name || "",
          contactPhone: (user?.phone || "").replace(/\D/g, "").slice(-10),
          line1: "",
          landmark: "",
          city: "",
          pincode: "",
          isDefault: false,
        }
  );
  // Editing goes straight to the fields; a new address starts with the choice.
  const [showFields, setShowFields] = useState(Boolean(address));
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const digits = (key, max) => (event) =>
    setForm((f) => ({ ...f, [key]: event.target.value.replace(/\D/g, "").slice(0, max) }));

  function getAddress() {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device can't share its location. Use “Enter address” instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        try {
          const found = await lookupAddress(c.latitude, c.longitude);
          setForm((f) => ({
            ...f,
            line1: found.line1 || f.line1,
            city: found.city || f.city,
            pincode: found.pincode || f.pincode,
          }));
          setCoords([c.longitude, c.latitude]);
          setShowFields(true);
        } catch {
          setError("Couldn't read your address from the location. Please enter it below.");
          setShowFields(true);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === 1
            ? "Location permission is off. Allow it in your browser, or use “Enter address”."
            : "Couldn't get your location. Use “Enter address” instead."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  const valid =
    form.contactName.trim() &&
    form.contactPhone.length === 10 &&
    form.line1.trim() &&
    form.city.trim() &&
    form.pincode.length === 6;

  async function save(event) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    const body = { ...form, contactName: form.contactName.trim(), contactPhone: form.contactPhone };
    if (coords) body.location = { type: "Point", coordinates: coords };
    try {
      if (address) {
        await api.patch(`/auth/me/addresses/${address.id}`, body);
      } else {
        await api.post("/auth/me/addresses", body);
      }
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="ae-form">
      <div className="ae-body">
        <section className="ae-card">
          <div className="ae-row">
            <label className="ae-field" htmlFor={id("name")}>
              <input
                id={id("name")}
                type="text"
                placeholder=" "
                autoComplete="name"
                value={form.contactName}
                onChange={set("contactName")}
              />
              <span>Name *</span>
            </label>
            <label className="ae-field" htmlFor={id("phone")}>
              <input
                id={id("phone")}
                type="tel"
                inputMode="numeric"
                placeholder=" "
                autoComplete="tel-national"
                value={form.contactPhone}
                onChange={digits("contactPhone", 10)}
              />
              <span>Contact number *</span>
            </label>
          </div>
        </section>

        {error ? <p className="notice error ae-note">{error}</p> : null}

        {!showFields ? (
          <section className="ae-card ae-choice">
            <button type="button" className="ae-locate" onClick={getAddress} disabled={locating}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              {locating ? "Finding your location…" : "Get address"}
            </button>
            <button type="button" className="ae-enter" onClick={() => setShowFields(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Enter address
            </button>
          </section>
        ) : (
          <section className="ae-card">
            <button type="button" className="ae-relocate" onClick={getAddress} disabled={locating}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              {locating ? "Finding your location…" : "Use my current location"}
            </button>

            <div className="ae-row">
              <label className="ae-field" htmlFor={id("pincode")}>
                <input
                  id={id("pincode")}
                  type="tel"
                  inputMode="numeric"
                  placeholder=" "
                  autoComplete="postal-code"
                  value={form.pincode}
                  onChange={digits("pincode", 6)}
                />
                <span>Pincode *</span>
              </label>
              <label className="ae-field" htmlFor={id("city")}>
                <input id={id("city")} type="text" placeholder=" " autoComplete="address-level2" value={form.city} onChange={set("city")} />
                <span>City *</span>
              </label>
            </div>

            <label className="ae-field" htmlFor={id("line1")}>
              <input id={id("line1")} type="text" placeholder=" " autoComplete="address-line1" value={form.line1} onChange={set("line1")} />
              <span>House no., building, street, area *</span>
            </label>

            <label className="ae-field" htmlFor={id("landmark")}>
              <input id={id("landmark")} type="text" placeholder=" " value={form.landmark} onChange={set("landmark")} />
              <span>Landmark (optional)</span>
            </label>

            <div className="ae-label-pick" role="radiogroup" aria-label="Save address as">
              <span>Save address as</span>
              {LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={form.label === label}
                  className={form.label === label ? "on" : ""}
                  onClick={() => setForm((f) => ({ ...f, label }))}
                >
                  {label}
                </button>
              ))}
            </div>

            {!address?.isDefault ? (
              <label className="addr-default-check">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Make this my default address
              </label>
            ) : null}
          </section>
        )}
      </div>

      {showFields ? (
        <div className="ae-foot">
          <button className="ae-save" disabled={saving || !valid}>
            {saving ? "Saving…" : address ? "Save changes" : "Save address"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
