import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, rupees, useConfirm } from "../../components/ui";
import {
  clearFailed, computeBill, enqueue, failed, flushQueue, isOffline,
  loadCatalogue, printInvoice, queued, saveCatalogue,
  customerPhone, sendBill, sendMode, wantsWhatsApp,
} from "./billing";
import PosTerminal from "./PosTerminal";
import { DEFAULT_POS_TEMPLATE, posBillHtml } from "./posBill";
import { openPrintWindow } from "../../lib/printFit";
import "./pos.css";
import "./pos-terminal.css";

const HEADER_KEY = "pos.header";
const HELD_KEY = "pos.held";
// The bill being rung up, kept for this tab so opening Hold bills or Past
// bills (their own pages) and coming back does not lose it.
const DRAFT_KEY = "pos.draft";
const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; } };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const money = (p) => rupees(p, { decimals: true });
// Text-box amounts: digits and one decimal point, at most 2 decimals.
const cleanAmount = (v) => {
  const [whole, ...rest] = v.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};

// Small inline icons: the shared icon set has no barcode / hold / printer glyphs.
const PATHS = {
  barcode: "M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3",
  bookmark: "M6 4h12v16l-6-4-6 4z",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  plus: "M12 5v14M5 12h14",
  printer: "M7 9V4h10v5M7 17H4v-6h16v6h-3M7 14h10v6H7z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  cash: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  upi: "M5 19L12 5l7 14M8 14h8",
  card: "M3 6h18v12H3zM3 10h18",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2",
  box: "M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8",
  store: "M4 10v10h16V10M3 10l2-6h14l2 6zM9 20v-5h6v5",
};
const Ico = ({ n, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[n]} />
  </svg>
);

const Thumb = ({ item }) =>
  item.image ? <img className="pos-thumb" src={item.image} alt="" /> : <span className="pos-thumb">{(item.productName || "?")[0]}</span>;

// Quantity box: selects its text on focus so typing replaces the number, and can be
// emptied while typing without deleting the line (an empty/0 box reverts on blur).
function QtyInput({ value, onChange }) {
  const [text, setText] = useState(null); // null = not editing
  return (
    <input
      type="number" step="any" min="0" aria-label="Quantity"
      value={text ?? value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && n > 0) onChange(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}

// Double-click the price to change it for this bill (needs the discount permission).
function PriceCell({ line, editable, onChange }) {
  const [text, setText] = useState(null);
  const base = line.basePrice ?? line.price;
  const commit = () => {
    const n = Number(text);
    if (text !== "" && n >= 0) onChange(Math.round(n * 100));
    setText(null);
  };
  if (text !== null) {
    return (
      <input
        autoFocus type="number" min="0" step="any" aria-label="Price" className="pos-price-edit"
        value={text} onFocus={(e) => e.target.select()} onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setText(null); }}
      />
    );
  }
  return (
    <span
      className={editable ? "pos-price" : undefined}
      title={editable ? "Double-click to change price" : undefined}
      onDoubleClick={editable ? () => setText(String(line.price / 100)) : undefined}
    >
      {line.price !== base && <small className="pos-was">{money(base)}</small>}
      {money(line.price)}
    </span>
  );
}

// Coloured payment-method marks (cash note, UPI, card) as inline SVG.
function MethodIcon({ k }) {
  if (k === "cash") {
    return (
      <svg width="40" height="28" viewBox="0 0 40 28" aria-hidden="true">
        <rect x="1" y="3" width="38" height="22" rx="4" fill="#e3f4ea" stroke="#1f9a52" strokeWidth="2" />
        <circle cx="20" cy="14" r="5" fill="#1f9a52" /><circle cx="8" cy="14" r="1.6" fill="#1f9a52" /><circle cx="32" cy="14" r="1.6" fill="#1f9a52" />
      </svg>
    );
  }
  if (k === "upi") {
    return (
      <svg width="44" height="28" viewBox="0 0 44 28" aria-hidden="true">
        <text x="22" y="12" textAnchor="middle" fontSize="12" fontWeight="800" fontStyle="italic" fill="#3d3d4e">UPI</text>
        <polygon points="14,25 20,15 26,15 20,25" fill="#f26b21" />
        <polygon points="22,25 28,15 34,15 28,25" fill="#1f9a52" />
      </svg>
    );
  }
  return (
    <svg width="40" height="28" viewBox="0 0 40 28" aria-hidden="true">
      <rect x="1" y="3" width="38" height="22" rx="4" fill="#3b6fe0" />
      <rect x="1" y="8" width="38" height="5" fill="#1d3f9b" />
      <rect x="6" y="17" width="12" height="4" rx="1" fill="#fff" opacity=".85" />
    </svg>
  );
}

