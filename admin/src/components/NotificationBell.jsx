import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { IconBell } from "./Icons";
import { rupees } from "./ui";

// The top-bar bell: watches for new orders and support tickets while the admin
// is signed in (checks every 20 seconds, on any page), plays a chime when
// something new arrives, and lists what is waiting.
//
// Browsers only allow sound after the person has interacted with the page, so
// the audio is "unlocked" by the first click or key press anywhere.

const POLL_MS = 20000;
const SOUND_KEY = "hb.notificationSound";

function loadSoundPref() {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

// Two short, soft tones — no audio file needed.
function chime(ctx) {
  const notes = [
    { freq: 880, at: 0 },
    { freq: 1175, at: 0.18 },
  ];
  for (const { freq, at } of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = ctx.currentTime + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  }
}

export default function NotificationBell() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState([]); // new orders not yet looked at
  const [tickets, setTickets] = useState(0);
  const [lowStock, setLowStock] = useState(null);
  const [soundOn, setSoundOn] = useState(loadSoundPref);
  const [toast, setToast] = useState(null);

  const box = useRef(null);
  const ctxRef = useRef(null);
  const knownOrders = useRef(null); // Set of order ids seen so far (null = first poll pending)
  const prevTickets = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const toastTimer = useRef(null);

  const getContext = () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    return ctxRef.current;
  };

  const play = useCallback(() => {
    if (!soundRef.current) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      chime(ctx);
    } catch {
      // Sound is a nicety; never let it break the page.
    }
  }, []);

  // First click or key press anywhere lets the browser play sound later.
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = getContext();
        if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const showToast = useCallback((next) => {
    setToast(next);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const poll = useCallback(async () => {
    if (can("orders.view")) {
      try {
        const res = await api.get("/orders", { limit: 10 });
        const items = res.items || [];
        if (knownOrders.current === null) {
          // First look: this is the baseline, not "new".
          knownOrders.current = new Set(items.map((o) => o.id));
        } else {
          const added = items.filter((o) => !knownOrders.current.has(o.id));
          if (added.length) {
            added.forEach((o) => knownOrders.current.add(o.id));
            setFresh((list) => [...added, ...list].slice(0, 30));
            play();
            const first = added[0];
            showToast({
              text: `New order ${first.code} · ${rupees(first.pricing?.total)}`,
              to: `/orders/${first.id}`,
            });
          }
        }
      } catch {
        // Offline or signed out — try again next tick.
      }
    }

    if (can("customers.view")) {
      try {
        const res = await api.get("/support", { open: "true", limit: 1 });
        const total = res.meta?.total || 0;
        if (prevTickets.current !== null && total > prevTickets.current) {
          play();
          showToast({ text: "New support ticket", to: "/support" });
        }
        prevTickets.current = total;
        setTickets(total);
      } catch {
        // ignore
      }
    }
  }, [can, play, showToast]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Low-stock count is only fetched when the list is opened.
  useEffect(() => {
    if (!open || !can("reports.view")) return;
    api
      .get("/reports/dashboard")
      .then((data) => setLowStock(data?.lowStockCount ?? 0))
      .catch(() => {});
  }, [open, can]);

  const go = (to, orderId) => {
    if (orderId) setFresh((list) => list.filter((o) => o.id !== orderId));
    setOpen(false);
    setToast(null);
    navigate(to);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundRef.current = next;
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // ignore
    }
    if (next) play(); // a short preview, which also unlocks audio
  };

  const count = fresh.length + tickets;

  return (
    <div className="notif-wrap" ref={box}>
      <button
        type="button"
        className="btn ghost sm icon-btn notif-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Notifications"
      >
        <IconBell width="17" height="17" />
        {count > 0 ? <span className="notif-badge">{count > 99 ? "99+" : count}</span> : null}
      </button>

      {open ? (
        <div className="notif-panel" role="menu">
          <div className="notif-head">
            <strong>Notifications</strong>
            <button type="button" className="notif-sound" onClick={toggleSound} title="Turn the alert sound on or off">
              {soundOn ? "🔔 Sound on" : "🔕 Sound off"}
            </button>
          </div>

          {fresh.length ? (
            <>
              <div className="notif-section">
                New orders
                <button type="button" className="notif-clear" onClick={() => setFresh([])}>
                  Mark all read
                </button>
              </div>
              {fresh.slice(0, 8).map((order) => (
                <button key={order.id} type="button" className="notif-item" onClick={() => go(`/orders/${order.id}`, order.id)}>
                  <span className="notif-dot" />
                  <span className="notif-text">
                    <strong>{order.code}</strong>
                    <span className="faint">{order.customerSnapshot?.name || "Customer"}</span>
                  </span>
                  <strong>{rupees(order.pricing?.total)}</strong>
                </button>
              ))}
            </>
          ) : (
            <div className="notif-empty">No new orders</div>
          )}

          <div className="notif-section">Needs attention</div>
          {can("customers.view") ? (
            <button type="button" className="notif-item" onClick={() => go("/support")}>
              <span className={`notif-dot${tickets ? "" : " off"}`} />
              <span className="notif-text">Open support tickets</span>
              <strong>{tickets}</strong>
            </button>
          ) : null}
          {can("inventory.view") ? (
            <button type="button" className="notif-item" onClick={() => go("/inventory")}>
              <span className={`notif-dot${lowStock ? " warn" : " off"}`} />
              <span className="notif-text">Low stock items</span>
              <strong>{lowStock ?? "…"}</strong>
            </button>
          ) : null}
          {can("orders.view") ? (
            <button type="button" className="notif-item" onClick={() => go("/orders")}>
              <span className="notif-dot off" />
              <span className="notif-text">All orders</span>
              <span className="faint">›</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {toast ? (
        <button type="button" className="notif-toast" onClick={() => go(toast.to)}>
          <IconBell width="16" height="16" />
          {toast.text}
        </button>
      ) : null}
    </div>
  );
}
