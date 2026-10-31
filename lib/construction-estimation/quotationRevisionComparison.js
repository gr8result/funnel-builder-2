const clone = (value) => JSON.parse(JSON.stringify(value));
const metadata = new Set(["sortOrder", "sortSection", "sortSectionId"]);

export function compareQuotationRevisions(current = {}, previous = {}) {
  if (!current.jobId || current.jobId !== previous.jobId) throw new Error("Quotation revision belongs to another job.");
  if (!current.workspaceId || current.workspaceId !== previous.workspaceId) throw new Error("Quotation revision belongs to another builder or has no builder identity.");
  const entries = (workbook) => {
    const result = new Map();
    for (const [section, group] of Object.entries(workbook.quotation || {})) {
      for (const [index, row] of (group.rows || []).entries()) {
        const key = `${group.sectionId || section}\u0000${row.id}`;
        if (!row.id || result.has(key)) throw new Error("Quotation revision has ambiguous row identities.");
        result.set(key, { section, index, row });
      }
    }
    return result;
  };
  const before = entries(current), after = entries(previous);
  const changes = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const from = before.get(key), to = after.get(key);
    const fields = from && to ? Object.fromEntries([...new Set([...Object.keys(from.row), ...Object.keys(to.row)])]
      .filter((field) => !metadata.has(field) && JSON.stringify(from.row[field]) !== JSON.stringify(to.row[field]))
      .map((field) => [field, { before: from.row[field] ?? null, after: to.row[field] ?? null }])) : {};
    const action = !from ? "ADDED" : !to ? "REMOVED" : Object.keys(fields).length ? "UPDATED" : from.index !== to.index || from.section !== to.section ? "REORDERED" : "UNCHANGED";
    if (action !== "UNCHANGED") changes.push({ action, section: to?.section || from.section, rowId: to?.row.id || from.row.id, item: to?.row.item || from?.row.item || "", fields: clone(fields), beforeIndex: from?.index ?? null, afterIndex: to?.index ?? null });
  }
  const counts = { ADDED: 0, REMOVED: 0, UPDATED: 0, REORDERED: 0 };
  for (const change of changes) counts[change.action] += 1;
  return { jobId: current.jobId, workspaceId: current.workspaceId, currentRows: before.size, previousRows: after.size, counts, changes };
}