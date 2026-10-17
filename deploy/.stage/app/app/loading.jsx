"use client";

import { useBranding } from "@/components/Providers";

// Shown while a page is loading (Next.js streams it in first): the logo with
// a soft pulse and a ring, instead of a blank screen.
export default function Loading() {
  const brand = useBranding();
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-ring" aria-hidden="true" />
      <img src={brand.logo} alt="" width="96" height="96" className="page-loader-logo" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
