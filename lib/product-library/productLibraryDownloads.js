// Browser download helpers for Product Library exports.
// These touch document/URL and must only run client side.
import { csvCell } from "./productLibraryCsv.js";

export function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(fileName, payload) {
  downloadBlob(fileName, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
}

export function downloadText(fileName, text, type = "text/plain;charset=utf-8") {
  downloadBlob(fileName, new Blob([text], { type }));
}

export function downloadCsv(fileName, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(fileName, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
