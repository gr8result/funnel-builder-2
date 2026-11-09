// The printed body of the Inclusions & Selections Schedule: the approved continuous layout.
// It renders the pages produced by selectionsScheduleDocument.js (paginateSchedule), so the PDF
// holds exactly what the on-screen schedule shows - Exterior Selections, Interior Selections,
// Painting Schedule - with the same rows, images and page breaks.

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const COLUMNS = ["Image", "Item", "Selected product", "Brand / Supplier", "Model / Code", "Colour / Finish", "Qty / Location", "Status"];
const swatch = (value) => (/^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : "");

function rowHtml(row) {
  const colour = swatch(row.swatch);
  const visual = row.imageUrl ? `<td class="ssVisual"><span class="ssImage"><img src="${escape(row.imageUrl)}" alt="${escape(row.product)}" /></span></td>`
    : colour ? `<td class="ssVisual"><span class="ssSwatch" style="background:${colour}"></span></td>` : "";
  const status = escape(row.status || "");
  return `<tr class="ssRow${row.imageUrl ? " withImage" : ""}" data-selection-id="${escape(row.id)}">${visual}`
    + `<td class="ssItem"${visual ? "" : ' colspan="2"'}>${escape(row.item)}</td>`
    + `<td><strong>${escape(row.product)}</strong>${row.details ? `<span>${escape(row.details)}</span>` : ""}</td>`
    + `<td>${escape(row.brandSupplier)}</td><td>${escape(row.modelCode)}</td>`
    + `<td>${row.imageUrl && colour ? `<i class="ssDot" style="background:${colour}"></i>` : ""}${escape(row.colourFinish)}</td>`
    + `<td>${escape(row.qtyLocation)}</td><td class="ssStatus ${status.toLowerCase()}">${status}</td></tr>`;
}

function pageHtml(page, number, { builderName, logoUrl, footerText, totalPages = 0 }) {
  const body = (page.blocks || []).map((block) => {
    if (block.type === "section") return `<tr class="ssSection"><td colspan="8">${escape(block.number)}. ${escape(block.title)}</td></tr>`;
    if (block.type === "group") return `<tr class="ssGroup"><td colspan="8">${escape(block.title)}${block.continued ? " (continued)" : ""}</td></tr>`;
    return rowHtml(block.row || {});
  }).join("");
  return `<section class="ssPage" data-schedule-page="${number}" data-schedule-section="${escape(page.section?.key)}">
  <header class="ssHeader"><div><span>Inclusions and Selections Schedule</span><h2>${escape(page.section?.number)}. ${escape(page.section?.title)}${page.continued ? " — continued" : ""}</h2></div>${logoUrl ? `<img src="${escape(logoUrl)}" alt="${escape(builderName || "Builder logo")}" />` : `<b>${escape(builderName)}</b>`}</header>
  <main class="ssBody"><table class="ssTable"><colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /><col class="c6" /><col class="c7" /><col class="c8" /></colgroup>
  <thead><tr>${COLUMNS.map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></main>
  <footer class="ssFooter"><span>${escape(builderName)}</span><span>${escape(footerText)}</span><strong>Page ${number}${totalPages ? ` of ${totalPages}` : ""}</strong></footer>
</section>`;
}

