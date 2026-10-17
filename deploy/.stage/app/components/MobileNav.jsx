"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./Providers";

// The phone's primary navigation, fixed to the bottom of the screen where a
// thumb can reach it — the header's account and cart buttons are hidden at
// this width, so these five are the way around the shop. Desktop never sees
// it (hidden in CSS above 720px).
const ITEMS = [
  { href: "/", label: "Home", icon: IconHome, match: (p) => p === "/" },
  { href: "/c", label: "Categories", icon: IconGrid, match: (p) => p === "/c" || p.startsWith("/c/") },
  { href: "/cart", label: "Cart", icon: IconCart, match: (p) => p === "/cart" || p === "/checkout", badge: true },
  { href: "/orders", label: "Orders", icon: IconBag, match: (p) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: IconUser, match: (p) => p === "/account" || p === "/login" },
];

export default function MobileNav() {
  const pathname = usePathname() || "/";
  const cart = useCart();

  return (
    <nav className="mobile-nav" aria-label="Main">
      {ITEMS.map(({ href, label, icon: Icon, match, badge }) => {
        const here = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-nav-item${here ? " current" : ""}`}
            aria-current={here ? "page" : undefined}
          >
            <span className="mobile-nav-icon">
              <Icon />
              {/* The cart belongs to a device-scoped session the server
                  render cannot see, so the count legitimately differs. */}
              {badge && cart.lineCount > 0 ? (
                <span className="mobile-nav-badge" suppressHydrationWarning>
                  {cart.lineCount}
                </span>
              ) : null}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 22,
  height: 22,
  "aria-hidden": true,
};

function IconHome() {
  return (
    <svg {...iconProps}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5.5h4v5.5" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}
function IconCart() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
function IconBag() {
  return (
    <svg {...iconProps}>
      <path d="M6.5 8h11l1 12.2a1.8 1.8 0 0 1-1.8 1.8H7.3a1.8 1.8 0 0 1-1.8-1.8L6.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" />
    </svg>
  );
}
