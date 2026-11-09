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
      setItems((list) => [...list.slice(-3), { id, ...event.detail }]);
      const timer = setTimeout(() => {
        setItems((list) => list.filter((item) => item.id !== id));
        timers.delete(timer);
      }, 5000);
      timers.add(timer);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!items.length) return null;
  const TITLES = { error: "Something went wrong", success: "Done", info: "Heads up" };
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
          <div className="toast-body">
            <strong className="toast-title">{TITLES[item.tone] || "Notice"}</strong>
            <span className="toast-msg">{item.message}</span>
          </div>
          <button
            type="button"
            className="toast-x"
            aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <span className="toast-bar" style={{ animationDuration: "5s" }} />
        </div>
      ))}
    </div>
  );
}