// The decisions still open, one line per group (cabinetry room, category...), so the client and builder
// see in one place what the TBC rows across the schedule are waiting for.
export function outstandingScheduleDecisions(pages = [], supplementalDecisions = []) {
  const byGroup = new Map();
  let section = "";
  let group = "";
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (block.type === "section") { section = String(block.title || ""); group = ""; continue; }
      if (block.type === "group") { group = String(block.title || ""); continue; }
      const row = block.row || {};
      if (String(row.status || "").toUpperCase() !== "TBC") continue;
      // "Kitchen — Splashback" is listed under its room: "Cabinetry & Benchtops — Kitchen: Splashback".
      const label = String(row.item || row.product || "").trim();
      const [, room = "", rest = label] = label.match(/^(.+?) — (.+)$/) || [];
      const area = [group || section, room].filter(Boolean).join(" — ");
      const key = `${section}|${area}`;
      if (!byGroup.has(key)) byGroup.set(key, { section, group: area, items: [], sourceRowIds: [] });
      const item = rest;
      if (item && !byGroup.get(key).items.includes(item)) byGroup.get(key).items.push(item);
      if (row.sourceRowId && !byGroup.get(key).sourceRowIds.includes(row.sourceRowId)) byGroup.get(key).sourceRowIds.push(row.sourceRowId);
    }
  }
  const representedSourceRows = new Set([...byGroup.values()].flatMap((entry) => entry.sourceRowIds));
  for (const decision of supplementalDecisions) {
    const sourceRowId = String(decision?.sourceRowId || "").trim();
    if (sourceRowId && representedSourceRows.has(sourceRowId)) continue;
    const group = String(decision?.title || "Client selection").trim();
    const detail = String(decision?.detail || "Selection requires confirmation.").trim();
    const key = `supplemental|${sourceRowId || group}`;
    if (!byGroup.has(key)) byGroup.set(key, { section: "", group, items: [], sourceRowIds: sourceRowId ? [sourceRowId] : [] });
    if (detail && !byGroup.get(key).items.includes(detail)) byGroup.get(key).items.push(detail);
  }
  return [...byGroup.values()];
}

// Height budget (mm) of a page body: A4 landscape minus header, footer, padding, table head and title.
const SUMMARY_BODY_MM = 150;
const summaryRowMm = (entry) => Math.max(8, Math.ceil(entry.items.join("; ").length / 110) * 4.2 + 2.5);
const ACCEPTANCE_MM = 60;

function summaryPagesHtml(entries, { acceptance, startNumber, totalPages, builderName, logoUrl, footerText }) {
  const pages = [];
  let current = [];
  let used = 0;
  for (const entry of entries) {
    const height = summaryRowMm(entry);
    if (current.length && used + height > SUMMARY_BODY_MM) { pages.push(current); current = []; used = 0; }
    current.push(entry); used += height;
  }
  const acceptanceOnOwnPage = acceptance && current.length && used + ACCEPTANCE_MM > SUMMARY_BODY_MM;
  pages.push(current);
  if (acceptanceOnOwnPage) pages.push([]);
  const signature = (label) => `<div class="ssSign"><span>${escape(label)}</span><i></i><span>Signature</span><i></i><span>Date</span><i></i></div>`;
  return pages.map((rows, index) => {
    const last = index === pages.length - 1;
    const continued = index > 0;
    const body = (index === 0 && !entries.length ? `<tr class="ssRow"><td colspan="8">There are no outstanding decisions in this schedule.</td></tr>` : "")
      + rows.map((entry) => `<tr class="ssRow ssOutstanding"><td class="ssItem" colspan="2">${escape(entry.group)}</td><td colspan="5">${escape(entry.items.join("; "))}</td><td class="ssStatus tbc">TBC</td></tr>`).join("")
      + (last && acceptance ? `<tr class="ssAcceptance"><td colspan="8"><strong>Client acceptance</strong><p>I/We have reviewed this schedule. The selections marked Selected, Included or Upgrade are confirmed; items marked TBC remain open and are not part of this acceptance. Prices are dealt with in the quotation and any variation.</p>${signature("Client")}${signature("Client")}${signature("For the builder")}</td></tr>` : "");
    return `<section class="ssPage ssSummaryPage" data-schedule-page="${startNumber + index}" data-schedule-section="outstanding">
  <header class="ssHeader"><div><span>Inclusions and Selections Schedule</span><h2>${last && acceptance && !rows.length ? "Client acceptance" : `Outstanding decisions${continued ? " — continued" : ""}`}</h2></div>${logoUrl ? `<img src="${escape(logoUrl)}" alt="${escape(builderName || "Builder logo")}" />` : `<b>${escape(builderName)}</b>`}</header>
  <main class="ssBody"><table class="ssTable"><colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /><col class="c6" /><col class="c7" /><col class="c8" /></colgroup>
  <thead><tr><th colspan="2">Area</th><th colspan="5">Still to be decided or confirmed</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></main>
  <footer class="ssFooter"><span>${escape(builderName)}</span><span>${escape(footerText)}</span><strong>Page ${startNumber + index}${totalPages ? ` of ${totalPages}` : ""}</strong></footer>
</section>`;
  });
}

