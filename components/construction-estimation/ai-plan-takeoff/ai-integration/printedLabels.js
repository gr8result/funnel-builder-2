// Printed opening labels in the browser: reads the size labels drawn on the sheet with a local
// tesseract.js worker whose files are served from this app (public/takeoff-ocr), applies the ones that
// agree with the measured openings, and reports the rest. Never blocks a takeoff: when the local OCR
// files are missing or reading fails, the takeoff continues without labels and says so.
import { recogniseOpeningLabels, recogniseRoomLabels, createTesseractLabelReader } from '../geometry/localLabelOcr.js';
import { applyPrintedLabels } from '../geometry/openingLabels.js';

export const PRINTED_LABEL_ASSETS = '/takeoff-ocr';
let readerPromise = null;

async function localReader(base) {
  if (!readerPromise) {
    readerPromise = (async () => {
      const probe = await fetch(`${base}/tessdata/eng.traineddata`, { method: 'HEAD' });
      if (!probe.ok) throw new Error('The local OCR language data is not installed (public/takeoff-ocr).');
      const { createWorker } = await import('tesseract.js');
      return createTesseractLabelReader({
        createWorker, langPath: `${base}/tessdata`, workerPath: `${base}/worker.min.js`, corePath: `${base}/core`,
        toImage: (crop) => new Blob([crop.bytes], { type: 'image/x-portable-graymap' }),
      });
    })();
    readerPromise.catch(() => { readerPromise = null; });
  }
  return readerPromise;
}

// Mutates detected.openings (as the detector's own classification stage does). Returns
// { report, warning } — report is null when labels were not read.
export async function readPrintedOpeningLabels({ detected, raster, logicalWidth, pixelsPerMm, textItems = [], base = PRINTED_LABEL_ASSETS, reader: suppliedReader }) {
  if (!raster?.data || !(pixelsPerMm > 0) || !detected?.walls?.length) return { report: null, warning: null };
  try {
    const reader = suppliedReader || await localReader(base);
    const read = await recogniseOpeningLabels({ raster, logicalWidth, pixelsPerMm, walls: detected.walls, textItems, reader });
    const applied = applyPrintedLabels(detected, read.labels, { pixelsPerMm });
    const report = {
      engine: 'tesseract.js 7 (local, tessdata_fast eng)', stats: read.stats, applied: applied.applied, resolved: applied.resolved,
      split: applied.split, conflicts: applied.conflicts, weak: applied.weak, ambiguous: applied.ambiguous, unassigned: applied.unassigned,
    };
    detected.stats = { ...(detected.stats || {}), printedLabels: { read: read.stats.labels, applied: applied.applied, settled: applied.resolved.length, split: applied.split.length, conflicts: applied.conflicts.length } };
    // Room names with no text layer (outlined glyphs, scans), read with the same local worker.
    let roomLabels = [];
    try {
      const rooms = await recogniseRoomLabels({ raster, logicalWidth, pixelsPerMm, walls: detected.walls, textItems, reader, alreadyRead: read.unreadable || [] });
      roomLabels = rooms.labels;
      report.roomLabels = { ...rooms.stats, names: rooms.labels.map((l) => l.text) };
    } catch { /* room names are optional; openings above are unaffected */ }
    return { report, warning: null, roomLabels };
  } catch (error) {
    return { report: null, warning: `Printed opening labels were not read on this sheet (${error.message}). Openings are measured from the linework only.` };
  }
}
