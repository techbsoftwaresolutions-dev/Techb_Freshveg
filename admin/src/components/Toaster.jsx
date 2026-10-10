import { useCallback, useEffect, useRef, useState } from "react";

// Toast pop-ups for the whole admin. Every successful save / create / delete
// made through api (api/client.js) announces itself here, and failures do too,
// so no screen has to wire its own "Saved" message. Anything else can call
// toast("success" | "error" | "info", text) from api/client.js.
const LIFETIME = { success: 3200, info: 3200, error: 6000 };
const MAX_VISIBLE = 4;

export default function Toaster() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 220);
  }, []);

  useEffect(() => {
    const onToast = (event) => {
      const { type = "info", text } = event.detail || {};
      if (!text) return;
      const id = nextId.current++;
      setToasts((list) => {
        const last = list[list.length - 1];
        const fresh = last && !last.leaving && last.type === type;
        // The same message twice in a row (a double click) shows once.
        if (fresh && last.text === text) return list;
        // A screen's own wording ("Category created…") arriving just after the
        // API's generic "Saved successfully" replaces it rather than stacking.
        if (fresh && type === "success" && Date.now() - last.at < 900) {
          return [...list.slice(0, -1), { ...last, text }];
        }
        return [...list, { id, type, text, at: Date.now() }].slice(-MAX_VISIBLE);
      });
      setTimeout(() => dismiss(id), LIFETIME[type] || LIFETIME.info);
    };
    window.addEventListener("admin-toast", onToast);
    return () => window.removeEventListener("admin-toast", onToast);
  }, [dismiss]);

  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}${t.leaving ? " leaving" : ""}`} role={t.type === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden="true">
            {t.type === "success" ? <IconCheck /> : t.type === "error" ? <IconAlert /> : <IconInfo />}
          </span>
          <span className="toast-text">{t.text}</span>
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const iconProps = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };
function IconCheck() {
  return (
    <svg {...iconProps}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg {...iconProps}>
      <path d="M12 8v5M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </svg>
  );
}
