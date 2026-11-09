"use client";

import Link from "next/link";

// A link to the cart that opens the side cart (the same one the header and the
// phone's bottom bar open). Without JavaScript it still goes to /cart.
export default function OpenCartLink({ children = "Cart", className }) {
  return (
    <Link
      href="/cart"
      className={className}
      aria-haspopup="dialog"
      onClick={(event) => {
        event.preventDefault();
        window.dispatchEvent(new Event("open-cart"));
      }}
    >
      {children}
    </Link>
  );
}
