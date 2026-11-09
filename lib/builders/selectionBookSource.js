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

// A book holds the client's selections when any row carries a guided selection (every Client
// Selections choice is recorded as one, including Electrical / Tiling / Cabinetry schedules that have
// no product). selectedProduct / selectedOptionId alone are NOT evidence: a freshly built template is
// pre-filled with the builder's standard inclusions and default products on every row.
export function bookHasSelections(book) {
  return (book?.rooms || []).some(room => (room?.rows || []).some(row => row?.guidedSelection && typeof row.guidedSelection === 'object' && Object.keys(row.guidedSelection).length > 0));
}
// Set only when a user saves a book that no longer holds any selection, having started from one
// that did: an intentional clearing, which must win like any other newer change.
export function bookConfirmedEmpty(book) {
  return Boolean(book?.metadata?.selectionsClearedAt);
}

// Deterministic choice between the job's own book, this browser's draft and the cloud book.
// Candidates are passed in priority order (job, draft, cloud). Rules:
//   1. Times are compared as instants (Date.parse), never as strings: "2026-10-30T10:06+10:00" is
//      earlier than "2026-10-30T00:08Z", although it sorts after it as text.
//   2. A book with no selections never replaces one that has them, unless it is a confirmed
//      clearing (bookConfirmedEmpty). An unconfirmed empty book is a template or a failed load.
//   3. A browser draft is unsaved work on top of ONE saved revision of the job (its `draftOf`). When
//      the job's selections are now a different revision (a job file was opened, another tab saved,
//      a rollback), the draft is stale whatever its time says: a draft is re-stamped every time the
//      page writes it, so an old book can carry a newer time than the job it would replace.
//   4. Otherwise the newest wins; a tie, or the same selection revision, goes to the earlier source.
export const selectionBookRevision = (book) => String(book?.metadata?.selectionRevision || '');
export function staleDraftReason(draft = null, job = null) {
  const jobRevision = selectionBookRevision(job?.book);
  const draftOf = String(draft?.draftOf ?? selectionBookRevision(draft?.book));
  if (!jobRevision || !draftOf || draftOf === jobRevision) return '';
  return `draft of saved revision ${draftOf}, but the job's selections are now revision ${jobRevision}`;
}
// Why a Client Selections save made from `baseRevision` must not be written over `workbook` ('' when
// it may). Unknown bases (callers that do not track one, a job with no recorded revision) are allowed,
// as is a base this tab replaced with its own later save (`ownRevisions`): saves queue behind each other.
export function staleClientSelectionsSave(baseRevision, workbook = {}, ownRevisions = new Set()) {
  const base = String(baseRevision || '');
  const current = selectionBookRevision(workbook?.clientSelectionsBook || workbook?.selectionsBook);
  if (!base || !current || base === current || ownRevisions.has(current)) return null;
  return { baseRevision: base, jobRevision: current };
}
export function reconcileSelectionBookSources(candidates = []) {
  const skipped = [];
  const job = candidates.find(candidate => candidate?.source === 'job' && valid(candidate.book)) || null;
  const current = candidates.filter(candidate => {
    if (!candidate || candidate.source !== 'browser-draft' || !job) return true;
    const reason = staleDraftReason(candidate, job);
    if (!reason) return true;
    skipped.push({ source: candidate.source, savedAt: candidate.savedAt || '', reason, stale: true });
    return false;
  });
  const usable = current.map((candidate) => (candidate && valid(candidate.book) ? {
    ...candidate, order: candidates.indexOf(candidate), at: time(candidate.savedAt || candidate.book?.updatedAt),
    hasSelections: bookHasSelections(candidate.book), confirmedEmpty: bookConfirmedEmpty(candidate.book),
    revision: selectionBookRevision(candidate.book),
  } : null)).filter(Boolean);
  if (!usable.length) return { chosen: null, skipped };
  const anyWithSelections = usable.some(candidate => candidate.hasSelections);
  const eligible = usable.filter(candidate => {
    if (candidate.hasSelections || candidate.confirmedEmpty || !anyWithSelections) return true;
    skipped.push({ source: candidate.source, savedAt: candidate.savedAt || '', reason: 'holds no selections and is not a confirmed clearing' });
    return false;
  });
  eligible.sort((a, b) => b.at - a.at || a.order - b.order);
  let chosen = eligible[0];
  const sameRevision = chosen.revision ? eligible.filter(candidate => candidate.revision === chosen.revision).sort((a, b) => a.order - b.order)[0] : null;
  if (sameRevision) chosen = sameRevision;
  return { chosen, skipped };
}

export function roomForSavedRequirement(book, requirementKey) {
  if (!requirementKey) return null;
  const owners = (book?.rooms || []).filter(room => (room.rows || []).some(row =>
    (row.guidedSelection?.requirementKey || row.guidedRequirementKey) === requirementKey));
  return owners.length === 1 ? owners[0] : null;
}