// ---- Variation summary (selectionVariationPricing.js) ---------------------------------------------
// Totals and the final / draft status are recomputed here from the rows; nothing the browser sends
// about them is trusted. Estimated and confirmed amounts are never added together, an unresolved
// price prints "Builder Review Required" (never $0), and a summary with any row that is not a
// builder-confirmed variation is printed as a DRAFT, not a final variation.
const VARIATION_STATES = new Set(["calculable", "builder_review", "estimated_price", "confirmed"]);
const moneyText = (value) => `${value < 0 ? "-" : "+"}$${Math.abs(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function normaliseVariationSummary(summary = null) {
  const rows = (Array.isArray(summary?.rows) ? summary.rows : []).filter((row) => VARIATION_STATES.has(row?.state)).map((row) => {
    const amount = Number(row.amountIncGst);
    const price = Number(row.priceIncGst);
    // An estimated price (no allowance recorded) needs its price; a variation needs its amount.
    const priced = row.state === "estimated_price" ? Number.isFinite(price) && price > 0 : row.state !== "builder_review" && Number.isFinite(amount);
    const state = priced ? row.state : "builder_review";
    return {
      room: String(row.room || "Whole home"), requirementLabel: String(row.requirementLabel || ""), standard: String(row.standard || "No standard product recorded"), selected: String(row.selected || ""),
      quantity: Number(row.quantity) > 0 ? Number(row.quantity) : null, unit: String(row.unit || ""), quantitySource: String(row.quantitySource || ""),
      state, amountIncGst: priced && state !== "estimated_price" ? amount : null, priceIncGst: state === "estimated_price" ? price : null,
      autoEstimated: row.autoEstimated === true, priceSourceLabel: String(row.priceSourceLabel || ""), missing: (Array.isArray(row.missing) ? row.missing : []).map((entry) => String(entry?.label || entry || "")).filter(Boolean),
      builderApproval: state === "confirmed" ? "Approved" : "Pending",
      clientAcceptance: state !== "confirmed" ? "Not issued" : row.clientAcceptance === "accepted" ? "Accepted" : row.clientAcceptance === "declined" ? "Declined" : "Awaiting decision",
    };
  });
  const total = (state) => Math.round(rows.filter((row) => row.state === state).reduce((sum, row) => sum + row.amountIncGst, 0) * 100) / 100;
  const estimatedPrices = rows.filter((row) => row.state === "estimated_price");
  return { rows, estimatedTotalIncGst: total("calculable"), confirmedTotalIncGst: total("confirmed"), reviewCount: rows.filter((row) => row.state === "builder_review").length,
    estimatedPriceCount: estimatedPrices.length, estimatedPriceTotalIncGst: Math.round(estimatedPrices.reduce((sum, row) => sum + row.priceIncGst, 0) * 100) / 100,
    final: rows.length > 0 && rows.every((row) => row.state === "confirmed") };
}

// Page body budget (mm) and a deliberately generous row estimate: each row prints two lines in the item
// and selection cells, and a Builder Review row also prints what is missing. The totals block is
// reserved on the last page. The PDF generator still refuses any page that does not fit.
const VARIATION_BODY_MM = 138;
const VARIATION_TOTALS_MM = 26;
const textLines = (text, perLine) => Math.max(1, Math.ceil(String(text || "").length / perLine));
const variationRowMm = (row) => 3.5 + 4.6 * Math.max(
  1 + textLines(row.requirementLabel, 26),
  textLines(`Standard: ${row.standard}`, 50) + textLines(`Selected: ${row.selected}`, 50),
  row.state === "builder_review" ? 1 + textLines(`Your builder will confirm the measurements and price. Waiting on: ${row.missing.join("; ")}`, 26)
    : row.state === "estimated_price" ? 1 + textLines("Auto-estimated price - allowance not recorded; builder to confirm the difference", 26)
      : 1 + textLines(row.autoEstimated ? "Auto-estimated - subject to builder confirmation" : "Estimate - subject to builder approval", 26),
);
function variationPages(summary) {
  const pages = [[]];
  let used = 0;
  for (const row of summary.rows) {
    const height = variationRowMm(row);
    if (pages[pages.length - 1].length && used + height > VARIATION_BODY_MM) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(row); used += height;
  }
  // The totals block needs its own room on the last page.
  if (used + VARIATION_TOTALS_MM > VARIATION_BODY_MM && pages[pages.length - 1].length > 1) pages.push([pages[pages.length - 1].pop()]);
  return pages;
}
function variationPagesHtml(summary, { startNumber, totalPages, builderName, logoUrl, footerText }) {
  const pages = variationPages(summary);
  const status = summary.final ? "Confirmed variations" : "DRAFT — not a final variation";
  return pages.map((rows, index) => {
    const last = index === pages.length - 1;
    const body = rows.map((row) => {
      const price = row.state === "builder_review"
        ? `<strong>Builder Review Required</strong><span>Your builder will confirm the measurements and price.${row.missing.length ? ` Waiting on: ${escape(row.missing.join("; "))}` : ""}</span>`
        : row.state === "estimated_price"
          ? `<strong class="ssEstimatedPrice">$${escape(Math.abs(row.priceIncGst).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} inc GST (price)</strong><span>Auto-estimated price — allowance not recorded; your builder will confirm the difference</span>`
          : `<strong>${escape(moneyText(row.amountIncGst))} inc GST</strong><span>${row.state === "confirmed" ? "Confirmed by builder" : row.autoEstimated ? "Auto-estimated — subject to builder confirmation" : "Estimate — subject to builder approval"}</span>`;
      return `<tr class="ssRow ssVariation" data-variation-state="${escape(row.state)}"><td class="ssItem" colspan="2">${escape(row.room)}<span>${escape(row.requirementLabel)}</span></td>`
        + `<td colspan="2"><span>Standard: ${escape(row.standard)}</span><strong>Selected: ${escape(row.selected)}</strong></td>`
        + `<td>${row.quantity ? `${escape(row.quantity)} ${escape(row.unit)}` : "—"}${row.quantitySource ? `<span>${escape(row.quantitySource)}</span>` : ""}</td>`
        + `<td class="ssPrice">${price}</td><td>${escape(row.builderApproval)}</td><td class="ssStatus ${row.state === "confirmed" ? "included" : "tbc"}">${escape(row.clientAcceptance)}</td></tr>`;
    }).join("")
      + (index === 0 && !rows.length ? `<tr class="ssRow"><td colspan="8">There are no changes from the standard inclusions.</td></tr>` : "")
      + (last ? `<tr class="ssVariationTotals"><td colspan="8"><span>Estimated (subject to builder approval): <b>${summary.rows.some((row) => row.state === "calculable") ? escape(moneyText(summary.estimatedTotalIncGst)) : "—"}</b></span><span>Confirmed: <b>${summary.rows.some((row) => row.state === "confirmed") ? escape(moneyText(summary.confirmedTotalIncGst)) : "—"}</b></span><span>Builder Review Required: <b>${summary.reviewCount}</b></span>${summary.estimatedPriceCount ? `<span>Auto-estimated prices, allowance to confirm: <b>${summary.estimatedPriceCount}</b> (not in the totals)</span>` : ""}<p>${summary.final ? "Every variation above has been confirmed by the builder." : "Estimated amounts, auto-estimated prices and items marked Builder Review Required are not approved variations. Only amounts confirmed by the builder and accepted by the client form a variation to the contract."}</p></td></tr>` : "");
    return `<section class="ssPage ssVariationPage" data-schedule-page="${startNumber + index}" data-schedule-section="variations" data-variation-final="${summary.final ? "true" : "false"}">
  <header class="ssHeader"><div><span>Inclusions and Selections Schedule</span><h2>Variation summary${index ? " — continued" : ""} · ${escape(status)}</h2></div>${logoUrl ? `<img src="${escape(logoUrl)}" alt="${escape(builderName || "Builder logo")}" />` : `<b>${escape(builderName)}</b>`}</header>
  <main class="ssBody"><table class="ssTable"><colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /><col class="c6" /><col class="c7" /><col class="c8" /></colgroup>
  <thead><tr><th colspan="2">Room / item</th><th colspan="2">Standard inclusion → client selection</th><th>Quantity</th><th>Price difference</th><th>Builder</th><th>Client</th></tr></thead><tbody>${body}</tbody></table></main>
  <footer class="ssFooter"><span>${escape(builderName)}</span><span>${escape(footerText)}</span><strong>Page ${startNumber + index}${totalPages ? ` of ${totalPages}` : ""}</strong></footer>
</section>`;
  });
}

// How many pages the outstanding-decisions summary (and acceptance block) adds.
function summaryPageCount(entries, acceptance) {
  return summaryPagesHtml(entries, { acceptance, startNumber: 0, totalPages: 0 }).length;
}

// pages: schedule pages ({ section, continued, blocks }); the cover is page 1, so the body starts at 2.
// summary: add the outstanding-decisions page(s) after the schedule; acceptance: end with the client
// acceptance block (left out when the builder supplies their own approval document).
export function renderSelectionsSchedulePagesHtml(pages = [], { builderName = "", logoUrl = "", footerText = "", firstPageNumber = 2, summary = false, acceptance = false, outstandingDecisions = [], variationSummary = null } = {}) {
  const entries = summary ? outstandingScheduleDecisions(pages, outstandingDecisions) : [];
  const extra = summary || acceptance ? summaryPageCount(entries, acceptance) : 0;
  const variations = variationSummary ? normaliseVariationSummary(variationSummary) : null;
  const variationCount = variations ? variationPages(variations).length : 0;
  const totalPages = firstPageNumber - 1 + pages.length + variationCount + extra;
  const body = pages.map((page, index) => pageHtml(page, firstPageNumber + index, { builderName, logoUrl, footerText, totalPages }));
  if (variations) body.push(...variationPagesHtml(variations, { startNumber: firstPageNumber + pages.length, totalPages, builderName, logoUrl, footerText }));
  if (extra) body.push(...summaryPagesHtml(entries, { acceptance, startNumber: firstPageNumber + pages.length + variationCount, totalPages, builderName, logoUrl, footerText }));
  return body.join("\n");
}

export const selectionsScheduleCss = `
  @page ssLandscape { size: A4 landscape; margin: 0; }
  .ssPage { page: ssLandscape; width: 297mm; height: 210mm; overflow: hidden; break-after: page; container-type: inline-size; display: grid; grid-template-rows: 5.2cqw minmax(0, 1fr) 2.6cqw; background: #fff; color: #102033; font-family: Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .ssPage:last-of-type { break-after: auto; }
  .ssHeader { display: flex; align-items: center; justify-content: space-between; gap: 2cqw; background: #071827; color: #fff; border-left: .7cqw solid #c99735; padding: 0 1.6cqw; }
  .ssHeader span { display: block; color: #f8d58a; font-size: .95cqw; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
  .ssHeader h2 { margin: .15cqw 0 0; color: #fff; font-size: 1.9cqw; line-height: 1.05; text-transform: uppercase; }
  .ssHeader img { height: 3.8cqw; max-width: 12cqw; object-fit: contain; background: #fff; padding: .25cqw .5cqw; border-radius: .2cqw; }
  .ssHeader b { font-size: 1.2cqw; }
  .ssBody { min-height: 0; overflow: hidden; padding: 1cqw 1.5cqw; }
  .ssTable { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 1.05cqw; line-height: 1.25; }
  .ssTable col.c1 { width: 6%; } .ssTable col.c2 { width: 11%; } .ssTable col.c3 { width: 23%; } .ssTable col.c4 { width: 12%; } .ssTable col.c5 { width: 9%; } .ssTable col.c6 { width: 13%; } .ssTable col.c7 { width: 17%; } .ssTable col.c8 { width: 9%; }
  .ssTable th { height: 2.3cqw; background: #e8edf2; color: #071827; border: .08cqw solid #cfd8e3; padding: 0 .5cqw; text-align: left; font-size: .86cqw; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
  .ssTable td { border: .08cqw solid #d9e0e8; padding: .3cqw .5cqw; vertical-align: middle; overflow-wrap: anywhere; }
  .ssTable tr { break-inside: avoid; page-break-inside: avoid; }
  .ssSection td { height: 4.2cqw; border: 0; border-bottom: .22cqw solid #c99735; padding: 1cqw 0 .3cqw; color: #071827; font-size: 1.75cqw; font-weight: 950; text-transform: uppercase; letter-spacing: .03em; vertical-align: bottom; }
  .ssGroup td { height: 2.5cqw; background: #071827; color: #fff; border-color: #071827; font-size: 1cqw; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
  .ssRow { height: 2.7cqw; } .ssRow.withImage { height: 3.6cqw; }
  .ssRow td strong { display: block; color: #071827; font-weight: 900; }
  .ssRow td span { display: block; color: #475569; font-size: .95cqw; margin-top: .1cqw; }
  .ssItem { font-weight: 800; color: #071827; }
  .ssTable td.ssVisual { padding: .2cqw; text-align: center; }
  .ssImage { display: block; width: 100%; height: 3.05cqw; } .ssImage img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .ssSwatch { display: block; width: 100%; height: 1.9cqw; border: .08cqw solid rgba(15,23,42,.3); border-radius: .2cqw; }
  .ssDot { display: inline-block; width: 1.5cqw; height: .9cqw; margin-right: .4cqw; border: .08cqw solid rgba(15,23,42,.3); border-radius: .15cqw; vertical-align: -.1cqw; }
  .ssStatus { font-weight: 900; color: #0f766e; white-space: nowrap; word-break: normal; overflow-wrap: normal; } .ssStatus.upgrade { color: #92400e; } .ssStatus.tbc { color: #b91c1c; } .ssStatus.included { color: #334155; }
  .ssFooter { display: grid; grid-template-columns: auto 1fr auto; gap: 1.6cqw; align-items: center; background: #071827; color: #fff; padding: 0 1.6cqw; font-size: .95cqw; line-height: 1.2; }
  .ssOutstanding td { vertical-align: top; padding-top: .45cqw; padding-bottom: .45cqw; }
  .ssAcceptance td { border: 0; padding: 1.4cqw 0 0; } .ssAcceptance strong { display: block; font-size: 1.3cqw; color: #071827; text-transform: uppercase; letter-spacing: .05em; } .ssAcceptance p { margin: .5cqw 0 1cqw; color: #334155; font-size: 1cqw; line-height: 1.4; }
  .ssSign { display: grid; grid-template-columns: 9cqw 1fr 5.5cqw 1fr 3.5cqw 10cqw; gap: .8cqw; align-items: end; height: 3.2cqw; font-size: .95cqw; color: #475569; } .ssSign i { display: block; border-bottom: .1cqw solid #64748b; height: 2cqw; }
  .ssFooter span:nth-child(2) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ssVariation td { vertical-align: top; padding-top: .45cqw; padding-bottom: .45cqw; }
  .ssVariation td.ssPrice strong { color: #92400e; } .ssVariation[data-variation-state="confirmed"] td.ssPrice strong { color: #065f46; } .ssVariation[data-variation-state="calculable"] td.ssPrice strong { color: #071827; } .ssVariation[data-variation-state="estimated_price"] td.ssPrice strong { color: #075985; }
  .ssVariationTotals td { border: 0; padding: 1cqw 0 0; } .ssVariationTotals span { display: inline-block; margin-right: 2.5cqw; font-size: 1.1cqw; color: #071827; } .ssVariationTotals p { margin: .6cqw 0 0; color: #334155; font-size: 1cqw; line-height: 1.4; }
`;
