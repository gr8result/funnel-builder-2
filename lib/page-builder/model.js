export const SHAPE_TYPES = ["rectangle", "circle", "line", "triangle"];

export function createElement(type, overrides = {}) {
  const base = {
    id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    x: 8,
    y: 8,
    width: type === "line" ? 84 : 34,
    height: type === "line" ? 2 : 14,
    rotation: 0,
    locked: false,
    mode: type === "text" ? "text" : type === "image" ? "image" : "color",
    text: type === "text" ? "Edit this text" : "",
    dataField: "",
    color: type === "line" ? "#d4af55" : "#d4af55",
    imageUrl: "",
  };
  return { ...base, ...overrides };
}

export function createPage(name = "New Page", elements = []) {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    backgroundColor: "#07111f",
    backgroundImage: "",
    elements,
  };
}

export function addPage(pages, name = "New Page") {
  const safeName = String(name || "").trim() || "New Page";
  return [...pages, createPage(safeName)];
}

export function duplicatePage(pages, index) {
  if (!pages[index]) return pages;
  const copy = { ...pages[index], id: `page-${Date.now()}`, name: `${pages[index].name} Copy`, elements: pages[index].elements.map((element) => ({ ...element, id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })) };
  return [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
}

export function movePage(pages, index, direction) {
  const next = index + direction;
  if (index < 0 || next < 0 || next >= pages.length) return pages;
  const result = pages.slice();
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function insertShape(page, shape) {
  return { ...page, elements: [...page.elements, createElement(shape)] };
}

export function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
    : "$0.00";
}

export function estimateSummary(source = {}) {
  const total = Number(source.totalIncGst ?? source.total ?? source.finalQuoteTotal ?? 0);
  const rows = Array.isArray(source.stages) ? source.stages : [];
  return {
    total: Number.isFinite(total) ? total : 0,
    stages: rows.length ? rows : [
      { stage: "PRELIMINARIES", percentage: 5, amount: 0 },
      { stage: "BASE STAGE", percentage: 10, amount: 0 },
      { stage: "FRAME STAGE", percentage: 15, amount: 0 },
      { stage: "LOCK UP STAGE", percentage: 25, amount: 0 },
      { stage: "FIX OUT STAGE", percentage: 20, amount: 0 },
      { stage: "PRACTICAL COMPLETION", percentage: 15, amount: 0 },
      { stage: "HANDOVER", percentage: 10, amount: 0 },
    ].map((row) => ({ ...row, amount: total * row.percentage / 100 })),
  };
}
