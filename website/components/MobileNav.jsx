"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./Providers";
import Icon from "./Icon";

// The phone's primary navigation, fixed to the bottom of the screen where a
// thumb can reach it — the header's account and cart buttons are hidden at
// this width, so these five are the way around the shop. Desktop never sees
// it (hidden in CSS above 720px).
const ITEMS = [
  { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { href: "/c", label: "Categories", icon: "categories", match: (p) => p === "/c" || p.startsWith("/c/") },
  { href: "/cart", label: "Cart", icon: "cart", match: (p) => p === "/cart" || p === "/checkout", badge: true },
  { href: "/orders", label: "Orders", icon: "orders", match: (p) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: "account", match: (p) => p === "/account" || p === "/login" },
];

// Scroll-away tuning: the bar never hides within TOP_ZONE px of the top, and
// flips only after FLIP px of travel in one direction, so finger jitter and
// scroll noise never toggle it.
const TOP_ZONE = 56;
const FLIP = 12;

export default function MobileNav() {
  const pathname = usePathname() || "/";
  const cart = useCart();

  // The bar slides away while the shopper scrolls down and comes back as soon
  // as they scroll up a little, or reach the top or the very bottom (where the
  // body's padding has room for it). The state lives on <html data-nav-hidden>,
  // not in React: scrolling never re-renders, and the bars stacked above the
  // nav (globals.css) follow it down. Re-run per page so a new page starts with
  // the bar showing.
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    let travel = 0; // px moved in the current direction
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY); // iOS overscroll goes negative
      const dy = y - lastY;
      lastY = y;
      // A jump of a whole screen is the browser restoring or an anchor, not a
      // swipe: keep the bar as it is.
      if (Math.abs(dy) > window.innerHeight) return;
      travel = dy * travel > 0 ? travel + dy : dy;
      const atEnd = y + window.innerHeight >= root.scrollHeight - 2;
      if (y < TOP_ZONE || atEnd || travel < -FLIP) delete root.dataset.navHidden;
      else if (travel > FLIP) root.dataset.navHidden = "";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      delete root.dataset.navHidden;
    };
  }, [pathname]);

  return (
    <nav className="mobile-nav" aria-label="Main">
      {ITEMS.map(({ href, label, icon, match, badge }) => {
        const here = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-nav-item${here ? " current" : ""}`}
            aria-current={here ? "page" : undefined}
            aria-label={label}
          >
            <span className="mobile-nav-icon">
              <Icon name={icon} size={26} />
              {/* The cart belongs to a device-scoped session the server
                  render cannot see, so the count legitimately differs. */}
              {badge && cart.lineCount > 0 ? (
                <span className="mobile-nav-badge" suppressHydrationWarning>
                  {cart.lineCount}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
