"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

// "Return items" on a delivered order. The server decides what is still
// returnable (each category sets its own window, and some items — fresh
// produce, dairy — are not returnable at all), so this only shows its answer.

const REASONS = [
  "Damaged or spoiled",
  "Expired",
  "Wrong item delivered",
  "Missing quantity",
  "Poor quality",
  "Other",
];

const MAX_PHOTOS = 5;

// Phone photos are several MB; this sends a JPEG at most 1280px on its long side.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read that photo"))), "image/jpeg", 0.85);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a photo we can read"));
    };
    image.src = url;
  });
}

export default function ReturnRequest({ orderId, items, pending = false, autoOpen = false, onDone }) {
  const [check, setCheck] = useState(null); // { eligible, items, reason, expiresAt }
  const [now, setNow] = useState(() => Date.now());
  const [version, setVersion] = useState(0); // bumped to re-ask the server after a request
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]); // uploaded URLs
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef(null);

  async function addPhotos(files) {
    const room = MAX_PHOTOS - photos.length;
    const list = [...(files || [])].filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (fileInput.current) fileInput.current.value = "";
    if (!list.length) return;
    setError("");
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const { url } = await api.upload("/uploads/return-photo", await shrink(file));
          setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, url] : p));
        } catch (err) {
          setError(err.message || "Could not upload that photo");
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
  }

  useEffect(() => {
    let live = true;
    api
      .get(`/returns/orders/${orderId}/returnable`)
      .then((d) => {
        if (!live) return;
        setCheck(d);
        if (autoOpen && d.eligible && version === 0) setOpen(true);
      })
      .catch(() => live && setCheck({ eligible: false, items: [], reason: "" }));
    return () => {
      live = false;
    };
  }, [orderId, autoOpen, version]);

  // Ticks the countdown; stops once the window has closed.
  useEffect(() => {
    if (!check?.expiresAt) return undefined;
    const end = new Date(check.expiresAt).getTime();
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= end) {
        clearInterval(timer);
        setOpen(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [check?.expiresAt]);

  // The page behind does not scroll while the sheet is open; Escape closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, busy]);

  if (!check) return null;

  // Returns close a fixed time after delivery (the server enforces it too);
  // once that passes the button simply goes away.
  const deadline = check.expiresAt ? new Date(check.expiresAt).getTime() : 0;
  const left = deadline ? deadline - now : 0;
  const closed = check.expired || (deadline && left <= 0);

  // An earlier request that was declined: the customer always sees why.
  const declinedNote = check.declined ? (
    <div className="return-declined" role="status">
      <strong>Return declined</strong>
      <p>{check.declined.reason || "Your return request was not approved."}</p>
      {check.limitReached ? (
        <em>You&apos;ve used all {check.maxAttempts || 5} return requests for this order.</em>
      ) : !closed && check.eligible ? (
        <em>
          You can request again with clearer photos — {check.attemptsLeft} of {check.maxAttempts || 5} request
          {check.attemptsLeft === 1 ? "" : "s"} left.
        </em>
      ) : null}
    </div>
  ) : null;

  if (closed) return declinedNote;
  const leftLabel = left >= 60000 ? `${Math.ceil(left / 60000)} min left` : `${Math.max(1, Math.ceil(left / 1000))} sec left`;

  const image = (orderItem) => items?.find((i) => String(i.id) === String(orderItem))?.image;
  const chosen = check.items.filter((i) => i.eligible && picked[i.orderItem]);
  const refund = chosen.reduce((sum, i) => sum + (i.amount || 0), 0);

  async function submit() {
    if (!chosen.length) return setError("Choose at least one item to return.");
    if (!reason) return setError("Tell us what went wrong.");
    if (!photos.length) return setError("Add at least one photo of the item.");
    setBusy(true);
    setError("");
    try {
      await api.post(`/returns/orders/${orderId}/request`, {
        items: chosen.map((i) => ({ orderItem: i.orderItem })),
        reason: note.trim() ? `${reason} — ${note.trim()}` : reason,
        photos,
      });
      setOpen(false);
      setPicked({});
      setPhotos([]);
      setReason("");
      setNote("");
      setVersion((v) => v + 1);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!check.eligible) {
    if (check.limitReached || check.declined) return declinedNote;
    const anyItems = check.items.length > 0;
    return anyItems ? (
      <p className="return-none">
        {check.items.every((i) => i.reason === "This item cannot be returned")
          ? "Items in this order can't be returned. If something arrived damaged or wrong, contact Help."
          : check.reason || "This order can no longer be returned."}
      </p>
    ) : null;
  }

  return (
    <>
      {declinedNote}
      <button type="button" className="btn block return-open" onClick={() => setOpen(true)}>
        {pending ? "Report another item" : check.declined ? "Request return again" : "Return items"}{" "}
        <span className="return-left">· {leftLabel}</span>
      </button>

      {check.attempts > 0 && check.attemptsLeft > 0 ? (
        <p className="return-count">
          {check.attemptsLeft} of {check.maxAttempts || 5} requests left on this order
        </p>
      ) : null}

      {open ? (
        <div className="return-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div className="return-sheet" role="dialog" aria-modal="true" aria-labelledby="return-title">
            <div className="return-head">
              <h2 id="return-title">
                Return items <small className="return-left">{leftLabel}</small>
              </h2>
              <button type="button" className="return-x" aria-label="Close" onClick={() => setOpen(false)} disabled={busy}>
                ×
              </button>
            </div>

            <p className="return-step">Which items?</p>
            <ul className="return-items">
              {check.items.map((i) => (
                <li key={i.orderItem} className={i.eligible ? "" : "off"}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!i.eligible}
                      checked={Boolean(picked[i.orderItem])}
                      onChange={(e) => setPicked((p) => ({ ...p, [i.orderItem]: e.target.checked }))}
                    />
                    <span className="order-thumb">{image(i.orderItem) ? <img src={image(i.orderItem)} alt="" /> : i.name?.[0]}</span>
                    <span className="return-item-name">
                      <strong>{i.name}</strong>
                      <em>
                        {i.eligible
                          ? `${i.variantName ? `${i.variantName} · ` : ""}×${i.quantity}`
                          : i.reason}
                      </em>
                    </span>
                    {i.eligible ? <b>{rupees(i.amount)}</b> : null}
                  </label>
                </li>
              ))}
            </ul>

            <p className="return-step">What went wrong?</p>
            <div className="return-reasons">
              {REASONS.map((r) => (
                <button key={r} type="button" className={reason === r ? "on" : ""} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <p className="return-step">
              Add photos <span className="return-req">Required</span>
            </p>
            <p className="return-hint">Show the problem clearly — the item, the damage or the label. Up to {MAX_PHOTOS} photos.</p>
            <div className="return-photos">
              {photos.map((src) => (
                <span key={src} className="return-photo">
                  <img src={src} alt="Your return photo" />
                  <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== src))} disabled={busy}>
                    ×
                  </button>
                </span>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <span key={`u${i}`} className="return-photo loading" aria-label="Uploading">
                  <i />
                </span>
              ))}
              {photos.length + uploading < MAX_PHOTOS ? (
                <button type="button" className="return-photo-add" onClick={() => fileInput.current?.click()} disabled={busy}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  <span>{photos.length ? "Add more" : "Add photo"}</span>
                </button>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => addPhotos(e.target.files)}
              />
            </div>

            <textarea
              rows={2}
              maxLength={300}
              placeholder="Anything else we should know? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {error ? <p className="notice error" style={{ margin: "10px 0 0" }}>{error}</p> : null}

            <div className="return-foot">
              {refund > 0 ? (
                <span>
                  Refund up to <strong>{rupees(refund)}</strong>
                </span>
              ) : (
                <span>Select items to return</span>
              )}
              <button type="button" className="btn primary" disabled={busy || uploading > 0} onClick={submit}>
                {busy ? "Sending…" : uploading ? "Uploading…" : "Request return"}
              </button>
            </div>
            <p className="return-fine">We&apos;ll review it and arrange a pickup. Refunds go to your wallet or original payment method.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
