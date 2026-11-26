"use client";

import { usePathname } from "next/navigation";

// On a phone the bottom tabs (Home, Categories, Cart, Orders, Account) are app
// screens, not web pages: the site footer (shop links, contact details) under
// them is just noise, so it is hidden there. Other pages (a product, a search),
// and every page on wider screens, keep the footer.
const TAB_SCREENS = ["/", "/c", "/cart", "/checkout", "/orders", "/account"];
const onTabScreen = (path) =>
  path === "/" || TAB_SCREENS.some((root) => root !== "/" && (path === root || path.startsWith(`${root}/`)));
export default function FooterGate({ children }) {
  const pathname = usePathname() || "";
  return <div className={onTabScreen(pathname) ? "footer-gate hide-on-phone" : "footer-gate"}>{children}</div>;
}
