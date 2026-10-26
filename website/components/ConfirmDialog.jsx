"use client";

import { useEffect, useRef } from "react";

// The site's window.confirm. A native <dialog> opened with showModal(), so the
// browser does the hard parts: the page behind is inert, focus stays inside,
// Escape cancels. A click on the backdrop lands on the dialog itself, outside
// the box, and cancels too. While `busy` it stays open and can't be confirmed
// twice.
export default function ConfirmDialog({ open, title, message, confirmText = "Confirm", cancelText = "Cancel", busy, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const cancel = () => !busy && onCancel();

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => e.target === e.currentTarget && cancel()}
    >
      <div className="confirm-dialog-box">
        <h2 id="confirm-dialog-title">{title}</h2>
        {message ? <p id="confirm-dialog-desc">{message}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={cancel} disabled={busy} autoFocus>
            {cancelText}
          </button>
          <button type="button" className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait…" : confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}
