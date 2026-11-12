"use client";

import Link from "next/link";

// Shown in place of /checkout until the shop opens.
export default function ComingSoonPage() {
  return (
    <div className="wrap coming-soon-page">
      <img src="/coming-soon.jpg" alt="Hosur Basket — coming soon, opening 13 November. Visit hosurbasket.com" />
      <p>Ordering opens on 13 November. Your cart is saved until then.</p>
      <Link href="/" className="btn primary">Back to the shop</Link>
    </div>
  );
}
