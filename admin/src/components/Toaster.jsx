import { useEffect, useState } from "react";

// A small toast system: call toast.error("…") / toast.success("…") from anywhere,
// and <Toaster /> (mounted once in App) shows it in the top-right corner for a few seconds.
const EVENT = "admin-toast";

function push(tone, message) {
  if (!message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { tone, message: String(message) } }));
}

export const toast = {
  error: (message) => push("error", message),
  success: (message) => push("success", message),
  info: (message) => push("info", message),
};

let nextId = 1;

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const timers = new Set();
    const onToast = (event) => {
      const id = nextId++;
      const at = Date.now();
      setItems((list) => [
        ...list.filter((item) => !(item.generic && at - item.at < 1500)).slice(-3),
        { id, ...event.detail, at },
      ]);
      const timer = setTimeout(() => {
        setItems((list) => list.filter((item) => item.id !== id));
        timers.delete(timer);
      }, 3500);
      timers.add(timer);
    };
    window.addEventListener(EVENT, onToast);

    // The other toast helper (components/toast.js, used by the API client for
    // its automatic "saved" message) sends { text, tone, generic }. A page's own,
    // more specific message replaces a generic one that just appeared.
    const onAppToast = (event) => {
      const { text, tone, generic } = event.detail || {};
      if (!text) return;
      const mapped = tone === "danger" || tone === "error" ? "error" : tone === "info" ? "info" : "success";
      const id = nextId++;
      const at = Date.now();
      setItems((list) => {
        // A generic "saved" right after a specific message adds nothing.
        if (generic && list.some((item) => !item.generic && at - item.at < 1500)) return list;
        const kept = generic ? list : list.filter((item) => !(item.generic && at - item.at < 1500));
        return [...kept.slice(-3), { id, tone: mapped, message: String(text), generic: Boolean(generic), at }];
      });
      const timer = setTimeout(() => {
        setItems((list) => list.filter((item) => item.id !== id));
        timers.delete(timer);
      }, 3500);
      timers.add(timer);
    };
    window.addEventListener("app:toast", onAppToast);

    return () => {
      window.removeEventListener(EVENT, onToast);
      window.removeEventListener("app:toast", onAppToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
          <span className="toast-ico" aria-hidden="true">
            {item.tone === "success" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            ) : item.tone === "error" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5v7M12 17.4v.1" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11v6M12 7.4v.1" /></svg>
            )}
          </span>
          <span className="toast-text">{item.message}</span>
          <button
            type="button"
            className="toast-x"
            aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
