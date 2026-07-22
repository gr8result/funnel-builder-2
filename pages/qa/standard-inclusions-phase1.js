import { useEffect, useMemo, useState } from "react";
import { createPremierInclusionsWorkingCopy } from "../../components/document-engine/templates/premierInclusionsMasterTemplate";
import { StandardInclusionsSheet } from "../../components/estimate-builder/EstimateBuilderWorkbook";

const STORAGE_KEY = "qa-standard-inclusions-phase1-workbook";
const DB_NAME = "estimate-builder-template-db";
const JOB_STORE_NAME = "jobs";
const ACTIVE_JOB_KEY = "active-job";
const QA_JOB_KEY = "job:qa-standard-inclusions-phase1";

function createSeedWorkbook() {
  const document = createPremierInclusionsWorkingCopy({
    builderId: "qa-builder",
    workbookId: "qa-standard-inclusions-phase1",
  });
  return {
    id: "qa-standard-inclusions-phase1",
    openedFileName: "QA Standard Inclusions Phase 1",
    builderId: "qa-builder",
    page: "standardInclusions",
    standardInclusions: {
      selectedPackageId: "std-premier-range-inclusions",
      documentBuilder: {
        ...document,
        id: "qa-standard-inclusions-phase1-doc",
        name: "QA Delete Proof Schedule",
        pages: document.pages.slice(0, 1),
        activePageId: document.pages[0]?.id || null,
        metadata: {
          ...(document.metadata || {}),
          documentSource: "qa-phase1-seed",
        },
      },
      scheduleDeleted: false,
      activeDocumentId: "qa-standard-inclusions-phase1-doc",
      activeDocumentName: "QA Delete Proof Schedule",
      activeDocumentSource: "qa-phase1-seed",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
      revisionHistory: [],
    },
  };
}

function loadInitialWorkbook() {
  if (typeof window === "undefined") return createSeedWorkbook();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return parsed?.id ? parsed : createSeedWorkbook();
  } catch {
    return createSeedWorkbook();
  }
}

function openQaDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("templates")) db.createObjectStore("templates");
      if (!db.objectStoreNames.contains(JOB_STORE_NAME)) db.createObjectStore(JOB_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open QA IndexedDB."));
  });
}

async function saveQaWorkbook(workbook) {
  const savedAt = new Date().toISOString();
  const record = {
    type: "job",
    key: QA_JOB_KEY,
    name: workbook.openedFileName || "QA Standard Inclusions Phase 1",
    savedAt,
    workbook: { ...workbook, savedAt },
  };
  const db = await openQaDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE_NAME, "readwrite");
    const store = transaction.objectStore(JOB_STORE_NAME);
    store.put(record, QA_JOB_KEY);
    store.put({ type: "active-job-pointer", key: ACTIVE_JOB_KEY, activeJobKey: QA_JOB_KEY, savedAt }, ACTIVE_JOB_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save QA workbook."));
  });
  db.close();
  return record;
}

async function loadQaWorkbookFromIndexedDb() {
  const db = await openQaDb();
  const record = await new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE_NAME, "readonly");
    const request = transaction.objectStore(JOB_STORE_NAME).get(QA_JOB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read QA workbook."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not read QA workbook."));
    };
  });
  return record?.workbook?.id ? record.workbook : null;
}

export default function StandardInclusionsPhase1QaPage() {
  const [workbook, setWorkbook] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadQaWorkbookFromIndexedDb()
      .then((saved) => {
        if (!cancelled) setWorkbook(saved || loadInitialWorkbook());
      })
      .catch(() => {
        if (!cancelled) setWorkbook(loadInitialWorkbook());
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const sheet = useMemo(() => ({
    workbook,
    previewMode: false,
    async updateStandardInclusions(nextStandardInclusions, options = {}) {
      const next = await new Promise((resolve, reject) => {
        setWorkbook((current) => {
        const next = { ...current, standardInclusions: nextStandardInclusions };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, standardInclusions: { ...next.standardInclusions, documentBuilder: null } }));
        }
        resolve(next);
        return next;
        });
      });
      if (!options.persist) return next.standardInclusions;
      const savedRecord = await saveQaWorkbook(next);
      const savedWorkbook = savedRecord?.workbook || await loadQaWorkbookFromIndexedDb();
      return savedWorkbook?.standardInclusions || null;
    },
  }), [workbook]);

  async function reset() {
    const next = createSeedWorkbook();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    try {
      await saveQaWorkbook(next);
    } catch {}
    setWorkbook(next);
  }

  return (
    <main style={styles.page}>
      <section style={styles.qaBar}>
        <strong>QA Standard Inclusions Phase 1</strong>
        <button type="button" style={styles.button} onClick={reset}>Reset proof schedule</button>
      </section>
      {workbook ? <StandardInclusionsSheet sheet={sheet} /> : <div style={styles.loading}>Loading QA workbook...</div>}
    </main>
  );
}

StandardInclusionsPhase1QaPage.disableLayout = true;

const styles = {
  page: { minHeight: "100vh", background: "#f6f8fb", color: "#0f172a", padding: 22 },
  qaBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "8px 12px", fontWeight: 800, cursor: "pointer" },
  loading: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 18, fontWeight: 800 },
};
