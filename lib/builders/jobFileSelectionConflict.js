// Opening a job file over the copy of the same job already saved in this browser.
// On 2026-10-30 a file saved before the builder's confirmed corrections was opened over the corrected
// job, and its older client selections silently replaced the newer ones. A file whose client
// selections are OLDER than the saved job's is therefore a conflict the user must decide:
//   keep the saved job / open the file but keep the confirmed corrections / open the file as it is.
import { carryForwardConfirmedDecisions } from "./clientSelectionCorrections.js";

const time = (value) => (Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0);
const bookOf = (workbook) => workbook?.clientSelectionsBook || workbook?.selectionsBook || null;
const bookTime = (book) => Math.max(time(book?.metadata?.savedAt), time(book?.updatedAt));
const guidedCount = (book) => (book?.rooms || []).flatMap((room) => room.rows || []).filter((row) => row?.guidedSelection && Object.keys(row.guidedSelection).length).length;
const correctionKey = (item = {}) => JSON.stringify([item.requirementKey || "", item.productId || "", item.productCode || "", item.levelId || "", item.from || "", item.to || ""]);

export function describeJobFileSelectionConflict(fileWorkbook = null, savedWorkbook = null) {
  const fileBook = bookOf(fileWorkbook);
  const savedBook = bookOf(savedWorkbook);
  if (!fileBook || !savedBook) return { conflict: false, reason: "nothing saved to compare with" };
  const fileRevision = String(fileBook.metadata?.selectionRevision || "");
  const savedRevision = String(savedBook.metadata?.selectionRevision || "");
  const fileAt = bookTime(fileBook);
  const savedAt = bookTime(savedBook);
  const summary = {
    file: { savedAt: fileAt ? new Date(fileAt).toISOString() : "", selectionRevision: fileRevision, selections: guidedCount(fileBook) },
    saved: { savedAt: savedAt ? new Date(savedAt).toISOString() : "", selectionRevision: savedRevision, selections: guidedCount(savedBook) },
  };
  if ((fileRevision && fileRevision === savedRevision) || savedAt <= fileAt) return { conflict: false, reason: "the file is not older than the saved job", ...summary };
  const fileLedgerKeys = new Set(["removeProducts", "removeFloorAllocations", "mergeRooms"].flatMap((field) => (fileBook.clientSelectionCorrections?.[field] || []).map(correctionKey)));
  const savedLedger = savedBook.clientSelectionCorrections || {};
  const missingCorrections = ["removeProducts", "removeFloorAllocations", "mergeRooms"].flatMap((field) => (savedLedger[field] || [])
    .filter((item) => !fileLedgerKeys.has(correctionKey(item)))
    .map((item) => item.reason || [item.requirementKey, item.productId, item.from && `${item.from} → ${item.to}`].filter(Boolean).join(" ")));
  const { carried } = carryForwardConfirmedDecisions(fileBook, [savedBook, { projectRoomModel: savedWorkbook?.projectRoomModel }]);
  return {
    conflict: true,
    reason: "the file's client selections are older than the ones saved for this job",
    ...summary,
    missingCorrections,
    correctionsConfirmedAt: savedLedger.confirmedAt || "",
    newerConfirmedRoomList: carried.roomModel,
  };
}
