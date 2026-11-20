"use client";

import { useEffect, useRef } from "react";

// The "Coming soon" banner. Opened by lib/launch.openComingSoon() from any checkout
// button. It is a <dialog> so it sits above the cart drawer, which is one too.
export default function ComingSoonModal() {
  const dialog = useRef(null);
  const previousOverflow = useRef(null);

  const close = () => dialog.current?.close();

  useEffect(() => {
    const open = () => {
      const el = dialog.current;
      if (!el || el.open) return;
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      el.showModal();
    };
    window.addEventListener("hb:coming-soon", open);
    return () => window.removeEventListener("hb:coming-soon", open);
  }, []);

  return (
    <dialog
      ref={dialog}
      className="coming-soon"
      aria-label="Hosur Basket is coming soon"
      onClose={() => {
        if (previousOverflow.current !== null) {
          document.body.style.overflow = previousOverflow.current;
          previousOverflow.current = null;
        }
      }}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
    >
      <button type="button" className="coming-soon-close" aria-label="Close" onClick={close}>×</button>
      <img src="/coming-soon.jpg" alt="Hosur Basket — coming soon, opening 13 November. Fresh groceries, healthy living, happier you. Visit hosurbasket.com" />
    </dialog>
  );
}
