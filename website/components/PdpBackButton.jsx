"use client";

import { useRouter } from "next/navigation";

// Round "<" button floated over the product photo on phones (hidden elsewhere).
export default function PdpBackButton({ fallback = "/" }) {
  const router = useRouter();
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button type="button" className="pdp-back" aria-label="Go back" onClick={back}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 5-7 7 7 7" />
      </svg>
    </button>
  );
}
