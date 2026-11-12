import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { api } from "../../api/client";
import { Banner, rupees } from "../../components/ui";
import Select from "../../components/Select";
import "./labels.css";

const money = (p) => rupees(p, { decimals: true });
const SIZES = {
  "50x30": { w: 50, h: 30, label: "50 mm x 30 mm (Standard)" },
  "38x25": { w: 38, h: 25, label: "38 mm x 25 mm (Small)" },
  "75x50": { w: 75, h: 50, label: "75 mm x 50 mm (Large)" },
  "100x50": { w: 100, h: 50, label: "100 mm x 50 mm (Extra large)" },
};
const LAYOUTS = [[1, "Single"], [2, "2 per Row"], [3, "3 per Row"]];

// Barcode or QR as an image, with its natural size so the PDF can keep the proportions.
async function codeImage(code, kind) {
  try {
    if (kind === "qr") return { url: await QRCode.toDataURL(code, { margin: 0, width: 240 }), w: 1, h: 1 };
    const c = document.createElement("canvas");
    JsBarcode(c, code, { format: /^\d{13}$/.test(code) ? "EAN13" : "CODE128", height: 60, fontSize: 18, margin: 0, displayValue: true });
    return { url: c.toDataURL("image/png"), w: c.width, h: c.height };
  } catch {
    return null; // a code the format cannot encode: the label prints without it
  }
}

const Check = ({ checked, onChange, label }) => (
  <label className="lb-check">
    <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
    <span />
  </label>
);

const Step = ({ value, onChange, min = 1 }) => (
  <span className="lb-step">
    <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)}>&minus;</button>
    <b>{value}</b>
    <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)}>+</button>
  </span>
);

