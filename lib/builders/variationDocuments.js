// Official variation document and tax invoice for a signed-off variation (Variations module).
// Client documents: they show the variation's description and its client amounts (ex GST, GST,
// inc GST) only - never the builder's cost, margin or supplier rates.

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
const money = (value) => {
  const amount = Number(value) || 0;
  return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const date = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
};

const PAGE_CSS = `body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:32px;font-size:16px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:24px 0 8px}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;font-size:16px;vertical-align:top}th{background:#f1f5f9}
td.num,th.num{text-align:right;white-space:nowrap}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px;margin-top:12px}.total td{font-weight:700}
.sign{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:32px}.sign div{border-top:1px solid #0f172a;padding-top:6px}@media print{body{margin:16mm}}`;

function amounts(variation = {}) {
  const total = Number(variation.total) || 0;
  const gst = Number(variation.gst_total) || 0;
  const subtotal = Number.isFinite(Number(variation.subtotal)) ? Number(variation.subtotal) : total - gst;
  return { subtotal, gst, total };
}

function header(title, variation, project) {
  return `<h1>${escape(title)}</h1><div class="meta">
<span><b>Variation:</b> ${escape(variation.variation_number)}</span><span><b>Job:</b> ${escape(project.project_name || project.projectName || "")}</span>
<span><b>Client:</b> ${escape(project.client_name || project.clientName || "")}</span><span><b>Site:</b> ${escape(project.site_address || project.siteAddress || "")}</span></div>`;
}

export function variationDocumentHtml(variation = {}, { project = {}, builderName = "" } = {}) {
  const meta = variation.metadata || {};
  const { subtotal, gst, total } = amounts(variation);
  const figures = meta.approvalFigures || null;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(variation.variation_number)} Variation</title><style>${PAGE_CSS}</style></head><body>
${header("Variation to Contract", variation, project)}
<h2>Change</h2><table><tr><th>Description</th><th class="num">Amount inc GST</th></tr>
<tr><td>${escape(meta.clientDescription || variation.title)}${meta.quantity ? `<br>Quantity: ${escape(meta.quantity)} ${escape(meta.unit || "")}` : ""}</td><td class="num">${money(total)}</td></tr></table>
<h2>Price</h2><table><tr><td>Variation amount ex GST</td><td class="num">${money(subtotal)}</td></tr><tr><td>GST</td><td class="num">${money(gst)}</td></tr><tr class="total"><td>Variation amount inc GST</td><td class="num">${money(total)}</td></tr></table>
${figures ? `<h2>Running total of approved variations</h2><table><tr><td>Approved before this variation</td><td class="num">${money(figures.previousTotalIncGst)}</td></tr><tr><td>This variation</td><td class="num">${money(figures.currentIncGst)}</td></tr><tr class="total"><td>New total of approved variations</td><td class="num">${money(figures.newTotalIncGst)}</td></tr></table>` : ""}
<h2>Approvals</h2><table><tr><td>Client approval</td><td>${escape(variation.approved_by_name || "Client")}${meta.clientApprovedAt || variation.approved_at ? ` — ${escape(date(meta.clientApprovedAt || variation.approved_at))}` : ""}</td></tr>
<tr><td>Builder sign-off</td><td>${meta.builderSignedOffAt ? `${escape(builderName || "Builder")} — ${escape(date(meta.builderSignedOffAt))}` : "Awaiting builder sign-off"}</td></tr></table>
<div class="sign"><div>Client signature</div><div>Builder signature</div></div>
</body></html>`;
}

export function variationInvoiceHtml(variation = {}, { project = {}, builderName = "", abn = "" } = {}) {
  const meta = variation.metadata || {};
  const invoice = meta.invoice || {};
  if (!invoice.number) throw new Error("This variation has not been invoiced.");
  const { subtotal, gst, total } = amounts(variation);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tax Invoice ${escape(invoice.number)}</title><style>${PAGE_CSS}</style></head><body>
<h1>Tax Invoice</h1><div class="meta"><span><b>Invoice:</b> ${escape(invoice.number)}</span><span><b>Date:</b> ${escape(date(invoice.preparedAt))}</span>
<span><b>From:</b> ${escape(builderName || "")}${abn ? ` (ABN ${escape(abn)})` : ""}</span><span><b>To:</b> ${escape(project.client_name || project.clientName || "")}</span>
<span><b>Job:</b> ${escape(project.project_name || project.projectName || "")}</span><span><b>Site:</b> ${escape(project.site_address || project.siteAddress || "")}</span></div>
<table><tr><th>Description</th><th class="num">Amount ex GST</th><th class="num">GST</th><th class="num">Amount inc GST</th></tr>
<tr><td>Variation ${escape(variation.variation_number)}: ${escape(meta.clientDescription || variation.title)}</td><td class="num">${money(subtotal)}</td><td class="num">${money(gst)}</td><td class="num">${money(total)}</td></tr>
<tr class="total"><td>Total due</td><td class="num">${money(subtotal)}</td><td class="num">${money(gst)}</td><td class="num">${money(total)}</td></tr></table>
</body></html>`;
}

// Opens a document in a new window for printing / saving as PDF (browser only).
export function openPrintableDocument(html) {
  if (typeof window === "undefined") return false;
  const opened = window.open("", "_blank");
  if (!opened) return false;
  opened.document.open();
  opened.document.write(html);
  opened.document.close();
  return true;
}
