import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../../api/client";
import { Banner, Card } from "../../components/ui";

const COLUMNS = ["sku", "barcode", "sellingPrice", "mrp", "costPrice", "taxRatePct", "stock"];

// Update prices, barcodes, GST and stock for existing products from a spreadsheet.
// Step 1 previews every row (nothing saved); step 2 applies the good rows.
export default function Import() {
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ["TOM-1KG", "", 40, 45, 30, 0, 100]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "product-import-template.xlsx");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReport(null);
    setMsg(null);
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <Card title="Import from Excel">
        <p>Columns: <code>{COLUMNS.join(", ")}</code>. Prices in rupees. <code>stock</code> sets the on-hand count. Products are matched by SKU; leave a cell empty to keep its current value.</p>
        <button className="btn" onClick={template}>Download template</button>{" "}
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
      </Card>
      {report && (
        <Card title={`${report.dryRun ? "Preview" : "Result"}: ${report.ok} OK, ${report.failed} with errors`}>
          {report.dryRun && (
            <button className="btn primary" disabled={busy || !report.ok} onClick={() => run(rows, false)}>
              Import {report.ok} valid row(s)
            </button>
          )}
          <table style={{ width: "100%", marginTop: 8 }}>
            <tbody>
              {report.results.filter((r) => r.status !== "ok").map((r) => (
                <tr key={r.row}><td>Row {r.row}</td><td>{r.sku}</td><td style={{ color: "crimson" }}>{r.message}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
