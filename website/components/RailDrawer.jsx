"use client";

import { useEffect, useState } from "react";

const CLOSED_KEY = "commerce.web.railClosed";

// The phone's category rail, open by default. Tapping the page title in the
// browse header (ListingSearch) sends "cat-rail-toggle", which hides it so the
// products get the whole width, and shows it again on the next tap. The
// choice is remembered from page to page.
export default function RailDrawer({ children }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLOSED_KEY) === "1") setOpen(false);
    } catch {
      // Storage blocked — it simply starts open.
    }
    const toggle = () => setOpen((v) => !v);
    window.addEventListener("cat-rail-toggle", toggle);
    return () => window.removeEventListener("cat-rail-toggle", toggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("cat-rail-state", { detail: open }));
    document.body.classList.toggle("cat-rail-closed", !open);
    try {
      localStorage.setItem(CLOSED_KEY, open ? "0" : "1");
    } catch {
      // Not fatal.
    }
    return () => document.body.classList.remove("cat-rail-closed");
  }, [open]);

  return <section className="cat-drawer">{children}</section>;
}
