"use client";

import Link from "next/link";
import { rememberCoupon } from "@/lib/pending-coupon";

// "Shop Now" on an offer card. If the offer needs a code, the code is kept so
// checkout can apply it without the customer typing it.
export default function PromoShopLink({ href, code, className, children }) {
  return (
    <Link href={href} className={className} onClick={() => { if (code) rememberCoupon(code); }}>
      {children}
    </Link>
  );
}
