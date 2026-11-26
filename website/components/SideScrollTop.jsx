"use client";

import { useEffect } from "react";

// On wide screens the category sidebar scrolls in its own box, which keeps
// its scroll when another category is opened. The department just opened is
// listed first (DepartmentNav), so the box goes back to the top to show it.
export default function SideScrollTop({ slug }) {
  useEffect(() => {
    const side = document.querySelector(".cat-side");
    if (side) side.scrollTop = 0;
  }, [slug]);
  return null;
}
