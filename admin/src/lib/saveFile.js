// One place for every download in the admin: file names and the download.
import { toast } from "../components/toast";

// "Products 16-11-26 3.00 pm": every download gets its own date and time, so
// a second one never turns into "products (1)". Windows does not allow ":"
// in file names, so the time is written 3.00 pm.
export function stampedName(title) {
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  const hour = now.getHours() % 12 || 12;
  const stamp = `${two(now.getDate())}-${two(now.getMonth() + 1)}-${two(now.getFullYear() % 100)} ${hour}.${two(
    now.getMinutes()
  )} ${now.getHours() < 12 ? "am" : "pm"}`;
  const name = String(title || "Export").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Export";
  return `${name} ${stamp}`;
}

const TYPES = {
  csv: { description: "CSV file", mime: "text/csv" },
  xlsx: { description: "Excel workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  doc: { description: "Word document", mime: "application/msword" },
  pdf: { description: "PDF document", mime: "application/pdf" },
};

export const mimeOf = (ext) => TYPES[ext]?.mime || "application/octet-stream";

// saveFile(content, filename) or saveFile(() => content, filename), where the
// function may be async (a PDF still being built).
//
// A direct browser download: one click and the file goes to the Downloads
// folder, showing in the browser's download list. No Save As window.
export async function saveFile(content, filename, mimeOverride) {
  const ext = filename.split(".").pop().toLowerCase();
  const mime = mimeOverride || mimeOf(ext);
  let blob;
  try {
    const value = typeof content === "function" ? await content() : content;
    blob = value instanceof Blob ? value : new Blob([value], { type: mime });
  } catch (err) {
    console.error("[saveFile] could not create", filename, err);
    toast(`Could not create ${filename}: ${err?.message || err}`, "error");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Freed a little later: revoking at once can cancel the download.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
  toast(`Downloaded ${filename}`);
}
