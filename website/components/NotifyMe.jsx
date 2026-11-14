"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./Providers";
import { ensureLoaded, subscribe, unwatch, watch } from "@/lib/stock-alerts";

// Shown instead of "Add to Cart" while an item is out of stock: tap to be told
// when it is back (tap again to stop). Signed-out shoppers are sent to sign in.
export default function NotifyMe({ variantId, fullWidth = false, size = "sm" }) {
  const { signedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (!signedIn || !variantId) return undefined;
    ensureLoaded();
    return subscribe((set) => setOn(set.has(String(variantId))));
  }, [signedIn, variantId]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  if (!variantId) return null;

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    setBusy(true);
    try {
      if (on) {
        await unwatch(variantId);
        setFlash("Alert removed");
      } else {
        await watch(variantId);
        setFlash("We'll notify you");
      }
    } catch (err) {
      setFlash(err.message || "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`add-btn notify-btn${on ? " on" : ""}${size === "lg" ? " lg" : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      title={on ? "You'll be notified when it's back — tap to cancel" : "Notify me when it's back in stock"}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span>{flash || (on ? "Notifying" : "Notify me")}</span>
    </button>
  );
}
