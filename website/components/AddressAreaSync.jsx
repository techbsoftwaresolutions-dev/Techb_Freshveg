"use client";

import { useEffect } from "react";
import { api } from "@/lib/client-api";
import { useCart } from "./Providers";

const AREA_KEY = "commerce.web.area";
const PINCODE_KEY = "commerce.web.pincode";

const norm = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Delivery is priced per area, and the areas and their charges are set by the
// admin (Settings → Stores) — the shopper is never asked to pick one. Instead the
// area is read from the delivery address they chose: if the address names one of
// the store's areas for its pincode ("Hosur Bastand" in the street, landmark or
// city), that area prices the order. Renders nothing.
export default function AddressAreaSync({ address }) {
  const cart = useCart();
  const pincode = address?.pincode;
  const text = address ? norm([address.line1, address.line2, address.landmark, address.city].join(" ")) : "";

  useEffect(() => {
    if (!pincode) return;
    let live = true;
    api
      .get("/storefront/serviceability", { pincode })
      .then((data) => {
        if (!live || !data?.serviceable) return;
        const areas = data.areas || [];
        const haystack = ` ${text} `;
        // Longest name first so "Hosur Bastand" wins over a shorter name inside it.
        const hit = [...areas].sort((a, b) => b.length - a.length).find((name) => haystack.includes(` ${norm(name)} `));
        const next = hit || (areas.length === 1 ? areas[0] : "");
        let current = "";
        try { current = localStorage.getItem(AREA_KEY) || ""; } catch { /* ignore */ }
        // No area found in the address: keep whatever area the shopper already
        // set on the location bar, as long as this pincode really has it.
        const finalArea = next || (areas.includes(current) ? current : "");
        try {
          localStorage.setItem(PINCODE_KEY, pincode);
          localStorage.setItem(AREA_KEY, finalArea);
        } catch { /* ignore */ }
        if (finalArea !== current) {
          window.dispatchEvent(new Event("commerce-area"));
          cart.refresh?.();
        }
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode, text]);

  return null;
}
