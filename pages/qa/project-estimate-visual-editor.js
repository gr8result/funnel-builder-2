import { useEffect, useMemo, useState } from "react";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import { createEstimateBuilderWorkbookDefaults } from "../../lib/construction-estimation/estimateBuilderWorkbookDefaults";
import { calculateEstimateBuilderWorkbook } from "../../lib/construction-estimation/estimateBuilderWorkbookCalculations";
import { ClientPageSheet } from "../../components/estimate-builder/EstimateBuilderWorkbook";

const STORAGE_KEY = "qa-project-estimate-visual-editor-workbook";

function createSeedWorkbook() {
  const workbook = createEstimateBuilderWorkbookDefaults();
  return {
    ...workbook,
    id: "qa-project-estimate-visual-editor",
    openedFileName: "QA Project Estimate Visual Editor",
    page: "projectEstimate",
    data: {
      ...(workbook.data || {}),
      projectDetails: {
        ...(workbook.data?.projectDetails || {}),
        rows: {
          ...(workbook.data?.projectDetails?.rows || {}),
          projectName: { ...(workbook.data?.projectDetails?.rows?.projectName || {}), value: "Araluen Residence" },
          clientName: { ...(workbook.data?.projectDetails?.rows?.clientName || {}), value: "Grant Test Client" },
          projectAddress: { ...(workbook.data?.projectDetails?.rows?.projectAddress || {}), value: "12 Visual Editor Way" },
          quoteNumber: { ...(workbook.data?.projectDetails?.rows?.quoteNumber || {}), value: "QA-1042" },
          quoteDate: { ...(workbook.data?.projectDetails?.rows?.quoteDate || {}), value: "19 July 2026" },
        },
      },
    },
  };
}

function loadWorkbook() {
  if (typeof window === "undefined") return createSeedWorkbook();
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return saved?.id ? saved : createSeedWorkbook();
  } catch {
    return createSeedWorkbook();
  }
}

function ProjectEstimateVisualEditorQaInner() {
  const [workbook, setWorkbook] = useState(null);
  useEffect(() => {
    setWorkbook(loadWorkbook());
  }, []);
  const preview = useMemo(() => workbook ? calculateEstimateBuilderWorkbook(workbook) : { summary: { finalQuoteTotal: 0, gst: 0 } }, [workbook]);
  const sheet = useMemo(() => ({
    workbook,
    preview,
    previewMode: false,
    updateClientPage(key, value) {
      setWorkbook((current) => {
        const next = { ...current, clientPage: { ...(current.clientPage || {}), [key]: value } };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    async saveDraft(nextWorkbook = null) {
      const next = nextWorkbook || workbook;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { ok: true };
    },
  }), [workbook, preview]);

  function reset() {
    const next = createSeedWorkbook();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWorkbook(next);
  }

  return (
    <main style={styles.page}>
      <section style={styles.qaBar}>
        <strong>QA Project Estimate Visual Editor</strong>
        <button type="button" style={styles.button} onClick={reset}>Reset QA workbook</button>
      </section>
      {workbook ? <ClientPageSheet sheet={sheet} /> : <div style={styles.loading}>Loading QA workbook...</div>}
    </main>
  );
}

export default function ProjectEstimateVisualEditorQaPage() {
  return (
    <WorkspaceProvider>
      <ProjectEstimateVisualEditorQaInner />
    </WorkspaceProvider>
  );
}

ProjectEstimateVisualEditorQaPage.disableLayout = true;

const styles = {
  page: { minHeight: "100vh", background: "#f6f8fb", color: "#0f172a", padding: 22 },
  qaBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "8px 12px", fontWeight: 800, cursor: "pointer" },
  loading: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 18, fontWeight: 800 },
};
