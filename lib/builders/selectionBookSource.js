// Read-only source selection. Never merge conflicting books or rewrite their timestamps.
const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const valid = book => Array.isArray(book?.rooms);
const populated = book => (book?.rooms || []).some(room => (room.rows || []).some(row => row.selectedProduct || row.guidedSelection?.productId || row.guidedSelection?.productName || row.guidedSelection?.configurationComplete));
export function selectionBookFromWorkbook(workbook = {}) {
  const books = [workbook?.clientSelectionsBook, workbook?.selectionsBook, workbook?.builderSelectionsBook,
    workbook?.selections?.book, workbook?.data?.clientSelectionsBook, workbook?.data?.selectionsBook].filter(valid);
  return books.sort((a, b) => time(b.updatedAt) - time(a.updatedAt))[0] || null;
}

export function chooseSelectionBookSource({ workbook = {}, draft = null, projectId = '', workspaceId = '' } = {}) {
  const book = selectionBookFromWorkbook(workbook);
  const workbookId = workbook?.jobId || workbook?.projectId || workbook?.registeredJobId;
  const belongs = !workbookId || workbookId === projectId;
  const savedAt = workbook?.savedAt || book?.updatedAt || '';
  const saved = book && belongs ? { book, savedAt, source: 'workbook' } : null;
  const cached = valid(draft?.book) && draft.projectId === projectId
    && (!draft.workspaceId || draft.workspaceId === workspaceId) ? { ...draft, source: 'browser-draft' } : null;
  if (!cached) return saved;
  if (!saved) return cached;
  if (populated(saved.book) && !populated(cached.book)) return saved;
  // A persisted workbook wins a tie or an undated cache. A genuinely newer draft
  // remains available; merely mounting/reloading the editor must not stamp it newer.
  return time(cached.savedAt) > time(savedAt) ? cached : saved;
}

export function roomForSavedRequirement(book, requirementKey) {
  if (!requirementKey) return null;
  const owners = (book?.rooms || []).filter(room => (room.rows || []).some(row =>
    (row.guidedSelection?.requirementKey || row.guidedRequirementKey) === requirementKey));
  return owners.length === 1 ? owners[0] : null;
}
