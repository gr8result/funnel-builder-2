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

function pageHtml(page, number, { builderName, logoUrl, footerText }) {
  const body = (page.blocks || []).map((block) => {
    if (block.type === "section") return `<tr class="ssSection"><td colspan="8">${escape(block.number)}. ${escape(block.title)}</td></tr>`;
    if (block.type === "group") return `<tr class="ssGroup"><td colspan="8">${escape(block.title)}${block.continued ? " (continued)" : ""}</td></tr>`;
    return rowHtml(block.row || {});
  }).join("");
  return `<section class="ssPage" data-schedule-page="${number}" data-schedule-section="${escape(page.section?.key)}">
  <header class="ssHeader"><div><span>Inclusions and Selections Schedule</span><h2>${escape(page.section?.number)}. ${escape(page.section?.title)}${page.continued ? " — continued" : ""}</h2></div>${logoUrl ? `<img src="${escape(logoUrl)}" alt="${escape(builderName || "Builder logo")}" />` : `<b>${escape(builderName)}</b>`}</header>
  <main class="ssBody"><table class="ssTable"><colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /><col class="c6" /><col class="c7" /><col class="c8" /></colgroup>
  <thead><tr>${COLUMNS.map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></main>
  <footer class="ssFooter"><span>${escape(builderName)}</span><span>${escape(footerText)}</span><strong>Page ${number}</strong></footer>
</section>`;
}

// pages: schedule pages ({ section, continued, blocks }); the cover is page 1, so the body starts at 2.
export function renderSelectionsSchedulePagesHtml(pages = [], { builderName = "", logoUrl = "", footerText = "", firstPageNumber = 2 } = {}) {
  return pages.map((page, index) => pageHtml(page, firstPageNumber + index, { builderName, logoUrl, footerText })).join("\n");
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
  .ssTable col.c1 { width: 6%; } .ssTable col.c2 { width: 11%; } .ssTable col.c3 { width: 23%; } .ssTable col.c4 { width: 12%; } .ssTable col.c5 { width: 9%; } .ssTable col.c6 { width: 13%; } .ssTable col.c7 { width: 20%; } .ssTable col.c8 { width: 6%; }
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
  .ssStatus { font-weight: 900; color: #0f766e; } .ssStatus.upgrade { color: #92400e; } .ssStatus.tbc { color: #b91c1c; } .ssStatus.included { color: #334155; }
  .ssFooter { display: grid; grid-template-columns: auto 1fr auto; gap: 1.6cqw; align-items: center; background: #071827; color: #fff; padding: 0 1.6cqw; font-size: .95cqw; line-height: 1.2; }
  .ssFooter span:nth-child(2) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
