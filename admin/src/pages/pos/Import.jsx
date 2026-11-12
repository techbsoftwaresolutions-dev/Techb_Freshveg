import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../../api/client";
import { Banner } from "../../components/ui";
import "./labels.css";
import "./import.css";

const COLUMNS = ["sku", "barcode", "sellingPrice", "mrp", "costPrice", "taxRatePct", "stock"];

// Update prices, barcodes, GST and stock for existing products from a spreadsheet.
// Step 2 previews every row (nothing saved); step 3 applies the good rows.
export default function Import() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ["TOM-1KG", "", 40, 45, 30, 0, 100]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "product-import-template.xlsx");
  };

  const readFile = async (file) => {
    if (!file) return;
    setReport(null);
    setMsg(null);
    setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      // Match headers case-insensitively so "SKU" and "sku" both work.
      const norm = data.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const col = COLUMNS.find((c) => c.toLowerCase() === String(k).trim().toLowerCase());
          if (col) out[col] = v;
        }
        return out;
      });
      setRows(norm);
      run(norm, true);
    } catch (err) {
      setMsg({ tone: "danger", text: `Could not read the file: ${err.message}` });
    }
  };

  const run = async (data, dryRun) => {
    setBusy(true);
    try {
      const r = await api.post("/pos/import", { rows: data, dryRun });
      setReport(r);
      if (!dryRun) setMsg({ tone: "ok", text: `Imported ${r.ok} row(s); ${r.failed} skipped.` });
    } catch (err) {
      setMsg({ tone: "danger", text: err.message });
    }
    setBusy(false);
  };

  const errors = report ? report.results.filter((r) => r.status !== "ok") : [];

  return (
    <div className="lb im">
      <div className="page-head">
        <div><h1>Excel Import</h1></div>
      </div>

      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

      <div className="im-grid">
        <div className="lb-panel im-step">
          <span className="im-num">1</span>
          <h2>Get the template</h2>
          <p>Fill one row per product. Prices are in rupees; <b>stock</b> sets the on-hand count. Products are matched by SKU, and an empty cell keeps the current value.</p>
          <div className="im-cols">{COLUMNS.map((c) => <span key={c}>{c}</span>)}</div>
          <button className="lb-btn" onClick={template}>Download template</button>
        </div>

        <div className="lb-panel im-step">
          <span className="im-num">2</span>
          <h2>Upload your file</h2>
          <div
            className={`im-drop${over ? " over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files?.[0]); }}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <b>{fileName || "Drop an Excel file here, or click to choose"}</b>
            <small>.xlsx, .xls or .csv</small>
            <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
          </div>
        </div>

        <div className="lb-panel im-step">
          <span className="im-num">3</span>
          <h2>Review and import</h2>
          {!report ? (
            <p className="im-muted">Every row is checked first. Nothing is saved until you press Import.</p>
          ) : (
            <>
              <div className="im-sum">
                <span className="ok"><b>{report.ok}</b> ready</span>
                <span className={report.failed ? "bad" : ""}><b>{report.failed}</b> with errors</span>
              </div>
              {report.dryRun && (
                <button className="lb-btn primary big" disabled={busy || !report.ok} onClick={() => run(rows, false)}>
                  {busy ? "Importing..." : `Import ${report.ok} valid row${report.ok === 1 ? "" : "s"}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="lb-panel">
          <h2 className="im-h2">Rows with errors</h2>
          <div className="im-table">
            <table>
              <thead><tr><th>Row</th><th>SKU</th><th>Problem</th></tr></thead>
              <tbody>
                {errors.map((r) => (
                  <tr key={r.row}><td>{r.row}</td><td>{r.sku}</td><td className="bad">{r.message}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
