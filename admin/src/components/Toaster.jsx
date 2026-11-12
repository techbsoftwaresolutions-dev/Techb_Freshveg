import { useEffect, useState } from "react";

const SHOW_MS = 4000;
let nextId = 1;

// Renders the toasts raised through toast(). Mounted once, in the Layout.
export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const on = (e) => {
      const { text, tone, generic } = e.detail;
      const id = nextId++;
      const at = Date.now();
      setItems((list) => {
        // A specific message replaces a generic one; a generic one is dropped if a specific one just showed.
        if (generic && list.some((t) => !t.generic && at - t.at < 2000)) return list;
        const kept = generic ? list : list.filter((t) => !t.generic);
        return [...kept, { id, text, tone, generic, at }].slice(-4);
      });
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), SHOW_MS);
    };
    window.addEventListener("app:toast", on);
    return () => window.removeEventListener("app:toast", on);
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast-msg ${t.tone}`} onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