const METHODS =[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"]];

export default function Pos() {
  const { can, user } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const canDiscount = can("pos.discount");
  const scanRef = useRef(null);
  const quickRef = useRef(null);
  // The billing screen fills the window below the top bar exactly, so the
  // page never scrolls: the bill list and payment column scroll inside.
  const rootRef = useRef(null);
  const [fitHeight, setFitHeight] = useState(null);
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setFitHeight(window.innerWidth > 1000 ? Math.max(520, window.innerHeight - top) : null);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  });
  const charging = useRef(false);
  const draft = useRef(readDraft()).current;
  const billId = useRef(draft.billId || crypto.randomUUID());
  const navigate = useNavigate();
  const location = useLocation();

  const [catalogue, setCatalogue] = useState(loadCatalogue);
  const [header, setHeader] = useState(() => read(HEADER_KEY, null));
  const [lines, setLines] = useState(() => draft.lines || []);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(() => draft.discount || ""); // rupees
  const [customer, setCustomer] = useState(() => draft.customer || null); // { name, phone } once "Add Customer" is used
  const [method, setMethod] = useState("cash");
  const [received, setReceived] = useState(""); // rupees, cash only
  const [split, setSplit] = useState({ cash: "", upi: "", card: "" }); // rupees, "Split" payment (terminal template)
  const [cat, setCat] = useState("All");
  const [held, setHeld] = useState(() => read(HELD_KEY, []));
  // Pay shows the bill first; it is saved and the screen cleared only when
  // "Print bill" is pressed — until then it can still be edited or held.
  const [review, setReview] = useState(false);
  // After the print window closes: "Did the bill print?" - { sale, invoiceNo, offline }.
  // The sale is saved (and the screen cleared) only when the cashier says yes.
  const [printed, setPrinted] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queued().length);
  const [failedCount, setFailedCount] = useState(failed().length);
  const [busy, setBusy] = useState(false);

  const bill = useMemo(
    () => computeBill(lines, canDiscount ? Math.round((Number(discount) || 0) * 100) : 0),
    [lines, discount, canDiscount]
  );
  const receivedPaise = Math.round((Number(received) || 0) * 100);
  const change = receivedPaise - bill.total;
  const toPaise = (v) => Math.round((Number(v) || 0) * 100);
  const splitPaise = toPaise(split.cash) + toPaise(split.upi) + toPaise(split.card);
  // The customer's mobile number is optional: leave it empty, or give all 10
  // digits (a half-typed number is not saved on the bill).
  const phoneOk = !customer?.phone || (/^\d{10}$/.test(customer.phone) && customer.phone !== "0000000000");
  const [needPhone, setNeedPhone] = useState(false);
  useEffect(() => {
    if (phoneOk) setNeedPhone(false);
  }, [phoneOk]);
  // The customer box is open as soon as there is something on the bill.
  useEffect(() => {
    if (lines.length && !customer) setCustomer({ name: "", phone: "", email: "" });
  }, [lines.length, customer]);
  const askPhone = () => {
    setCustomer((c) => c || { name: "", phone: "", email: "" });
    setNeedPhone(true);
    setMsg({ tone: "warn", text: "Enter the full 10-digit mobile number, or leave it empty" });
    setTimeout(() => document.querySelector(".pos-customer input[inputmode=numeric]")?.focus(), 50);
  };
  const canPay =
    lines.length > 0 && !busy &&
    (method === "cash" ? receivedPaise >= bill.total : method === "split" ? splitPaise >= bill.total : true);

  useEffect(() => {
    try {
      if (lines.length || customer) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ lines, discount, customer, billId: billId.current }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* storage blocked */ }
  }, [lines, discount, customer]);

  const refreshCounts = () => { setPending(queued().length); setFailedCount(failed().length); };
  const saveHeld = (list) => { setHeld(list); try { localStorage.setItem(HELD_KEY, JSON.stringify(list)); } catch { /* storage blocked */ } };

  // Fresh catalogue copy + invoice header whenever online; otherwise the saved ones.
  const sync = useCallback(async () => {
    try {
      const sent = await flushQueue();
      if (sent) setMsg({ tone: "ok", text: `${sent} offline bill(s) synced` });
    } catch { /* offline: keep the saved copies */ }
    // Loaded separately, so a failing header never throws the product list away.
    const [h, c] = await Promise.allSettled([api.get("/pos/invoice-header"), api.get("/pos/search", { all: 1 })]);
    if (h.status === "fulfilled" && h.value?.header) {
      setHeader(h.value.header);
      try { localStorage.setItem(HEADER_KEY, JSON.stringify(h.value.header)); } catch { /* storage blocked */ }
    }
    if (c.status === "fulfilled" && Array.isArray(c.value?.items)) {
      setCatalogue(c.value.items);
      saveCatalogue(c.value.items);
    }
    refreshCounts();
  }, []);

  useEffect(() => {
    sync();
    const goOnline = () => { setOnline(true); sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // The whole product list is heavy, so it refreshes every 5 minutes; waiting offline
    // bills are retried every 30 s (a no-op, with no network call, when none are waiting).
    const full = setInterval(sync, 300000);
    const retry = setInterval(() => { flushQueue().then(refreshCounts).catch(() => {}); }, 30000);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(full); clearInterval(retry); };
  }, [sync]);

  const add = (item) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === item.id);
      return i >= 0 ? ls.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { ...item, qty: 1, basePrice: item.price }];
    });
    setCode("");
  };

  // Live server matches for what is typed, so a name like "oreo" is found even
  // when the till's saved catalogue copy is empty or out of date.
  const [remote, setRemote] = useState({ q: "", items: [] });
  useEffect(() => {
    const q = code.trim();
    if (q.length < 2 || !navigator.onLine) return undefined;
    const timer = setTimeout(() => {
      api.get("/pos/search", { q, store: header?.storeId })
        .then((res) => setRemote({ q, items: res.items || [] }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [code, header?.storeId]);

  // Suggestions appear as you type (2+ characters), with photo, price and stock.
  // Every typed word must appear somewhere (name, pack, SKU, barcode, category);
  // names that start with the text rank first.
  const suggestions = useMemo(() => {
    const t = code.trim().toLowerCase();
    if (t.length < 2) return [];
    const words = t.split(/\s+/);
    const seen = new Set();
    const pool = [...catalogue, ...(remote.q.toLowerCase() === t ? remote.items : [])].filter((c) => !seen.has(c.id) && seen.add(c.id));
    return pool
      .map((c) => {
        const name = `${c.productName || ""} ${c.name || ""}`.toLowerCase();
        const hay = `${name} ${c.sku || ""} ${c.barcode || ""} ${c.category || ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        // 0 name starts with it, 1 a word in the name does, 2 inside the name, 3 SKU/barcode/category only
        const score = name.startsWith(t) ? 0 : ` ${name}`.includes(` ${t}`) ? 1 : name.includes(t) ? 2 : 3;
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || (b.c.stock > 0) - (a.c.stock > 0))
      .slice(0, 80)
      .map((x) => x.c);
  }, [code, catalogue, remote]);
  const noMatch = code.trim().length >= 2 && !suggestions.length;
  const searching = noMatch && online && remote.q !== code.trim();

  // Enter: an exact barcode/SKU (a scanner) adds straight away; otherwise a single
  // suggestion is added, and several stay on screen to pick from.
  const onScan = async (e) => {
    e.preventDefault();
    const text = code.trim();
    if (!text) return;
    const t = text.toLowerCase();
    let hit = catalogue.find((c) => c.barcode === text || c.sku.toLowerCase() === t);
    if (!hit && navigator.onLine) {
      try { hit = (await api.get("/pos/lookup", { code: text })).item; } catch { /* not found */ }
    }
    if (!hit && suggestions.length === 1) hit = suggestions[0];
    if (hit) return add(hit);
    if (!suggestions.length) setMsg({ tone: "danger", text: `Nothing found for "${text}"` });
  };

  // A known number fills in the customer's name (only if the name box is still empty).
  const changePhone = async (phone) => {
    setCustomer((c) => ({ ...c, phone }));
    if (phone.length !== 10 || !navigator.onLine) return;
    try {
      const { name, email } = await api.get("/pos/customer", { phone });
      if (name || email) setCustomer((c) => (c && c.phone === phone ? { ...c, name: c.name || name || "", email: c.email || email || "" } : c));
    } catch { /* offline or not found: leave the name for the cashier */ }
  };

  const setPrice = (id, price) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, price } : l)));

  const setQty = (id, q) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty: q } : l)).filter((l) => l.qty > 0));

  const reset = () => {
    setLines([]); setDiscount(""); setCustomer(null); setMethod("cash"); setReceived(""); setCode("");
    setSplit({ cash: "", upi: "", card: "" });
    billId.current = crypto.randomUUID(); // the next bill is a new bill
    scanRef.current?.focus();
  };

  const snapshot = () => ({ id: crypto.randomUUID(), at: Date.now(), lines, discount, customer });

  const hold = () => {
    if (!lines.length || charging.current) return;
    saveHeld([snapshot(), ...held]);
    reset();
    setMsg({ tone: "info", text: "Bill put on hold" });
  };

  // Resuming swaps: whatever is on the screen goes on hold so nothing is lost.
  const resume = (h) => {
    const rest = held.filter((x) => x.id !== h.id);
    saveHeld(lines.length ? [snapshot(), ...rest] : rest);
    setLines(h.lines); setDiscount(h.discount || ""); setCustomer(h.customer || null); setReceived("");
    billId.current = crypto.randomUUID();
  };

  // "Resume" on the Hold bills page comes back here with the bill's id.
  useEffect(() => {
    const id = location.state?.resume;
    if (!id) return;
    const h = held.find((x) => x.id === id);
    if (h) {
      resume(h);
      setMsg({ tone: "info", text: "Hold bill resumed" });
    }
    navigate(".", { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const newBill = async () => {
    if (charging.current) return;
    if (lines.length && !(await confirm({ title: "Clear this bill?", confirmLabel: "Clear" }))) return;
    reset();
  };

  const openHeld = () => navigate("/pos/hold-bills");
  const openPast = () => navigate("/pos/past-bills");
  // The terminal layout still asks for "held" / "past" by name.
  const setModal = (which) => (which === "held" ? openHeld() : which === "past" ? openPast() : null);

  // The sale as it would be sent — used for the preview and the save alike.
  const buildSale = () => ({
    // One id per bill: pressing Pay again for the same bill is recognised by the server.
    clientId: billId.current,
    store: header?.storeId,
    items: lines.map((l) => ({ variantId: l.id, quantity: l.qty, ...(l.price !== (l.basePrice ?? l.price) ? { unitPrice: l.price } : {}) })),
    discount: bill.discount,
    // Change is not revenue: the payments recorded always add up to the bill total.
    payments: method === "split" ? splitPayments(split, bill.total) : [{ method, amount: bill.total }],
    customerPhone: customer?.phone || undefined,
    customerName: customer?.name || undefined,
    customerEmail: customer?.email || undefined,
    soldAt: new Date().toISOString(),
  });

  // A preview of an emptied bill (held or cleared) closes itself.
  useEffect(() => {
    if (review && !lines.length) setReview(false);
  }, [review, lines.length]);

  // Step 1 (Pay / F9): show the bill. Nothing is saved or cleared yet.
  // "Take Payment & Print Bill" / F9: straight to the print window (no
  // preview step). The sale is saved only after "Did the bill print?" -> Yes.
  const charge = () => {
    if (lines.length && !phoneOk) return askPhone();
    if (!canPay || charging.current) return;
    confirmPrint();
  };

  // Step 2 ("Print bill" / F9 in the preview): print first, save after.
  // The bill prints with the number it will get (asked from the server, not
  // used up). When the print window closes the cashier is asked whether it
  // printed - the browser cannot tell a printed bill from a cancelled one.
  // Only "Yes" saves the sale and clears the screen; "No" leaves everything
  // as it was, to print again. The print window opens straight from the click
  // so the browser does not block it as a pop-up.
  const confirmPrint = async () => {
    if (lines.length && !phoneOk) return askPhone();
    if (!canPay || charging.current) return;
    charging.current = true; // a double click or held F9 cannot start a second print
    setBusy(true);
    const printWin = openPrintWindow();
    const sale = buildSale();
    let invoiceNo = null;
    let offline = false;
    try {
      invoiceNo = (await api.get("/pos/next-invoice", { store: header?.storeId })).invoiceNo;
    } catch (err) {
      if (isOffline(err)) offline = true;
      else {
        printWin?.close();
        setMsg({ tone: "danger", text: err.message });
        charging.current = false;
        setBusy(false);
        return;
      }
    }
    const draft = { ...provisional(sale, lines, bill), invoiceNo, cashierName: user?.name || "" };
    printInvoice(draft, header, { provisional: offline, win: printWin });
    const ask = () => setPrinted({ sale, invoiceNo, offline });
    if (printWin) {
      const watch = setInterval(() => {
        if (printWin.closed) {
          clearInterval(watch);
          ask();
        }
      }, 300);
    } else ask();
  };

  // "No": nothing saved, the bill and its preview stay to print again.
  const notPrinted = () => {
    setPrinted(null);
    charging.current = false;
    setBusy(false);
  };

  // "Yes, printed": now the sale is saved and the screen cleared.
  const finishSale = async () => {
    if (!printed || finishing) return;
    const { sale, invoiceNo, offline } = printed;
    setFinishing(true);
    // WhatsApp: a tab opened now, from the click (a tab opened after the save
    // would be blocked as a pop-up); it is pointed at the chat once saved.
    const mode = sendMode(header);
    const phone = customerPhone({ customerSnapshot: { phone: sale.customerPhone } });
    const waWin = !offline && phone && wantsWhatsApp(mode) ? window.open("", "_blank") : null;
    const done = () => {
      setPrinted(null);
      setReview(false);
      reset();
      charging.current = false;
      setBusy(false);
    };
    try {
      if (offline) throw Object.assign(new Error("offline"), { offlineBill: true });
      const { order } = await api.post("/pos/sales", sale);
      if (invoiceNo && order.invoiceNo !== invoiceNo) {
        // Another till billed in between and took that number: print the
        // bill again with the number it really got.
        printInvoice(order, header);
        setMsg({ tone: "warn", text: `Billed ${order.invoiceNo} (not ${invoiceNo}, another till used it) - reprinted with the right number` });
      } else {
        setMsg({ tone: "ok", text: `Billed ${order.invoiceNo} - ${money(order.pricing.total)}` });
      }
      done();
      // Then the bill goes to the customer (Settings -> General -> POS).
      const sent = await sendBill(order, header, { waWin, api, mode });
      if (sent) setMsg((m) => ({ ...(m || { tone: "ok" }), text: `${m?.text || `Billed ${order.invoiceNo}`} · ${sent}` }));
    } catch (err) {
      waWin?.close();
      if (err.offlineBill || isOffline(err)) {
        // No connection: keep the bill on this device, sync later.
        enqueue(sale);
        setMsg({ tone: "warn", text: "Offline - bill saved on this device and will sync automatically" });
        refreshCounts();
        done();
      } else {
        setMsg({ tone: "danger", text: err.message });
        notPrinted();
      }
    }
    setFinishing(false);
  };

  // F2 new, F3 hold, F4 past bills, F9 pay. Handler always sees the latest state via the ref.
  const keys = useRef();
  keys.current = {
    newBill, hold, openPast,
    charge: printed ? finishSale : review ? confirmPrint : charge,
    review: review || printed,
    closeReview: () => (printed ? notPrinted() : charging.current ? null : setReview(false)),
  };
  useEffect(() => {
    const on = (e) => {
      if (e.key === "Escape" && keys.current.review) {
        keys.current.closeReview();
        return;
      }
      const fn = { F2: "newBill", F3: "hold", F4: "openPast", F9: "charge" }[e.key];
      if (!fn) return;
      e.preventDefault();
      keys.current[fn]();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const cats = useMemo(() => ["All", ...new Set(catalogue.map((c) => c.category).filter(Boolean))], [catalogue]);
  const quick = useMemo(
    () => catalogue.filter((c) => cat === "All" || c.category === cat).slice(0, 30),
    [catalogue, cat]
  );

  const terminal = header?.template === "terminal";
  // Everything the full-screen terminal layout needs from this screen's state.
  const ctx = {
    header, online, pending, catalogue, suggestions, cats, cat, setCat, lines, bill, setQty, setPrice, add, code, setCode, onScan, scanRef,
    method, setMethod, received, setReceived, receivedPaise, change, split, setSplit, splitPaise, canPay, busy, charge,
    reset, hold, newBill, held, setModal, openPast, customer, setCustomer, changePhone, msg, setMsg,
    discount, setDiscount, canDiscount, Ico, Thumb, QtyInput, PriceCell, MethodIcon,
  };

  return (
    <div
      ref={rootRef}
      className={`pos pos--${header?.template || "standard"}${fitHeight ? " pos-fit" : ""}`}
      style={fitHeight ? { height: fitHeight } : undefined}
    >
      {terminal ? <PosTerminal p={ctx} /> : (<>
      <div className="pos-head">
        <div>
          <h1>POS Billing</h1>
          <div className="pos-meta">
            <span className={`pos-status${online ? " on" : ""}`}><i />{online ? "Online" : "Offline"}</span>
            {header?.store && <span className="pos-meta-item"><Ico n="store" size={15} /> {header.store}</span>}
            <span className="pos-meta-item"><Ico n="clock" size={15} /> {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
        </div>
        <div className="pos-actions">
          <button className="pos-chip-btn" onClick={newBill}><Ico n="plus" /> New Bill (F2)</button>
          <button className="pos-chip-btn" onClick={openHeld}>
            <Ico n="bookmark" /> Hold Bills (F3){held.length > 0 && <span className="badge">{held.length}</span>}
          </button>
          <button className="pos-chip-btn" onClick={openPast}><Ico n="clock" /> Past Bills (F4)</button>
        </div>
      </div>

      {!online && <Banner tone="warn">You are offline. Bills are saved here and sent when the connection returns.</Banner>}
      {pending > 0 && <Banner tone="info">{pending} bill(s) waiting to sync.</Banner>}
      {failedCount > 0 && (
        <Banner tone="danger">
          {failedCount} offline bill(s) were rejected by the server. Check stock/prices and re-enter them.{" "}
          <button className="pos-sm-btn" onClick={() => console.table(failed().map((f) => ({ error: f.error, sale: JSON.stringify(f.sale) })))}>Show</button>{" "}
          <button className="pos-sm-btn" onClick={() => { clearFailed(); setFailedCount(0); }}>Dismiss</button>
        </Banner>
      )}
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

      <div className="pos-grid">
        <div className="pos-col">
          <div className="pos-panel">
            <form className="pos-scan" onSubmit={onScan}>
              <Ico n="barcode" size={28} />
              <input
                ref={scanRef}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan barcode, or type SKU / product name and press Enter"
                onKeyDown={(e) => { if (e.key === "Escape") setCode(""); }}
                aria-label="Scan barcode or search product"
              />
              <kbd className="pos-kbd">Enter ↵</kbd>
            </form>
            {noMatch && (
              <div className="pos-matches pos-nomatch">{searching ? "Searching…" : `No products match "${code.trim()}"`}</div>
            )}
            {suggestions.length > 0 && (
              <div className="pos-matches" role="listbox">
                {suggestions.slice(0, 10).map((m) => (
                  <button key={m.id} role="option" onClick={() => { add(m); scanRef.current?.focus(); }}>
                    <Thumb item={m} />
                    <span className="pos-match-text">
                      <b>{m.productName} {m.name}</b>
                      <small>SKU: {m.sku}{m.stock <= 0 ? " - out of stock" : ` - ${m.stock} in stock`}</small>
                    </span>
                    <span className="pos-match-price">{money(m.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cats.length > 1 && (
            <div className="pos-cats">
              {cats.map((c) => (
                <button key={c} className={`pos-cat${c === cat ? " on" : ""}`} onClick={() => setCat(c)}>{c === "All" ? "All Items" : c}</button>
              ))}
            </div>
          )}

          <div className="pos-panel pos-bill">
            <div className="pos-panel-head">
              <h2><span className="pos-h-ico"><Ico n="bag" size={18} /></span> Bill Items <span className="pos-count">{lines.length}</span></h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pos-sm-btn danger" disabled={!lines.length} onClick={reset}><Ico n="trash" size={16} /> Clear All</button>
                <button className="pos-sm-btn" onClick={() => setCustomer((c) => c || { name: "", phone: "" })}><Ico n="user" size={16} /> Add Customer</button>
              </div>
            </div>
            {customer && (
              <div className="pos-customer">
                <input placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                <input
                  placeholder="Mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  className={needPhone && !phoneOk ? "pos-need" : ""}
                  value={customer.phone}
                  onChange={(e) => changePhone(e.target.value.replace(/\D/g, ""))}
                />
                <input placeholder="Email (to email the bill)" type="email" value={customer.email || ""} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                {lines.length ? null : <button className="pos-sm-btn" onClick={() => setCustomer(null)}>Remove</button>}
              </div>
            )}
            {!lines.length ? (
              <div className="pos-empty pos-empty-rich">
                <span className="pos-empty-ico"><Ico n="barcode" size={26} /></span>
                <b>No items on this bill yet</b>
                <span>Scan a barcode, search above, or tap a product below to start.</span>
              </div>
            ) : (
              <div className="pos-table-wrap">
                <table className="pos-table">
                  <thead><tr><th>#</th><th>Product</th><th className="r">Price</th><th>Qty</th><th className="r">Total</th><th /></tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.id} className={l.stock < l.qty ? "pos-row-low" : undefined}>
                        <td>{i + 1}</td>
                        <td>
                          <div className="pos-prod">
                            <Thumb item={l} />
                            <div><b>{l.productName} {l.name}</b><small>SKU: {l.sku}</small>{l.stock < l.qty && <span className="pos-low">{l.stock > 0 ? `Low stock - only ${l.stock} left` : "Out of stock"}</span>}</div>
                          </div>
                        </td>
                        <td className="r"><PriceCell line={l} editable={canDiscount} onChange={(p) => setPrice(l.id, p)} /><br /><small style={{ color: "var(--text-muted)" }}>/ {l.unit}</small></td>
                        <td>
                          <div className="pos-stepper">
                            <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Decrease">-</button>
                            <QtyInput value={l.qty} onChange={(n) => setQty(l.id, n)} />
                            <button onClick={() => setQty(l.id, l.qty + 1)} aria-label="Increase">+</button>
                          </div>
                        </td>
                        <td className="r"><b>{money(Math.round(l.price * l.qty))}</b></td>
                        <td><button className="pos-del" onClick={() => setQty(l.id, 0)} aria-label="Remove item"><Ico n="trash" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pos-panel pos-quick">
            <div className="pos-panel-head">
              <h2><span className="pos-h-ico"><Ico n="plus" size={18} /></span> Quick Add Products</h2>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="pos-sm-btn" aria-label="Scroll left" onClick={() => quickRef.current?.scrollBy({ left: -480, behavior: "smooth" })}>&lsaquo;</button>
                <button className="pos-sm-btn" aria-label="Scroll right" onClick={() => quickRef.current?.scrollBy({ left: 480, behavior: "smooth" })}>&rsaquo;</button>
              </span>
            </div>
            {quick.length ? (
              <div className="pos-quick-row" ref={quickRef}>
                {quick.map((p) => (
                  <button key={p.id} className="pos-tile" onClick={() => { add(p); scanRef.current?.focus(); }}>
                    <Thumb item={p} />
                    <b>{p.productName} {p.name}</b>
                    <small>{money(p.price)} / {p.unit}</small>
                    <i>+</i>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pos-empty pos-empty-rich">
                <span className="pos-empty-ico"><Ico n="box" size={26} /></span>
                <b>No products yet</b>
                <span>Products added to the catalogue show up here for one-tap billing.</span>
              </div>
            )}
          </div>
        </div>

        <div className="pos-panel pos-payment">
          <div className="pos-sum"><span>Subtotal</span><b>{money(bill.gross)}</b></div>
          {canDiscount && (
            <div className="pos-sum">
              <span>Discount (Rs)</span>
              <input type="text" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => setDiscount(cleanAmount(e.target.value))} aria-label="Discount in rupees" />
            </div>
          )}
          <div className="pos-sum"><span>GST (Included)</span><b>{money(bill.tax)}</b></div>
          {bill.roundOff !== 0 && <div className="pos-sum"><span>Round off</span><b>{money(bill.roundOff)}</b></div>}
          <div className="pos-total"><span>Total</span><span>{money(bill.total)}</span></div>

          <h2 style={{ fontSize: 15 }}>Payment Method</h2>
          <div className="pos-methods">
            {METHODS.map(([k, label]) => (
              <button key={k} className={`pos-method${method === k ? " on" : ""}`} onClick={() => setMethod(k)}>
                <MethodIcon k={k} /> {label}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <>
              <div className="pos-sum">
                <span>Cash Received (Rs)</span>
                <input type="text" inputMode="decimal" placeholder="0.00" value={received} onChange={(e) => setReceived(cleanAmount(e.target.value))} aria-label="Cash received" />
              </div>
              <div className="pos-sum">
                <button className="pos-sm-btn" disabled={!lines.length} onClick={() => setReceived(String(bill.total / 100))}>Exact amount</button>
                <span>Change (Rs)</span>
                <span className="pos-change">{receivedPaise >= bill.total && bill.total > 0 ? money(change) : "-"}</span>
              </div>
            </>
          )}

          {lines.length && !phoneOk ? <div className="pos-need-note">Mobile number needs all 10 digits (or leave it empty).</div> : null}
          <button className="pos-pay" disabled={!canPay && !(lines.length && !phoneOk)} onClick={charge}>
            <Ico n="printer" /> {busy ? "Printing..." : "Take Payment & Print Bill (F9)"}
          </button>
          <div className="pos-pay-row">
            <button disabled={!lines.length} onClick={hold}><Ico n="bookmark" size={16} /> Hold Bill (F3)</button>
            <button className="danger" disabled={!lines.length} onClick={reset}><Ico n="trash" size={16} /> Clear Bill</button>
          </div>
        </div>
      </div>

      </>)}

      {review && lines.length ? (
        <div className="pos-modal-bg" onClick={() => !busy && setReview(false)}>
          <div className="pos-modal pos-review" role="dialog" aria-modal="true" aria-label="Bill preview" onClick={(e) => e.stopPropagation()}>
            <div className="pos-panel-head">
              <h2><span className="pos-h-ico"><Ico n="printer" size={18} /></span> Bill preview</h2>
              <span className="pos-review-total">{money(bill.total)}</span>
            </div>
            <iframe
              className="pos-review-frame"
              title="Bill preview"
              srcDoc={posBillHtml(provisional(buildSale(), lines, bill), header, header?.posTemplate || DEFAULT_POS_TEMPLATE, { preview: true })}
            />
            <p className="pos-review-note">The bill is saved and the screen cleared only after it prints and you confirm it. Until then you can go back and change it, or hold it.</p>
            <div className="pos-review-actions">
              <button className="pos-sm-btn" disabled={busy} onClick={() => setReview(false)}>Back to bill (Esc)</button>
              <button className="pos-sm-btn" disabled={busy} onClick={() => { setReview(false); hold(); }}><Ico n="bookmark" size={16} /> Hold bill</button>
              <button className="pos-pay pos-review-print" disabled={busy || !canPay} onClick={confirmPrint}>
                <Ico n="printer" /> {busy ? "Printing..." : "Print bill (F9)"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {printed ? (
        <div className="pos-modal-bg">
          <div className="pos-modal pos-printed" role="alertdialog" aria-modal="true" aria-labelledby="pos-printed-title">
            <span className="pos-printed-ico" aria-hidden="true"><Ico n="printer" size={26} /></span>
            <h2 id="pos-printed-title">Bill printed?</h2>
            <p>{printed.invoiceNo ? <b>{printed.invoiceNo}</b> : "This bill"} · {money(bill.total)}</p>
            <div className="pos-printed-actions">
              <button className="pos-sm-btn" disabled={finishing} onClick={notPrinted}>Not printed</button>
              <button className="pos-pay" disabled={finishing} onClick={finishSale} autoFocus>
                {finishing ? "Saving..." : "Printed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  );
}

// Cash/UPI/card amounts typed for a split bill -> payments that add up to the total
// (any overpayment is cash change, so it comes off the cash part).
function splitPayments(split, total) {
  const p = { cash: Math.round((Number(split.cash) || 0) * 100), upi: Math.round((Number(split.upi) || 0) * 100), card: Math.round((Number(split.card) || 0) * 100) };
  p.cash = Math.max(0, p.cash - Math.max(0, p.cash + p.upi + p.card - total));
  return Object.entries(p).filter(([, amount]) => amount > 0).map(([method, amount]) => ({ method, amount }));
}

// What the receipt shows when the server could not be reached.
// GST in each rate's lines (prices include GST): taxable value and tax.
function gstSplit(lines) {
  const byRate = new Map();
  for (const l of lines) {
    if (!l.taxRatePct) continue;
    const gross = Math.round(l.price * l.qty);
    const taxable = Math.round((gross * 100) / (100 + l.taxRatePct));
    const cur = byRate.get(l.taxRatePct) || { rate: l.taxRatePct, taxableValue: 0, tax: 0 };
    cur.taxableValue += taxable;
    cur.tax += gross - taxable;
    byRate.set(l.taxRatePct, cur);
  }
  return [...byRate.values()];
}

function provisional(sale, lines, bill) {
  return {
    placedAt: sale.soldAt,
    cashierName: "",
    customerSnapshot: { phone: sale.customerPhone, name: sale.customerName },
    items: lines.map((l) => ({
      name: l.productName, variantName: l.name, quantity: l.qty, unitPrice: l.price,
      lineTotal: Math.round(l.price * l.qty), taxRatePct: l.taxRatePct,
    })),
    pricing: { subtotal: bill.gross, offerDiscount: bill.discount, roundOff: bill.roundOff, total: bill.total, taxBreakup: gstSplit(lines) },
    posPayments: sale.payments,
  };
}
