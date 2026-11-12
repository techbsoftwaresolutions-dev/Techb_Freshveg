import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Banner, rupees } from "../../components/ui";

const money = (p) => rupees(p, { decimals: true });

// Full-screen "Terminal" template: its own top bar, category rail, product grid,
// bill panel and a bottom action bar. It is only a layout: all state and handlers
// come from Pos.jsx through `p`, so billing behaves exactly as in the other templates.
export default function PosTerminal({ p }) {
  const nav = useNavigate();
  const { session } = useAuth();
  const user = session?.user || {};
  const { Ico, Thumb, QtyInput, PriceCell, MethodIcon } = p;
  const [sub, setSub] = useState(null); // "customer" | "price"
  const [priceCode, setPriceCode] = useState("");

  // The grid follows the category chosen on the rail, or whatever is typed in the scan box.
  const shown = useMemo(() => {
    const t = p.code.trim().toLowerCase();
    // Typed text uses the same ranked, server-backed search as the other layouts.
    const list = t.length >= 2
      ? p.suggestions
      : p.catalogue.filter((c) => p.cat === "All" || c.category === p.cat);
    return list.slice(0, 80);
  }, [p.catalogue, p.cat, p.code, p.suggestions]);

  const priceMatches = useMemo(() => {
    const t = priceCode.trim().toLowerCase();
    if (t.length < 2) return [];
    return p.catalogue.filter((c) => c.barcode === priceCode.trim() || `${c.productName} ${c.name} ${c.sku}`.toLowerCase().includes(t)).slice(0, 6);
  }, [priceCode, p.catalogue]);

  const tiles = [["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["split", "Split"]];

  return (
    <div className="pt">
      <header className="pt-top">
        <button className="pt-burger" aria-label="Back to admin" title="Back to admin" onClick={() => nav("/")}>
          <span /><span /><span />
        </button>
        <img src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" height="38" />
        <strong className="pt-brand">HosurBasket</strong>
        <span className="pt-title">POS Billing</span>
        <span className="pt-spacer" />
        {p.pending > 0 && <span className="pt-pill warn">{p.pending} to sync</span>}
        <span className="pt-pill">{p.header?.store || "Store"}</span>
        <span className={`pt-pill ${p.online ? "on" : "off"}`}><i /> {p.online ? "Online" : "Offline"}</span>
        <span className="pt-user"><b>{user.name || "User"}</b><small>{user.role?.replace("_", " ")}</small></span>
      </header>

      {p.msg && <div className="pt-msg"><Banner tone={p.msg.tone}>{p.msg.text}</Banner></div>}

      <div className="pt-body">
        <nav className="pt-rail" aria-label="Categories">
          {p.cats.map((c) => (
            <button key={c} className={`pt-cat${c === p.cat ? " on" : ""}`} onClick={() => { p.setCat(c); p.setCode(""); }}>
              <span className="pt-cat-ico">{c === "All" ? "▦" : c[0]}</span>{c === "All" ? "All Products" : c}
            </button>
          ))}
        </nav>

        <section className="pt-mid">
          <form className="pt-scan" onSubmit={p.onScan}>
            <Ico n="barcode" size={28} />
            <input
              ref={p.scanRef}
              autoFocus
              value={p.code}
              onChange={(e) => p.setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") p.setCode(""); }}
              placeholder="Scan Barcode or Search Product (SKU / Name)"
              aria-label="Scan barcode or search product"
            />
          </form>
          <div className="pt-grid">
            {shown.map((m) => (
              <button key={m.id} className="pt-tile" onClick={() => { p.add(m); p.scanRef.current?.focus(); }}>
                <Thumb item={m} />
                <b>{m.productName}</b>
                <span>{m.name}</span>
                <strong>{money(m.price)}{m.unit ? ` / ${m.unit}` : ""}</strong>
                <i>+</i>
              </button>
            ))}
            {!shown.length && <div className="pt-none">No products found.</div>}
          </div>
        </section>

        <section className="pt-right">
          <div className="pt-right-head">
            <h2>Current Bill ({p.lines.length} {p.lines.length === 1 ? "Item" : "Items"})</h2>
            <button className="pt-clear" disabled={!p.lines.length} onClick={p.reset}><Ico n="trash" size={16} /> Clear</button>
          </div>

          <div className="pt-lines">
            <table>
              <thead><tr><th>#</th><th>Item</th><th>Qty</th><th className="r">Price</th><th className="r">Total</th><th /></tr></thead>
              <tbody>
                {p.lines.map((l, i) => (
                  <tr key={l.id} className={l.stock < l.qty ? "pos-row-low" : undefined}>
                    <td>{i + 1}</td>
                    <td>
                      <b>{l.productName}</b>
                      <small>{l.name}</small>
                      {l.stock < l.qty && <span className="pos-low">{l.stock > 0 ? `Low stock - only ${l.stock} left` : "Out of stock"}</span>}
                    </td>
                    <td>
                      <div className="pos-stepper">
                        <button onClick={() => p.setQty(l.id, l.qty - 1)} aria-label="Decrease">&minus;</button>
                        <QtyInput value={l.qty} onChange={(n) => p.setQty(l.id, n)} />
                        <button onClick={() => p.setQty(l.id, l.qty + 1)} aria-label="Increase">+</button>
                      </div>
                    </td>
                    <td className="r"><PriceCell line={l} editable={p.canDiscount} onChange={(price) => p.setPrice(l.id, price)} /></td>
                    <td className="r"><b>{money(Math.round(l.price * l.qty))}</b></td>
                    <td><button className="pos-del" onClick={() => p.setQty(l.id, 0)} aria-label="Remove item"><Ico n="trash" /></button></td>
                  </tr>
                ))}
                {!p.lines.length && <tr><td colSpan={6} className="pt-none">Tap a product or scan a barcode to start the bill.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pt-totals">
            <div className="pt-sums">
              <div><span>Subtotal</span><b>{money(p.bill.gross)}</b></div>
              <div>
                <span>Discount</span>
                {p.canDiscount
                  ? <input type="number" min="0" placeholder="0.00" value={p.discount} onChange={(e) => p.setDiscount(e.target.value)} aria-label="Discount in rupees" />
                  : <b>{money(p.bill.discount)}</b>}
              </div>
              <div><span>GST (Included)</span><b>{money(p.bill.tax)}</b></div>
            </div>
            <div className="pt-total"><span>Total</span><strong>{money(p.bill.total)}</strong></div>
          </div>

          <button className="pt-pay" disabled={!p.canPay} onClick={p.charge}>
            <Ico n="card" size={34} /> {p.busy ? "Saving..." : "Pay Now"} <span aria-hidden="true">&rsaquo;</span>
          </button>

          <div className="pt-methods">
            {tiles.map(([k, label]) => (
              <button key={k} className={`pt-method ${k}${p.method === k ? " on" : ""}`} onClick={() => p.setMethod(k)}>
                {k === "split" ? <Ico n="plus" size={28} /> : <MethodIcon k={k} />}
                {label}
              </button>
            ))}
          </div>

          {p.method === "cash" && (
            <div className="pt-extra">
              <label>Cash received<input type="number" min="0" value={p.received} onChange={(e) => p.setReceived(e.target.value)} /></label>
              <button className="pt-small" disabled={!p.lines.length} onClick={() => p.setReceived(String(p.bill.total / 100))}>Exact</button>
              <span className="pt-change">Change <b>{p.receivedPaise >= p.bill.total && p.bill.total > 0 ? money(p.change) : "-"}</b></span>
            </div>
          )}
          {p.method === "split" && (
            <div className="pt-extra">
              {["cash", "upi", "card"].map((k) => (
                <label key={k}>{k.toUpperCase()}<input type="number" min="0" value={p.split[k]} onChange={(e) => p.setSplit({ ...p.split, [k]: e.target.value })} /></label>
              ))}
              <span className="pt-change">Short <b>{money(Math.max(0, p.bill.total - p.splitPaise))}</b></span>
            </div>
          )}
        </section>
      </div>

      <footer className="pt-bottom">
        <button onClick={p.newBill}><Ico n="plus" size={22} /> New Bill</button>
        <button onClick={p.hold} disabled={!p.lines.length}><Ico n="bookmark" size={22} /> Hold Bill</button>
        <button onClick={() => p.setModal("held")}><Ico n="bookmark" size={22} /> Open Bills{p.held.length > 0 && <em>{p.held.length}</em>}</button>
        <button onClick={() => { if (!p.customer) p.setCustomer({ name: "", phone: "" }); setSub("customer"); }}><Ico n="user" size={22} /> Customers</button>
        <button onClick={() => { setPriceCode(""); setSub("price"); }}><Ico n="barcode" size={22} /> Price Check</button>
        <button onClick={p.openPast}><Ico n="clock" size={22} /> Past Bills</button>
        <button onClick={() => nav("/reports")}><Ico n="cash" size={22} /> Reports</button>
        <button onClick={() => nav("/inventory")}><Ico n="card" size={22} /> Inventory</button>
        <button onClick={() => nav("/settings/general")}><Ico n="user" size={22} /> Settings</button>
      </footer>

      {sub && (
        <div className="pos-modal-bg" onClick={() => setSub(null)}>
          <div className="pos-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="pos-panel-head">
              <h2>{sub === "customer" ? "Customer" : "Price check"}</h2>
              <button className="pos-sm-btn" onClick={() => setSub(null)}>Done</button>
            </div>
            {sub === "customer" && p.customer && (
              <div className="pos-customer">
                <input placeholder="Customer name" value={p.customer.name} onChange={(e) => p.setCustomer({ ...p.customer, name: e.target.value })} />
                <input placeholder="Phone (10 digits)" inputMode="numeric" maxLength={10} value={p.customer.phone} onChange={(e) => p.changePhone(e.target.value.replace(/\D/g, ""))} />
                <button className="pos-sm-btn" onClick={() => { p.setCustomer(null); setSub(null); }}>Remove</button>
              </div>
            )}
            {sub === "price" && (
              <>
                <div className="pos-customer"><input autoFocus style={{ flex: 1 }} placeholder="Scan barcode or type a name" value={priceCode} onChange={(e) => setPriceCode(e.target.value)} /></div>
                {priceMatches.map((m) => (
                  <div className="pos-modal-row" key={m.id}>
                    <span style={{ display: "flex", gap: 10, alignItems: "center" }}><Thumb item={m} /><span><b>{m.productName} {m.name}</b><br /><small>{m.stock} in stock</small></span></span>
                    <b>{money(m.price)}</b>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
