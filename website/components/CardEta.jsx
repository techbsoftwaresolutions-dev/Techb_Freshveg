"use client";

import { useStore } from "./Providers";

// The delivery-time chip on a product card, like "⏱ 30 MINS". The number is the
// selected store's own prep time (set in the admin), so it is never a
// hard-coded figure; with no store known yet the chip simply stays away.
export default function CardEta() {
  const { store } = useStore();
  const minutes = Number(store?.prepTimeMinutes ?? store?.settings?.prepTimeMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return (
    <span className="card-eta" title={`Delivery in about ${minutes} minutes`}>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9.5 3h5" />
      </svg>
      {minutes} MINS
    </span>
  );
}