export default function Labels() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [manual, setManual] = useState([]);
  const [tab, setTab] = useState("select"); // "select" | "manual"
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState({}); // id -> number of labels
  const [perProduct, setPerProduct] = useState(1);
  const [size, setSize] = useState("50x30");
  const [cols, setCols] = useState(1);
  const [kind, setKind] = useState("barcode");
  const [brand, setBrand] = useState("HosurBasket");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", price: "" });

  const load = async () => {
    try { setItems((await api.get("/pos/search", { all: 1 })).items); } catch (e) { setMsg({ tone: "danger", text: e.message }); }
  };
  useEffect(() => {
    load();
    api.get("/pos/invoice-header").then((h) => h.header?.name && setBrand(h.header.name)).catch(() => {});
  }, []);

  const all = useMemo(() => [...manual, ...items], [manual, items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((i) =>
      (!category || i.category === category) &&
      (!t || `${i.productName} ${i.name} ${i.sku} ${i.barcode}`.toLowerCase().includes(t))
    ).slice(0, 300);
  }, [all, q, category]);

  const chosen = all.filter((i) => picked[i.id] > 0);
  const total = chosen.reduce((s, i) => s + picked[i.id], 0);
  const allShown = rows.length > 0 && rows.every((r) => picked[r.id] > 0);
  const toggle = (id) => setPicked((p) => ({ ...p, [id]: p[id] > 0 ? 0 : perProduct }));
  const toggleAll = () => setPicked((p) => {
    const next = { ...p };
    rows.forEach((r) => { next[r.id] = allShown ? 0 : (p[r.id] > 0 ? p[r.id] : perProduct); });
    return next;
  });
  const changePerProduct = (n) => {
    setPerProduct(n);
    setPicked((p) => Object.fromEntries(Object.entries(p).map(([id, v]) => [id, v > 0 ? n : v])));
  };

  // Preview follows the product the arrows point at.
  const current = chosen.length ? chosen[Math.min(idx, chosen.length - 1)] : null;
  useEffect(() => {
    setPreview(null);
    if (current?.barcode || current?.sku) codeImage(current.barcode || current.sku, kind).then(setPreview);
  }, [current?.id, current?.barcode, kind]); // eslint-disable-line
  useEffect(() => { if (idx >= chosen.length) setIdx(0); }, [chosen.length, idx]);

  // Gives every selected product that has no barcode an in-store EAN-13.
  const generate = async () => {
    const real = chosen.filter((c) => !String(c.id).startsWith("m-") && !c.barcode).map((c) => c.id);
    if (!real.length) return setMsg({ tone: "info", text: "Every selected product already has a barcode." });
    try {
      const r = await api.post("/pos/barcodes/generate", { variantIds: real });
      setMsg({ tone: "ok", text: `Generated ${r.generated} barcode(s)` });
      load();
    } catch (e) { setMsg({ tone: "danger", text: e.message }); }
  };

  const addManual = () => {
    const price = Math.round(Number(form.price) * 100);
    if (!form.name.trim() || !form.code.trim() || !(price >= 0)) return setMsg({ tone: "danger", text: "Enter a name, a code and a price" });
    const id = `m-${Date.now()}`;
    setManual((m) => [{ id, productName: form.name.trim(), name: "", sku: form.code.trim(), barcode: form.code.trim(), price, image: "", category: "" }, ...m]);
    setPicked((p) => ({ ...p, [id]: perProduct }));
    setForm({ name: "", code: "", price: "" });
    setTab("select");
  };

  const labelsToPrint = () => chosen.flatMap((i) => Array.from({ length: picked[i.id] }, () => i));
  const { w, h } = SIZES[size];

  const withImages = async () => Promise.all(labelsToPrint().map(async (i) => ({ i, img: i.barcode || i.sku ? await codeImage(i.barcode || i.sku, kind) : null })));
  const chunk = (list) => Array.from({ length: Math.ceil(list.length / cols) }, (_, r) => list.slice(r * cols, r * cols + cols));

  const print = async () => {
    if (!total) return;
    setBusy(true);
    const list = await withImages();
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const cell = ({ i, img }) => `<div class="l"><small>${esc(brand)}</small><b>${esc(`${i.productName} ${i.name}`.trim())}</b><div class="r">${img ? `<img src="${img.url}">` : "<span></span>"}<strong>${esc(money(i.price))}</strong></div></div>`;
    const html = chunk(list).map((row) => `<div class="row">${row.map(cell).join("")}</div>`).join("");
    const win = window.open("", "_blank");
    if (!win) { setBusy(false); return setMsg({ tone: "warn", text: "Allow pop-ups to print labels" }); }
    win.document.write(`<!doctype html><title>Labels</title><style>
@page{size:${cols * w}mm ${h}mm;margin:0}body{margin:0;font-family:Helvetica,sans-serif}
.row{display:flex;width:${cols * w}mm;height:${h}mm;page-break-after:always;overflow:hidden}
.l{width:${w}mm;height:${h}mm;box-sizing:border-box;padding:1.5mm 2mm;display:flex;flex-direction:column;text-align:center}
.l small{font-size:6.5pt;font-weight:bold}.l b{font-size:8pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r{flex:1;display:flex;align-items:center;justify-content:space-between;gap:2mm;min-height:0}
.r img{max-width:62%;max-height:100%;object-fit:contain}.r strong{font-size:11pt;white-space:nowrap}
</style>${html}<script>onload=()=>print()</script>`);
    win.document.close();
    setBusy(false);
  };

  const downloadPdf = async () => {
    if (!total) return;
    setBusy(true);
    const list = await withImages();
    const pw = cols * w;
    const doc = new jsPDF({ orientation: pw > h ? "landscape" : "portrait", unit: "mm", format: [Math.min(pw, h), Math.max(pw, h)] });
    chunk(list).forEach((row, r) => {
      if (r > 0) doc.addPage();
      row.forEach(({ i, img }, c) => {
        const x = c * w;
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
        doc.text(String(brand), x + w / 2, 4, { align: "center" });
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(`${i.productName} ${i.name}`.trim(), w - 4)[0] || "", x + w / 2, 8, { align: "center" });
        if (img) {
          const iw = Math.min(w * 0.6, (img.w / img.h) * (h - 12));
          doc.addImage(img.url, "PNG", x + 2, 10, iw, iw * (img.h / img.w));
        }
        doc.setFontSize(11);
        // The built-in PDF font has no rupee sign, so the PDF writes "Rs."
        doc.text(`Rs. ${(i.price / 100).toFixed(2)}`, x + w - 2, h / 2 + 4, { align: "right" });
      });
    });
    doc.save("labels.pdf");
    setBusy(false);
  };

  const labelEl = current && (
    <div className="lb-label" style={{ aspectRatio: `${w} / ${h}` }}>
      <small>{brand}</small>
      <b>{`${current.productName} ${current.name}`.trim()}</b>
      <div className="lb-label-row">
        {preview ? <img src={preview.url} alt="" /> : <span className="lb-nocode">No barcode yet</span>}
        <strong>{money(current.price)}</strong>
      </div>
    </div>
  );

  return (
    <div className="lb">
      <div className="page-head">
        <div><h1>Barcode Labels</h1></div>
      </div>

      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

      <div className="lb-grid">
        <section className="lb-panel">
          <div className="lb-panel-head">
            <h2>Pick Products</h2>
            <span className="lb-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "select"} className={tab === "select" ? "on" : ""} onClick={() => setTab("select")}>Select Products</button>
              <button role="tab" aria-selected={tab === "manual"} className={tab === "manual" ? "on" : ""} onClick={() => setTab("manual")}>Manual Entry</button>
            </span>
          </div>

          {tab === "manual" ? (
            <div className="lb-manual">
              <label>Product name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Barcode / code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
              <label>Price (Rs)<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
              <button className="lb-btn primary" onClick={addManual}>Add to selection</button>
            </div>
          ) : (
            <>
              <input className="lb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product by name, SKU or barcode..." aria-label="Search products" />
              <div className="lb-filters">
                <label>Category
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </label>
                <button className="lb-btn soft" onClick={() => nav("/catalog/products")}>+ Add Product</button>
              </div>

              <div className="lb-table">
                <table>
                  <thead>
                    <tr>
                      <th><Check checked={allShown} onChange={toggleAll} label="Select all" /></th>
                      <th>Product Name</th><th>Barcode (EAN)</th><th className="r">Price</th><th>Qty (Labels)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={picked[r.id] > 0 ? "on" : ""}>
                        <td><Check checked={picked[r.id] > 0} onChange={() => toggle(r.id)} label={`Select ${r.productName}`} /></td>
                        <td>
                          <span className="lb-prod">
                            {r.image ? <img src={r.image} alt="" /> : <i>{(r.productName || "?")[0]}</i>}
                            <b>{r.productName} {r.name}</b>
                          </span>
                        </td>
                        <td>{r.barcode || <em>none</em>}</td>
                        <td className="r">{money(r.price)}</td>
                        <td><Step value={picked[r.id] > 0 ? picked[r.id] : perProduct} onChange={(n) => setPicked((p) => ({ ...p, [r.id]: n }))} /></td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={5} className="lb-none">No products found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="lb-foot">
            <span className="lb-sel"><Check checked={chosen.length > 0} onChange={() => setPicked({})} label="Clear selection" /> {chosen.length} product{chosen.length === 1 ? "" : "s"} selected</span>
            <span className="lb-foot-btns">
              <button className="lb-btn danger" disabled={!chosen.length} onClick={() => setPicked({})}>Clear Selection</button>
              <button className="lb-btn primary" disabled={!chosen.length} onClick={generate}>Generate Labels</button>
            </span>
          </div>
        </section>

        <div className="lb-side">
          <section className="lb-panel">
            <div className="lb-panel-head"><h2>Label Preview</h2></div>
            {current ? (
              <>
                <div className="lb-carousel">
                  <button aria-label="Previous" disabled={chosen.length < 2} onClick={() => setIdx((idx - 1 + chosen.length) % chosen.length)}>&lsaquo;</button>
                  <div className="lb-stage" style={{ "--lw": `${Math.min(300, w * 5)}px` }}>{labelEl}</div>
                  <button aria-label="Next" disabled={chosen.length < 2} onClick={() => setIdx((idx + 1) % chosen.length)}>&rsaquo;</button>
                </div>
                <div className="lb-dots">{chosen.slice(0, 6).map((c, n) => <i key={c.id} className={n === idx ? "on" : ""} />)}</div>
              </>
            ) : <p className="lb-none">Select a product to preview its label.</p>}
          </section>

          <section className="lb-panel">
            <div className="lb-panel-head"><h2>Print Settings</h2></div>
            <div className="lb-set">
              <span>Label Size</span>
              <Select value={size} onChange={(e) => setSize(e.target.value)}>
                {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
              <span>Labels per Product</span>
              <Step value={perProduct} onChange={changePerProduct} />
              <span>Code type</span>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="barcode">Barcode</option>
                <option value="qr">QR code</option>
              </Select>
            </div>
            <div className="lb-layouts" role="radiogroup" aria-label="Print layout">
              {LAYOUTS.map(([n, label]) => (
                <button key={n} role="radio" aria-checked={cols === n} className={cols === n ? "on" : ""} onClick={() => setCols(n)}>{label}</button>
              ))}
            </div>
            <div className="lb-actions">
              <button className="lb-btn primary big" disabled={!total || busy} onClick={print}>Print Labels{total ? ` (${total})` : ""}</button>
              <button className="lb-btn big" disabled={!total || busy} onClick={downloadPdf}>Download PDF</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
