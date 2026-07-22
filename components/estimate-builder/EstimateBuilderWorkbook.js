import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  ClipboardList,
  FileText,
  FolderKanban,
  Handshake,
  Home,
  LayoutDashboard,
  Package,
  Presentation,
  RefreshCw,
  Ruler,
  Settings,
  Truck,
} from "lucide-react";
import { useEstimateBuilderWorkbook } from "../../hooks/estimate-builder/useEstimateBuilderWorkbook";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useJobFile } from "../../hooks/useJobFile";
import { supabase } from "../../utils/supabase-client";
import { isDeveloperEmail } from "../../lib/adminUsers";
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from "../../lib/construction-estimation/estimateBuilderWorkbookCalculations";
import { windowDoorSizeCodeForRow } from "../../lib/construction-estimation/estimateBuilderWorkbookDefaults";
import { SUBCONTRACTOR_QUOTE_DEDUCTIONS, V4_DATA_SECTIONS } from "../../lib/construction-estimation/estimateWorksheetV4Schema";
import { syncCommercialSnapshot } from "../../lib/builders/syncCommercialSnapshot";
import { BUILDER_INCLUSION_SECTION_TITLES, normaliseEstimateInclusions, selectedEstimateInclusionsPackage } from "../../lib/builders/estimateInclusions";
import { normaliseStandardInclusions, selectedStandardInclusionsPackage } from "../../lib/builders/standardInclusions";
import { createPremierInclusionsWorkingCopy } from "../document-engine/templates/premierInclusionsMasterTemplate";
import { createDocument } from "../document-engine/core/documentState";
import { createA4Page } from "../document-engine/core/pageEngine";
import { createObject } from "../document-engine/core/objectEngine";
import OnlyOfficePresentationEditor from "../standard-inclusions/OnlyOfficePresentationEditor";
import { loadPdfJs } from "./ai-takeoff/pdfPlanRendering";
import AIPlanTakeoffPage from "./ai-takeoff/AIPlanTakeoffPage";
import ProjectEstimatePackPage from "./project-estimate/ProjectEstimatePackPage";
import { projectEstimateTextUsesParentResize } from "./project-estimate/ProjectEstimateShared";
import {
  APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
  PROJECT_ESTIMATE_EXPORT_ORDER,
  PROJECT_ESTIMATE_PAGE_KEYS as REGISTRY_PROJECT_ESTIMATE_PAGE_KEYS,
  PROJECT_ESTIMATE_TEMPLATE_ID as REGISTRY_PROJECT_ESTIMATE_TEMPLATE_ID,
  PROJECT_ESTIMATE_TEMPLATE_VERSION as REGISTRY_PROJECT_ESTIMATE_TEMPLATE_VERSION,
  defaultProjectEstimateBlocks,
  projectEstimateNavigationPages,
  projectEstimatePageDefinitionFor,
} from "./project-estimate/ProjectEstimateRegistry";

import { appendProjectEstimatePageRevision, projectEstimateRevisionsForPage } from "./project-estimate/storage/projectEstimateVersionHistory";
import { useProjectEstimateInstanceSync } from "./project-estimate/persistence/useProjectEstimateInstanceSync";
import * as ProjectEstimateApi from "./project-estimate/persistence/ProjectEstimateApiClient";
import ProjectEstimateTemplateManager from "./project-estimate/components/TemplateManager";
import ProjectEstimateVersionHistoryPanel from "./project-estimate/components/VersionHistoryPanel";
import { TextEditingToolbar as WebsiteBuilderTextEditingToolbar } from "../website-builder/page-builder/pbPropertiesPanels";

export const USE_NEW_TAKEOFF_ENGINE = true;


// AI Gantt Builder — loaded client-side only
const GanttBuilderPage = dynamic(() => import("./gantt/GanttBuilderPage"), {
  ssr: false,
  loading: () => <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading AI Gantt Builder…</div>,
});

const CommercialBoqPage = dynamic(() => import("../../pages/modules/builders/boq"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="BOQ" />,
});

const CommercialPurchaseOrdersPage = dynamic(() => import("../../pages/modules/builders/purchase-orders"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Purchase Orders" />,
});

const CommercialVariationsPage = dynamic(() => import("../../pages/modules/builders/variations"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Variations" />,
});

const CommercialBudgetVsActualPage = dynamic(() => import("../../pages/modules/builders/budget-vs-actual"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Budget vs Actual" />,
});

const CommercialSupplierInvoicesPage = dynamic(() => import("../../pages/modules/builders/supplier-invoices"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Supplier Invoices" />,
});

const CommercialProcurementSchedulePage = dynamic(() => import("../../pages/modules/builders/procurement-schedule"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Procurement Schedule" />,
});

const CommercialClientSelectionsPage = dynamic(() => import("../../pages/modules/builders/selections-book"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Selections Book" />,
});

const PremierInclusionsCanvasEditor = dynamic(() => import("./standard-inclusions/PremierInclusionsCanvasEditor"), {
  ssr: false,
  loading: () => <div style={{ padding: 28, color: "#475569", fontWeight: 900 }}>Loading editable Premier Inclusions page...</div>,
});

const DocumentPageBuilder = dynamic(() => import("../document-engine/editor/DocumentPageBuilder"), {
  ssr: false,
  loading: () => <div style={{ padding: 28, color: "#475569", fontWeight: 900 }}>Loading document page builder...</div>,
});

const CommercialQuoteApprovalsPage = dynamic(() => import("../../pages/modules/builders/quote-approvals"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Quote Approvals" />,
});

const CommercialDocumentVaultPage = dynamic(() => import("../../pages/modules/builders/document-vault"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="Document Vault" />,
});

const CommercialRfisPage = dynamic(() => import("../../pages/modules/builders/rfis"), {
  ssr: false,
  loading: () => <CommercialModuleLoading label="RFIs" />,
});

const DATA_INPUT_SECTIONS_FOR_LOOKUP = V4_DATA_SECTIONS || [];
const SUPPLIER_QUOTATION_SECTION_KEY = "subcontractorQuotes";

const WORKSPACE_VISUALS = {
  projectDashboard: {
    title: "Project Workspace",
    subtitle: "A premium command centre for the estimate, takeoff, BOQ, procurement, selections and client approvals.",
    color: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
    gradient: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
    Icon: LayoutDashboard,
  },
  jobDetails: {
    title: "Job Details",
    subtitle: "Manage project name, client, address, builder and estimate basics.",
    color: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
    gradient: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
    Icon: Briefcase,
  },
  dataInput: {
    title: "Project Setup",
    subtitle: "The source of truth for construction assumptions, quantities and linked workbook inputs.",
    color: "#0d9488",
    soft: "#f0fdfa",
    border: "#99f6e4",
    gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
    Icon: Building2,
  },
  aiPlanTakeoff: {
    title: "Takeoff Engine",
    subtitle: "Upload plans, measure areas, scale drawings and create takeoff quantities.",
    color: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    Icon: Ruler,
  },
  windowsDoors: {
    title: "Windows & Doors",
    subtitle: "Review window, door and opening schedules linked to the estimate.",
    color: "#0284c7",
    soft: "#f0f9ff",
    border: "#bae6fd",
    gradient: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
    Icon: Home,
  },
  boq: {
    title: "BOQ",
    subtitle: "Review quantities, trade categories, materials, labour and estimate build-up.",
    color: "#16a34a",
    soft: "#f0fdf4",
    border: "#bbf7d0",
    gradient: "linear-gradient(135deg, #16a34a 0%, #84cc16 100%)",
    Icon: ClipboardList,
  },
  quotation: {
    title: "Quotation Builder",
    subtitle: "Build the detailed quote and final quotation workflow with line items, margins, GST, allowances and totals.",
    color: "#f97316",
    soft: "#fff7ed",
    border: "#fed7aa",
    gradient: "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
    Icon: Calculator,
  },
  standardInclusions: {
    title: "Standard Inclusions",
    subtitle: "Edit the builder baseline inclusions package used to price Project Estimates.",
    color: "#15803d",
    soft: "#f0fdf4",
    border: "#bbf7d0",
    gradient: "linear-gradient(135deg, #166534 0%, #22c55e 100%)",
    Icon: FileText,
  },
  productLibrary: {
    title: "Product Library",
    subtitle: "Manage reusable product records imported from the Quote Sheet CSV.",
    color: "#0f766e",
    soft: "#ecfdf5",
    border: "#99f6e4",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    Icon: Package,
  },
  projectEstimate: {
    title: "Project Estimate",
    subtitle: "Prepare the client-facing estimate pack with cover, summary, pricing, inclusions, terms and acceptance.",
    color: "#b7791f",
    soft: "#fffbeb",
    border: "#fde68a",
    gradient: "linear-gradient(135deg, #92400e 0%, #d97706 100%)",
    Icon: FileText,
  },
  supplierQuotations: {
    title: "Supplier Quotations",
    subtitle: "Track supplier and subcontractor quotes before converting them to costs or purchase orders.",
    color: "#0891b2",
    soft: "#ecfeff",
    border: "#a5f3fc",
    gradient: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
    Icon: Handshake,
  },
  procurement: {
    title: "Procurement",
    subtitle: "Manage materials, ordering dates, delivery status and supplier follow-up.",
    color: "#059669",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    gradient: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
    Icon: Truck,
  },
  budgetVsActual: {
    title: "Budget vs Actual",
    subtitle: "Compare original estimate, approved changes, committed costs, invoices and remaining budget.",
    color: "#65a30d",
    soft: "#f7fee7",
    border: "#d9f99d",
    gradient: "linear-gradient(135deg, #65a30d 0%, #84cc16 100%)",
    Icon: BarChart3,
  },
  purchaseOrders: {
    title: "Purchase Orders",
    subtitle: "Create and track supplier, subcontractor and material purchase orders.",
    color: "#d97706",
    soft: "#fffbeb",
    border: "#fde68a",
    gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
    Icon: Package,
  },
  supplierInvoices: {
    title: "Supplier Invoices",
    subtitle: "Record supplier invoices and feed actual costs into budget tracking.",
    color: "#b45309",
    soft: "#fffbeb",
    border: "#fde68a",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
    Icon: FileText,
  },
  variations: {
    title: "Variations",
    subtitle: "Create, approve and track client changes and cost adjustments.",
    color: "#db2777",
    soft: "#fdf2f8",
    border: "#fbcfe8",
    gradient: "linear-gradient(135deg, #db2777 0%, #f472b6 100%)",
    Icon: RefreshCw,
  },
  clientSelections: {
    title: "Client Selections",
    subtitle: "Open the premium tablet-friendly Selections Book for finishes, fixtures, colours and client choices.",
    color: "#4f46e5",
    soft: "#eef2ff",
    border: "#c7d2fe",
    gradient: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
    Icon: Home,
  },
  clientPage: {
    title: "Estimate Pack",
    subtitle: "Prepare the client-facing estimate pack with summary, pricing, inclusions, terms and acceptance.",
    color: "#8b5cf6",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #c084fc 100%)",
    Icon: Presentation,
  },
  quoteApprovals: {
    title: "Quote Approvals",
    subtitle: "Track signed quote, variation, selection and change authority approvals.",
    color: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    Icon: ClipboardList,
  },
  documentVault: {
    title: "Document Vault",
    subtitle: "Store plans, approvals, signed documents, warranties, contracts and supplier records.",
    color: "#0f766e",
    soft: "#f0fdfa",
    border: "#99f6e4",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    Icon: FolderKanban,
  },
  rfis: {
    title: "RFIs",
    subtitle: "Manage client questions, builder responses, priorities and due dates.",
    color: "#be123c",
    soft: "#fff1f2",
    border: "#fecdd3",
    gradient: "linear-gradient(135deg, #be123c 0%, #fb7185 100%)",
    Icon: FileText,
  },
  clientPortal: {
    title: "Client Portal",
    subtitle: "Share quotes, selections, variations, approvals and project documents with the client.",
    color: "#0ea5e9",
    soft: "#f0f9ff",
    border: "#bae6fd",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #7dd3fc 100%)",
    Icon: FileText,
  },
  cashflowSummary: {
    title: "Reports",
    subtitle: "Review cashflow, budget, cost, margin and project status reporting.",
    color: "#65a30d",
    soft: "#f7fee7",
    border: "#d9f99d",
    gradient: "linear-gradient(135deg, #65a30d 0%, #bef264 100%)",
    Icon: BarChart3,
  },
  summary: {
    title: "Reports",
    subtitle: "Review totals, margins, allowances, GST and workbook summary reporting.",
    color: "#65a30d",
    soft: "#f7fee7",
    border: "#d9f99d",
    gradient: "linear-gradient(135deg, #65a30d 0%, #bef264 100%)",
    Icon: BarChart3,
  },
  settings: {
    title: "Settings",
    subtitle: "Manage job settings, estimate rules, defaults and workbook options.",
    color: "#475569",
    soft: "#f8fafc",
    border: "#cbd5e1",
    gradient: "linear-gradient(135deg, #475569 0%, #94a3b8 100%)",
    Icon: Settings,
  },
};

function workspaceVisual(pageKey) {
  return WORKSPACE_VISUALS[pageKey] || WORKSPACE_VISUALS.projectDashboard;
}

export default function EstimateBuilderWorkbook({ previewMode = false, mode = "", recentId = "" } = {}) {
  const sheet = useEstimateBuilderWorkbook({}, { previewMode });
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const saveStatusTimerRef = useRef(null);
  const modeHandledRef = useRef("");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [jobPickerMessage, setJobPickerMessage] = useState("");
  const [formulaTarget, setFormulaTarget] = useState(null);
  const [newJobModalOpen, setNewJobModalOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({ jobName: "", clientName: "", jobNumber: "", address: "", notes: "" });
  const [jobFileError, setJobFileError] = useState("");
  const [saveStatus, setSaveStatus] = useState({ state: "idle", label: "", detail: "" });
  const [commercialSyncStatus, setCommercialSyncStatus] = useState({ state: "idle", message: "", projectId: "", snapshotId: "", syncedAt: "" });
  const [showDeveloperControls, setShowDeveloperControls] = useState(false);
  const jobFilePayload = useMemo(() => workbookToJobFileData(sheet.workbook), [sheet.workbook]);
  const jobFile = useJobFile({
    enabled: !previewMode,
    jobData: jobFilePayload,
    autoSaveDelayMs: 3000,
    onError: (message) => {
      if (message && !isWorkbookLoaded(sheet.workbook)) setJobFileError(message);
    },
    onOpenJob: async (job, fileName) => {
      setJobFileError("");
      const nextWorkbook = {
        ...(job.workbook || {}),
        jobFileMeta: {
          jobName: job.jobName || "",
          clientName: job.clientName || "",
          jobNumber: job.jobNumber || "",
          address: job.address || "",
          notes: job.notes || "",
          created: job.created || new Date().toISOString(),
          lastModified: job.lastModified || new Date().toISOString(),
        },
      };
      await sheet.loadJobFileText(JSON.stringify({ ...job, workbook: nextWorkbook }), fileName || "job.gr8job");
    },
  });
  const lockHandlers = previewMode ? previewProtectionHandlers : {};

  useEffect(() => {
    if (jobFileError && isWorkbookLoaded(sheet.workbook)) setJobFileError("");
  }, [jobFileError, sheet.workbook]);
  const isAdminMode = typeof window !== "undefined" && window.localStorage.getItem("estimate-builder-permission-mode") === "admin";
  const isSaving = saveStatus.state === "saving";
  const isCommercialSyncing = commercialSyncStatus.state === "syncing";
  const activeVisual = workspaceVisual(sheet.workbook.page);
  const ActivePageIcon = activeVisual.Icon;
  const openJobDetails = openJobHeaderDetails(sheet.workbook);
  const commercialModuleContext = useMemo(() => ({
    embedded: true,
    workspaceId,
    workbook: sheet.workbook,
    calculated: sheet.preview,
    projectId: commercialSyncStatus.projectId || "",
    estimateSnapshotId: commercialSyncStatus.snapshotId || "",
    snapshotId: commercialSyncStatus.snapshotId || "",
    onSyncSnapshot: handleCommercialSnapshotSync,
  }), [workspaceId, sheet.workbook, sheet.preview, commercialSyncStatus.projectId, commercialSyncStatus.snapshotId]);

  useEffect(() => () => {
    if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current);
  }, []);

  useEffect(() => {
    setShowDeveloperControls(window.localStorage.getItem("estimate-builder-show-developer-controls") === "true");
  }, []);

  async function runSaveAction(label, action) {
    if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current);
    setSaveStatus({ state: "saving", label, detail: "" });
    try {
      const result = await Promise.resolve(action());
      if (result?.ok === false) {
        setSaveStatus({ state: "error", label: "Save failed", detail: result.message || "Please try again." });
        saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus({ state: "idle", label: "", detail: "" }), 7000);
        return result;
      }
      const detail = result?.message || `${label.replace(/^Saving\s+/i, "")} saved`;
      setSaveStatus({ state: "saved", label: "Saved", detail });
      saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus({ state: "idle", label: "", detail: "" }), 4000);
      return result;
    } catch (error) {
      setSaveStatus({ state: "error", label: "Save failed", detail: error?.message || "Please try again." });
      saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus({ state: "idle", label: "", detail: "" }), 7000);
      throw error;
    }
  }

  async function openJobPicker() {
    setJobPickerMessage("");
    const jobs = await sheet.refreshSavedJobSummaries?.();
    if (!jobs?.length) setJobPickerMessage("No saved jobs found");
    setJobPickerOpen(true);
  }

  async function openSavedJob(key) {
    const result = await sheet.openSavedJob?.(key);
    if (result?.ok) {
      setJobPickerOpen(false);
      setFileMenuOpen(false);
      return;
    }
    setJobPickerMessage(result?.message || "Saved job could not be opened.");
  }

  function updateNewJobField(key, value) {
    setNewJobForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateNewJob() {
    setJobFileError("");
    const createResult = await runSaveAction("Creating new job", () => sheet.createJobFromTemplate(newJobForm));
    if (!createResult?.ok || !createResult.workbook) return;

    const fileCreateResult = await jobFile.newJob(workbookToJobFileData(createResult.workbook));
    if (!fileCreateResult.ok && fileCreateResult.message) {
      setJobFileError(fileCreateResult.message);
      return;
    }
    if (!fileCreateResult.cancelled) {
      setNewJobModalOpen(false);
      setNewJobForm({ jobName: "", clientName: "", jobNumber: "", address: "", notes: "" });
    }
  }

  async function handleCommercialSnapshotSync() {
    if (previewMode || isCommercialSyncing) return;
    if (!workspaceId) {
      setCommercialSyncStatus({
        state: "error",
        message: workspaceLoading ? "Workspace is still loading. Please try again in a moment." : "Choose an active workspace before syncing to Project Commercials.",
        projectId: "",
        snapshotId: "",
        syncedAt: "",
      });
      return;
    }

    setCommercialSyncStatus({ state: "syncing", message: "Syncing commercial snapshot...", projectId: "", snapshotId: "", syncedAt: "" });
    try {
      const calculated = calculateEstimateBuilderWorkbook(sheet.workbook);
      const result = await syncCommercialSnapshot({
        workspace_id: workspaceId,
        project: commercialProjectMetadataFromWorkbook(sheet.workbook, jobFilePayload),
        workbook: sheet.workbook,
        calculated,
      });
      const projectId = result?.project_id || result?.data?.project?.id || "";
      const snapshotId = result?.snapshot_id || result?.data?.snapshot?.id || "";
      const syncedAt = result?.data?.snapshot?.created_at || new Date().toISOString();
      setCommercialSyncStatus({
        state: "success",
        message: `Commercial snapshot synced${snapshotId ? `: ${snapshotId}` : ""}`,
        projectId,
        snapshotId,
        syncedAt,
      });
    } catch (error) {
      setCommercialSyncStatus({
        state: "error",
        message: error?.message || "Commercial snapshot sync failed.",
        projectId: "",
        snapshotId: "",
        syncedAt: "",
      });
    }
  }

  useEffect(() => {
    if (previewMode || !mode) return;
    const key = `${mode}:${recentId || ""}`;
    if (modeHandledRef.current === key) return;
    modeHandledRef.current = key;

    if (mode === "open-job") {
      jobFile.open().then((result) => {
        if (result.ok) setJobFileError("");
        else if (result.message && !isWorkbookLoaded(sheet.workbook)) setJobFileError(result.message);
      }).catch(() => {
        if (!isWorkbookLoaded(sheet.workbook)) setJobFileError("This job file could not be opened.");
      }).finally(() => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/modules/estimate-builder");
        }
      });
    }
    if (mode === "open-recent" && recentId) {
      jobFile.openRecent(recentId).then((result) => {
        if (result.ok) setJobFileError("");
        else if (result.message && !isWorkbookLoaded(sheet.workbook)) setJobFileError(result.message);
      }).catch(() => {
        if (!isWorkbookLoaded(sheet.workbook)) setJobFileError("This job file could not be opened.");
      }).finally(() => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/modules/estimate-builder");
        }
      });
    }
  }, [mode, recentId, previewMode, jobFile]);

  return (
    <div style={{ ...styles.shell, ...(previewMode ? styles.previewShell : {}) }} {...lockHandlers}>
      <style jsx global>{`
        .project-workspace-nav-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
        }
        .project-workspace-nav-button:hover .project-workspace-nav-icon,
        .project-workspace-card:hover .project-workspace-card-icon {
          transform: scale(1.06) rotate(-2deg);
        }
        .project-workspace-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 54px rgba(15, 23, 42, 0.16);
        }
      `}</style>
      <aside style={styles.nav}>
        <div style={styles.navBrand}>
          <span style={styles.navBrandIcon}><FolderKanban size={30} strokeWidth={2.4} /></span>
          <span>
            <span style={styles.navEyebrow}>Projects Hub</span>
            <strong style={styles.navTitle}>{previewMode ? "Preview" : "Project Workspace"}</strong>
          </span>
        </div>
        <div style={styles.navQuoteTotalLine}>
          <span>Current quote total</span>
          <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
        </div>
        {sheet.pages.map((page) => {
          const visual = workspaceVisual(page.key);
          const NavIcon = visual.Icon;
          const active = sheet.workbook.page === page.key;
          return (
          <button
            key={page.key}
            className="project-workspace-nav-button"
            style={{
              ...styles.navButton,
              borderColor: visual.color,
              color: active ? "#ffffff" : visual.color,
              background: active ? visual.color : "#ffffff",
              boxShadow: active ? `0 14px 28px ${visual.color}33` : "0 8px 18px rgba(15, 23, 42, 0.05)",
            }}
            onClick={() => sheet.setPage(page.key)}
          >
            <span className="project-workspace-nav-icon" style={{ ...styles.navButtonIcon, background: active ? "rgba(255,255,255,0.18)" : visual.soft }}>
              <NavIcon size={22} strokeWidth={2.4} />
            </span>
            <span>{page.label}</span>
          </button>
        );})}
        <div style={styles.navNote}>
          {previewMode
            ? "Preview mode is blank and locked. Data entry, editing, copying, saving, and exports are disabled."
            : "Project Setup remains the source of truth. Dashboard fields, quote totals, supplier quotes, and workbook pages stay linked to the same estimate data."}
        </div>
        {!previewMode && (
          <FloatingSaveJob
            saveStatus={saveStatus}
            onSaveJob={() => runSaveAction("Saving job", jobFile.save)}
          />
        )}
      </aside>

      <main style={styles.main}>
        <div style={styles.compactControlRow}>
          <div style={styles.topControls}>
            <a href="/modules/construction" style={styles.bannerBackButton}>Back to Projects Hub</a>
            {previewMode ? (
              <span style={styles.lockedBadge}>Locked Preview</span>
            ) : (
              <>
            <FileMenu
              open={fileMenuOpen}
              onToggle={() => setFileMenuOpen((current) => !current)}
              onClose={() => setFileMenuOpen(false)}
              busy={isSaving}
              recentJobs={jobFile.recentJobs}
              onOpenRecentJob={(id) => jobFile.openRecent(id)}
              items={[
                { label: "New Job", action: () => setNewJobModalOpen(true) },
                {
                  label: "Open Job",
                  action: async () => {
                    const result = await jobFile.open();
                    if (!result.ok && result.message) setJobFileError(result.message);
                  },
                },
                { label: "Save", action: () => runSaveAction("Saving job", jobFile.save), primary: true },
                { label: "Save As", action: () => runSaveAction("Saving job as", jobFile.saveAs) },
                { label: "Save As Base Template", action: () => runSaveAction("Saving base template", sheet.saveAsBaseTemplate) },
              ]}
            />
            <TemplateFileMenu
              sheet={sheet}
              open={templateMenuOpen}
              onToggle={() => setTemplateMenuOpen((current) => !current)}
              onClose={() => setTemplateMenuOpen(false)}
              onSaveAction={runSaveAction}
              busy={isSaving}
              showDeveloperControls={showDeveloperControls}
            />
            {showDeveloperControls ? (
              <button
                type="button"
                style={{ ...styles.commercialSyncButton, ...(isCommercialSyncing ? styles.commercialSyncButtonDisabled : {}) }}
                disabled={isCommercialSyncing || workspaceLoading}
                onClick={handleCommercialSnapshotSync}
              >
                {isCommercialSyncing ? "Syncing..." : "Sync to Project Commercials"}
              </button>
            ) : null}
            {saveStatus.state !== "idle" ? (
              <SaveProgress status={saveStatus} />
            ) : sheet.lastSavedAt ? (
              <span style={styles.savedText}>Saved {new Date(sheet.lastSavedAt).toLocaleTimeString()}</span>
            ) : null}
            {(sheet.workbook.page === "quotation" || sheet.workbook.page === "clientSelections") && (
              <div style={styles.quoteSearchControls}>
                {sheet.workbook.page === "quotation" ? (
                  <>
                    <input
                      style={styles.searchInput}
                      placeholder="Search line item"
                      value={sheet.lineSearch}
                      onChange={(event) => sheet.setLineSearch(event.target.value)}
                    />
                    <label style={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={sheet.hideUnused}
                        onChange={(event) => sheet.setHideUnused(event.target.checked)}
                      />
                      Hide unused
                    </label>
                    <button type="button" style={styles.secondaryButton} onClick={() => exportQuoteSelectionsCsv(sheet)}>
                      Export to Selections CSV
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => exportQuoteSheetCsv(sheet)}
                  title="Download the current quote sheet line items as a CSV"
                >
                  Download Quote Sheet CSV
                </button>
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {showDeveloperControls && commercialSyncStatus.state !== "idle" && (
          <div
            style={{
              ...styles.commercialSyncStatus,
              ...(commercialSyncStatus.state === "error" ? styles.commercialSyncStatusError : {}),
              ...(commercialSyncStatus.state === "success" ? styles.commercialSyncStatusSuccess : {}),
            }}
            role={commercialSyncStatus.state === "error" ? "alert" : "status"}
          >
            <strong>{commercialSyncStatus.state === "success" ? "Synced" : commercialSyncStatus.state === "error" ? "Sync failed" : "Syncing"}</strong>
            <span>{commercialSyncStatus.message}</span>
            {commercialSyncStatus.syncedAt ? <small>{new Date(commercialSyncStatus.syncedAt).toLocaleString()}</small> : null}
          </div>
        )}

        <section style={{ ...styles.topbar, background: activeVisual.gradient }}>
          <div style={styles.pageBannerTitleGroup}>
            <span style={styles.pageBannerIcon}><ActivePageIcon size={34} strokeWidth={2.3} /></span>
            <span>
              <span style={styles.pageBannerEyebrow}>Estimate Builder</span>
              <h1 style={styles.pageTitle}>{activeVisual.title}</h1>
              <p style={styles.pageBannerSubtitle}>{activeVisual.subtitle}</p>
            </span>
          </div>
          <div style={styles.openFileBanner}>
            <span style={styles.openFileLabel}>Current saved file</span>
            <span style={styles.openFileName}>{openJobDetails.fileName}</span>
          </div>
          <div style={styles.openJobBanner}>
            <OpenJobHeaderField label="Open Job" value={openJobDetails.projectName} />
            <OpenJobHeaderField label="Job #" value={openJobDetails.jobNumber} />
            <OpenJobHeaderField label="Address" value={openJobDetails.projectAddress} wide />
          </div>
        </section>

        <fieldset disabled={previewMode} style={styles.previewFieldset}>
            {sheet.workbook.page === "projectDashboard" && (
              <ProjectDashboardSheet sheet={sheet} />
            )}
            {sheet.workbook.page === "dataInput" && (
              <DataInputSheet
                sheet={sheet}
                sections={dataInputWorkbookSections(sheet)}
                formulaTarget={formulaTarget}
                onPickFormulaReference={(key) => insertQuoteQuantityReference(sheet, formulaTarget, key)}
                canEditFormulas={isAdminMode}
              />
            )}
            {sheet.workbook.page === "supplierQuotations" && (
              <SupplierQuotationsSheet sheet={sheet} />
            )}
            {sheet.workbook.page === "windowsDoors" && <WindowsDoorsSheet sheet={sheet} />}
            {sheet.workbook.page === "formulaSheet" && (
              <FormulaSheet
                sheet={sheet}
                formulaTarget={formulaTarget}
                onPickFormulaReference={(key) => insertQuoteQuantityReference(sheet, formulaTarget, key)}
                canEditFormulas={isAdminMode}
              />
          )}
          {sheet.workbook.page === "quotation" && <QuotationSheet sheet={sheet} onFormulaTarget={setFormulaTarget} />}
          {sheet.workbook.page === "standardInclusions" && <StandardInclusionsSheet sheet={sheet} />}
          {sheet.workbook.page === "productLibrary" && <ProductLibrarySheet sheet={sheet} />}
          {sheet.workbook.page === "estimateInclusions" && <EstimateInclusionsSheet sheet={sheet} />}
          {sheet.workbook.page === "summary" && <SummarySheet sheet={sheet} />}
          {sheet.workbook.page === "projectEstimate" && <ProjectEstimateSheet sheet={sheet} />}
          {sheet.workbook.page === "clientPage" && <ClientPageSheet sheet={sheet} />}
          {sheet.workbook.page === "boq" && <CommercialBoqPage {...commercialModuleContext} />}
          {sheet.workbook.page === "variations" && <CommercialVariationsPage {...commercialModuleContext} />}
          {sheet.workbook.page === "purchaseOrders" && <CommercialPurchaseOrdersPage {...commercialModuleContext} />}
          {sheet.workbook.page === "clientSelections" && <CommercialClientSelectionsPage {...commercialModuleContext} />}
          {sheet.workbook.page === "budgetVsActual" && <CommercialBudgetVsActualPage {...commercialModuleContext} />}
          {sheet.workbook.page === "supplierInvoices" && <CommercialSupplierInvoicesPage {...commercialModuleContext} />}
          {sheet.workbook.page === "quoteApprovals" && <CommercialQuoteApprovalsPage {...commercialModuleContext} />}
          {sheet.workbook.page === "documentVault" && <CommercialDocumentVaultPage {...commercialModuleContext} />}
          {sheet.workbook.page === "rfis" && <CommercialRfisPage {...commercialModuleContext} />}
          {sheet.workbook.page === "cashflowSummary" && <CashflowSummarySheet sheet={sheet} />}
          {sheet.workbook.page === "procurement" && <CommercialProcurementSchedulePage {...commercialModuleContext} />}
          {sheet.workbook.page === "aiPlanTakeoff" && (
            <AIPlanTakeoffPage sheet={sheet} />
          )}
          {sheet.workbook.page === "gantt" && (
            <GanttBuilderPage sheet={sheet} />
          )}
        </fieldset>

        {jobFileError ? (
          <div style={styles.fileErrorBanner} role="alert">{jobFileError}</div>
        ) : null}
      </main>

      <aside style={styles.summary}>
        {sheet.workbook.page === "projectEstimate" || sheet.workbook.page === "clientPage" || sheet.workbook.page === "cashflowSummary" ? (
          <>
            <div style={styles.eyebrow}>{sheet.workbook.page === "cashflowSummary" ? "Cashflow" : "Project Estimate"}</div>
            <h2 style={styles.navTitle}>{sheet.workbook.page === "cashflowSummary" ? "Contract Total" : "Estimate Total"}</h2>
            <div style={styles.finalBox}>
              <span>Total quoted price</span>
              <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
            </div>
          </>
        ) : (
          <>
            <div style={styles.eyebrow}>Live Summary</div>
            <h2 style={styles.navTitle}>Quote Totals</h2>
            <SummaryRow label="Base line item subtotal" value={money(sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin)} />
            <SummaryRow label={`Preliminaries ${sheet.preview.summary.preliminaryCostsPercent || 0}%`} value={money(sheet.preview.summary.preliminaryCostsAmount)} />
            <SummaryRow label={`Overheads ${sheet.preview.summary.overheadsPercent}%`} value={money(sheet.preview.summary.overheadsAmount)} />
            <SummaryRow label={`Materials & labour margin ${sheet.preview.summary.marginPercent}%`} value={money(sheet.preview.summary.marginAmount)} />
            <SummaryRow label={`Profit ${sheet.preview.summary.profitPercent}%`} value={money(sheet.preview.summary.profitAmount)} />
            <SummaryRow label={`GST ${sheet.preview.summary.gstPercent || 10}%`} value={money(sheet.preview.summary.gst)} />
            <SummaryRow label="QBSA registration" value={money(sheet.preview.summary.qbsaRegistration)} />
            <SummaryRow label="Q Leave fees" value={money(sheet.preview.summary.qLeaveFees)} />
            <SummaryRow label={`Sales commission ${sheet.preview.summary.salesCommissionPercent}%`} value={money(sheet.preview.summary.salesCommissionAmount)} />
            <div style={styles.finalBox}>
              <span>Final quote total</span>
              <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
            </div>
          </>
        )}
        {sheet.workbook.page !== "projectEstimate" && sheet.workbook.page !== "clientPage" && sheet.workbook.page !== "cashflowSummary" && sheet.workbook.page !== "procurement" && (
          <>
            <Panel title="Missing Required Inputs">
              {sheet.preview.missingRequired.length ? (
                sheet.preview.missingRequired.map((item) => (
                  <span key={`${item.section}-${item.key}`} style={styles.warningPill}>
                    {pretty(item.key)}
                  </span>
                ))
              ) : (
                <span style={styles.okPill}>Required inputs complete</span>
              )}
            </Panel>
            <Panel title="Quote / Rate Review">
              {quoteReviewRows(sheet).slice(0, 10).map((row) => (
                <SummaryRow key={`${row.item}-${row.sourceOfRate}`} label={row.item} value={row.sourceOfRate} />
              ))}
            </Panel>
          </>
        )}
      </aside>

      {jobPickerOpen && (
        <JobPickerModal
          jobs={sheet.savedJobSummaries || []}
          message={jobPickerMessage}
          busy={isSaving}
          onRefresh={openJobPicker}
          onOpen={openSavedJob}
          onClose={() => setJobPickerOpen(false)}
        />
      )}

      {newJobModalOpen && (
        <NewJobModal
          form={newJobForm}
          onChange={updateNewJobField}
          busy={isSaving}
          onClose={() => setNewJobModalOpen(false)}
          onCreate={handleCreateNewJob}
        />
      )}
    </div>
  );
}

function FloatingSaveJob({ saveStatus, onSaveJob }) {
  const isSaving = saveStatus?.state === "saving";
  return (
    <div style={styles.floatingSaveJob}>
      <button style={styles.floatingSaveJobButton} disabled={isSaving} onClick={onSaveJob}>
        {isSaving ? "Saving..." : "Save Job"}
      </button>
    </div>
  );
}

function CommercialModuleLoading({ label }) {
  return (
    <div style={styles.commercialModuleLoading}>
      <strong>Loading {label}</strong>
      <span>Opening inside the Estimate Builder workspace...</span>
    </div>
  );
}

function OpenJobHeaderField({ label, value, wide = false }) {
  return (
    <span style={{ ...styles.openJobField, ...(wide ? styles.openJobFieldWide : {}) }}>
      <span style={styles.openJobLabel}>{label}</span>
      <strong style={styles.openJobValue}>{value}</strong>
    </span>
  );
}

function dataInputWorkbookSections(sheet) {
  return (sheet.dataInputSections || []).filter((section) => section.key !== SUPPLIER_QUOTATION_SECTION_KEY);
}

function supplierQuotationWorkbookSections(sheet) {
  return (sheet.dataInputSections || []).filter((section) => section.key === SUPPLIER_QUOTATION_SECTION_KEY);
}

const DASHBOARD_GENERAL_FIELDS = [
  { label: "Project Name", key: "projectName" },
  { label: "Project Address", key: "projectAddress" },
  { label: "Client", key: "clientName" },
  { label: "Job Number", key: "jobNumber" },
  { label: "Builder", key: "builderName" },
  { label: "Estimator", key: "estimatorName" },
  { label: "Quote Date", key: "quoteDate" },
  { label: "Status", key: "projectStatus" },
];

const DASHBOARD_WORKSPACE_CARDS = [
  {
    title: "Job Details",
    subtitle: "Manage project name, client, address, builder and estimate basics.",
    page: "projectDashboard",
    visualKey: "jobDetails",
    badge: "Here",
  },
  {
    title: "Project Setup",
    subtitle: "Enter detailed construction assumptions, areas, wall types, floor systems and formula inputs.",
    page: "dataInput",
    visualKey: "dataInput",
    badge: "Source",
  },
  {
    title: "Takeoff Engine",
    subtitle: "Upload plans, measure areas, scale drawings and create takeoff quantities.",
    page: "aiPlanTakeoff",
    visualKey: "aiPlanTakeoff",
    badge: "Plans",
  },
  {
    title: "BOQ",
    subtitle: "Review quantities, trade categories, materials, labour and estimate build-up.",
    page: "boq",
    visualKey: "boq",
    badge: "Quantities",
  },
  {
    title: "Quotation Builder",
    subtitle: "Build the detailed quote and final quotation workflow with line items, margins, GST, allowances and totals.",
    page: "quotation",
    visualKey: "quotation",
    badge: "Quote",
  },
  {
    title: "Standard Inclusions",
    subtitle: "Edit the builder baseline inclusions schedule used to price Project Estimates.",
    page: "standardInclusions",
    visualKey: "standardInclusions",
    badge: "Base",
  },
  {
    title: "Product Library",
    subtitle: "Download, edit, re-upload and manage reusable products converted from the Quote Sheet.",
    page: "productLibrary",
    visualKey: "productLibrary",
    badge: "CSV",
  },
  {
    title: "Project Estimate",
    subtitle: "Prepare the estimate pack with cover, summary, price/trade summary, standard inclusions, terms and acceptance.",
    page: "projectEstimate",
    visualKey: "projectEstimate",
    badge: "Pack",
  },
  {
    title: "Supplier Quotations",
    subtitle: "Track supplier and subcontractor quotes before converting them to costs or purchase orders.",
    page: "supplierQuotations",
    visualKey: "supplierQuotations",
    badge: "Quotes",
  },
  {
    title: "Procurement",
    subtitle: "Manage required materials, ordering dates, delivery status and supplier follow-up.",
    page: "procurement",
    visualKey: "procurement",
    badge: "Orders",
  },
  {
    title: "Budget vs Actual",
    subtitle: "Compare the estimate, variations, purchase orders, supplier invoices and remaining budget.",
    page: "budgetVsActual",
    visualKey: "budgetVsActual",
    badge: "Cost",
  },
  {
    title: "Purchase Orders",
    subtitle: "Create and track purchase orders for suppliers, subcontractors and materials.",
    page: "purchaseOrders",
    visualKey: "purchaseOrders",
    badge: "Drafts",
  },
  {
    title: "Supplier Invoices",
    subtitle: "Record invoice costs against suppliers and purchase orders.",
    page: "supplierInvoices",
    visualKey: "supplierInvoices",
    badge: "Actuals",
  },
  {
    title: "Variations",
    subtitle: "Create, approve and track client changes and cost adjustments.",
    page: "variations",
    visualKey: "variations",
    badge: "Changes",
  },
  {
    title: "Client Selections",
    subtitle: "Open the premium tablet-friendly Selections Book for finishes, fixtures, colours and client choices.",
    page: "clientSelections",
    visualKey: "clientSelections",
    badge: "Choices",
  },
  {
    title: "Quote Approvals",
    subtitle: "Create durable signed approval records for quotes, variations and selections.",
    page: "quoteApprovals",
    visualKey: "quoteApprovals",
    badge: "Signed",
  },
  {
    title: "Document Vault",
    subtitle: "Manage project plans, signed documents, contracts, warranties and supplier records.",
    page: "documentVault",
    visualKey: "documentVault",
    badge: "Files",
  },
  {
    title: "RFIs",
    subtitle: "Track client questions, responses, priorities and required response dates.",
    page: "rfis",
    visualKey: "rfis",
    badge: "Questions",
  },
  {
    title: "Reports",
    subtitle: "View budget, cost, margin, procurement and project status reports.",
    page: "summary",
    visualKey: "summary",
    badge: "Reports",
  },
  {
    title: "Settings",
    subtitle: "Manage job settings, estimate rules, defaults and workbook options.",
    page: "dataInput",
    visualKey: "settings",
    badge: "Defaults",
  },
];

function ProjectDashboardSheet({ sheet }) {
  return (
    <div style={styles.dashboardShell}>
      <section style={styles.dashboardTopGrid}>
        <div style={styles.dashboardPanel}>
          <div style={styles.dashboardPanelHeader}>
            <div>
              <h3 style={styles.dashboardPanelTitle}>General</h3>
              <p style={styles.dashboardPanelSubtitle}>Linked directly to Project Setup. Updating these fields updates the workbook source data.</p>
            </div>
            <button type="button" style={styles.dashboardSmallNavButton} onClick={() => sheet.setPage("dataInput")}>Open Project Setup</button>
          </div>
          <div style={styles.dashboardFieldGrid}>
            {DASHBOARD_GENERAL_FIELDS.map((field) => (
              <DashboardLinkedField key={`general-${field.label}`} sheet={sheet} field={field} />
            ))}
          </div>
        </div>
      </section>

      <section style={styles.dashboardCardGrid}>
        {DASHBOARD_WORKSPACE_CARDS.map((card) => {
          const visual = workspaceVisual(card.visualKey || card.page);
          const CardIcon = visual.Icon;
          return (
          <button
            key={`${card.title}-${card.page}`}
            type="button"
            className="project-workspace-card"
            style={{ ...styles.dashboardWorkspaceCard, background: visual.soft, borderColor: visual.border }}
            onClick={() => sheet.setPage(card.page)}
          >
            <span className="project-workspace-card-icon" style={{ ...styles.dashboardCardIcon, background: visual.color, borderColor: visual.color }}>
              <CardIcon size={30} strokeWidth={2.3} />
            </span>
            <span style={styles.dashboardCardCopy}>
              <span style={styles.dashboardCardTitle}>{card.title}</span>
              <span style={styles.dashboardCardSubtitle}>{card.subtitle}</span>
            </span>
            <span style={{ ...styles.dashboardCardBadge, background: "#ffffff", borderColor: visual.border, color: visual.color }}>{card.badge}</span>
          </button>
        );})}
      </section>
    </div>
  );
}

function DashboardLinkedField({ sheet, field }) {
  const row = dashboardDataInputRow(sheet, field.key);
  if (!row) {
    return (
      <label style={styles.dashboardField}>
        <span>{field.label}</span>
        <div style={styles.dashboardUnavailable}>Not in Project Setup yet</div>
      </label>
    );
  }
  const saved = sheet.workbook.data?.inputDataSheet?.rows?.[row.key] || {};
  const displayValue = row.calculated ? value(sheet.preview.quantities[row.key]) : editableInputValue(sheet, row, saved);
  return (
    <label style={styles.dashboardField}>
      <span>{field.label}</span>
      {row.calculated ? (
        <div style={styles.dashboardReadOnly}>{displayValue || "-"}</div>
      ) : row.options ? (
        <select
          style={styles.dashboardInput}
          value={selectInputValue(row, saved)}
          onChange={(event) => sheet.updateData("inputDataSheet", row.key, "value", event.target.value)}
        >
          {row.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <BufferedInput
          style={styles.dashboardInput}
          value={displayValue}
          onCommit={(next) => sheet.updateData("inputDataSheet", row.key, "value", next)}
        />
      )}
    </label>
  );
}

function WorkspacePlaceholderSheet({ title }) {
  return (
    <div style={styles.pageStack}>
      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>
          <span>{title}</span>
          <span>Workspace page</span>
        </div>
        <div style={styles.workspacePlaceholder}>
          This workspace area is available in the navigation and will use the existing workbook data as it is connected. No estimating data has been duplicated or moved.
        </div>
      </section>
    </div>
  );
}

function dashboardDataInputRow(sheet, key) {
  if (!key) return null;
  return (sheet.dataInputSections || [])
    .flatMap((section) => section.rows || [])
    .find((row) => row.key === key) || null;
}

function DataInputSheet({ sheet, sections = null, formulaTarget, onPickFormulaReference, canEditFormulas = false }) {
  const readonly = sheet.previewMode;
  const visibleSections = sections || sheet.dataInputSections || [];
  return (
    <div style={styles.pageStack}>
      {visibleSections.map((section) => (
        <section key={section.key} style={styles.section}>
          <button style={styles.sectionHeader} onClick={() => sheet.toggleDataSection(section.key)}>
            <span>{section.label}</span>
            <span>{sheet.workbook.data?.[section.key]?.collapsed ? "Show" : "Hide"}</span>
          </button>
          {!sheet.workbook.data?.[section.key]?.collapsed && (
            section.type === "subcontractorQuotes" ? (
              <SubcontractorQuotesSection sheet={sheet} section={section} />
            ) : (
            <>
            {!readonly && <button style={styles.addLineButton} onClick={() => sheet.addDataRow(section.key)}>Add new row</button>}
            <Spreadsheet
              headers={readonly ? ["#", "Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result"] : ["#", "Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result", "Actions"]}
              compactColumns={[0]}
            >
              {section.rows.map((row, rowIndex) => {
                const saved = sheet.workbook.data?.[section.key]?.rows?.[row.key] || {};
                const calculated = row.calculated;
                const tone = levelTone(row);
                const editId = rowDomId("data-edit", section.key, row.key);
                if (row.heading) {
                  const subheading = row.subheading;
                  return (
                    <tr key={row.key}>
                      <Cell compact heading={!subheading} subheading={subheading} tone={tone}>
                        <span style={styles.dataRowNumber}>{dataInputRowNumber(row, rowIndex)}</span>
                      </Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone}>{row.label}</Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone}>{row.userNote || ""}</Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      {!readonly && <Cell heading={!subheading} subheading={subheading} tone={tone} />}
                    </tr>
                  );
                }
                return (
                  <tr key={row.key}>
                    <Cell compact tone={tone}>
                      <span style={styles.dataRowNumber}>{dataInputRowNumber(row, rowIndex)}</span>
                    </Cell>
                    <Cell tone={tone}>{row.sectionLabel}</Cell>
                    <Cell strong tone={tone}>
                      {row.custom ? (
                        <BufferedInput
                          id={editId}
                          style={styles.itemInput}
                          value={row.label || ""}
                          onCommit={(next) => sheet.updateDataRowMeta(section.key, row.key, "label", next)}
                        />
                      ) : row.label}
                    </Cell>
                    <Cell tone={tone}>
                      {calculated ? (
                        <span style={styles.readOnly}>{value(sheet.preview.quantities[row.key])}</span>
                      ) : row.options ? (
                        <select
                          id={editId}
                          style={styles.input}
                          value={selectInputValue(row, saved)}
                          onChange={(event) => sheet.updateData(section.key, row.key, "value", event.target.value)}
                        >
                          {row.options.map((option) => <option key={option}>{option}</option>)}
                        </select>
                      ) : (
                        <BufferedInput
                          id={editId}
                          style={styles.input}
                          value={editableInputValue(sheet, row, saved)}
                          onCommit={(next) => sheet.updateData(section.key, row.key, "value", next)}
                        />
                      )}
                    </Cell>
                    <Cell tone={tone}>
                      {row.custom ? (
                        <BufferedInput
                          style={styles.unitInput}
                          value={row.unit || ""}
                          onCommit={(next) => sheet.updateDataRowMeta(section.key, row.key, "unit", next)}
                        />
                      ) : row.unit}
                    </Cell>
                    <Cell tone={tone}>
                      {calculated && !readonly && canEditFormulas ? (
                        <BufferedInput
                          id={editId}
                          style={styles.formulaInput}
                          value={dataInputFormulaForRow(sheet, row) || formulaForRow(sheet, row)}
                          onCommit={(next) => sheet.updateFormula(row.key, next)}
                        />
                      ) : calculated || row.formula || dataInputFormulaForRow(sheet, row) ? (
                        <span id={editId} tabIndex={-1} style={styles.formulaText}>{dataInputFormulaForRow(sheet, row) || formulaForRow(sheet, row)}</span>
                      ) : (
                        <BufferedInput style={styles.input} value={saved.notes || row.userNote || ""} onCommit={(next) => sheet.updateData(section.key, row.key, "notes", next)} />
                      )}
                    </Cell>
                    <Cell final={calculated} tone={tone}>
                      {calculated ? (
                        <button
                          style={formulaPickButtonStyle(formulaTarget)}
                          title={formulaTarget ? `Insert ${row.key}` : row.key}
                          onClick={() => formulaTarget && onPickFormulaReference(row.key)}
                        >
                          {value(sheet.preview.quantities[row.key])}
                        </button>
                      ) : ""}
                    </Cell>
                    {!readonly && <Cell tone={tone}>
                      <div style={styles.rowActions}>
                        <button style={styles.smallButton} onClick={() => focusRowEditor(editId)}>Edit</button>
                        <button style={styles.smallButton} onClick={() => sheet.addDataRow(section.key, row.key, "after")}>Insert below</button>
                        {!isRequiredDataInputRow(row.key) && <button style={styles.dangerButton} onClick={() => sheet.deleteDataRow(section.key, row.key)}>Delete</button>}
                      </div>
                    </Cell>}
                  </tr>
                );
              })}
            </Spreadsheet>
            </>
            )
          )}
        </section>
      ))}
    </div>
  );
}

function SupplierQuotationsSheet({ sheet }) {
  const supplierSections = supplierQuotationWorkbookSections(sheet);
  return (
    <div style={styles.pageStack}>
      {supplierSections.map((section) => (
        <section key={section.key} style={styles.section}>
          <button style={styles.sectionHeader} onClick={() => sheet.toggleDataSection(section.key)}>
            <span>{section.label}</span>
            <span>{sheet.workbook.data?.[section.key]?.collapsed ? "Show" : "Hide"}</span>
          </button>
          {!sheet.workbook.data?.[section.key]?.collapsed && (
            <SubcontractorQuotesSection sheet={sheet} section={section} />
          )}
        </section>
      ))}
    </div>
  );
}

function SubcontractorQuotesSection({ sheet, section }) {
  const readonly = sheet.previewMode;
  return (
    <div style={styles.subcontractorPanel}>
      <div style={styles.subcontractorIntro}>
        Quote reconciliation uses the live quotation costs for selected deductions and only pushes a fit-off value when Use Quote? is switched on.
      </div>
      <div style={styles.subcontractorCardList}>
        {section.rows.map((row, index) => {
          const saved = sheet.workbook.data?.subcontractorQuotes?.rows?.[row.key] || {};
          const deductions = subcontractorDeductionsForRow(row.key);
          const deductionRows = deductions.map((deduction) => ({
            ...deduction,
            amount: subcontractorDeductionAmount(sheet, deduction, saved),
            selected: Boolean(saved.deductions?.[deduction.key]),
          }));
          const deductionTotal = deductionRows.reduce((sum, deduction) => sum + deduction.amount, 0);
          const quoteAmount = summaryNumber(saved.quoteAmount);
          const balance = Math.max(0, quoteAmount - deductionTotal);
          const status = subcontractorQuoteStatus(saved, quoteAmount);
          const statusStyle = styles[`subcontractorStatus${status.key}`] || styles.subcontractorStatusNoQuote;
          const acceptedTone = saved.accepted
            ? styles.subcontractorCardAccepted
            : quoteAmount > 0
              ? styles.subcontractorCardPending
              : styles.subcontractorCardMissing;
          return (
            <section
              key={row.key}
              style={{
                ...styles.subcontractorCard,
                ...(index % 2 === 0 ? styles.subcontractorCardBlue : styles.subcontractorCardGrey),
                ...acceptedTone,
              }}
            >
              <div style={styles.subcontractorCardHeader}>
                <div style={styles.subcontractorHeaderTitle}>
                  <span style={styles.subcontractorIcon}>⚒</span>
                  <span>{row.label}</span>
                </div>
                <span style={{ ...styles.subcontractorStatusBadge, ...statusStyle }}>{status.label}</span>
              </div>
              <div style={styles.subcontractorCardGrid}>
                <div style={styles.subcontractorColumn}>
                  <div style={styles.subcontractorColumnTitle}>Contractor Details</div>
                  <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.contractorName || ""} placeholder="Contractor Name" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "contractorName", next)} />
                  <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.company || ""} placeholder="Company" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "company", next)} />
                </div>
                <div style={{ ...styles.subcontractorColumn, ...styles.subcontractorColumnDivider }}>
                  <div style={styles.subcontractorColumnTitle}>Quote Details</div>
                <div style={styles.subcontractorFieldGrid}>
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.quoteNumber || ""} placeholder="Quote Number" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "quoteNumber", next)} />
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} type="date" value={saved.quoteDate || ""} onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "quoteDate", next)} />
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.quoteAmount || ""} placeholder="$0.00" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "quoteAmount", currencyInputValue(next))} />
                    <label style={styles.subcontractorCheckLabel}><input style={styles.largeCheckbox} disabled={readonly} type="checkbox" checked={Boolean(saved.included)} onChange={(event) => sheet.updateSubcontractorQuote(row.key, "included", event.target.checked)} /> Included?</label>
                </div>
                  <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.notes || ""} placeholder="Notes" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "notes", next)} />
                </div>
                <div style={{ ...styles.subcontractorColumn, ...styles.subcontractorColumnDivider }}>
                  <div style={styles.subcontractorColumnTitle}>Procurement</div>
                <div style={styles.subcontractorFieldGrid}>
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.supplier || ""} placeholder="Supplier" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "supplier", next)} />
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.quotePdf || ""} placeholder="Quote PDF" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "quotePdf", next)} />
                    <label style={styles.subcontractorCheckLabel}><input style={styles.largeCheckbox} disabled={readonly} type="checkbox" checked={Boolean(saved.accepted)} onChange={(event) => sheet.updateSubcontractorQuote(row.key, "accepted", event.target.checked)} /> Accepted?</label>
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} value={saved.purchaseOrder || ""} placeholder="Purchase Order" onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "purchaseOrder", next)} />
                    <BufferedInput disabled={readonly} style={styles.subcontractorInput} type="date" value={saved.requiredDate || ""} onCommit={(next) => sheet.updateSubcontractorQuote(row.key, "requiredDate", next)} />
                </div>
                </div>
                <div style={{ ...styles.subcontractorColumn, ...styles.subcontractorColumnDivider }}>
                  <div style={styles.subcontractorColumnTitle}>Use Quote</div>
                  <label style={styles.useQuoteToggleModern}>
                    <input style={styles.toggleInput} disabled={readonly} type="checkbox" checked={Boolean(saved.useQuote)} onChange={(event) => sheet.updateSubcontractorQuote(row.key, "useQuote", event.target.checked)} />
                    <span style={{ ...styles.toggleTrack, ...(saved.useQuote ? styles.toggleTrackOn : styles.toggleTrackOff) }}>
                      <span style={{ ...styles.toggleKnob, ...(saved.useQuote ? styles.toggleKnobOn : {}) }} />
                    </span>
                    <strong style={{ color: saved.useQuote ? "#15803d" : "#475569" }}>{saved.useQuote ? "ON" : "OFF"}</strong>
                  </label>
                </div>
                <div style={{ ...styles.subcontractorColumn, ...styles.subcontractorColumnDivider }}>
                  <div style={styles.subcontractorColumnTitle}>Deductions</div>
                {deductionRows.length ? (
                  <div style={styles.deductionList}>
                    {deductionRows.map((deduction) => (
                      <label key={deduction.key} style={styles.deductionRow}>
                        <input
                          style={styles.largeCheckbox}
                          disabled={readonly}
                          type="checkbox"
                          checked={deduction.selected}
                          onChange={(event) => sheet.updateSubcontractorQuote(row.key, "deductions", { ...(saved.deductions || {}), [deduction.key]: event.target.checked })}
                        />
                        <span>{deduction.label}</span>
                        <strong>{money(deduction.amount)}</strong>
                      </label>
                    ))}
                  </div>
                ) : (
                  <span style={styles.readOnly}>No standard deductions mapped yet.</span>
                )}
                </div>
                <div style={{ ...styles.subcontractorColumn, ...styles.subcontractorColumnDivider }}>
                  <div style={styles.subcontractorColumnTitle}>Balance</div>
                <div style={styles.balanceStack}>
                    <div style={styles.balanceLine}><span>Quote</span><strong>{money(quoteAmount)}</strong></div>
                    <div style={styles.balanceLine}><span>Less Deductions</span><strong>{money(deductionTotal)}</strong></div>
                    <div style={styles.balanceNet}><span>Net Balance</span><strong>{money(balance)}</strong></div>
                </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WindowsDoorsSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const [openGroups, setOpenGroups] = useState({});
  const groups = windowDoorGroups(sheet.preview.windowsDoors.rows);
  const levelWarning = windowDoorLevelWarning(sheet.preview.windowsDoors.rows);
  const toggleGroup = (key) => setOpenGroups((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div style={styles.pageStack}>
      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>
          <span>Windows & Doors Schedule</span>
          {!readonly && <button style={styles.headerButton} onClick={sheet.resetWindowsDoorsFromExcel}>Reset from Excel sheet</button>}
        </div>
        {groups.map((group) => (
          <div key={group.key} style={styles.subSection}>
            <button style={styles.subSectionHeader} onClick={() => toggleGroup(group.key)}>
              <span>{group.label}</span>
              <span>{group.rows.length} lines - {openGroups[group.key] ? "Hide" : "Show"}</span>
            </button>
            {openGroups[group.key] && (
              <>
                {!readonly && <button style={styles.addLineButton} onClick={() => sheet.addWindow(group.rows[group.rows.length - 1]?.id || null, "after", null, group.defaultType, group.label)}>Add new row</button>}
                <Spreadsheet headers={readonly ? ["SIZE", "SIZE CODE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE"] : ["SIZE", "SIZE CODE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE", "Actions"]}>
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <Cell>
                        <select
                          id={rowDomId("window-edit", row.id)}
                          style={styles.itemInput}
                          value={row.code || ""}
                          onChange={(event) => (
                            sheet.updateWindowOption
                              ? sheet.updateWindowOption(row.id, event.target.value)
                              : sheet.updateWindow(row.id, "code", event.target.value)
                          )}
                        >
                          {windowSizeOptions(group.rows, row.code, row).map((option) => (
                            <option key={option} value={option}>{option || "Select size"}</option>
                          ))}
                        </select>
                      </Cell>
                      <Cell>
                        {(sheet.doorScheduleRangeOptions?.(row) || []).length ? (
                          <select
                            style={styles.itemInput}
                            value={row.doorRange || ""}
                            onChange={(event) => sheet.updateWindowDoorRange(row.id, event.target.value)}
                          >
                            {(sheet.doorScheduleRangeOptions?.(row) || []).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : shouldSkipWindowSizeCode(row) ? "" : readonly ? (
                          row.sizeCode || windowDoorSizeCodeForRow(row)
                        ) : (
                          <BufferedInput
                            style={styles.unitInput}
                            value={row.sizeCode || windowDoorSizeCodeForRow(row)}
                            onCommit={(next) => sheet.updateWindow(row.id, "sizeCode", String(next || "").toUpperCase())}
                          />
                        )}
                      </Cell>
                      <Cell><BufferedInput style={styles.numberInput} value={value(row.quantity)} onCommit={(next) => sheet.updateWindow(row.id, "quantity", next)} /></Cell>
                      <Cell>
                        <select style={styles.unitInput} value={levelDisplayValue(row.level)} onChange={(event) => sheet.updateWindow(row.id, "level", event.target.value)}>
                          <option value="">Level</option>
                          {["Ground Level", "Second Level", "Third Level"].map((level) => <option key={level} value={level}>{level}</option>)}
                        </select>
                      </Cell>
                      <Cell><BufferedInput inputMode="decimal" style={styles.numberInput} value={value(row.height)} onCommit={(next) => sheet.updateWindow(row.id, "height", next)} /></Cell>
                      <Cell><BufferedInput inputMode="decimal" style={styles.numberInput} value={value(row.width)} onCommit={(next) => sheet.updateWindow(row.id, "width", next)} /></Cell>
                      <Cell final>{value(row.totalArea)}</Cell>
                      <Cell final>{value(row.sillLength)}</Cell>
                      <Cell final>{value(row.architraveLength)}</Cell>
                      <Cell>
                        {readonly
                          ? value(row.rate)
                          : <BufferedInput style={styles.rateInput} value={value(row.rate)} onCommit={(next) => sheet.updateWindowRate(row.id, currencyInputValue(next))} />}
                      </Cell>
                      {!readonly && <Cell>
                        <div style={styles.rowActions}>
                          <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("window-edit", row.id))}>Edit</button>
                          <button style={styles.smallButton} onClick={() => sheet.addWindow(row.id, "after", row.id, group.defaultType, group.label)}>Insert below</button>
                          <button style={styles.dangerButton} onClick={() => sheet.deleteWindow(row.id)}>Delete</button>
                        </div>
                      </Cell>}
                    </tr>
                  ))}
                </Spreadsheet>
              </>
            )}
          </div>
        ))}
        <Spreadsheet headers={readonly ? ["Total", "SIZE CODE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE"] : ["Total", "SIZE CODE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE", "Actions"]}>
          <tr>
            <Cell strong>Total Area</Cell>
            <Cell />
            <Cell final>{value(sheet.preview.windowsDoors.totals.windowCount)}</Cell>
            <Cell />
            <Cell />
            <Cell />
            <Cell final>{value(sheet.preview.windowsDoors.totals.totalArea)}</Cell>
            <Cell final>{value(sheet.preview.windowsDoors.totals.sillLength)}</Cell>
            <Cell final>{value(sheet.preview.windowsDoors.totals.architraveLength)}</Cell>
            <Cell />
            {!readonly && <Cell />}
          </tr>
        </Spreadsheet>
        <Spreadsheet headers={["Level", "Opening Area"]}>
          <tr><Cell strong>Ground Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.groundFloorArea)}</Cell></tr>
          <tr><Cell strong>Second Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.secondLevelArea)}</Cell></tr>
          <tr><Cell strong>Third Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.thirdLevelArea)}</Cell></tr>
          <tr><Cell strong>Total openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.totalArea)}</Cell></tr>
        </Spreadsheet>
        {levelWarning && (
          <div style={styles.windowLevelWarning}>
            <strong>Level check warning</strong>
            <span>{levelWarning}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function FormulaSheet({ sheet, formulaTarget, onPickFormulaReference, canEditFormulas = false }) {
  const rows = formulaRows(sheet);
  const readonly = sheet.previewMode;
  const locked = readonly || !canEditFormulas;
  return (
    <div style={styles.pageStack}>
      {!locked && <button style={styles.addLineButton} onClick={() => sheet.addFormulaRow()}>Add new row</button>}
      <Spreadsheet headers={locked ? ["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note"] : ["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note", "Actions"]}>
        {rows.map((row) => (
          <tr key={row.key}>
            <Cell strong>
              {row.custom ? (
                <BufferedInput
                  disabled={locked}
                  style={styles.itemInput}
                  value={row.label || ""}
                  onCommit={(next) => sheet.updateFormulaRowMeta(row.key, "label", next)}
                />
              ) : row.label}
            </Cell>
            <Cell>
              <BufferedInput
                id={rowDomId("formula-edit", row.key)}
                disabled={locked}
                style={styles.formulaInput}
                value={formulaForRow(sheet, row)}
                onCommit={(next) => sheet.updateFormula(row.key, next)}
              />
            </Cell>
            <Cell final>
              <button
                style={formulaPickButtonStyle(formulaTarget)}
                title={formulaTarget ? `Insert ${row.key}` : row.key}
                onClick={() => formulaTarget && onPickFormulaReference(row.key)}
              >
                {value(sheet.preview.quantities[row.key])}
              </button>
            </Cell>
            <Cell>
              {row.custom ? (
                <BufferedInput
                  disabled={locked}
                  style={styles.unitInput}
                  value={row.unit || ""}
                  onCommit={(next) => sheet.updateFormulaRowMeta(row.key, "unit", next)}
                />
              ) : row.unit}
            </Cell>
            <Cell>
              <BufferedInput
                style={styles.input}
                placeholder="Why this formula changed for this job"
                value={sheet.workbook.formulaNotes?.[row.key] || ""}
                onCommit={(next) => sheet.updateFormulaNote(row.key, next)}
              />
            </Cell>
            {!locked && <Cell>
              <div style={styles.rowActions}>
                <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("formula-edit", row.key))}>Edit</button>
                <button style={styles.smallButton} onClick={() => sheet.addFormulaRow(row.key, "after")}>Insert below</button>
                {!row.custom && <button style={styles.smallButton} onClick={() => sheet.requestPromoteFormula(row.key)}>Promote Later</button>}
                <button style={styles.dangerButton} onClick={() => sheet.deleteFormulaRow(row.key)}>Delete</button>
              </div>
            </Cell>}
          </tr>
        ))}
      </Spreadsheet>
      <HistoryPanel title="Formula Change History" rows={sheet.workbook.formulaHistory || []} />
    </div>
  );
}

function CalculatedQuantitiesSheet({ sheet }) {
  const floorCount = workbookDataValue(sheet.workbook, "floorCount") || "Single storey";
  return (
    <div style={styles.pageStack}>
      {sheet.dataSections.map((section) => {
        const rows = section.rows.filter((row) => row.calculated && isCalculatedRowVisible(row, sheet.workbook, floorCount));
        if (!rows.length) return null;
        return (
          <section key={section.key} style={styles.section}>
            <div style={styles.staticSectionHeader}>{section.label}</div>
            <Spreadsheet headers={["Quantity", "Result", "Unit", "Formula"]}>
              {rows.map((row) => (
                <tr key={row.key}>
                  <Cell strong>{row.label}</Cell>
                  <Cell final>{value(sheet.preview.quantities[row.key])}</Cell>
                  <Cell>{row.unit}</Cell>
                  <Cell><span style={styles.formulaText}>{formulaForRow(sheet, row)}</span></Cell>
                </tr>
              ))}
            </Spreadsheet>
          </section>
        );
      })}
    </div>
  );
}

function QuotationSheet({ sheet, onFormulaTarget }) {
  const readonly = sheet.previewMode;
  const search = sheet.lineSearch.trim().toLowerCase();
  const [orderManagerOpen, setOrderManagerOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [moveSectionNumber, setMoveSectionNumber] = useState("");
  const [moveAfterNumber, setMoveAfterNumber] = useState("");
  const [openApplianceBrands, setOpenApplianceBrands] = useState({});
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [productLightbox, setProductLightbox] = useState(null);

  function openOrderManager() {
    setDraftOrder(topLevelQuoteSections(sheet.quoteSections));
    setMoveSectionNumber("");
    setMoveAfterNumber("");
    setOrderManagerOpen(true);
  }

  function closeOrderManager() {
    setOrderManagerOpen(false);
  }

  function moveDraftSection(section, direction) {
    setDraftOrder((current) => {
      const index = current.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moving] = next.splice(index, 1);
      next.splice(nextIndex, 0, moving);
      return next;
    });
  }

  function dragOrderStart(event, section) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", section);
  }

  function dropOrderSection(event, targetSection) {
    event.preventDefault();
    const movingSection = event.dataTransfer.getData("text/plain");
    if (!movingSection || movingSection === targetSection) return;
    setDraftOrder((current) => moveSectionBefore(current, movingSection, targetSection));
  }

  function moveBySectionNumber() {
    const section = findSectionByNumber(draftOrder, moveSectionNumber, sheet);
    const afterSection = findSectionByNumber(draftOrder, moveAfterNumber, sheet);
    if (!section || !afterSection || section === afterSection) return;
    setDraftOrder((current) => moveSectionAfter(current, section, afterSection));
  }

  function saveSectionOrder() {
    sheet.saveQuoteSectionOrder(expandManagedQuoteSectionOrder(draftOrder, sheet.quoteSections));
    setOrderManagerOpen(false);
  }

  function dragStart(event, section, id) {
    if (readonly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify({ section, id }));
  }

  function dropLine(event, toSection, targetId, position = "after") {
    if (readonly) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    let dragged = null;
    try {
      dragged = JSON.parse(raw);
    } catch {
      return;
    }
    sheet.moveQuoteLine(dragged.section, dragged.id, toSection, targetId, position);
  }

  function toggleApplianceBrand(brandKey) {
    setOpenApplianceBrands((current) => ({ ...current, [brandKey]: !current[brandKey] }));
  }

  function showProductPreview(section, row) {
    setPreviewProduct(productPreviewFromQuoteRow(section, row));
    setPreviewImageIndex(0);
  }

  function updatePreviewImageUrl(next) {
    if (!previewProduct) return;
    sheet.updateQuote(previewProduct.section, previewProduct.rowId, "selectionImageUrl", next);
    setPreviewProduct((current) => current ? productPreviewFromQuoteRow(current.section, { ...current.row, selectionImageUrl: next }) : current);
    setPreviewImageIndex(0);
  }

  const displayNumbering = quoteDisplayNumbering(sheet, openApplianceBrands);

  function renderQuoteSection(section, options = {}) {
    const previewSection = sheet.preview.quotation[section];
    const savedSection = sheet.workbook.quotation?.[section] || {};
    const sectionTotal = options.total ?? previewSection?.subtotal ?? 0;
    const rows = (previewSection?.rows || []).filter((row) => {
      if (isRemovedQuoteOutput(section, row)) return false;
      if (quoteFeeType(row)) return false;
      if (isHiddenQuoteRow(row)) return false;
      if (!isQuoteRowRelevantForFloorCount(row, sheet.workbook)) return false;
      if (!hasSelectedWallThickness(sheet.workbook, "90") && is90mmWallFrameQuoteRow(row)) return false;
      if (isApplianceHeadingQuoteRow(row)) return true;
      const haystack = `${row.item || ""} ${row.rawText || ""}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (sheet.hideUnused && !isUsedQuoteRow(row)) return false;
      return true;
    });
    const renderedRows = isAppliancePackageSection(section) ? visibleApplianceRows(rows, openApplianceBrands) : rows;
    const showQuoteRows = renderedRows.length > 0 || !isAppliancePackageSection(section);
    return (
      <section key={section} style={options.nested ? styles.nestedQuoteSection : styles.section}>
        <div
          style={options.nested ? styles.nestedSectionHeader : styles.sectionHeader}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropLine(event, section, null)}
        >
          <input
            aria-label={`${section} group number`}
            disabled={readonly}
            readOnly
            style={styles.sectionGroupInput}
            value={displayNumbering.sections[section] || savedSection.groupNumber || ""}
            onClick={(event) => event.stopPropagation()}
          />
          <input
            aria-label={`${section} summary stage number`}
            disabled={readonly}
            style={styles.sectionStageInput}
            value={savedSection.stageNumber || ""}
            onChange={(event) => sheet.updateQuoteSectionMeta(section, "stageNumber", event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            style={styles.sectionHeaderButton}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              sheet.toggleQuoteSection(section);
            }}
          >
              <span>{quoteSectionDisplayLabel(options.label || section)}</span>
            <span style={styles.sectionTotalStack}>
              <strong>{money(sectionTotal)}</strong>
              <small>{quotePercentOfTotal(sectionTotal, sheet.preview.summary.finalQuoteTotal)}</small>
            </span>
          </button>
        </div>
        {!sheet.workbook.quotation?.[section]?.collapsed && showQuoteRows && (
        <>
        <Spreadsheet
          headers={readonly ? ["", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Selection", "Notes"] : ["Move", "", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Selection", "Notes", "Actions"]}
          compactColumns={readonly ? [0] : [0, 1]}
        >
          {renderedRows.map((row, rowIndex) => {
            if (isApplianceHeadingQuoteRow(row)) {
              const isBrandHeading = row.applianceHeadingLevel === 1;
              const brandKey = applianceBrandKey(row);
              const brandOpen = Boolean(openApplianceBrands[brandKey]);
              const brandRows = isBrandHeading ? applianceRowsForBrand(rows, brandKey) : [];
              return (
                <tr key={row.id}>
                  {!readonly && <Cell compact />}
                  <Cell compact />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1}>
                    {isBrandHeading ? (
                      <button
                        type="button"
                        style={styles.applianceBrandToggle}
                        onClick={() => toggleApplianceBrand(brandKey)}
                      >
                        <span>{brandOpen ? "v" : ">"} {quoteItem(row)}</span>
                        <span style={styles.applianceBrandMeta}>{brandRows.length} rows | {money(sumQuoteRows(brandRows))}</span>
                      </button>
                    ) : (
                      <span style={styles.appliancePackageHeading}>{quoteItem(row)}</span>
                    )}
                  </Cell>
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  {!readonly && <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />}
                </tr>
              );
            }
            return (
              <tr
                key={row.id}
                draggable={!readonly}
                onDragStart={(event) => dragStart(event, section, row.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropLine(event, section, row.id, "before")}
                onMouseEnter={() => showProductPreview(section, row)}
                onClick={() => showProductPreview(section, row)}
                style={styles.draggableRow}
              >
                {!readonly && <Cell compact><span style={styles.dragHandle} title="Drag row">::</span></Cell>}
                <Cell compact />
                <Cell>
                  <BufferedInput
                    id={rowDomId("quote-edit", row.id)}
                    style={styles.itemInput}
                    value={quoteItem(row)}
                    onCommit={(next) => sheet.updateQuote(section, row.id, "item", next)}
                  />
                </Cell>
                <Cell>
                  {isBlankQuoteQtyRow(row) ? (
                    <BufferedInput style={styles.numberInput} value={quoteInputQty(row, sheet)} onFocus={() => onFormulaTarget({ section, id: row.id })} onCommit={(next) => sheet.updateQuote(section, row.id, "quantity", next)} />
                  ) : isLinkedQuoteQty(row) && !isEditableLinkedQuoteQty(row) ? (
                    <span style={styles.readOnly}>{value(row.qty)}</span>
                  ) : (
                    <BufferedInput style={styles.numberInput} value={quoteInputQty(row, sheet)} onFocus={() => onFormulaTarget({ section, id: row.id })} onCommit={(next) => sheet.updateQuote(section, row.id, "quantity", next)} />
                  )}
                </Cell>
                <Cell><BufferedInput style={styles.unitInput} value={row.unit || ""} onCommit={(next) => sheet.updateQuote(section, row.id, "unit", next)} /></Cell>
                <Cell><BufferedInput style={styles.rateInput} value={value(row.manualRate || row.excelRate)} onCommit={(next) => sheet.updateQuote(section, row.id, "manualRate", currencyInputValue(next))} /></Cell>
                <Cell final>{quoteCost(row)}</Cell>
                <Cell>{row.sourceOfRate}</Cell>
                <Cell>
                  <QuoteSelectionReferenceCell
                    row={row}
                    readonly={readonly}
                    onChange={(key, next) => sheet.updateQuote(section, row.id, key, next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    style={{ ...styles.input, ...styles.quoteNotesInput }}
                    value={row.notes || ""}
                    onCommit={(next) => sheet.updateQuote(section, row.id, "notes", next)}
                  />
                </Cell>
                {!readonly && <Cell>
                  <div style={styles.rowActions}>
                    <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("quote-edit", row.id))}>Edit</button>
                    <button style={styles.smallButton} onClick={() => sheet.addQuoteLine(section, row.id, "after")}>Insert below</button>
                    <button style={styles.dangerButton} onClick={() => sheet.deleteQuoteLine(section, row.id)}>Delete</button>
                  </div>
                </Cell>}
              </tr>
            );
          })}
          {readonly ? (
            <tr><Cell /><Cell strong>Section total</Cell><Cell /><Cell /><Cell /><Cell final>{money(previewSection?.subtotal || 0)}</Cell><Cell /><Cell /><Cell /></tr>
          ) : (
            <tr><Cell /><Cell /><Cell strong>Section total</Cell><Cell /><Cell /><Cell /><Cell final>{money(previewSection?.subtotal || 0)}</Cell><Cell /><Cell /><Cell /><Cell /></tr>
          )}
        </Spreadsheet>
        {!readonly && (
          <div style={styles.sectionFooterActions}>
            <button style={styles.addLineButton} onClick={() => sheet.addQuoteLine(section)}>Add line</button>
            <button type="button" style={styles.closeSectionButton} onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              sheet.toggleQuoteSection(section);
            }}>Close section</button>
          </div>
        )}
        </>
        )}
      </section>
    );
  }

  return (
    <div style={styles.pageStack}>
      {!readonly && (
        <div style={styles.tabBar}>
          <button style={styles.primaryButton} onClick={openOrderManager}>Manage Section Order</button>
          <button style={styles.secondaryButton} onClick={() => sheet.renumberQuoteDisplay?.()}>Renumber Display</button>
          <button style={styles.secondaryButton} onClick={() => sheet.collapseAllQuoteSections?.()}>Collapse All</button>
          {sheet.renumberReport && (
            <span style={sheet.renumberReport.ok ? styles.okPill : styles.warningPill}>{sheet.renumberReport.message}</span>
          )}
        </div>
      )}
      {orderManagerOpen && (
        <div style={styles.orderPanel}>
          <div style={styles.orderPanelHeader}>
            <div>
              <div style={styles.orderPanelTitle}>Manage Section Order</div>
              <div style={styles.orderPanelNote}>Drag sections, use move buttons, or move one section after another by section number.</div>
            </div>
            <button style={styles.secondaryButton} onClick={closeOrderManager}>Close</button>
          </div>
          <div style={styles.orderToolRow}>
            <input
              style={styles.shortInput}
              value={moveSectionNumber}
              onChange={(event) => setMoveSectionNumber(event.target.value)}
              placeholder="Move #"
            />
            <span style={styles.orderToolText}>after</span>
            <input
              style={styles.shortInput}
              value={moveAfterNumber}
              onChange={(event) => setMoveAfterNumber(event.target.value)}
              placeholder="After #"
            />
            <button style={styles.secondaryButton} onClick={moveBySectionNumber}>Move section after section number</button>
          </div>
          <div style={styles.orderList}>
            {draftOrder.map((section, index) => (
              <div
                key={section}
                draggable
                onDragStart={(event) => dragOrderStart(event, section)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOrderSection(event, section)}
                style={styles.orderItem}
              >
                <span style={styles.dragHandle} title="Drag section">::</span>
                <span style={styles.orderItemNumber}>{quoteSectionNumber(section, sheet) || index + 1}</span>
                <input
                  aria-label={`${section} group number`}
                  style={styles.orderGroupInput}
                  value={sheet.workbook.quotation?.[section]?.groupNumber || ""}
                  onChange={(event) => sheet.updateQuoteSectionMeta(section, "groupNumber", event.target.value)}
                />
                <span style={styles.orderItemName}>{section}</span>
                <button style={styles.smallButton} onClick={() => moveDraftSection(section, -1)} disabled={index === 0}>Move Up</button>
                <button style={styles.smallButton} onClick={() => moveDraftSection(section, 1)} disabled={index === draftOrder.length - 1}>Move Down</button>
              </div>
            ))}
          </div>
          <div style={styles.orderActions}>
            <button style={styles.primaryButton} onClick={saveSectionOrder}>Save Order</button>
            <button style={styles.secondaryButton} onClick={() => setDraftOrder(topLevelQuoteSections(sheet.quoteSections))}>Reset</button>
          </div>
        </div>
      )}
      <div style={styles.quotationWorkspace}>
        <div style={styles.quotationTablePane}>
          {topLevelQuoteSections(sheet.quoteSections).map((section) => {
            const wallFramesParent = sheet.quoteSections.find((item) => isWallFramesSection(item));
            const roofFramingParent = sheet.quoteSections.find((item) => isRoofFramingSection(item));
            const hardwareParent = sheet.quoteSections.find((item) => isHardwareSection(item));
            const roofingMaterialsParent = sheet.quoteSections.find((item) => isRoofingMaterialsSection(item));
            const externalCladdingParent = sheet.quoteSections.find((item) => isExternalCladdingSection(item));
            const entryDoorsParent = sheet.quoteSections.find((item) => isEntryDoorsSection(item));
            const tilingParent = sheet.quoteSections.find((item) => isTilingSection(item));
            const plumbingFittingsParent = sheet.quoteSections.find((item) => isPlumbingFittingsSection(item));
            const electricalParent = sheet.quoteSections.find((item) => isElectricalSection(item));
            const painterParent = sheet.quoteSections.find((item) => isPainterSection(item));
            const floorcoveringsParent = sheet.quoteSections.find((item) => isFloorcoveringsSection(item));
            const mirrorsShowerScreensParent = sheet.quoteSections.find((item) => isMirrorsShowerScreensSection(item));
            const faceBrickworkParent = sheet.quoteSections.find((item) => isFaceBrickworkSection(item));
            const renderingParent = sheet.quoteSections.find((item) => isRenderingSection(item));
            const plasterSupplyInstallParent = sheet.quoteSections.find((item) => isPlasterSupplyInstallSection(item));
            const fixOutMaterialsParent = sheet.quoteSections.find((item) => isFixOutMaterialsSection(item));
            const cabinetMakerParent = sheet.quoteSections.find((item) => isCabinetMakerSection(item));
            const appliancePackageParent = sheet.quoteSections.find((item) => isAppliancePackageSection(item));
            if (isConcreteSlabSubsection(section)) return null;
            if (wallFramesParent && isWallFramesSubsection(section)) return null;
            if (roofFramingParent && isRoofFramingSubsection(section)) return null;
            if (hardwareParent && isHardwareSubsection(section)) return null;
            if (roofingMaterialsParent && isRoofingMaterialsSubsection(section)) return null;
            if (externalCladdingParent && isExternalCladdingSubsection(section)) return null;
            if (entryDoorsParent && isEntryDoorsSubsection(section)) return null;
            if (tilingParent && isTilingSubsection(section)) return null;
            if (plumbingFittingsParent && isPlumbingFittingsSubsection(section)) return null;
            if (electricalParent && isElectricalSubsection(section)) return null;
            if (painterParent && isPainterSubsection(section)) return null;
            if (floorcoveringsParent && isFloorcoveringsSubsection(section)) return null;
            if (mirrorsShowerScreensParent && isMirrorsShowerScreensSubsection(section)) return null;
            if (faceBrickworkParent && isFaceBrickworkSubsection(section)) return null;
            if (renderingParent && isRenderingSubsection(section)) return null;
            if (plasterSupplyInstallParent && isPlasterSupplyInstallSubsection(section)) return null;
            if (fixOutMaterialsParent && isFixOutMaterialsSubsection(section)) return null;
            if (cabinetMakerParent && isCabinetMakerSubsection(section)) return null;
            if (appliancePackageParent && isApplianceBrandSubsection(section)) return null;
            const childSections = isConcreteSlabSection(section)
              ? sheet.quoteSections.filter((item) => isConcreteSlabSubsection(item))
              : isWallFramesSection(section)
                ? orderedFramingSubsections(sheet.quoteSections)
                : isRoofFramingSection(section)
                  ? sheet.quoteSections.filter((item) => isRoofFramingSubsection(item))
                  : isHardwareSection(section)
                    ? sheet.quoteSections.filter((item) => isHardwareSubsection(item))
                    : isRoofingMaterialsSection(section)
                      ? sheet.quoteSections.filter((item) => isRoofingMaterialsSubsection(item))
                      : isExternalCladdingSection(section)
                        ? sheet.quoteSections.filter((item) => isExternalCladdingSubsection(item))
                        : isEntryDoorsSection(section)
                          ? sheet.quoteSections.filter((item) => isEntryDoorsSubsection(item))
                          : isTilingSection(section)
                            ? orderedTilingSubsections(sheet.quoteSections.filter((item) => isTilingSubsection(item)))
                            : isPlumbingFittingsSection(section)
                              ? orderedPlumbingFittingsSubsections(sheet.quoteSections.filter((item) => isPlumbingFittingsSubsection(item)))
                              : isElectricalSection(section)
                                ? orderedElectricalSubsections(sheet.quoteSections.filter((item) => isElectricalSubsection(item)))
                                : isPainterSection(section)
                                  ? orderedPainterSubsections(sheet.quoteSections.filter((item) => isPainterSubsection(item)))
                                  : isFloorcoveringsSection(section)
                                    ? orderedFloorcoveringsSubsections(sheet.quoteSections.filter((item) => isFloorcoveringsSubsection(item)))
                                    : isMirrorsShowerScreensSection(section)
                                      ? orderedMirrorsShowerScreensSubsections(sheet.quoteSections.filter((item) => isMirrorsShowerScreensSubsection(item)))
                                      : isFaceBrickworkSection(section)
                                        ? sheet.quoteSections.filter((item) => isFaceBrickworkSubsection(item))
                                        : isRenderingSection(section)
                                          ? sheet.quoteSections.filter((item) => isRenderingSubsection(item))
                                          : isPlasterSupplyInstallSection(section)
                                            ? sheet.quoteSections.filter((item) => isPlasterSupplyInstallSubsection(item))
                                            : isFixOutMaterialsSection(section)
                                              ? orderedFixOutSubsections(sheet.quoteSections)
                                              : isCabinetMakerSection(section)
                                                ? orderedCabinetMakerSubsections(sheet.quoteSections.filter((item) => isCabinetMakerSubsection(item)))
                                                : isAppliancePackageSection(section)
                                                  ? orderedApplianceBrandSubsections(sheet.quoteSections)
                                                  : [];
            const sectionTotal = childSections.length
              ? childSections.reduce((sum, item) => sum + (sheet.preview.quotation[item]?.subtotal || 0), sheet.preview.quotation[section]?.subtotal || 0)
              : undefined;
            return (
              <div key={section} style={styles.quoteGroup}>
                {renderQuoteSection(section, { total: sectionTotal, label: wallFramesDisplayLabel(section) || quoteSectionDisplayLabel(section) })}
                {childSections.length > 0 && !sheet.workbook.quotation?.[section]?.collapsed && (
                  <div style={styles.nestedQuoteStack}>
                    {childSections.map((child) => renderQuoteSection(child, { nested: true, label: quoteSectionDisplayLabel(child) }))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <QuoteProductPreviewPanel
          product={previewProduct}
          imageIndex={previewImageIndex}
          readonly={readonly}
          onImageIndex={setPreviewImageIndex}
          onChangeImageUrl={updatePreviewImageUrl}
          onOpenLightbox={(payload) => setProductLightbox(payload)}
        />
      </div>
      {productLightbox ? (
        <ProductGalleryLightbox
          product={productLightbox.product}
          imageIndex={productLightbox.imageIndex}
          onImageIndex={(nextIndex) => setProductLightbox((current) => current ? { ...current, imageIndex: nextIndex } : current)}
          onClose={() => setProductLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function QuoteProductPreviewPanel({ product, imageIndex, readonly, onImageIndex, onChangeImageUrl, onOpenLightbox }) {
  const images = product?.images || [];
  const safeIndex = images.length ? Math.min(Math.max(imageIndex, 0), images.length - 1) : 0;
  const imageUrl = images[safeIndex] || "";
  return (
    <aside style={styles.productPreviewPanel}>
      <div style={styles.productPreviewHeader}>
        <span>Product Preview</span>
        <strong>{product?.productName || "Hover a product row"}</strong>
      </div>
      {imageUrl ? (
        <button
          type="button"
          style={{ ...styles.productPreviewImageButton, backgroundImage: `url(${imageUrl})` }}
          title="Open larger gallery"
          onClick={() => onOpenLightbox({ product, imageIndex: safeIndex })}
        />
      ) : (
        <div style={styles.productPreviewEmpty}>
          <strong>No product image</strong>
          <span>Hover or click a quotation row to preview its selected product.</span>
        </div>
      )}
      {images.length > 1 ? (
        <>
          <div style={styles.productPreviewNav}>
            <button type="button" style={styles.smallButton} onClick={() => onImageIndex((safeIndex - 1 + images.length) % images.length)}>Previous</button>
            <span>{safeIndex + 1} / {images.length}</span>
            <button type="button" style={styles.smallButton} onClick={() => onImageIndex((safeIndex + 1) % images.length)}>Next</button>
          </div>
          <div style={styles.productPreviewThumbs}>
            {images.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                style={{ ...styles.productPreviewThumb, ...(index === safeIndex ? styles.productPreviewThumbActive : {}), backgroundImage: `url(${url})` }}
                onClick={() => onImageIndex(index)}
                title={`Show image ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
      {!readonly && product ? (
        <label style={styles.productPreviewField}>
          Image URL
          <BufferedInput
            style={styles.productPreviewInput}
            value={product.row?.selectionImageUrl || product.row?.productImageUrl || product.row?.imageUrl || ""}
            placeholder="Paste product image URL"
            onCommit={onChangeImageUrl}
          />
        </label>
      ) : null}
      <div style={styles.productPreviewMeta}>
        <div><span>Supplier</span><strong>{product?.supplier || "-"}</strong></div>
        <div><span>SKU</span><strong>{product?.sku || "-"}</strong></div>
        <div><span>Manufacturer</span><strong>{product?.manufacturer || "-"}</strong></div>
      </div>
      <div style={styles.productPreviewDescription}>
        <span>Description</span>
        <p style={styles.productPreviewDescriptionText}>{product?.description || "No product description recorded."}</p>
      </div>
    </aside>
  );
}

function ProductGalleryLightbox({ product, imageIndex, onImageIndex, onClose }) {
  const images = product?.images || [];
  const safeIndex = images.length ? Math.min(Math.max(imageIndex, 0), images.length - 1) : 0;
  const imageUrl = images[safeIndex] || "";
  return (
    <div style={styles.imageModalBackdrop} onClick={onClose}>
      <div style={styles.imageModal} onClick={(event) => event.stopPropagation()}>
        <button type="button" style={styles.imageModalClose} onClick={onClose}>Close</button>
        {imageUrl ? <img src={imageUrl} alt={product?.productName || "Product preview"} style={styles.imageModalImg} /> : null}
        <strong>{product?.productName || "Product image"}</strong>
        {images.length > 1 ? (
          <div style={styles.productPreviewNav}>
            <button type="button" style={styles.smallButton} onClick={() => onImageIndex((safeIndex - 1 + images.length) % images.length)}>Previous</button>
            <span>{safeIndex + 1} / {images.length}</span>
            <button type="button" style={styles.smallButton} onClick={() => onImageIndex((safeIndex + 1) % images.length)}>Next</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummarySheet({ sheet }) {
  const readonly = sheet.previewMode;
  const stageGroups = summaryBuildStageGroups(sheet);
  const [expandedStages, setExpandedStages] = useState({});
  const toggleStage = (stageNumber) => setExpandedStages((current) => ({ ...current, [stageNumber]: !current[stageNumber] }));
  const collapseAllRows = () => setExpandedStages({});
  const expandAllRows = () => setExpandedStages(Object.fromEntries(stageGroups.map((group) => [group.stageNumber, true])));
  const headers = ["Stage / Section", "Section Name", "Item Name", "Qty", "Unit", "Rate", "Total / Cost", "Notes"];
  return (
    <div style={styles.pageStack}>
      <div style={styles.summaryToolbar}>
        <button style={styles.secondaryButton} onClick={collapseAllRows}>Collapse All Rows</button>
        <button style={styles.secondaryButton} onClick={expandAllRows}>Expand All Rows</button>
        {!readonly && <button style={styles.addLineButton} onClick={sheet.addQuoteSection}>Add new row</button>}
      </div>
      <Spreadsheet headers={headers}>
        {stageGroups.flatMap((group) => {
          const mainOpen = Boolean(expandedStages[group.stageNumber]);
          const rows = [
            <tr key={`stage-${group.stageNumber}`} style={styles.summaryStageRow}>
              <Cell strong>
                <button style={styles.summaryToggleButton} onClick={() => toggleStage(group.stageNumber)}>
                  <span>{mainOpen ? "v" : ">"}</span>
                  <span>{group.stageNumber} {group.label}</span>
                </button>
              </Cell>
              <Cell />
              <Cell />
              <Cell />
              <Cell />
              <Cell />
              <Cell final>{money(group.total)}</Cell>
              <Cell>{summaryStagePercentOfTotal(group.total, sheet.preview.summary.finalQuoteTotal)}</Cell>
            </tr>,
          ];
          if (!mainOpen) return rows;
          group.rows.forEach((item, rowIndex) => {
            if (item.adjustment) {
              rows.push(
                <tr key={`stage-adjustment-${group.stageNumber}-${item.row.id}`}>
                  <Cell>Cost</Cell>
                  <Cell>{group.label}</Cell>
                  <Cell strong>{item.row.item}</Cell>
                  <Cell>1</Cell>
                  <Cell>ITEM</Cell>
                  <Cell>{money(item.total)}</Cell>
                  <Cell final>{money(item.total)}</Cell>
                  <Cell>{item.row.notes}</Cell>
                </tr>
              );
              return;
            }
            const sectionDisplayName = summarySectionDisplayName(item.section, sheet);
            rows.push(
              <tr key={`stage-line-${group.stageNumber}-${item.section}-${item.row.id || rowIndex}`}>
                <Cell>{group.stageNumber}</Cell>
                <Cell>
                  <BufferedInput
                    style={styles.summarySectionInput}
                    disabled={readonly}
                    value={sectionDisplayName}
                    onCommit={(next) => sheet.updateQuoteSectionMeta(item.section, "displayName", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    style={styles.itemInput}
                    disabled={readonly}
                    value={quoteItem(item.row)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "item", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    inputMode="decimal"
                    style={styles.numberInput}
                    disabled={readonly}
                    value={value(item.row.qty || item.row.quantity)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "quantity", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    style={styles.unitInput}
                    disabled={readonly}
                    value={item.row.unit || ""}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "unit", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    inputMode="decimal"
                    style={styles.rateInput}
                    disabled={readonly}
                    value={value(item.row.finalRateUsed || item.row.manualRate || item.row.excelRate)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "manualRate", currencyInputValue(next))}
                  />
                </Cell>
                <Cell final>
                  <BufferedInput
                    inputMode="decimal"
                    style={styles.rateInput}
                    disabled={readonly}
                    value={summaryLineTotal(item.row)}
                    onCommit={(next) => updateSummaryLineTotal(sheet, item.section, item.row, next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    style={styles.input}
                    disabled={readonly}
                    value={item.row.notes || ""}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "notes", next)}
                  />
                </Cell>
              </tr>
            );
          });
          return rows;
        })}
        {summaryTotalRow("Base line item subtotal", sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin, sheet.preview.summary.finalQuoteTotal)}
        {SUMMARY_TABLE_ADJUSTMENT_ROWS.map((field) => summaryAdjustmentRow(sheet, field, readonly))}
        {summaryFinalTotalRow(sheet.preview.summary.finalQuoteTotal)}
        {summaryFloorAreaRow(sheet)}
        {summaryRatePerM2Row(sheet)}
      </Spreadsheet>
      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>Template Promotion Requests</div>
        <Spreadsheet headers={["Type", "Item", "Value", "Notes"]}>
          {Object.entries(sheet.workbook.formulaPromotions || {}).map(([key, item]) => (
            <tr key={key}><Cell strong>Formula</Cell><Cell>{pretty(key)}</Cell><Cell>{item.formula}</Cell><Cell>{item.note}</Cell></tr>
          ))}
          {(sheet.workbook.ratePromotions || []).map((item) => (
            <tr key={`${item.id}-${item.requestedAt}`}><Cell strong>Rate</Cell><Cell>{item.item}</Cell><Cell>{item.rate}</Cell><Cell>{item.notes}</Cell></tr>
          ))}
        </Spreadsheet>
      </section>
    </div>
  );
}

export function ClientPageSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const { workspaceId } = useWorkspace();
  const [activePageId, setActivePageId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [draggedBlockId, setDraggedBlockId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [editingBlockId, setEditingBlockId] = useState("");
  const [pageEditMode, setPageEditMode] = useState(false);
  const [addElementOpen, setAddElementOpen] = useState(false);
  const [projectEstimateInspectorTab, setProjectEstimateInspectorTab] = useState("properties");
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [mediaLibraryAssets, setMediaLibraryAssets] = useState([]);
  const [aiRewriteOpen, setAiRewriteOpen] = useState(false);
  const [aiRewriteInstruction, setAiRewriteInstruction] = useState("Make clearer");
  const [aiRewritePreview, setAiRewritePreview] = useState("");
  const [documentLibraryOpen, setDocumentLibraryOpen] = useState(null);
  const [documentLibraryRows, setDocumentLibraryRows] = useState([]);
  const [documentLibraryLoading, setDocumentLibraryLoading] = useState(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const saveTimerRef = useRef(null);
  const draftRef = useRef(null);
  const dirtyRef = useRef(false);
  const exportPagesRef = useRef(null);
  const themeUploadTargetRef = useRef("");
  const blockImageUploadPurposeRef = useRef("image");
  const inclusionsInputRef = useRef(null);
  const modifiedInclusionsInputRef = useRef(null);
  const plansInputRef = useRef(null);
  const client = useMemo(
    () => clientPageValues(sheet),
    [sheet.workbook.clientPage, sheet.workbook.data, sheet.preview.summary.finalQuoteTotal, sheet.preview.summary.gst]
  );
  const linkedFields = useMemo(() => quoteProposalLinkedFields(sheet, client), [sheet, client]);
  const sourceBuilder = useMemo(
    () => normaliseQuoteProposalBuilder(sheet.workbook.clientPage?.proposalBuilder, client, sheet),
    [sheet.workbook.clientPage?.proposalBuilder, client]
  );
  const [builder, setBuilder] = useState(sourceBuilder);
  const orderedProposalPages = useMemo(() => orderedProjectEstimatePages(builder), [builder]);
  const activePage = orderedProposalPages.find((page) => page.id === activePageId) || orderedProposalPages[0] || builder.pages[0];
  const selectedBlock = activePage?.blocks?.find((block) => block.id === selectedBlockId) || null;
  const logoInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const estimateDocuments = builder.importedDocuments || {};
  const inclusionsDocument = estimateDocuments.inclusions || null;
  const pricedPlans = estimateDocuments.pricedPlans || { files: [], pages: [] };
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [baseTemplateConfirmOpen, setBaseTemplateConfirmOpen] = useState(false);
  const [isPlatformAdminUser, setIsPlatformAdminUser] = useState(false);
  const estimateProjectId = proposalProjectId(sheet)
    || sheet.workbook?.id
    || sheet.workbook?.jobId
    || sheet.workbook?.openedFileName
    || "";
  const instanceSync = useProjectEstimateInstanceSync({
    workspaceId,
    projectId: estimateProjectId,
    builder,
    setBuilder,
    dirtyRef,
    readonly,
    hydratePage: (pageShell) => hydrateProjectEstimatePageFromApi(pageShell, client, sheet),
  });

  useEffect(() => {
    if (instanceSync.status === "saving") setStatusMessage("Saving...");
    else if (instanceSync.status === "saved") setStatusMessage("Saved");
    else if (instanceSync.status === "save_failed") setStatusMessage(instanceSync.errorMessage || "Save failed");
    else if (instanceSync.status === "conflict") setStatusMessage(instanceSync.errorMessage || "Save conflict — reload to see the latest version.");
  }, [instanceSync.status, instanceSync.errorMessage]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setIsPlatformAdminUser(isDeveloperEmail(data?.user?.email || ""));
      })
      .catch(() => {
        if (!cancelled) setIsPlatformAdminUser(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    draftRef.current = builder;
  }, [builder]);

  useEffect(() => {
    if (dirtyRef.current) return;
    setBuilder(sourceBuilder);
    draftRef.current = sourceBuilder;
  }, [sourceBuilder]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activePageId && orderedProposalPages[0]?.id) setActivePageId(orderedProposalPages[0].id);
  }, [activePageId, orderedProposalPages]);

  useEffect(() => {
    if (activePage && selectedBlockId && !activePage.blocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId("");
    }
  }, [activePage, selectedBlockId]);

  useEffect(() => {
    setEditingBlockId("");
    setAddElementOpen(false);
  }, [activePage?.id, pageEditMode]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!pageEditMode || readonly) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoProjectEstimateEdit();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoProjectEstimateEdit();
        return;
      }
      if (!selectedBlock || editingBlockId) return;
      if (["Delete", "Backspace"].includes(event.key)) {
        event.preventDefault();
        if (isSubscriberProjectEstimateBlock(selectedBlock, activePage)) removeBlock(selectedBlock.id);
        else updateSelectedBlockDesign({ hidden: true, hiddenBySubscriber: true });
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      updateBlockDesign(selectedBlock.id, "frame", moveProposalFrame(selectedBlock.design?.frame, dx, dy));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageEditMode, readonly, selectedBlock?.id, selectedBlock?.design?.frame, editingBlockId, activePage?.id]);

  const persistBuilder = async (nextBuilder, { message = "Proposal autosaved.", fullWorkbookSaveTriggered = true } = {}) => {
    if (readonly) return;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const nextWorkbook = {
      ...sheet.workbook,
      clientPage: {
        ...(sheet.workbook.clientPage || {}),
        proposalBuilder: nextBuilder,
      },
    };
    sheet.updateClientPage("proposalBuilder", nextBuilder);
    if (fullWorkbookSaveTriggered) {
      await Promise.resolve(sheet.saveDraft?.(nextWorkbook));
    }
    dirtyRef.current = false;
    instanceSync.scheduleSave(nextBuilder);
    setStatusMessage(message);
    proposalPerfLog("save time", {
      ms: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 10) / 10,
      fullWorkbookSaveTriggered,
    });
  };

  const scheduleBuilderSave = (nextBuilder, message = "Proposal autosaved.") => {
    if (readonly) return;
    dirtyRef.current = true;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistBuilder(draftRef.current || nextBuilder, { message, fullWorkbookSaveTriggered: true }).catch((error) => {
        console.error("Quote proposal autosave failed", error);
        setStatusMessage("Save failed");
      });
    }, 1200);
  };

  const saveBuilder = (nextBuilder, message = "Proposal updated.") => {
    setBuilder(nextBuilder);
    draftRef.current = nextBuilder;
    setStatusMessage("Unsaved changes");
    scheduleBuilderSave(nextBuilder, message);
  };

  const saveBuilderImmediate = async (nextBuilder, message = "Proposal updated.") => {
    const updatedBuilder = { ...nextBuilder, updatedAt: new Date().toISOString() };
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setBuilder(updatedBuilder);
    draftRef.current = updatedBuilder;
    dirtyRef.current = false;
    await persistBuilder(updatedBuilder, { message, fullWorkbookSaveTriggered: true });
    return updatedBuilder;
  };

  const updateBuilder = (updater, message) => {
    const next = updater(draftRef.current || builder);
    saveBuilder({ ...next, updatedAt: new Date().toISOString() }, message);
  };

  const snapshotProjectEstimateBlock = (blockId) => {
    const currentBuilder = draftRef.current || builder;
    const page = (currentBuilder.pages || []).find((item) => item.id === activePage?.id);
    const block = page?.blocks?.find((item) => item.id === blockId);
    if (!page || !block) return null;
    return { pageId: page.id, blockId, block: cloneJson(block), capturedAt: Date.now() };
  };

  const pushProjectEstimateUndo = (blockId) => {
    const snapshot = snapshotProjectEstimateBlock(blockId);
    if (!snapshot) return;
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-80);
    redoStackRef.current = [];
  };

  const restoreProjectEstimateSnapshot = (snapshot, targetStackRef) => {
    if (!snapshot?.pageId || !snapshot?.blockId) return;
    const current = snapshotProjectEstimateBlock(snapshot.blockId);
    if (current) targetStackRef.current = [...targetStackRef.current, current].slice(-80);
    updateBuilder((builderState) => ({
      ...builderState,
      pages: (builderState.pages || []).map((page) => page.id === snapshot.pageId ? {
        ...page,
        blocks: (page.blocks || []).map((block) => block.id === snapshot.blockId ? cloneJson(snapshot.block) : block),
      } : page),
    }), "Undo saved.");
    setSelectedBlockId(snapshot.blockId);
  };

  const undoProjectEstimateEdit = () => {
    const snapshot = undoStackRef.current.pop();
    if (snapshot) restoreProjectEstimateSnapshot(snapshot, redoStackRef);
  };

  const redoProjectEstimateEdit = () => {
    const snapshot = redoStackRef.current.pop();
    if (snapshot) restoreProjectEstimateSnapshot(snapshot, undoStackRef);
  };

  const updatePage = (pageId, changes) => {
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === pageId ? { ...page, ...changes } : page),
    }), "Page saved.");
  };

  const updateBlock = (blockId, changes) => {
    const currentBlock = activePage.blocks.find((item) => item.id === blockId);
    if (currentBlock?.design?.locked && !Object.prototype.hasOwnProperty.call(changes || {}, "design")) return;
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: page.blocks.map((block) => block.id === blockId ? { ...block, ...changes } : block),
      } : page),
    }), "Block saved.");
  };

  const updateBlockContent = (blockId, key, value) => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latestPage = (draftRef.current || builder).pages?.find((page) => page.id === activePage?.id) || activePage;
    const pageType = latestPage?.page_type || latestPage?.id || "";
    const fallbackBlock = defaultProjectEstimateBlocks(pageType).find((item) => item.id === blockId) || null;
    const block = (latestPage?.blocks || []).find((item) => item.id === blockId) || fallbackBlock;
    if (block?.design?.locked) return;
    pushProjectEstimateUndo(blockId);
    const objectUpdatedAt = new Date().toISOString();
    updateBuilder((current) => ({
      ...current,
      theme: blockId === "cover-hero-image" && key === "imageUrl"
        ? { ...(current.theme || {}), heroImageUrl: value }
        : current.theme,
      pageRevisions: appendProjectEstimatePageRevision(current.pageRevisions || [], {
        pageId: activePage.page_type || activePage.id,
        templateVersion: PROJECT_ESTIMATE_TEMPLATE_VERSION,
        contentOverrides: projectEstimatePageContentOverrides(activePage),
        source: "editor",
      }),
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: [
          ...((page.blocks || []).some((item) => item.id === blockId) ? (page.blocks || []) : [...(page.blocks || []), fallbackBlock].filter(Boolean)),
        ].map((item) => item.id === blockId ? { ...item, objectUpdatedAt, objectRevision: Number(item.objectRevision || 0) + 1, content: { ...(item.content || {}), [key]: value } } : item),
      } : page),
    }), "Saved");
    proposalPerfLog("text edit latency", {
      ms: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 10) / 10,
      blockId,
      field: key,
      fullWorkbookSaveTriggered: false,
    });
  };

  const updateBlockDesign = (blockId, key, value) => {
    const latestPage = (draftRef.current || builder).pages?.find((page) => page.id === activePage?.id) || activePage;
    const pageType = latestPage?.page_type || latestPage?.id || "";
    const fallbackBlock = defaultProjectEstimateBlocks(pageType).find((item) => item.id === blockId) || null;
    const block = (latestPage?.blocks || []).find((item) => item.id === blockId) || fallbackBlock;
    if (block?.design?.locked && key !== "locked" && key !== "hidden") return;
    pushProjectEstimateUndo(blockId);
    const visualKeys = new Set(["fontFamily", "fontSize", "fontWeight", "fontStyle", "textDecoration", "color", "backgroundColor", "textAlign", "lineHeight", "letterSpacing", "padding", "borderRadius", "opacity", "objectFit", "zoom", "objectPositionX", "objectPositionY"]);
    const designUpdates = key && typeof key === "object" ? key : { [key]: value };
    const shouldFreezeFrame = Object.keys(designUpdates).some((item) => visualKeys.has(item)) && !block?.design?.frameEdited;
    const nextDesign = {
      ...(block?.design || {}),
      ...(shouldFreezeFrame ? { frame: normaliseProposalFrame(block?.design?.frame, block), frameEdited: true } : {}),
      ...designUpdates,
      ...(Object.prototype.hasOwnProperty.call(designUpdates, "frame") ? { frameEdited: true } : {}),
      ...(Object.keys(designUpdates).some((item) => visualKeys.has(item)) ? { styleEdited: true } : {}),
    };
    Object.entries(designUpdates).forEach(([designKey, designValue]) => {
      if (designValue === undefined) delete nextDesign[designKey];
    });
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: [
          ...((page.blocks || []).some((item) => item.id === blockId) ? (page.blocks || []) : [...(page.blocks || []), fallbackBlock].filter(Boolean)),
        ].map((item) => item.id === blockId ? { ...item, objectUpdatedAt: new Date().toISOString(), objectRevision: Number(item.objectRevision || 0) + 1, design: nextDesign } : item),
      } : page),
    }), "Block saved.");
  };

  const updateSelectedBlockDesign = (changes = {}) => {
    if (!selectedBlock) return;
    updateBlock(selectedBlock.id, { design: { ...(selectedBlock.design || {}), ...changes } });
  };

  const updateTheme = (changes) => {
    updateBuilder((current) => ({
      ...current,
      theme: { ...defaultLuxuryProposalTheme(client), ...(current.theme || {}), ...changes },
    }), "Proposal theme updated.");
  };

  const updateThemeStat = (index, key, value) => {
    const theme = { ...defaultLuxuryProposalTheme(client), ...(draftRef.current?.theme || builder.theme || {}) };
    const stats = [...(theme.stats || [])];
    stats[index] = { ...(stats[index] || {}), [key]: value };
    updateTheme({ stats });
  };

  const openThemeImageUpload = (target) => {
    themeUploadTargetRef.current = target;
    imageInputRef.current?.click();
  };

  const addBlock = (type) => {
    const nextBlock = {
      ...createProposalVisualElement(type, linkedFields, activePage?.blocks?.length || 0),
      pageType: activePage?.page_type || activePage?.id || "",
    };
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: [...page.blocks, nextBlock],
      } : page),
    }), "Block added.");
    setSelectedBlockId(nextBlock.id);
    setProjectEstimateInspectorTab("properties");
  };

  const removeBlock = (blockId) => {
    const block = activePage.blocks.find((item) => item.id === blockId);
    if (block?.design?.locked) return;
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: page.blocks.filter((block) => block.id !== blockId),
      } : page),
    }), "Block removed.");
  };

  const duplicateBlock = (blockId) => {
    const block = activePage.blocks.find((item) => item.id === blockId);
    if (!block || block.design?.locked) return;
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        blocks: page.blocks.flatMap((item) => item.id === blockId ? [item, { ...item, id: proposalBuilderId("block"), content: { ...item.content }, design: { ...item.design } }] : [item]),
      } : page),
    }), "Block duplicated.");
  };

  const moveBlock = (blockId, direction) => {
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const blocks = [...page.blocks];
        const index = blocks.findIndex((block) => block.id === blockId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return page;
        const [block] = blocks.splice(index, 1);
        blocks.splice(nextIndex, 0, block);
        return { ...page, blocks };
      }),
    }), "Block moved.");
  };

  const moveBlockLayer = (blockId, action) => {
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const blocks = [...page.blocks].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        const index = blocks.findIndex((block) => block.id === blockId);
        if (index < 0) return page;
        const [block] = blocks.splice(index, 1);
        const targetIndex = action === "front"
          ? blocks.length
          : action === "back"
            ? 0
            : clampNumber(index + Number(action || 0), 0, blocks.length);
        blocks.splice(targetIndex, 0, block);
        return { ...page, blocks: blocks.map((item, itemIndex) => ({ ...item, order: itemIndex })) };
      }),
    }), "Layer order updated.");
  };

  const moveBlockToIndex = (blockId, targetIndex) => {
    updateBuilder((current) => ({
      ...current,
      pages: current.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const blocks = [...page.blocks];
        const fromIndex = blocks.findIndex((block) => block.id === blockId);
        if (fromIndex < 0 || targetIndex < 0 || targetIndex >= blocks.length || fromIndex === targetIndex) return page;
        const [block] = blocks.splice(fromIndex, 1);
        blocks.splice(targetIndex, 0, block);
        return { ...page, blocks };
      }),
    }), "Block moved.");
  };

  const addProjectEstimatePage = () => {
    const page = createBuilderProjectEstimatePage(builder.pages?.length || 0);
    updateBuilder((current) => ({ ...current, pages: [...(current.pages || []), page] }), "Page added.");
    setActivePageId(page.id);
    setSelectedBlockId("");
  };

  const duplicateProjectEstimatePage = () => {
    if (!activePage) return;
    const page = {
      ...activePage,
      id: proposalBuilderId("page"),
      source: "builder-created",
      title: `${activePage.title || "Page"} Copy`,
      page_type: "builderCreated",
      blocks: (activePage.blocks || []).map((block, index) => ({
        ...block,
        id: proposalBuilderId("block"),
        source: "builder-created",
        pageType: "builderCreated",
        order: index,
        content: { ...(block.content || {}) },
        design: { ...(block.design || {}) },
      })),
    };
    updateBuilder((current) => {
      const pages = [...(current.pages || [])];
      const index = pages.findIndex((item) => item.id === activePage.id);
      pages.splice(index >= 0 ? index + 1 : pages.length, 0, page);
      return { ...current, pages };
    }, "Page duplicated.");
    setActivePageId(page.id);
    setSelectedBlockId("");
  };

  const renameProjectEstimatePage = () => {
    if (!activePage || typeof window === "undefined") return;
    const title = window.prompt("Page name", activePage.title || "Custom Page");
    if (!title) return;
    updatePage(activePage.id, { title });
  };

  const deleteProjectEstimatePage = () => {
    if (!activePage || activePage.source !== "builder-created") return;
    updateBuilder((current) => {
      const pages = (current.pages || []).filter((page) => page.id !== activePage.id);
      return { ...current, pages };
    }, "Page deleted.");
    setActivePageId("");
    setSelectedBlockId("");
  };

  const moveProjectEstimatePage = (direction) => {
    if (!activePage) return;
    updateBuilder((current) => {
      const pages = [...(current.pages || [])];
      const index = pages.findIndex((page) => page.id === activePage.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return current;
      const [page] = pages.splice(index, 1);
      pages.splice(nextIndex, 0, page);
      return { ...current, pages };
    }, "Page moved.");
  };

  const toggleProjectEstimatePageHidden = () => {
    if (!activePage) return;
    if (activePage.source !== "builder-created" && !window.confirm("Hide this approved page from the PDF?")) return;
    updatePage(activePage.id, { hiddenFromPdf: !activePage.hiddenFromPdf });
  };

  const restoreApprovedProjectEstimatePage = () => {
    if (!activePage) return;
    const pageType = activePage.page_type || activePage.id;
    const definition = projectEstimatePageDefinitionFor(pageType);
    if (!definition) return;
    if (typeof window !== "undefined" && !window.confirm("Restore this approved page to the approved template defaults?")) return;
    const restored = defaultQuoteProposalPage(pageType, client, sheet);
    updateBuilder((current) => ({
      ...current,
      pages: (current.pages || []).map((page) => page.id === activePage.id ? { ...restored, id: page.id, page_type: pageType } : page),
    }), "Approved page restored.");
    setSelectedBlockId("");
  };

  const uploadImageForBlock = async (event, purpose) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const imageLike = file?.type?.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(String(file?.name || ""));
    if (!file || !imageLike) return;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    setStatusMessage("Preparing image...");
    try {
      const url = await prepareProposalImageDataUrl(file, {
        maxDimension: purpose === "logo" ? 900 : 1800,
        quality: 0.84,
      });
      if (purpose === "theme") {
        const target = themeUploadTargetRef.current || "heroImageUrl";
        themeUploadTargetRef.current = "";
        updateTheme({ [target]: url });
      } else if (purpose === "background") {
        updatePage(activePage.id, { design: { ...activePage.design, backgroundImageUrl: url } });
      } else if (selectedBlock || selectedBlockId) {
        updateBlockContent(selectedBlock?.id || selectedBlockId, purpose === "logo" ? "logoUrl" : "imageUrl", url);
      }
      proposalPerfLog("image import", {
        ms: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 10) / 10,
        purpose,
        originalKb: Math.round(file.size / 102.4) / 10,
        storedKb: Math.round(url.length / 102.4) / 10,
      });
    } catch (error) {
      console.error("Proposal image import failed", error);
      setStatusMessage("Image could not be imported.");
      themeUploadTargetRef.current = "";
    }
  };

  const saveCurrentEstimateChanges = async (message = "Estimate changes saved.") => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setStatusMessage("Saving estimate changes...");
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const nextBuilder = { ...(draftRef.current || builder), updatedAt: new Date().toISOString() };
    const nextWorkbook = {
      ...sheet.workbook,
      clientPage: {
        ...(sheet.workbook.clientPage || {}),
        proposalBuilder: nextBuilder,
      },
    };
    sheet.updateClientPage("proposalBuilder", nextBuilder);
    dirtyRef.current = false;
    await Promise.resolve(sheet.saveDraft?.(nextWorkbook));
    await instanceSync.persistNow(nextBuilder);
    setStatusMessage(message);
    proposalPerfLog("save time", {
      ms: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 10) / 10,
      explicit: true,
      fullWorkbookSaveTriggered: true,
    });
  };

  // Applies a freshly-loaded/reset set of API pages onto the in-memory builder,
  // hydrating any page whose blocks are null (meaning "use compiled defaults")
  // via defaultQuoteProposalPage, then persists locally (not to the instance —
  // the instance is already the source of the pages we just applied).
  const applyApiPagesToBuilder = (apiPages, message) => {
    const hydratedPages = (apiPages || []).map((apiPage) => (
      hydrateProjectEstimatePageFromApi(ProjectEstimateApi.apiPageToBuilderPageShell(apiPage), client, sheet)
    ));
    const nextBuilder = { ...(draftRef.current || builder), pages: hydratedPages, updatedAt: new Date().toISOString() };
    setBuilder(nextBuilder);
    draftRef.current = nextBuilder;
    dirtyRef.current = false;
    sheet.updateClientPage("proposalBuilder", nextBuilder);
    setSelectedBlockId("");
    setEditingBlockId("");
    setStatusMessage(message);
  };

  const updateMyTemplate = async () => {
    const templateId = instanceSync.templateId;
    if (!workspaceId || !templateId) {
      setStatusMessage("Save this estimate at least once before updating a template.");
      return;
    }
    try {
      const template = await ProjectEstimateApi.getTemplate(workspaceId, templateId);
      if (template.isSystemDefault) {
        await saveAsNewSubscriberTemplate({ promptMessage: "The system default is protected — name your organisation's copy to edit it" });
        return;
      }
      if (typeof window !== "undefined" && !window.confirm(
        `Update "${template.templateName}"? This changes the template used by every future estimate created from it.`
      )) return;
      const nextBuilder = draftRef.current || builder;
      const pages = (nextBuilder.pages || []).map((page, index) => (
        ProjectEstimateApi.builderPageToApiPage(page, index, nextBuilder.importedDocuments)
      ));
      await ProjectEstimateApi.updateTemplate(workspaceId, templateId, {
        pages,
        createVersionSnapshot: true,
        versionLabel: "Updated from estimate editor",
      });
      setStatusMessage("My template updated.");
    } catch (error) {
      setStatusMessage(error?.message || "Could not update template.");
    }
  };

  const projectEstimateBaseTemplateForbiddenValues = () => {
    const keys = [
      "projectName",
      "clientName",
      "projectAddress",
      "jobNumber",
      "quoteNumber",
      "quoteDate",
      "quoteTotal",
      "engineering",
      "estimatedDuration",
      "estimatedStart",
    ];
    return keys
      .map((key) => linkedFields[key]?.value)
      .filter((value) => typeof value === "string" && value.trim() && value !== "Not entered");
  };

  const projectEstimateBaseTemplateSettings = (sourceBuilder) => {
    const theme = { ...(sourceBuilder.theme || {}) };
    delete theme.clientNameOverride;
    delete theme.siteAddressOverride;
    delete theme.projectNameOverride;
    delete theme.quoteNumberOverride;
    delete theme.quoteDateOverride;
    return {
      ...(sourceBuilder.settings || {}),
      theme,
      templateType: "project_estimate",
      sourceTemplateVersion: PROJECT_ESTIMATE_TEMPLATE_VERSION,
      importSlots: {
        inclusions: { pageType: "standardInclusions", mode: "placeholder" },
        plans: { pageType: "pricedPlans", mode: "placeholder" },
      },
    };
  };

  const updateSystemBaseTemplate = async () => {
    if (!workspaceId) {
      setStatusMessage("A workspace is required before updating the base template.");
      return;
    }
    setBaseTemplateConfirmOpen(false);
    setStatusMessage("Updating Project Estimate base template...");
    try {
      if (typeof document !== "undefined" && document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      const nextBuilder = draftRef.current || builder;
      const pages = (nextBuilder.pages || []).map((page, index) => ({
        ...ProjectEstimateApi.builderPageToApiPage(page, index, {}),
        importedDocument: null,
      }));
      const sourceAudit = ProjectEstimateApi.auditProjectEstimateBaseTemplatePayload({
        pages,
        pageOrder: pages.map((page) => page.pageKey),
        settings: projectEstimateBaseTemplateSettings(nextBuilder),
        forbiddenProjectValues: projectEstimateBaseTemplateForbiddenValues(),
      });
      console.info("[project-estimate base-template] source payload audit before compact serialization", sourceAudit);
      const result = await ProjectEstimateApi.updateSystemBaseTemplate(workspaceId, {
        pages,
        pageOrder: pages.map((page) => page.pageKey),
        settings: projectEstimateBaseTemplateSettings(nextBuilder),
        forbiddenProjectValues: projectEstimateBaseTemplateForbiddenValues(),
      });
      setStatusMessage(`${result.message}${result.version ? ` Version ${result.version}.` : ""}`);
    } catch (error) {
      setStatusMessage(error?.message || "Update failed.");
    }
  };

  const resetToMyTemplate = async () => {
    const templateId = instanceSync.templateId;
    if (!workspaceId || !instanceSync.instanceId || !templateId) return;
    if (typeof window !== "undefined" && !window.confirm("Discard unsaved changes and reload this estimate from its linked template?")) return;
    try {
      const instance = await ProjectEstimateApi.resetInstanceToTemplate(workspaceId, instanceSync.instanceId, templateId);
      applyApiPagesToBuilder(instance.pages, "Reset to your saved template.");
    } catch (error) {
      setStatusMessage(error?.message || "Could not reset to template.");
    }
  };

  const resetToSystemDefault = async () => {
    if (!workspaceId || !instanceSync.instanceId) return;
    if (typeof window !== "undefined" && !window.confirm("Reset this estimate to the protected system default template? This cannot be undone.")) return;
    try {
      const templates = await ProjectEstimateApi.listTemplates(workspaceId);
      const systemDefault = templates.find((template) => template.isSystemDefault);
      if (!systemDefault) throw new Error("System default template not found.");
      const instance = await ProjectEstimateApi.resetInstanceToTemplate(workspaceId, instanceSync.instanceId, systemDefault.id);
      instanceSync.setTemplateId(systemDefault.id);
      applyApiPagesToBuilder(instance.pages, "Reset to system default template.");
    } catch (error) {
      setStatusMessage(error?.message || "Could not reset to system default.");
    }
  };

  const uploadProposalPdf = async (file, sourceType) => {
    const selectedPdf = await validateSelectedPdfFile(file);
    if (!selectedPdf.ok) {
      setStatusMessage(selectedPdf.error);
      return null;
    }
    setStatusMessage("Uploading PDF...");
    const metadataResult = await readProposalPdfMetadata(file)
      .then((metadata) => ({ ok: true, metadata }))
      .catch(async (error) => {
        const repaired = await repairPdfFile(file).catch(() => null);
        if (!repaired?.file) {
          return { ok: false, error: error?.message || "The selected file is not a valid PDF" };
        }
        try {
          const metadata = await readProposalPdfMetadata(repaired.file);
          return { ok: true, metadata, file: repaired.file };
        } catch (repairError) {
          return { ok: false, error: repairError?.message || error?.message || "The selected file is not a valid PDF" };
        }
      });
    if (!metadataResult.ok) {
      setStatusMessage(metadataResult.error || "The selected file is not a valid PDF");
      return null;
    }
    const uploadFile = metadataResult.file || file;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const form = new FormData();
    form.append("file", uploadFile, uploadFile.name || file.name || "document.pdf");
    form.append("sourceType", sourceType);
    form.append("workspaceId", workspaceId || "");
    form.append("projectId", sheet.workbook?.commercialProjectId || sheet.workbook?.projectId || "");
    form.append("estimateId", sheet.workbook?.estimateSnapshotId || sheet.workbook?.id || "");
    form.append("metadata", JSON.stringify(metadataResult.metadata));
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch("/api/builders/proposal-document-upload", {
      method: "POST",
      headers,
      body: form,
    });
    const responseType = response.headers.get("content-type") || "";
    if (!responseType.includes("application/json")) {
      const body = await response.text().catch(() => "");
      setStatusMessage(responseType.includes("text/html")
        ? "The upload returned JSON/HTML instead of a PDF"
        : `The upload returned ${responseType || "an unknown response type"} instead of JSON.`);
      console.error("Unexpected PDF upload response", { status: response.status, responseType, body: body.slice(0, 500) });
      return null;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      setStatusMessage(payload.error || `PDF upload failed with HTTP ${response.status}.`);
      return null;
    }
    const uploadedPdf = await validateUploadedPdfDocument(payload.document);
    if (!uploadedPdf.ok) {
      setStatusMessage(uploadedPdf.error);
      return null;
    }
    return payload.document;
  };

  const importInclusionsPdf = async (event, sourceType = "standard_inclusions") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const document = await uploadProposalPdf(file, sourceType);
      if (!document) return;
      await saveBuilderImmediate(replaceActiveInclusionsDocument(draftRef.current || builder, document, sourceType), "Inclusions schedule imported.");
      setStatusMessage("Inclusions schedule imported.");
    } catch (error) {
      console.error("Inclusions import failed", error);
      setStatusMessage(error?.message || "Inclusions import failed.");
    }
  };

  const importPlanPdfs = async (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === "application/pdf");
    event.target.value = "";
    if (!files.length) return;
    try {
      const document = await uploadProposalPdf(files[0], "priced_plans");
      if (!document) return;
      const nextPages = (document.pages || []).map((page, index) => ({
        ...page,
        documentId: document.id,
        fileName: document.fileName,
        publicUrl: document.publicUrl,
        storagePath: document.storagePath,
        sourceType: "priced_plans",
        order: index + 1,
      }));
      await saveBuilderImmediate({
        ...(draftRef.current || builder),
        importedDocuments: {
          ...((draftRef.current || builder).importedDocuments || {}),
          pricedPlans: { ...document, pages: nextPages, importedAt: new Date().toISOString() },
        },
      }, "Concept plans PDF imported.");
      setStatusMessage("Concept plans PDF imported.");
    } catch (error) {
      console.error("Plan import failed", error);
      setStatusMessage(error?.message || "Plan import failed.");
    }
  };

  const removeInclusionsDocument = async () => {
    const activeDocument = (draftRef.current || builder).importedDocuments?.inclusions || null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      if (activeDocument?.id || activeDocument?.storagePath) {
        const response = await fetch("/api/builders/proposal-document-remove", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            documentId: activeDocument.id || "",
            storagePath: activeDocument.storagePath || "",
            workspaceId: workspaceId || "",
            projectId: proposalProjectId(sheet),
            removeAllProjectInclusions: true,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not remove inclusions schedule.");
      }
      await saveBuilderImmediate(clearActiveInclusionsDocument(draftRef.current || builder), "Inclusions schedule removed completely.");
      setStatusMessage("Inclusions schedule removed completely.");
    } catch (error) {
      console.error("Inclusions removal failed", error);
      setStatusMessage(error?.message || "Inclusions removal failed.");
    }
  };

  const removePlansDocument = async () => {
    const nextBuilder = {
      ...(draftRef.current || builder),
      importedDocuments: { ...((draftRef.current || builder).importedDocuments || {}), pricedPlans: null },
    };
    await saveBuilderImmediate(nextBuilder, "Plans removed.");
    setStatusMessage("Plans removed.");
  };

  const exportMergedProposalPdf = async () => {
    setStatusMessage("Preparing PDF...");
    try {
      const rawBuilder = draftRef.current || builder;
      const rawInclusionsCheck = validateActiveInclusionsState(rawBuilder.importedDocuments || {});
      if (!rawInclusionsCheck.ok) throw new Error(rawInclusionsCheck.error);
      if (rawInclusionsCheck.legacyFound) {
        throw new Error("Legacy inclusions schedule data was found. Remove the existing schedule completely, then upload the correct schedule again.");
      }
      const exportBuilder = {
        ...rawBuilder,
        importedDocuments: normaliseProposalImportedDocuments(rawBuilder.importedDocuments || {}),
      };
      const inclusionsCheck = validateActiveInclusionsState(exportBuilder.importedDocuments || {});
      if (!inclusionsCheck.ok) throw new Error(inclusionsCheck.error);
      await saveBuilderImmediate(exportBuilder, "Latest estimate pack saved for PDF export.");
      console.info("[Project Estimate PDF export] active inclusions", {
        fileName: inclusionsCheck.document?.fileName || "",
        publicUrl: inclusionsCheck.document?.publicUrl || "",
        storagePath: inclusionsCheck.document?.storagePath || "",
        fileHash: inclusionsCheck.document?.fileHash || "",
        version: inclusionsCheck.document?.version || "",
        pageCount: inclusionsCheck.document?.pageCount || 0,
        projectId: proposalProjectId(sheet),
        legacyInclusionsFound: inclusionsCheck.legacyFound,
      });
      const exportPayload = buildProjectEstimateExportPayload({
        builder: exportBuilder,
        sheet,
        workspaceId,
        linkedFields,
      });
      const requestBody = JSON.stringify(exportPayload);
      assertProjectEstimateExportPayloadIsSmall(exportPayload);
      console.info("[Project Estimate PDF export] small export payload", {
        byteLength: new Blob([requestBody]).size,
        payloadKeys: Object.keys(exportPayload),
        pageCount: exportPayload.pageOrder.length,
        importedDocuments: exportPayload.importedDocumentReferences,
      });
      validateProjectEstimateExportBounds(exportPagesRef.current);
      const renderedPages = await renderProposalPagesForPdf(exportPagesRef.current);
      const mergeWarnings = [];
      const blob = await createProposalPdfBlobFromProjectEstimate({
        renderedPages,
        importedDocuments: exportBuilder.importedDocuments || {},
        onWarning: (message) => mergeWarnings.push(message),
      });
      const downloadName = proposalPdfFileName(sheet, exportBuilder);
      downloadBlob(blob, downloadName);
      setStatusMessage(mergeWarnings.length ? `${mergeWarnings.join(" ")} The remainder of the Project Estimate has been generated successfully.` : "PDF downloaded.");
    } catch (error) {
      console.error("Merged PDF export failed", error);
      setStatusMessage("PDF export could not be completed. Your estimate has not been changed. Please try again.");
    }
  };

  const openBlockImageUpload = (purpose = "image") => {
    blockImageUploadPurposeRef.current = purpose;
    if (purpose === "logo") logoInputRef.current?.click();
    else imageInputRef.current?.click();
  };

  const openProjectEstimateMediaLibrary = async () => {
    setMediaLibraryOpen(true);
    setMediaLibraryLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      if (!token) throw new Error("Sign in to use the Media Library.");
      const response = await fetch("/api/assets/list-library?includeEmailTemplateRefs=0", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load Media Library.");
      setMediaLibraryAssets([...(payload.images || [])].filter((asset) => asset?.src || asset?.url || asset?.publicUrl));
    } catch (error) {
      setStatusMessage(error?.message || "Could not load Media Library.");
      setMediaLibraryAssets([]);
    } finally {
      setMediaLibraryLoading(false);
    }
  };

  const selectProjectEstimateMediaAsset = (asset) => {
    if (!selectedBlock) return;
    const src = asset?.src || asset?.url || asset?.publicUrl || "";
    if (!src) return;
    updateBlockContent(selectedBlock.id, selectedBlock.type === "logo" ? "logoUrl" : "imageUrl", src);
    setMediaLibraryOpen(false);
  };

  const saveAsNewSubscriberTemplate = async (options = {}) => {
    if (!workspaceId) {
      setStatusMessage("Join a workspace before saving a Project Estimate template.");
      return;
    }
    const timestamp = new Date().toISOString();
    const templateName = typeof window !== "undefined"
      ? window.prompt(options.promptMessage || "Template name", `My Project Estimate ${formatShortDateTime(timestamp)}`)
      : "";
    if (typeof window !== "undefined" && !templateName) return;
    const nextBuilder = draftRef.current || builder;
    const pages = (nextBuilder.pages || []).map((page, index) => (
      ProjectEstimateApi.builderPageToApiPage(page, index, nextBuilder.importedDocuments)
    ));
    try {
      const { template } = await ProjectEstimateApi.createTemplate(workspaceId, {
        templateName,
        basedOn: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.id,
        basedOnVersion: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.version,
        pageOrder: pages.map((page) => page.pageKey),
        pages,
      });
      instanceSync.setTemplateId(template.id);
      if (instanceSync.instanceId) {
        await ProjectEstimateApi.saveInstance(workspaceId, instanceSync.instanceId, { templateId: template.id });
      }
      setStatusMessage(`Saved as "${template.templateName}".`);
    } catch (error) {
      setStatusMessage(error?.message || "Could not save template.");
    }
  };

  const openAiRewriteForSelectedBlock = () => {
    if (!selectedBlock) return;
    setAiRewriteInstruction("Make clearer");
    setAiRewritePreview(projectEstimateAiRewriteText(projectEstimateBlockRawTextValue(selectedBlock), "Make clearer", client));
    setAiRewriteOpen(true);
  };

  const refreshAiRewritePreview = (instruction = aiRewriteInstruction) => {
    if (!selectedBlock) return;
    setAiRewritePreview(projectEstimateAiRewriteText(projectEstimateBlockRawTextValue(selectedBlock), instruction, client));
  };

  const applyAiRewritePreview = () => {
    if (!selectedBlock || !aiRewritePreview) return;
    updateBlockContent(selectedBlock.id, projectEstimateEditorContentKey(selectedBlock), aiRewritePreview);
    setAiRewriteOpen(false);
  };

  const openReferencedPdfDocument = (document) => {
    const url = referencedPdfUrl(document);
    if (!url || typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openDocumentLibrary = async (sourceType) => {
    setDocumentLibraryOpen(sourceType);
    setDocumentLibraryLoading(true);
    try {
      if (!workspaceId) throw new Error("Choose an active workspace first.");
      const dbTypes = sourceType === "priced_plans" ? ["general"] : ["other", "general"];
      const { data, error } = await supabase
        .from("builder_project_documents")
        .select("id, title, file_name, storage_path, public_url, document_type, metadata, status, created_at")
        .eq("workspace_id", workspaceId)
        .in("document_type", dbTypes)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      setDocumentLibraryRows(data || []);
    } catch (error) {
      setStatusMessage(error?.message || "Could not load document library.");
      setDocumentLibraryRows([]);
    } finally {
      setDocumentLibraryLoading(false);
    }
  };

  const selectLibraryDocument = async (row) => {
    const sourceType = documentLibraryOpen;
    setDocumentLibraryOpen(null);
    if (!row?.public_url) {
      setStatusMessage("Selected document has no accessible file URL.");
      return;
    }
    const pageCount = Number(row.metadata?.pageCount || 1) || 1;
    const pageOrientations = Array.isArray(row.metadata?.pageOrientation) ? row.metadata.pageOrientation : [];
    const pageRotations = Array.isArray(row.metadata?.pageRotation) ? row.metadata.pageRotation : [];
    const pageSizes = Array.isArray(row.metadata?.pageSizes) ? row.metadata.pageSizes : [];
    const document = {
      id: row.id,
      fileName: row.file_name || row.title || "Library document.pdf",
      title: row.title || row.file_name || "Library document",
      publicUrl: row.public_url,
      storagePath: row.storage_path || "",
      sourceType,
      status: row.status || "active",
      active: true,
      fileHash: row.metadata?.fileHash || "",
      version: row.metadata?.version || row.metadata?.fileVersion || "",
      projectId: row.metadata?.projectId || "",
      estimateId: row.metadata?.estimateId || "",
      pageCount,
      pages: Array.from({ length: pageCount }, (_, index) => ({
        pageNumber: index + 1,
        order: index + 1,
        orientation: pageOrientations[index] || "portrait",
        rotation: Number(pageRotations[index] || 0),
        metadataRotation: Number(pageRotations[index] || 0),
        width: Number(pageSizes[index]?.width || 595),
        height: Number(pageSizes[index]?.height || 842),
      })),
    };
    if (sourceType === "priced_plans") {
      await saveBuilderImmediate({
        ...(draftRef.current || builder),
        importedDocuments: {
          ...((draftRef.current || builder).importedDocuments || {}),
          pricedPlans: {
            ...document,
            pages: document.pages.map((page, index) => ({ ...page, documentId: document.id, fileName: document.fileName, publicUrl: document.publicUrl, storagePath: document.storagePath, order: index + 1 })),
          },
        },
      }, "Library concept plans inserted.");
    } else {
      await saveBuilderImmediate(replaceActiveInclusionsDocument(draftRef.current || builder, document, sourceType || "standard_inclusions"), "Library inclusions inserted.");
    }
  };

  return (
    <div style={styles.proposalBuilderShell}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .proposal-builder-print, .proposal-builder-print * { visibility: visible; }
          .proposal-builder-print { position: absolute; inset: 0; width: 100%; background: #e5e7eb; }
          .proposal-builder-tools, .proposal-builder-sidebar, .proposal-builder-panel { display: none !important; }
          .proposal-builder-page { break-after: page; page-break-after: always; box-shadow: none !important; border-radius: 0 !important; margin: 0 auto 20px !important; }
          .proposal-builder-page-landscape { size: A4 landscape; width: 297mm !important; height: 210mm !important; }
        }
      `}</style>
      <div className="proposal-builder-tools" style={styles.proposalBuilderToolbar}>
        <strong>Estimate Pack</strong>
        <button style={pageEditMode ? styles.primaryButton : styles.secondaryButton} disabled={readonly} onClick={() => {
          setPageEditMode((current) => !current);
          setSelectedBlockId("");
          setEditingBlockId("");
          setAddElementOpen(false);
        }}>{pageEditMode ? "Done Editing" : "Edit Page"}</button>
        <button style={styles.secondaryButton} disabled={readonly} onClick={() => saveCurrentEstimateChanges("Estimate changes saved.")}>Save Changes to This Estimate</button>
        <button style={styles.secondaryButton} disabled={readonly} onClick={saveAsNewSubscriberTemplate}>Save as My Template</button>
        <button style={styles.secondaryButton} disabled={readonly} onClick={updateMyTemplate}>Update My Template</button>
        {isPlatformAdminUser ? (
          <button style={styles.secondaryButton} disabled={readonly} onClick={() => setBaseTemplateConfirmOpen(true)}>Update Base Template</button>
        ) : null}
        <button style={styles.secondaryButton} disabled={readonly} onClick={resetToMyTemplate}>Reset</button>
        <button style={styles.secondaryButton} onClick={exportMergedProposalPdf}>Download PDF</button>
      </div>
      {baseTemplateConfirmOpen ? (
        <div style={styles.projectEstimateAdminModalOverlay} onMouseDown={() => setBaseTemplateConfirmOpen(false)}>
          <div style={styles.projectEstimateAdminModal} onMouseDown={(event) => event.stopPropagation()}>
            <strong>Update Project Estimate Base Template?</strong>
            <p>
              This will replace the default Project Estimate template used when new organisation templates and new project estimates are created.
              Existing saved project estimates and existing subscriber templates will not be changed.
            </p>
            <div style={styles.projectEstimateAdminModalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setBaseTemplateConfirmOpen(false)}>Cancel</button>
              <button type="button" style={styles.primaryButton} onClick={updateSystemBaseTemplate}>Update Base Template</button>
            </div>
          </div>
        </div>
      ) : null}
      {templateManagerOpen ? (
        <ProjectEstimateTemplateManager
          workspaceId={workspaceId}
          currentTemplateId={instanceSync.templateId}
          onClose={() => setTemplateManagerOpen(false)}
          onSelectTemplate={async (templateId) => {
            if (!instanceSync.instanceId) return;
            try {
              const instance = await ProjectEstimateApi.resetInstanceToTemplate(workspaceId, instanceSync.instanceId, templateId);
              instanceSync.setTemplateId(templateId);
              applyApiPagesToBuilder(instance.pages, "Switched to selected template.");
              setTemplateManagerOpen(false);
            } catch (error) {
              setStatusMessage(error?.message || "Could not switch template.");
            }
          }}
        />
      ) : null}
      {versionHistoryOpen && instanceSync.templateId ? (
        <ProjectEstimateVersionHistoryPanel
          workspaceId={workspaceId}
          templateId={instanceSync.templateId}
          onClose={() => setVersionHistoryOpen(false)}
          onRestored={() => {
            setStatusMessage("Template version restored. Use \"Reset to My Template\" to load it into this estimate.");
            setVersionHistoryOpen(false);
          }}
        />
      ) : null}
      {statusMessage ? <div style={styles.proposalBuilderStatus}>{statusMessage}</div> : null}
      <div style={styles.proposalBuilderLayout}>
          <aside className="proposal-builder-sidebar" style={styles.proposalBuilderSidebar}>
            <h3>Pages</h3>
            {orderedProposalPages.map((page) => (
              <button
                key={page.id}
                style={{ ...styles.proposalPageListButton, ...(activePage.id === page.id ? styles.proposalPageListButtonActive : {}) }}
                onClick={() => setActivePageId(page.id)}
              >
                <span>{page.title}</span>
                <small>{page.page_type}</small>
                <ProjectEstimatePageAttachmentLabel page={page} importedDocuments={builder.importedDocuments || {}} />
              </button>
            ))}
            <ProposalImportSidebarStatus
              page={activePage}
              inclusionsDocument={inclusionsDocument}
              pricedPlans={pricedPlans}
              editing={!readonly}
              onInsertStandard={() => inclusionsInputRef.current?.click()}
              onInsertModified={() => modifiedInclusionsInputRef.current?.click()}
              onInsertPlans={() => plansInputRef.current?.click()}
              onReplaceInclusions={() => inclusionsInputRef.current?.click()}
              onRemoveInclusions={removeInclusionsDocument}
              onReplacePlans={() => plansInputRef.current?.click()}
              onRemovePlans={removePlansDocument}
              onViewDocument={openReferencedPdfDocument}
              onOpenLibrary={openDocumentLibrary}
            />
            <div style={styles.proposalThemeHint}>
              <strong>Client document pages</strong>
              <span>Download PDF exports the same rendered pages shown in this editor.</span>
            </div>
          </aside>
        <main className="proposal-builder-print" style={styles.proposalBuilderCanvas}>
          {isProposalImportPage(activePage) ? (
            <ProposalImportedDocumentPage
              key={activePage.id}
              page={activePage}
              inclusionsDocument={inclusionsDocument}
              pricedPlans={pricedPlans}
              editing={pageEditMode && !readonly}
              onInsertStandard={() => inclusionsInputRef.current?.click()}
              onInsertModified={() => modifiedInclusionsInputRef.current?.click()}
              onInsertPlans={() => plansInputRef.current?.click()}
              onReplaceInclusions={() => inclusionsInputRef.current?.click()}
              onRemoveInclusions={removeInclusionsDocument}
              onReplacePlans={() => plansInputRef.current?.click()}
              onRemovePlans={removePlansDocument}
              onOpenLibrary={openDocumentLibrary}
            />
          ) : (
            <ProjectEstimateApprovedPage
              key={activePage.id}
              page={activePage}
              theme={builder.theme}
              linkedFields={linkedFields}
              Brochure={EstimateInclusionsBrochure}
              editMode={pageEditMode && !readonly}
              selectedBlockId={selectedBlockId}
              editingBlockId={editingBlockId}
              onSelectBlock={setSelectedBlockId}
              onEditBlock={setEditingBlockId}
              onTextCommit={updateBlockContent}
              onBlockDesign={updateBlockDesign}
              onReplaceImage={(block) => {
                setSelectedBlockId(block?.id || "");
                blockImageUploadPurposeRef.current = block?.type === "logo" ? "logo" : "image";
                imageInputRef.current?.click();
              }}
              onDuplicateBlock={duplicateBlock}
              onDeleteBlock={removeBlock}
              onMoveBlockLayer={moveBlockLayer}
            />
          )}
          <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={(event) => uploadImageForBlock(event, "logo")} />
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp, image/svg+xml" style={{ display: "none" }} onChange={(event) => uploadImageForBlock(event, themeUploadTargetRef.current ? "theme" : blockImageUploadPurposeRef.current || "image")} />
          <input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(event) => uploadImageForBlock(event, "background")} />
          <input ref={inclusionsInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(event) => importInclusionsPdf(event, "standard_inclusions")} />
          <input ref={modifiedInclusionsInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(event) => importInclusionsPdf(event, "modified_inclusions")} />
          <input ref={plansInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={importPlanPdfs} />
          </main>
      </div>
      <div ref={exportPagesRef} style={styles.proposalExportSource} aria-hidden="true">
        {orderedProposalPages.filter((page) => !page.hiddenFromPdf).map((page) => (
          <div
            key={`export-${page.id}`}
            data-proposal-export-page="true"
            data-orientation={proposalPageOrientation(page)}
            data-page-type={page.page_type || ""}
            data-page-id={page.page_type || page.id || ""}
            data-source-file={page.importedDocument?.fileName || page.importedDocument?.title || ""}
            data-source-path={page.importedDocument?.storagePath || page.importedDocument?.publicUrl || ""}
            data-source-page-number={page.importedPageNumber || page.importedDocument?.pageNumber || ""}
          >
            <ProjectEstimateApprovedPage
              page={page}
              theme={builder.theme}
              linkedFields={linkedFields}
              Brochure={EstimateInclusionsBrochure}
            />
          </div>
        ))}
      </div>
      {documentLibraryOpen ? (
        <ProposalDocumentLibraryModal
          rows={documentLibraryRows}
          loading={documentLibraryLoading}
          onClose={() => setDocumentLibraryOpen(null)}
          onSelect={selectLibraryDocument}
        />
      ) : null}
      {mediaLibraryOpen ? (
        <ProjectEstimateMediaLibraryModal
          assets={mediaLibraryAssets}
          loading={mediaLibraryLoading}
          onClose={() => setMediaLibraryOpen(false)}
          onSelect={selectProjectEstimateMediaAsset}
        />
      ) : null}
      {aiRewriteOpen ? (
        <ProjectEstimateAiRewriteModal
          instruction={aiRewriteInstruction}
          preview={aiRewritePreview}
          onInstruction={(instruction) => {
            setAiRewriteInstruction(instruction);
            refreshAiRewritePreview(instruction);
          }}
          onTryAgain={() => refreshAiRewritePreview()}
          onReplace={applyAiRewritePreview}
          onClose={() => setAiRewriteOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LuxuryProposalThemePanel({ theme, linkedFields, readonly, onThemeChange, onThemeStatChange, onUploadImage }) {
  const resolvedTheme = { ...defaultLuxuryProposalTheme({}), ...(theme || {}) };
  return (
    <div style={styles.proposalPropertiesStack}>
      <h3>Luxury Residential Theme</h3>
      <div style={styles.proposalThemeLinkedBox}>
        <strong>Workbook linked fields</strong>
        <span>Client: {linkedFields.clientName?.value || "Not entered"}</span>
        <span>Site: {linkedFields.projectAddress?.value || "Not entered"}</span>
        <span>Builder: {linkedFields.companyName?.value || "Not entered"}</span>
        <span>Quote: {linkedFields.quoteNumber?.value || "Not entered"} / {linkedFields.quoteDate?.value || "Not entered"}</span>
      </div>
      <ProposalPanelColor label="Accent colour" value={resolvedTheme.accentColor} disabled={readonly} onChange={(value) => onThemeChange({ accentColor: value })} />
      <button style={styles.secondaryButton} disabled={readonly} onClick={() => onUploadImage("logoUrl")}>Change logo</button>
      <button style={styles.secondaryButton} disabled={readonly} onClick={() => onUploadImage("heroImageUrl")}>Change cover hero image</button>
      <button style={styles.secondaryButton} disabled={readonly} onClick={() => onUploadImage("aboutImageUrl")}>Change About image</button>
      <button style={styles.secondaryButton} disabled={readonly} onClick={() => onUploadImage("designImageUrl")}>Change Scope / Design image</button>
      <button style={styles.secondaryButton} disabled={readonly} onClick={() => onUploadImage("thankYouImageUrl")}>Change Thank You image</button>
      <ProposalPanelInput label="Client name override" value={resolvedTheme.clientNameOverride || ""} disabled={readonly} onCommit={(value) => onThemeChange({ clientNameOverride: value })} />
      <ProposalPanelTextarea label="Site address override" value={resolvedTheme.siteAddressOverride || ""} disabled={readonly} onCommit={(value) => onThemeChange({ siteAddressOverride: value })} />
      <ProposalPanelTextarea label="Company story" value={resolvedTheme.companyStory || ""} disabled={readonly} onCommit={(value) => onThemeChange({ companyStory: value })} />
      <ProposalPanelTextarea label="Testimonial" value={resolvedTheme.testimonial || ""} disabled={readonly} onCommit={(value) => onThemeChange({ testimonial: value })} />
      <ProposalPanelTextarea label="Design notes" value={resolvedTheme.designNotes || ""} disabled={readonly} onCommit={(value) => onThemeChange({ designNotes: value })} />
      <ProposalPanelTextarea label="Thank you message" value={resolvedTheme.thankYouMessage || ""} disabled={readonly} onCommit={(value) => onThemeChange({ thankYouMessage: value })} />
      <h3>Stats</h3>
      {(resolvedTheme.stats || []).slice(0, 4).map((stat, index) => (
        <div key={`stat-${index}`} style={styles.proposalStatEditor}>
          <ProposalPanelInput label={`Stat ${index + 1} number`} value={stat.value || ""} disabled={readonly} onCommit={(value) => onThemeStatChange(index, "value", value)} />
          <ProposalPanelInput label={`Stat ${index + 1} label`} value={stat.label || ""} disabled={readonly} onCommit={(value) => onThemeStatChange(index, "label", value)} />
        </div>
      ))}
    </div>
  );
}

function isProposalImportPage(page = {}) {
  return ["standardInclusions", "pricedPlans", "importedInclusionsPdf", "importedPlanPdf"].includes(page.page_type);
}

function orderedProjectEstimatePages(builder = {}) {
  const pages = Array.isArray(builder.pages) ? builder.pages : [];
  const byType = new Map();
  pages.forEach((page) => {
    const pageType = page?.page_type || page?.id || "";
    if (pageType && !byType.has(pageType)) byType.set(pageType, page);
  });
  return PROJECT_ESTIMATE_EXPORT_ORDER
    .map((item) => {
      const pageId = item.type === "documentSlot" ? item.placeholderPageId : item.pageId;
      return byType.get(pageId) || defaultQuoteProposalPage(pageId, {}, {});
    })
    .filter((page) => page && projectEstimatePageDefinitionFor(page.page_type || page.id))
    .concat(pages.filter((page) => page?.source === "builder-created"));
}

function expandProposalPagesForImportedDocuments(pages = [], importedDocuments = {}, { editing = false } = {}) {
  const inclusions = importedDocuments.inclusions || null;
  const planPages = Array.isArray(importedDocuments.pricedPlans?.pages) ? importedDocuments.pricedPlans.pages : [];
  return (pages || []).flatMap((page) => {
    if (page.page_type === "standardInclusions") {
      if (!inclusions?.publicUrl) return editing ? [page] : [];
      const count = Number(inclusions.pageCount || inclusions.pages?.length || 1) || 1;
      const importedPages = Array.from({ length: count }, (_, index) => ({
        ...page,
        id: `imported-inclusions-${inclusions.id || "doc"}-${index + 1}`,
        page_type: "importedInclusionsPdf",
        title: `Standard Inclusions Schedule ${index + 1}`,
        importedDocument: {
          ...(inclusions.pages?.[index] || {}),
          documentId: inclusions.id,
          fileName: inclusions.fileName,
          publicUrl: inclusions.publicUrl,
          storagePath: inclusions.storagePath,
        },
        importedPageNumber: index + 1,
      }));
      return importedPages;
    }
    if (page.page_type === "pricedPlans") {
      if (!planPages.length) return editing ? [page] : [];
      const importedPages = planPages.map((planPage, index) => ({
        ...page,
        id: `imported-plan-${planPage.documentId || "doc"}-${planPage.pageNumber || index + 1}-${index}`,
        page_type: "importedPlanPdf",
        title: `Priced Plan ${index + 1}`,
        importedDocument: planPage,
        importedPageNumber: planPage.pageNumber || index + 1,
        planIndex: index,
      }));
      return importedPages;
    }
    return [page];
  });
}

function ProjectEstimatePageAttachmentLabel({ page, importedDocuments = {} }) {
  const pageType = page?.page_type || page?.id || "";
  if (pageType === "standardInclusions") {
    const document = importedDocuments.inclusions || null;
    if (!referencedPdfUrl(document)) return null;
    const pageCount = Number(document.pageCount || document.page_count || document.pages?.length || 1) || 1;
    return <small>{document.fileName || document.title || "Inclusions.pdf"} - {pageCount} page{pageCount === 1 ? "" : "s"}</small>;
  }
  if (pageType === "pricedPlans") {
    const document = importedDocuments.pricedPlans || null;
    if (!referencedPdfUrl(document)) return null;
    const pageCount = Number(document.pageCount || document.page_count || document.pages?.length || 1) || 1;
    return <small>{document.fileName || document.title || "Plans.pdf"} - {pageCount} page{pageCount === 1 ? "" : "s"}</small>;
  }
  return null;
}

function ProposalImportSidebarStatus({
  page,
  inclusionsDocument,
  pricedPlans,
  editing,
  onInsertStandard,
  onInsertModified,
  onInsertPlans,
  onReplaceInclusions,
  onRemoveInclusions,
  onReplacePlans,
  onRemovePlans,
  onViewDocument,
  onOpenLibrary,
}) {
  if (!editing || !["standardInclusions", "pricedPlans"].includes(page?.page_type)) return null;
  const planPages = Array.isArray(pricedPlans?.pages) ? pricedPlans.pages : [];
  if (page.page_type === "pricedPlans") {
    return (
      <div style={styles.proposalThemeHint}>
        <strong>Plans Used to Prepare This Estimate</strong>
        {planPages.length ? (
          <>
            <span>Current file: {pricedPlans.fileName || pricedPlans.title || planPages[0]?.fileName || "Concept Plans PDF"}</span>
            <span>Page count: {planPages.length}</span>
            <div style={styles.importButtonRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => onViewDocument?.(pricedPlans)}>View PDF</button>
              <button type="button" style={styles.secondaryButton} onClick={onReplacePlans}>Replace PDF</button>
              <button type="button" style={styles.dangerButton} onClick={onRemovePlans}>Remove PDF</button>
            </div>
          </>
        ) : (
          <>
            <span>Current file: No PDF attached</span>
            <span>Page count: -</span>
            <div style={styles.importButtonRow}>
              <button type="button" style={styles.secondaryButton} disabled>View PDF</button>
              <button type="button" style={styles.secondaryButton} onClick={onInsertPlans}>Replace PDF</button>
              <button type="button" style={styles.primaryButton} onClick={onInsertPlans}>Upload Plans</button>
              <button type="button" style={styles.secondaryButton} onClick={() => onOpenLibrary("priced_plans")}>Choose from Document Library</button>
              <button type="button" style={styles.dangerButton} disabled>Remove PDF</button>
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={styles.proposalThemeHint}>
      <strong>Standard Inclusions Schedule</strong>
      {referencedPdfUrl(inclusionsDocument) ? (
        <>
          <span>Current file: {inclusionsDocument.fileName || inclusionsDocument.title || "Inclusions schedule"}</span>
          <span>Page count: {Number(inclusionsDocument.pageCount || inclusionsDocument.page_count || inclusionsDocument.pages?.length || 1)}</span>
          <span>Uploaded {formatProposalDate(inclusionsDocument.uploadedAt || inclusionsDocument.importedAt)}</span>
          {inclusionsDocument.version || inclusionsDocument.fileHash ? (
            <span>Version {inclusionsDocument.version || String(inclusionsDocument.fileHash).slice(0, 12)}</span>
          ) : null}
          <div style={styles.importButtonRow}>
            <button type="button" style={styles.secondaryButton} onClick={() => onViewDocument?.(inclusionsDocument)}>View PDF</button>
            <button type="button" style={styles.secondaryButton} onClick={onReplaceInclusions}>Replace PDF</button>
            <button type="button" style={styles.primaryButton} onClick={onInsertStandard}>Upload Standard Inclusions</button>
            <button type="button" style={styles.secondaryButton} onClick={onInsertModified}>Upload Modified Inclusions</button>
            <button type="button" style={styles.secondaryButton} onClick={() => onOpenLibrary("standard_inclusions")}>Choose from Document Library</button>
            <button type="button" style={styles.dangerButton} onClick={onRemoveInclusions}>Remove PDF</button>
          </div>
        </>
      ) : (
        <>
          <span>Current file: No PDF attached</span>
          <span>Page count: -</span>
          <div style={styles.importButtonRow}>
            <button type="button" style={styles.secondaryButton} disabled>View PDF</button>
            <button type="button" style={styles.secondaryButton} onClick={onInsertStandard}>Replace PDF</button>
            <button type="button" style={styles.primaryButton} onClick={onInsertStandard}>Upload Standard Inclusions</button>
            <button type="button" style={styles.secondaryButton} onClick={onInsertModified}>Upload Modified Inclusions</button>
            <button type="button" style={styles.secondaryButton} onClick={() => onOpenLibrary("standard_inclusions")}>Choose from Document Library</button>
            <button type="button" style={styles.dangerButton} disabled>Remove PDF</button>
          </div>
        </>
      )}
    </div>
  );
}

function ProposalImportedDocumentPage({
  page,
  inclusionsDocument,
  pricedPlans,
  editing,
  onInsertStandard,
  onInsertModified,
  onInsertPlans,
  onReplaceInclusions,
  onRemoveInclusions,
  onReplacePlans,
  onRemovePlans,
  onOpenLibrary,
}) {
  if (page.page_type === "importedPlanPdf") {
    const doc = page.importedDocument || {};
    const isLandscape = planPageOrientation(doc) === "landscape";
    return (
      <section className={`proposal-builder-page ${isLandscape ? "proposal-builder-page-landscape" : ""}`} style={isLandscape ? styles.importedPdfLandscapePage : styles.importedPdfPortraitPage}>
        <ImportedPdfPageImage document={doc} pageNumber={page.importedPageNumber || 1} title={page.title} />
      </section>
    );
  }

  if (page.page_type === "importedInclusionsPdf") {
    const doc = page.importedDocument || {};
    const isLandscape = planPageOrientation(doc) === "landscape";
    return (
      <section className={`proposal-builder-page ${isLandscape ? "proposal-builder-page-landscape" : ""}`} style={isLandscape ? styles.importedPdfLandscapePage : styles.importedPdfPortraitPage}>
        <ImportedPdfPageImage document={doc} pageNumber={page.importedPageNumber || 1} title={page.title} />
      </section>
    );
  }

  if (page.page_type === "pricedPlans") {
    const pages = Array.isArray(pricedPlans?.pages) ? pricedPlans.pages : [];
    return (
      <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.importPlaceholderPage }}>
        <div style={styles.importPlaceholderContent}>
          <h1 style={styles.importPlaceholderTitle}>Plans Used to Prepare This Estimate</h1>
          <p style={styles.importPlaceholderText}>Insert the concept plans or drawings used as the basis of this estimate.</p>
          {pages.length ? (
            <div style={styles.importedSummaryBox}>
              <strong>{pricedPlans.fileName || pricedPlans.title || pages[0]?.fileName || "Concept Plans PDF"}</strong>
              <span>{pages.length} page{pages.length === 1 ? "" : "s"}</span>
              {editing ? (
                <div style={styles.importButtonRow}>
                  <button type="button" style={styles.secondaryButton} onClick={onReplacePlans}>Replace Concept Plans PDF</button>
                  <button type="button" style={styles.dangerButton} onClick={onRemovePlans}>Remove Concept Plans PDF</button>
                </div>
              ) : null}
            </div>
          ) : editing ? (
            <div style={styles.importButtonRow}>
              <button type="button" style={styles.primaryButton} onClick={onInsertPlans}>Insert Concept Plans PDF</button>
              <button type="button" style={styles.secondaryButton} onClick={() => onOpenLibrary("priced_plans")}>Select from Document Library</button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.importPlaceholderPage }}>
      <div style={styles.importPlaceholderContent}>
        <h1 style={styles.importPlaceholderTitle}>Standard Inclusions Schedule</h1>
        <p style={styles.importPlaceholderText}>Insert the inclusions schedule applicable to this project.</p>
        {inclusionsDocument?.publicUrl ? (
          <div style={styles.importedSummaryBox}>
            <strong>{inclusionsDocument.fileName || inclusionsDocument.title || "Inclusions schedule"}</strong>
            <span>{Number(inclusionsDocument.pageCount || 1)} page{Number(inclusionsDocument.pageCount || 1) === 1 ? "" : "s"}</span>
            {editing ? (
              <div style={styles.importButtonRow}>
                <button type="button" style={styles.secondaryButton} onClick={onReplaceInclusions}>Replace Inclusions Schedule</button>
                <button type="button" style={styles.dangerButton} onClick={onRemoveInclusions}>Remove Inclusions Schedule</button>
              </div>
            ) : null}
          </div>
        ) : editing ? (
          <div style={styles.importButtonRow}>
            <button type="button" style={styles.primaryButton} onClick={onInsertStandard}>Insert Standard Inclusions Schedule</button>
            <button type="button" style={styles.secondaryButton} onClick={onInsertModified}>Insert Modified Inclusions Schedule</button>
            <button type="button" style={styles.secondaryButton} onClick={() => onOpenLibrary("standard_inclusions")}>Select from Document Library</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function planPageOrientation(page = {}) {
  if (page.orientation === "portrait" || page.orientation === "landscape") return page.orientation;
  const rotation = Number(page.rotation || page.metadataRotation || 0);
  const width = Number(page.width || 0);
  const height = Number(page.height || 0);
  const rotated = Math.abs(rotation % 180) === 90;
  const displayWidth = rotated ? height : width;
  const displayHeight = rotated ? width : height;
  return displayWidth >= displayHeight ? "landscape" : "portrait";
}

function proposalPageOrientation(page = {}) {
  if (page.page_type === "importedPlanPdf" || page.page_type === "importedInclusionsPdf") {
    return planPageOrientation(page.importedDocument || page);
  }
  return page.orientation === "landscape" ? "landscape" : "portrait";
}

function safePdfNamePart(value = "") {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function proposalPdfFileName(sheet, builder = {}) {
  const clientName = safePdfNamePart(clientWorkbookDataValue(sheet, "clientName") || builder.theme?.clientNameOverride || "Client");
  const quoteNumber = safePdfNamePart(clientWorkbookDataValue(sheet, "quoteNumber") || clientWorkbookDataValue(sheet, "estimateNumber") || "");
  const parts = [clientName, quoteNumber, "Project Estimate"].filter(Boolean);
  return `${parts.join(" - ")}.pdf`;
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function waitForProposalExportReady(container) {
  await nextAnimationFrame();
  const deadline = Date.now() + 4500;
  while (Date.now() < deadline) {
    const images = Array.from(container.querySelectorAll("img"));
    const imagesReady = images.every((image) => !image.src || (image.complete && image.naturalWidth > 0));
    const loadingText = String(container.textContent || "").includes("Loading PDF page");
    if (imagesReady && !loadingText) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function renderProposalPagesForPdf(container) {
  if (!container) throw new Error("The rendered document is not ready for PDF export.");
  await waitForProposalExportReady(container);
  const html2canvas = (await import("html2canvas")).default;
  const pageElements = Array.from(container.querySelectorAll("[data-proposal-export-page='true']"));
  if (!pageElements.length) throw new Error("No rendered document pages were found for PDF export.");
  const renderedPages = [];
  for (const [index, element] of pageElements.entries()) {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2.4,
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: Math.ceil(element.scrollWidth),
        windowHeight: Math.ceil(element.scrollHeight),
      });
      renderedPages.push({
        pageIndex: index + 1,
        pageId: element.dataset.pageId || element.dataset.pageType || "",
        pageType: element.dataset.pageType || "",
        sourceFile: element.dataset.sourceFile || "",
        sourcePath: element.dataset.sourcePath || "",
        sourcePageNumber: Number(element.dataset.sourcePageNumber || 0) || null,
        orientation: element.dataset.orientation === "landscape" ? "landscape" : "portrait",
        imageData: canvas.toDataURL("image/jpeg", 0.96),
      });
    } catch (error) {
      const sourceFile = element.dataset.sourceFile || element.dataset.sourcePath || `rendered page ${index + 1}`;
      const sourcePage = element.dataset.sourcePageNumber ? ` page ${element.dataset.sourcePageNumber}` : "";
      console.error("Proposal PDF page render failed", {
        pageIndex: index + 1,
        pageType: element.dataset.pageType || "",
        sourceFile,
        sourcePath: element.dataset.sourcePath || "",
        sourcePageNumber: element.dataset.sourcePageNumber || "",
        error,
      });
      throw new Error(`PDF page render failed on ${sourceFile}${sourcePage}: ${error?.stack || error?.message || String(error)}`);
    }
  }
  return renderedPages;
}

function validateProjectEstimateExportBounds(root) {
  if (!root) return;
  const pages = [...root.querySelectorAll("[data-proposal-export-page='true']")];
  pages.forEach((pageWrap) => {
    const page = pageWrap.querySelector(".proposal-builder-page");
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    const pageLabel = pageWrap.getAttribute("data-page-type") || pageWrap.getAttribute("data-page-id") || "Project Estimate page";
    const elements = [...page.querySelectorAll("[data-project-estimate-native-group], [data-project-estimate-native-element]")];
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const id = element.getAttribute("data-project-estimate-native-group") || element.getAttribute("data-project-estimate-native-element") || "block";
      const tolerance = 2;
      if (rect.bottom > pageRect.bottom + tolerance || rect.right > pageRect.right + tolerance || rect.top < pageRect.top - tolerance || rect.left < pageRect.left - tolerance) {
        throw new Error(`${pageLabel}: "${id}" does not fit inside the printable page area. Move or resize the block before downloading the PDF.`);
      }
    });
  });
}

function buildProjectEstimateExportPayload({ builder = {}, sheet = {}, workspaceId = "", linkedFields = {} } = {}) {
  const orderedPages = orderedProjectEstimatePages(builder).filter((page) => !page.hiddenFromPdf);
  return {
    documentType: "project-estimate",
    estimateId: proposalEstimateId(sheet),
    jobId: sheet?.workbook?.id || sheet?.workbook?.jobId || "",
    workspaceId: workspaceId || "",
    projectId: proposalProjectId(sheet),
    templateId: builder.templateId || QUOTE_PROPOSAL_TEMPLATE_KEY,
    templateVersion: builder.templateVersion || PROJECT_ESTIMATE_TEMPLATE_VERSION,
    template: builder.template || APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
    pageOrder: PROJECT_ESTIMATE_EXPORT_ORDER.map((item) => item.type === "documentSlot" ? item.placeholderPageId : item.pageId),
    pageOverrides: serializeProjectEstimatePageOverrides(orderedPages),
    linkedFieldOverrides: serializeProjectEstimateLinkedFieldOverrides(linkedFields),
    importedDocumentReferences: serializeProjectEstimateDocumentReferences(builder.importedDocuments || {}),
  };
}

function serializeProjectEstimatePageOverrides(pages = []) {
  return pages.reduce((overrides, page) => {
    const pageId = page.page_type || page.id;
    if (!pageId) return overrides;
    overrides[pageId] = projectEstimatePageContentOverrides(page);
    return overrides;
  }, {});
}

function serializeProjectEstimateLinkedFieldOverrides(linkedFields = {}) {
  return Object.entries(linkedFields).reduce((fields, [key, field]) => {
    if (["pricingGroups", "inclusions", "standardInclusionsPackage", "estimateInclusionsPackage"].includes(key)) return fields;
    const value = field?.value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      fields[key] = value;
    }
    return fields;
  }, {});
}

function serializeProjectEstimateDocumentReferences(importedDocuments = {}) {
  return Object.entries(importedDocuments || {}).reduce((documents, [key, document]) => {
    if (!document || typeof document !== "object") return documents;
    const pages = Array.isArray(document.pages) ? document.pages : [];
    documents[key] = {
      id: document.id || "",
      fileName: document.fileName || document.file_name || document.title || "",
      mimeType: document.mimeType || document.mime_type || "application/pdf",
      storagePath: document.storagePath || document.storage_path || "",
      publicUrl: document.publicUrl || document.public_url || document.url || "",
      sourceType: document.sourceType || document.source_type || "",
      pageCount: Number(document.pageCount || document.page_count || pages.length || 0) || 0,
      pages: pages.map((page, index) => ({
        pageNumber: Number(page.pageNumber || index + 1),
        order: Number(page.order || index + 1),
        storagePath: page.storagePath || document.storagePath || document.storage_path || "",
        publicUrl: page.publicUrl || document.publicUrl || document.public_url || "",
      })),
    };
    return documents;
  }, {});
}

function assertProjectEstimateExportPayloadIsSmall(payload = {}) {
  const json = JSON.stringify(payload);
  if (/data:(image|application)\//i.test(json) || /;base64,/i.test(json)) {
    throw new Error("Project Estimate export metadata contains embedded Base64 data.");
  }
  return true;
}

function parseRenderedPageImage(imageData = "") {
  const match = String(imageData || "").match(/^data:(image\/png|image\/jpeg|image\/jpg);base64,(.+)$/);
  if (!match) throw new Error("Rendered PDF page image was invalid.");
  return {
    mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1],
    bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)),
  };
}

async function createProposalPdfBlobFromRenderedPages(renderedPages = []) {
  const { PDFDocument } = await import("pdf-lib");
  const outputPdf = await PDFDocument.create();
  const pageSizes = {
    portrait: [595.28, 841.89],
    landscape: [841.89, 595.28],
  };
  for (const renderedPage of renderedPages) {
    const size = renderedPage.orientation === "landscape" ? pageSizes.landscape : pageSizes.portrait;
    const page = outputPdf.addPage(size);
    const { mimeType, bytes } = parseRenderedPageImage(renderedPage.imageData);
    const image = mimeType === "image/png" ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);
    page.drawImage(image, { x: 0, y: 0, width: size[0], height: size[1] });
  }
  const pdfBytes = await outputPdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

async function createProposalPdfBlobFromProjectEstimate({ renderedPages = [], importedDocuments = {}, onWarning = () => {} } = {}) {
  const { PDFDocument } = await import("pdf-lib");
  const outputPdf = await PDFDocument.create();
  const pageSizes = {
    portrait: [595.28, 841.89],
    landscape: [841.89, 595.28],
  };
  const renderedByPageId = new Map();
  renderedPages.forEach((renderedPage) => {
    const pageId = renderedPage.pageId || renderedPage.pageType || "";
    if (pageId && !renderedByPageId.has(pageId)) renderedByPageId.set(pageId, renderedPage);
  });
  const diagnostics = [];

  const appendRenderedPage = async (pageId, reasonIncluded) => {
    const renderedPage = renderedByPageId.get(pageId);
    if (!renderedPage) throw new Error(`Rendered Project Estimate page "${pageId}" was not available for PDF export.`);
    const size = renderedPage.orientation === "landscape" ? pageSizes.landscape : pageSizes.portrait;
    const page = outputPdf.addPage(size);
    const { mimeType, bytes } = parseRenderedPageImage(renderedPage.imageData);
    const image = mimeType === "image/png" ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);
    page.drawImage(image, { x: 0, y: 0, width: size[0], height: size[1] });
    diagnostics.push({
      outputPage: outputPdf.getPageCount(),
      sourceType: "rendered page",
      pageId,
      reasonIncluded,
    });
  };

  for (const item of PROJECT_ESTIMATE_EXPORT_ORDER) {
    if (item.type === "page") {
      await appendRenderedPage(item.pageId, "declared project estimate page");
      continue;
    }
    if (item.type === "documentSlot") {
      const document = resolveProjectEstimateSlotDocument(importedDocuments, item.slotId);
      if (referencedPdfUrl(document)) {
        const result = await appendReferencedPdfDocument({
          outputPdf,
          document,
          warningMessage: item.slotId === "plans" ? "Plans could not be included." : "The selected Inclusions Schedule could not be found.",
          onWarning,
        });
        if (result.appendedPageCount > 0) {
          diagnostics.push(...result.pages.map((entry) => ({
            ...entry,
            reasonIncluded: `${item.slotId} document replaces ${item.placeholderPageId} placeholder`,
          })));
          continue;
        }
      }
      await appendRenderedPage(item.placeholderPageId, `${item.slotId} placeholder because no PDF is attached`);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.info("[Project Estimate PDF export] Final PDF assembly", diagnostics.map((entry, index) => ({
      number: String(index + 1).padStart(2, "0"),
      ...entry,
    })));
    console.info("[Project Estimate PDF export] page counts", {
      plansSourcePageCount: Number(importedDocuments?.pricedPlans?.pageCount || importedDocuments?.pricedPlans?.page_count || importedDocuments?.pricedPlans?.pages?.length || 0) || 0,
      inclusionsSourcePageCount: Number(importedDocuments?.inclusions?.pageCount || importedDocuments?.inclusions?.page_count || importedDocuments?.inclusions?.pages?.length || 0) || 0,
      renderedProjectEstimatePageCount: renderedPages.length,
      finalMergedPageCount: outputPdf.getPageCount(),
    });
  }
  const pdfBytes = await outputPdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

async function appendReferencedPdfDocument({ outputPdf, document, warningMessage, onWarning }) {
  const sourceUrl = referencedPdfUrl(document);
  if (!sourceUrl) return { appendedPageCount: 0, pages: [] };
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const { PDFDocument } = await import("pdf-lib");
    const importedPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await outputPdf.copyPages(importedPdf, importedPdf.getPageIndices());
    const pages = [];
    copiedPages.forEach((page, index) => {
      outputPdf.addPage(page);
      pages.push({
        outputPage: outputPdf.getPageCount(),
        sourceType: "imported PDF",
        fileName: document?.fileName || document?.file_name || document?.title || "",
        sourcePageNumber: index + 1,
      });
    });
    return { appendedPageCount: pages.length, pages };
  } catch (error) {
    console.error("Referenced PDF merge failed", {
      warningMessage,
      document: referencedPdfDiagnostics(document),
      error,
    });
    onWarning?.(warningMessage);
    return { appendedPageCount: 0, pages: [] };
  }
}

function resolveProjectEstimateSlotDocument(importedDocuments = {}, slotId = "") {
  if (slotId === "inclusions") return importedDocuments.inclusions || null;
  if (slotId === "plans") return importedDocuments.pricedPlans || null;
  return null;
}

function referencedPdfUrl(document = {}) {
  if (!document || typeof document !== "object") return "";
  if (document.publicUrl || document.public_url || document.url) return document.publicUrl || document.public_url || document.url;
  const firstPage = Array.isArray(document.pages) ? document.pages.find((page) => page?.publicUrl || page?.public_url || page?.url) : null;
  return firstPage?.publicUrl || firstPage?.public_url || firstPage?.url || "";
}

function referencedPdfDiagnostics(document = {}) {
  return {
    id: document?.id || "",
    fileName: document?.fileName || document?.file_name || document?.title || "",
    storagePath: document?.storagePath || document?.storage_path || "",
    publicUrl: referencedPdfUrl(document),
    pageCount: document?.pageCount || document?.page_count || document?.pages?.length || 0,
    sourceType: document?.sourceType || document?.source_type || "",
  };
}

async function formatProposalExportErrorResponse(response, responseType = "", { responseOk = false } = {}) {
  const statusLine = `HTTP ${response.status} ${response.statusText || ""}`.trim();
  const body = await response.text().catch((error) => `Could not read response body: ${error?.message || String(error)}`);
  const trimmedBody = body.trim();
  const isFrameworkInvalidJson = trimmedBody === "Invalid JSON";
  console.error("Project Estimate PDF export response body", {
    status: response.status,
    statusText: response.statusText,
    contentType: responseType,
    body,
  });
  const safeMessage = "PDF export could not be completed.\nYour estimate has not been changed.\nPlease try again.";
  if (isFrameworkInvalidJson) {
    console.error("Project Estimate PDF export invalid JSON response", { statusLine, body });
    return safeMessage;
  }
  if (responseType.includes("application/json") || /^[\[{]/.test(trimmedBody)) {
    try {
      const payload = JSON.parse(body || "{}");
      console.error("Project Estimate PDF export JSON error payload", { statusLine, responseOk, payload });
      return safeMessage;
    } catch (error) {
      console.error("Project Estimate PDF export response parse failed", { statusLine, error, body });
      return safeMessage;
    }
  }
  if (/text\/html/i.test(responseType) || /^\s*<!doctype html|^\s*<html/i.test(body)) {
    console.error("Project Estimate PDF export returned HTML", { statusLine, responseType, body });
    return safeMessage;
  }
  console.error("Project Estimate PDF export returned unexpected response", { statusLine, responseType, body });
  return safeMessage;
}

function bytesStartWithPdf(bytes) {
  if (!bytes || bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

async function validateSelectedPdfFile(file) {
  if (!file) return { ok: false, error: "Please choose a PDF document." };
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  if (file.size <= 0) return { ok: false, error: "The selected file is not a valid PDF" };
  if (type && type !== "application/pdf" && !/\.pdf$/i.test(name)) return { ok: false, error: "The selected file is not a valid PDF" };
  if (!type && !/\.pdf$/i.test(name)) return { ok: false, error: "The selected file is not a valid PDF" };
  const firstBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!bytesStartWithPdf(firstBytes)) return { ok: false, error: "The selected file is not a valid PDF" };
  return { ok: true };
}

async function repairPdfFile(file) {
  const { PDFDocument } = await import("pdf-lib");
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const repairedBytes = await sourcePdf.save({ useObjectStreams: false });
  const repairedFile = new File([repairedBytes], file.name || "document.pdf", { type: "application/pdf" });
  return { file: repairedFile };
}

async function readProposalPdfMetadata(file) {
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  if (!bytesStartWithPdf(bytes)) throw new Error("The selected file is not a valid PDF");
  try {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    return await proposalPdfMetadataFromPdfJsDocument(pdf);
  } catch (error) {
    console.warn("PDF.js metadata read failed; falling back to pdf-lib.", error);
    return proposalPdfMetadataFromBytes(bytes);
  }
}

async function proposalPdfMetadataFromPdfJsDocument(pdf) {
  const pages = [];
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const rotation = Number(page.rotate || viewport.rotation || 0);
    const width = Number(viewport.width || 595);
    const height = Number(viewport.height || 842);
    pages.push({
      pageNumber: index,
      order: index,
      width,
      height,
      rotation,
      metadataRotation: rotation,
      orientation: width >= height ? "landscape" : "portrait",
    });
  }
  return {
    pageCount: pages.length,
    pages,
  };
}

async function proposalPdfMetadataFromBytes(bytes) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = Number(page.getRotation?.().angle || 0);
    const rotated = Math.abs(rotation % 180) === 90;
    const displayWidth = rotated ? height : width;
    const displayHeight = rotated ? width : height;
    return {
      pageNumber: index + 1,
      order: index + 1,
      width: displayWidth,
      height: displayHeight,
      rotation,
      metadataRotation: rotation,
      orientation: displayWidth >= displayHeight ? "landscape" : "portrait",
    };
  });
  return { pageCount: pages.length, pages };
}

async function fetchVerifiedPdfBytes(url) {
  if (!url) throw new Error("The upload did not return a PDF URL.");
  const response = await fetch(url, { cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Could not read uploaded PDF. HTTP ${response.status}.`);
  }
  if (/application\/json|text\/html/i.test(contentType)) {
    const body = await response.text().catch(() => "");
    console.error("Uploaded PDF URL returned non-PDF content", { contentType, body: body.slice(0, 500) });
    throw new Error("The upload returned JSON/HTML instead of a PDF");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytesStartWithPdf(bytes)) throw new Error("The upload returned JSON/HTML instead of a PDF");
  return bytes;
}

async function validateUploadedPdfDocument(document = {}) {
  try {
    const bytes = await fetchVerifiedPdfBytes(document.publicUrl);
    let pageCount = 0;
    try {
      const pdfjsLib = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      pageCount = pdf.numPages;
    } catch (error) {
      console.warn("PDF.js uploaded validation failed; falling back to pdf-lib.", error);
      const metadata = await proposalPdfMetadataFromBytes(bytes);
      pageCount = metadata.pageCount;
    }
    const expectedPageCount = Number(document.pageCount || 0);
    if (expectedPageCount && pageCount !== expectedPageCount) {
      return { ok: false, error: `Uploaded PDF page count mismatch: expected ${expectedPageCount}, received ${pageCount}.` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "The uploaded PDF could not be parsed." };
  }
}

async function loadUploadedPdfDocument(url) {
  const bytes = await fetchVerifiedPdfBytes(url);
  try {
    const pdfjsLib = await loadPdfJs();
    return await pdfjsLib.getDocument({ data: bytes }).promise;
  } catch (error) {
    throw new Error(error?.message || "The uploaded PDF could not be parsed.");
  }
}

function ImportedPdfPageImage({ document, pageNumber, title }) {
  const [state, setState] = useState({ status: "loading", dataUrl: "", width: 0, height: 0, error: "" });

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      try {
        setState({ status: "loading", dataUrl: "", width: 0, height: 0, error: "" });
        const pdf = await loadUploadedPdfDocument(document.publicUrl);
        const pdfPage = await pdf.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 2.2 });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) {
          setState({
            status: "ready",
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
            error: "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", dataUrl: "", width: 0, height: 0, error: error?.message || "Could not render PDF page." });
        }
      }
    }
    if (document?.publicUrl) renderPage();
    else setState({ status: "error", dataUrl: "", width: 0, height: 0, error: "Missing PDF URL." });
    return () => {
      cancelled = true;
    };
  }, [document?.publicUrl, pageNumber]);

  if (state.status === "ready") {
    return <img src={state.dataUrl} alt={title || `PDF page ${pageNumber}`} style={styles.importedPdfImage} />;
  }
  return (
    <div style={styles.importedPdfLoading}>
      {state.status === "error" ? state.error : "Rendering plan page..."}
    </div>
  );
}

function ProposalDocumentLibraryModal({ rows, loading, onClose, onSelect }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.documentLibraryModal}>
        <div style={styles.documentLibraryHeader}>
          <strong>Select platform document</strong>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>Close</button>
        </div>
        {loading ? <div style={styles.empty}>Loading documents...</div> : null}
        {!loading && !rows.length ? <div style={styles.empty}>No matching document library records found.</div> : null}
        <div style={styles.documentLibraryList}>
          {rows.map((row) => (
            <button key={row.id} type="button" style={styles.documentLibraryRow} onClick={() => onSelect(row)}>
              <strong>{row.title || row.file_name || "Untitled document"}</strong>
              <span>{row.file_name || row.public_url || row.storage_path || "PDF document"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectEstimateApprovedPage({
  page,
  theme,
  linkedFields,
  Brochure,
  editMode = false,
  selectedBlockId = "",
  editingBlockId = "",
  onSelectBlock,
  onEditBlock,
  onTextCommit,
  onBlockDesign,
  onReplaceImage,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlockLayer,
}) {
  const frameRef = useRef(null);
  const savedTextSelectionRef = useRef(null);
  const toolbarDragRef = useRef(null);
  const resizeGestureRef = useRef(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [toolbarManuallyMoved, setToolbarManuallyMoved] = useState(false);
  const [pageBoundaryWarning, setPageBoundaryWarning] = useState(false);
  const nativeHiddenBlockIds = (page?.blocks || [])
    .filter((block) => !isSubscriberProjectEstimateBlock(block, page) && block.design?.hidden === true && block.design?.hiddenBySubscriber === true)
    .map((block) => block.id);
  const blockById = Object.fromEntries([
    ...defaultProjectEstimateBlocks(page?.page_type || page?.id || ""),
    ...(Array.isArray(page?.blocks) ? page.blocks : []),
  ].map((block) => [block.id, block]));
  const selectedBlock = blockById[selectedBlockId] || null;
  const selectedDesign = selectedBlock?.design || {};
  const editingBlock = blockById[editingBlockId] || null;
  const editingDesign = editingBlock?.design || {};
  const selectedIsText = selectedBlock ? projectEstimateIsTextBlock(selectedBlock) && selectedBlock.type !== "quote_field" : false;
  const editingIsText = editingBlock ? projectEstimateIsTextBlock(editingBlock) && editingBlock.type !== "quote_field" : false;
  const selectedIsLinked = selectedBlock?.type === "quote_field";
  const selectedIsImage = selectedBlock ? projectEstimateIsImageBlock(selectedBlock) : false;
  const selectedIsGroup = selectedBlock?.type === "group";
  const selectedUsesParentResize = selectedBlock ? projectEstimateTextUsesParentResize(selectedBlock) : false;
  const selectedIsStructuredChild = !!selectedDesign.parentGroupId && selectedUsesParentResize;
  const canMoveOrResizeSelected = selectedBlock && !selectedUsesParentResize;
  const canRemoveNative = selectedBlock ? isSubscriberProjectEstimateBlock(selectedBlock, page) : false;

  const refreshSelectionBox = () => {
    const frame = frameRef.current;
    if (!frame || !editMode || !selectedBlockId) {
      setSelectionBox(null);
      return;
    }
    const element = selectedIsGroup
      ? frame.querySelector(`[data-project-estimate-native-group="${cssEscapeValue(selectedBlockId)}"]`)
      : frame.querySelector(`[data-project-estimate-native-element="${cssEscapeValue(selectedBlockId)}"]`);
    if (!element) {
      setSelectionBox(null);
      return;
    }
    const frameRect = frame.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scale = pageScale();
    setSelectionBox({
      left: (elementRect.left - frameRect.left) / scale,
      top: (elementRect.top - frameRect.top) / scale,
      width: elementRect.width / scale,
      height: elementRect.height / scale,
      viewportLeft: elementRect.left,
      viewportTop: elementRect.top,
      viewportRight: elementRect.right,
      viewportBottom: elementRect.bottom,
    });
  };

  useEffect(() => {
    refreshSelectionBox();
  }, [editMode, selectedBlockId, editingBlockId, page?.id, page?.blocks]);

  useEffect(() => {
    if (!editMode) return undefined;
    const handle = () => refreshSelectionBox();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [editMode, selectedBlockId, page?.id]);

  useEffect(() => {
    if (!editMode || !editingBlockId || !selectionBox || toolbarManuallyMoved) return;
    setToolbarPosition(projectEstimateToolbarPositionForRect(selectionBox));
  }, [editMode, editingBlockId, selectionBox, toolbarManuallyMoved]);

  useEffect(() => {
    if (!editMode || !editingBlockId || !selectionBox || toolbarManuallyMoved || typeof document === "undefined") return;
    const toolbar = document.querySelector('[data-text-toolbar="true"]');
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const overlaps = !(rect.bottom <= selectionBox.viewportTop || rect.top >= selectionBox.viewportBottom || rect.right <= selectionBox.viewportLeft || rect.left >= selectionBox.viewportRight);
    if (overlaps) {
      setToolbarPosition(projectEstimateToolbarPositionForRect(selectionBox, { width: rect.width, height: rect.height }));
    }
  }, [editMode, editingBlockId, selectionBox, toolbarPosition, toolbarManuallyMoved]);

  useEffect(() => {
    setToolbarManuallyMoved(false);
    setToolbarPosition(null);
  }, [editingBlockId]);

  const selectedElement = (blockId = selectedBlockId) => {
    const frame = frameRef.current;
    if (!frame || !blockId) return null;
    return frame.querySelector(`[data-project-estimate-native-element="${cssEscapeValue(blockId)}"]`);
  };

  const activeTextElement = () => selectedElement(editingBlockId || selectedBlockId);

  const selectedFrameElement = () => {
    const frame = frameRef.current;
    if (!frame || !selectedBlockId) return null;
    return selectedIsGroup
      ? frame.querySelector(`[data-project-estimate-native-group="${cssEscapeValue(selectedBlockId)}"]`)
      : frame.querySelector(`[data-project-estimate-native-element="${cssEscapeValue(selectedBlockId)}"]`);
  };

  const pageScale = () => {
    const rect = frameRef.current?.getBoundingClientRect?.();
    return rect?.width ? rect.width / PROJECT_ESTIMATE_PAGE_WIDTH || 1 : 1;
  };

  const preserveCurrentSelection = () => {
    const element = activeTextElement();
    const selection = window.getSelection?.();
    if (!element || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return;
    savedTextSelectionRef.current = range.cloneRange();
  };

  const restoreTextSelection = () => {
    const range = savedTextSelectionRef.current;
    const selection = window.getSelection?.();
    if (!range || !selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const commitActiveTextEdit = () => {
    const activeBlock = editingBlock || selectedBlock;
    const element = selectedElement(activeBlock?.id || "");
    if (!element || !activeBlock || activeBlock.type === "quote_field") return;
    const contentKey = element.getAttribute("data-project-estimate-content-key") || "text";
    onTextCommit?.(activeBlock.id, contentKey, element.innerHTML);
    const parentGroupId = blockById[activeBlock.id]?.design?.parentGroupId || "";
    if (parentGroupId) {
      window.setTimeout(() => autoFitProjectEstimateGroup(parentGroupId), 80);
    }
  };

  const commitSelectionOffset = (dx, dy) => {
    if (!selectedBlock || selectedBlock.design?.locked) return;
    const requestedLeft = (selectionBox?.left || 0) + dx;
    const requestedTop = (selectionBox?.top || 0) + dy;
    const nextLeft = clampNumber(requestedLeft, 0, PROJECT_ESTIMATE_PAGE_WIDTH - (selectionBox?.width || 0));
    const nextTop = clampNumber(requestedTop, 0, PROJECT_ESTIMATE_PAGE_HEIGHT - (selectionBox?.height || 0));
    setPageBoundaryWarning(nextLeft !== requestedLeft || nextTop !== requestedTop);
    onBlockDesign?.(selectedBlock.id, "translateX", Number(selectedDesign.translateX || 0) + Math.round(nextLeft - (selectionBox?.left || 0)));
    onBlockDesign?.(selectedBlock.id, "translateY", Number(selectedDesign.translateY || 0) + Math.round(nextTop - (selectionBox?.top || 0)));
    requestAnimationFrame(refreshSelectionBox);
  };

  const startMoveSelected = (event) => {
    if (!selectedBlock || selectedBlock.design?.locked || !canMoveOrResizeSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const onPointerUp = (upEvent) => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      const dx = Math.round(upEvent.clientX - startX);
      const dy = Math.round(upEvent.clientY - startY);
      if (dx || dy) commitSelectionOffset(dx, dy);
    };
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("mouseup", onPointerUp, { once: true });
  };

  const resizeSelected = (handle, event) => {
    if (!selectedBlock || selectedBlock.design?.locked || !selectionBox || !canMoveOrResizeSelected) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    const targetElement = selectedFrameElement();
    if (!targetElement) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = selectionBox.left || 0;
    const startTop = selectionBox.top || 0;
    const startRight = startLeft + (selectionBox.width || 0);
    const startBottom = startTop + (selectionBox.height || 0);
    const startWidth = Number(selectedDesign.widthOverride || selectionBox.width || 0);
    const startHeight = Number(selectedDesign.heightOverride || selectionBox.height || 0);
    const startTranslateX = Number(selectedDesign.translateX || 0);
    const startTranslateY = Number(selectedDesign.translateY || 0);
    const minWidth = selectedIsText ? 72 : 36;
    const minHeight = 24;
    const applyResize = (moveEvent) => {
      const scale = pageScale();
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      if (selectedIsText) {
        const requestedWidth = startWidth + (handle.includes("e") ? dx : handle.includes("w") ? -dx : 0);
        let nextWidth = clampNumber(Math.round(requestedWidth), minWidth, PROJECT_ESTIMATE_PAGE_WIDTH);
        let nextLeft = handle.includes("w") ? startRight - nextWidth : startLeft;
        if (nextLeft < 0) {
          nextLeft = 0;
          nextWidth = Math.max(minWidth, Math.round(startRight));
        }
        if (nextLeft + nextWidth > PROJECT_ESTIMATE_PAGE_WIDTH) nextWidth = Math.max(minWidth, Math.round(PROJECT_ESTIMATE_PAGE_WIDTH - nextLeft));
        const nextTranslateX = startTranslateX + Math.round(nextLeft - startLeft);
        targetElement.style.width = `${nextWidth}px`;
        targetElement.style.height = "auto";
        targetElement.style.minHeight = "";
        targetElement.style.transform = `translate(${nextTranslateX}px, ${startTranslateY}px)`;
        const measuredRect = targetElement.getBoundingClientRect();
        const nextHeight = measuredRect.height / scale;
        resizeGestureRef.current = {
          widthOverride: nextWidth,
          heightOverride: undefined,
          translateX: nextTranslateX || undefined,
          translateY: startTranslateY || undefined,
        };
        setSelectionBox({ ...selectionBox, left: nextLeft, top: startTop, width: nextWidth, height: nextHeight });
        setPageBoundaryWarning(nextLeft !== startLeft + (handle.includes("w") ? dx : 0) || nextLeft + nextWidth > PROJECT_ESTIMATE_PAGE_WIDTH);
        return;
      }
      let requestedWidth = startWidth + (handle.includes("e") ? dx : handle.includes("w") ? -dx : 0);
      let requestedHeight = startHeight + (handle.includes("s") ? dy : handle.includes("n") ? -dy : 0);
      let nextWidth = clampNumber(Math.round(requestedWidth), minWidth, PROJECT_ESTIMATE_PAGE_WIDTH);
      let nextHeight = clampNumber(Math.round(requestedHeight), minHeight, PROJECT_ESTIMATE_PAGE_HEIGHT);
      let nextLeft = handle.includes("w") ? startRight - nextWidth : startLeft;
      let nextTop = handle.includes("n") ? startBottom - nextHeight : startTop;

      if (nextLeft < 0) {
        nextLeft = 0;
        nextWidth = Math.max(minWidth, Math.round(startRight));
      }
      if (nextTop < 0) {
        nextTop = 0;
        nextHeight = Math.max(minHeight, Math.round(startBottom));
      }
      if (nextLeft + nextWidth > PROJECT_ESTIMATE_PAGE_WIDTH) nextWidth = Math.max(minWidth, Math.round(PROJECT_ESTIMATE_PAGE_WIDTH - nextLeft));
      if (nextTop + nextHeight > PROJECT_ESTIMATE_PAGE_HEIGHT) nextHeight = Math.max(minHeight, Math.round(PROJECT_ESTIMATE_PAGE_HEIGHT - nextTop));

      targetElement.style.width = `${nextWidth}px`;
      targetElement.style.minHeight = `${nextHeight}px`;
      targetElement.style.transform = `translate(${startTranslateX + Math.round(nextLeft - startLeft)}px, ${startTranslateY + Math.round(nextTop - startTop)}px)`;
      const nextBox = { ...selectionBox, left: nextLeft, top: nextTop, width: nextWidth, height: nextHeight };
      resizeGestureRef.current = {
        widthOverride: nextWidth,
        heightOverride: nextHeight,
        translateX: startTranslateX + Math.round(nextLeft - startLeft),
        translateY: startTranslateY + Math.round(nextTop - startTop),
      };
      setSelectionBox(nextBox);
      setPageBoundaryWarning(nextLeft !== startLeft + (handle.includes("w") ? dx : 0) || nextTop !== startTop + (handle.includes("n") ? dy : 0));
    };
    const onPointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      applyResize(moveEvent);
    };
    const onPointerUp = (upEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      applyResize(upEvent);
      const finalFrame = resizeGestureRef.current;
      resizeGestureRef.current = null;
      if (finalFrame) {
        onBlockDesign?.(selectedBlock.id, finalFrame);
      }
      requestAnimationFrame(refreshSelectionBox);
    };
    resizeGestureRef.current = null;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const applyTextCommand = (command, value = null) => {
    const activeBlock = editingBlock || selectedBlock;
    if (!activeBlock) return;
    const element = selectedElement(activeBlock.id);
    if (!element) return;
    element.focus({ preventScroll: true });
    restoreTextSelection();
    if (command === "fontSize") {
      onBlockDesign?.(activeBlock.id, "fontSize", value);
    } else if (command === "lineHeight") {
      onBlockDesign?.(activeBlock.id, "lineHeight", value);
    } else if (command === "createLink") {
      const href = typeof window !== "undefined" ? window.prompt("Link URL", "https://") : "";
      if (href) document.execCommand("createLink", false, href);
    } else {
      document.execCommand(command, false, value);
    }
    preserveCurrentSelection();
  };

  const startToolbarDrag = (event) => {
    const toolbar = document.querySelector('[data-text-toolbar="true"]');
    if (!toolbar) return;
    event.preventDefault();
    const rect = toolbar.getBoundingClientRect();
    toolbarDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    const move = (moveEvent) => {
      const drag = toolbarDragRef.current;
      if (!drag) return;
      setToolbarManuallyMoved(true);
      setToolbarPosition({
        x: clampNumber(moveEvent.clientX - drag.offsetX, 8, Math.max(8, window.innerWidth - drag.width - 8)),
        y: clampNumber(moveEvent.clientY - drag.offsetY, 8, Math.max(8, window.innerHeight - drag.height - 8)),
        width: Math.round(drag.width),
      });
    };
    const up = () => {
      toolbarDragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const activeToolbarPosition = toolbarPosition || (selectionBox ? projectEstimateToolbarPositionForRect(selectionBox) : { x: 24, y: 24, width: 680 });

  const autoFitProjectEstimateGroup = (groupId) => {
    const group = frameRef.current?.querySelector(`[data-project-estimate-native-group="${cssEscapeValue(groupId)}"]`);
    if (!group) return;
    const requiredHeight = Math.ceil(group.scrollHeight);
    const currentHeight = Math.ceil(group.getBoundingClientRect().height / pageScale());
    if (requiredHeight > currentHeight) {
      const groupRect = group.getBoundingClientRect();
      const frameRect = frameRef.current?.getBoundingClientRect();
      const groupTop = frameRect ? (groupRect.top - frameRect.top) / pageScale() : 0;
      onBlockDesign?.(groupId, "heightOverride", Math.min(requiredHeight, PROJECT_ESTIMATE_PAGE_HEIGHT - groupTop));
    }
  };

  const measuredProjectEstimateGroupHeight = (groupId) => {
    const group = frameRef.current?.querySelector(`[data-project-estimate-native-group="${cssEscapeValue(groupId)}"]`);
    return group ? Math.ceil(group.scrollHeight) : 18;
  };

  return (
    <div
      ref={frameRef}
      data-project-estimate-approved-page={page?.page_type || page?.id || ""}
      style={styles.projectEstimateVisualEditorFrame}
      onMouseDown={() => {
        if (!editMode) return;
        commitActiveTextEdit();
        onSelectBlock?.("");
        onEditBlock?.("");
      }}
    >
      <ProjectEstimatePackPage
        page={page}
        theme={theme}
        linkedFields={linkedFields}
        Brochure={Brochure}
        editing={editMode}
        selectedBlockId={selectedBlockId}
        editingBlockId={editingBlockId}
        onSelectBlock={onSelectBlock}
        onEditBlock={onEditBlock}
        onTextCommit={onTextCommit}
        onStartDrag={() => {}}
        onReplaceImage={onReplaceImage}
        onPreserveSelection={preserveCurrentSelection}
        hiddenBlockIds={nativeHiddenBlockIds}
      />
      {editMode && selectedBlock && selectionBox ? (
        <div
          data-project-estimate-selection-overlay="true"
          style={{
            position: "absolute",
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
            zIndex: 90,
            border: "2px solid #0ea5e9",
            boxShadow: "0 0 0 2px rgba(14,165,233,0.18)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          {canMoveOrResizeSelected ? <button type="button" style={styles.projectEstimateMoveHandle} onPointerDown={startMoveSelected} onMouseDown={startMoveSelected}>Move</button> : null}
          <div style={styles.projectEstimateElementName}>{selectedIsGroup ? "Section" : selectedBlock.content?.editorLabel || selectedBlock.id}</div>
          <div style={{ position: "absolute", right: 0, top: -34, display: "flex", gap: 4, pointerEvents: "auto" }}>
            {selectedIsLinked ? <span style={styles.projectEstimateLinkedIndicator}>Linked to Project Setup</span> : null}
            {selectedIsImage ? <button type="button" style={styles.projectEstimateToolbarButton} onClick={() => onReplaceImage?.(selectedBlock)}>Replace</button> : null}
            {selectedIsGroup ? <button type="button" style={styles.projectEstimateToolbarButton} onClick={() => onBlockDesign?.(selectedBlock.id, "locked", !selectedBlock.design?.locked)}>{selectedBlock.design?.locked ? "Unlock" : "Lock"}</button> : null}
            <button type="button" style={styles.projectEstimateToolbarButton} disabled={!canRemoveNative} onClick={() => onDuplicateBlock?.(selectedBlock.id)}>Duplicate</button>
            <button type="button" style={styles.projectEstimateToolbarButton} onClick={() => onMoveBlockLayer?.(selectedBlock.id, 1)}>Bring Forward</button>
            <button type="button" style={styles.projectEstimateToolbarButton} onClick={() => onMoveBlockLayer?.(selectedBlock.id, -1)}>Send Backward</button>
            <button type="button" style={styles.projectEstimateToolbarButton} disabled={!canRemoveNative} onClick={() => onDeleteBlock?.(selectedBlock.id)}>Delete</button>
          </div>
          {canMoveOrResizeSelected ? (selectedIsText ? ["w", "e"] : ["nw", "ne", "sw", "se"]).map((handle) => (
            <span
              key={handle}
              data-project-estimate-resize-handle={handle}
              style={{
                ...styles.projectEstimateResizeHandle,
                ...projectEstimateResizeHandleStyle(handle),
                pointerEvents: "auto",
              }}
              onPointerDown={(event) => resizeSelected(handle, event)}
            />
          )) : null}
        </div>
      ) : null}
      {editMode && pageBoundaryWarning ? (
        <div aria-hidden="true" style={styles.projectEstimatePageBoundaryGuide} />
      ) : null}
      {editMode && editingIsText && editingBlockId && typeof document !== "undefined" ? createPortal(
          <WebsiteBuilderTextEditingToolbar
            visible
            textColor={editingDesign.color || "#0f172a"}
            highlightColor={editingDesign.backgroundColor || "#ffffff"}
            fontFamily={editingDesign.fontFamily || "Arial"}
            fontSize={Number(editingDesign.fontSize || 18)}
            lineHeight={Number(editingDesign.lineHeight || 1.5)}
            fontWeight={String(editingDesign.fontWeight || 400)}
            fontStyle={editingDesign.fontStyle || "normal"}
            textDecoration={editingDesign.textDecoration || "none"}
            textAlign={editingDesign.textAlign || "left"}
            blockType={editingBlock.type === "heading" ? "H2" : "P"}
            position={activeToolbarPosition}
            onDragStart={startToolbarDrag}
            onClose={() => {
              commitActiveTextEdit();
              onEditBlock?.("");
            }}
            onPreserveSelection={preserveCurrentSelection}
            onCommand={applyTextCommand}
            onTextColor={(value) => applyTextCommand("foreColor", value)}
            onHighlightColor={(value) => applyTextCommand("hiliteColor", value)}
            onFontSize={(value) => applyTextCommand("fontSize", value)}
            onLineHeight={(value) => applyTextCommand("lineHeight", value)}
            onFontFamily={(value) => applyTextCommand("fontName", value)}
            onBlockType={(value) => applyTextCommand("formatBlock", value)}
          />,
        document.body
      ) : null}
    </div>
  );
}

function projectEstimateToolbarPositionForRect(rect = {}, measured = {}) {
  if (typeof window === "undefined") return { x: 24, y: 24, width: 680 };
  const gap = 14;
  const margin = 8;
  const viewportWidth = window.innerWidth || 1440;
  const viewportHeight = window.innerHeight || 900;
  const width = Math.min(760, Math.max(320, Number(measured.width || 0) || viewportWidth - margin * 2));
  const estimatedHeight = Math.min(viewportHeight - margin * 2, Math.max(360, Number(measured.height || 0) || 430));
  const candidates = [
    { x: rect.viewportLeft, y: rect.viewportTop - estimatedHeight - gap },
    { x: rect.viewportLeft, y: rect.viewportBottom + gap },
    { x: rect.viewportRight + gap, y: rect.viewportTop },
    { x: rect.viewportLeft - width - gap, y: rect.viewportTop },
  ];
  const fits = (candidate) => (
    candidate.x >= margin
    && candidate.y >= margin
    && candidate.x + width <= viewportWidth - margin
    && candidate.y + estimatedHeight <= viewportHeight - margin
  );
  const chosen = candidates.find(fits) || candidates[0];
  return {
    x: Math.round(clampNumber(chosen.x, margin, Math.max(margin, viewportWidth - width - margin))),
    y: Math.round(clampNumber(chosen.y, margin, Math.max(margin, viewportHeight - estimatedHeight - margin))),
    width,
  };
}

function ProjectEstimateDocumentEditor({
  page,
  theme,
  linkedFields,
  editMode,
  selectedBlockId,
  editingBlockId,
  onSelectBlock,
  onEditBlock,
  onBlockContent,
  onBlockDesign,
  onReplaceImage,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlockLayer,
}) {
  const pageRef = useRef(null);
  const selectionRef = useRef(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 160, y: 96, width: 1080 });
  const [transientFrames, setTransientFrames] = useState({});
  const pageType = page?.page_type || page?.id || "";
  const sourceBlocks = useMemo(() => (page?.blocks || [])
    .filter((block) => !block.design?.hidden)
    .map((block) => projectEstimateElementWithFrame(block, pageType))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)), [page?.blocks, pageType]);
  const blocks = useMemo(() => sourceBlocks.map((block) => (
    transientFrames[block.id]
      ? { ...block, design: { ...(block.design || {}), frame: transientFrames[block.id], frameEdited: true } }
      : block
  )), [sourceBlocks, transientFrames]);
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) || null;
  const editingBlock = blocks.find((block) => block.id === editingBlockId) || null;
  const selectedText = editingBlock && projectEstimateIsTextBlock(editingBlock) ? editingBlock : null;
  const selectedDesign = selectedText?.design || {};

  useEffect(() => {
    if (!editMode) {
      onSelectBlock?.("");
      onEditBlock?.("");
    }
  }, [editMode]);

  const pageScale = () => {
    const rect = pageRef.current?.getBoundingClientRect?.();
    return rect?.width ? rect.width / PROJECT_ESTIMATE_PAGE_WIDTH || 1 : 1;
  };

  const commitFrame = (blockId, frame) => {
    onBlockDesign?.(blockId, "frame", normaliseProposalFrame(frame, blocks.find((block) => block.id === blockId) || {}));
  };

  const handleDragEnd = ({ active, delta }) => {
    const block = blocks.find((item) => item.id === active?.id);
    if (!block || block.design?.locked || editingBlockId === block.id) return;
    const scale = pageScale();
    const frame = proposalBlockFrame(block, page);
    setTransientFrames((current) => {
      const next = { ...current };
      delete next[block.id];
      return next;
    });
    commitFrame(block.id, {
      ...frame,
      x: frame.x + (delta?.x || 0) / scale,
      y: frame.y + (delta?.y || 0) / scale,
    });
  };

  const startResize = (block, handle, event) => {
    if (!block || block.design?.locked || editingBlockId === block.id) return;
    event.preventDefault();
    event.stopPropagation();
    const scale = pageScale();
    const startFrame = proposalBlockFrame(block, page);
    const startX = event.clientX;
    const startY = event.clientY;
    const aspectRatio = startFrame.width / Math.max(1, startFrame.height);
    const lockAspect = projectEstimateIsImageBlock(block) && !event.shiftKey;
    let finalFrame = startFrame;
    const onMove = (moveEvent) => {
      const next = resizeProposalFrame(
        startFrame,
        handle,
        (moveEvent.clientX - startX) / scale,
        (moveEvent.clientY - startY) / scale,
        lockAspect ? aspectRatio : 0
      );
      finalFrame = next;
      setTransientFrames((current) => ({ ...current, [block.id]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setTransientFrames((current) => {
        const next = { ...current };
        delete next[block.id];
        return next;
      });
      commitFrame(block.id, finalFrame);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const preserveSelection = () => {
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection?.();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const commitEditingHtml = () => {
    const node = pageRef.current?.querySelector?.(`[data-project-estimate-editable-text="${cssEscapeValue(editingBlockId)}"]`);
    if (!node || !editingBlock) return;
    if (editingBlock.type !== "quote_field") {
      onBlockContent?.(editingBlock.id, projectEstimateEditorContentKey(editingBlock), node.innerHTML);
    }
  };

  const applyTextCommand = (command, value = null) => {
    if (!editingBlock) return;
    restoreSelection();
    const designPatch = {};
    const commandName = String(command || "");
    if (commandName === "fontName") designPatch.fontFamily = value;
    if (commandName === "fontSize") designPatch.fontSize = Number(value) || selectedDesign.fontSize || 17;
    if (commandName === "lineHeight") designPatch.lineHeight = Number(value) || selectedDesign.lineHeight || 1.35;
    if (commandName === "foreColor") designPatch.color = value;
    if (commandName === "hiliteColor") designPatch.backgroundColor = value === "transparent" ? "" : value;
    if (commandName === "justifyLeft") designPatch.textAlign = "left";
    if (commandName === "justifyCenter") designPatch.textAlign = "center";
    if (commandName === "justifyRight") designPatch.textAlign = "right";
    if (commandName === "justifyFull") designPatch.textAlign = "justify";
    try {
      if (["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList", "removeFormat", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].includes(commandName)) {
        document.execCommand(commandName, false, value);
      } else if (commandName === "createLink") {
        const url = window.prompt("Enter link URL", "");
        if (url) document.execCommand("createLink", false, url);
      } else if (commandName === "fontName") {
        document.execCommand("fontName", false, value);
      } else if (commandName === "foreColor" || commandName === "hiliteColor") {
        document.execCommand(commandName, false, value);
      }
    } catch {}
    Object.entries(designPatch).forEach(([key, nextValue]) => onBlockDesign?.(editingBlock.id, key, nextValue));
    commitEditingHtml();
    preserveSelection();
  };

  const startToolbarDrag = (event) => {
    if (event.target?.closest?.("button,select,input,label")) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, position: toolbarPosition };
    const onMove = (moveEvent) => {
      setToolbarPosition((current) => ({
        ...current,
        x: Math.max(12, start.position.x + moveEvent.clientX - start.x),
        y: Math.max(12, start.position.y + moveEvent.clientY - start.y),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <>
      <DndContext onDragEnd={handleDragEnd}>
        <section
          ref={pageRef}
          className="proposal-builder-page"
          data-project-estimate-document-canvas="true"
          style={{
            ...styles.luxuryPage,
            padding: 0,
            display: "block",
            position: "relative",
            overflow: "hidden",
            background: page?.design?.backgroundColor || "#ffffff",
          }}
          onMouseDown={() => {
            if (editMode) {
              commitEditingHtml();
              onEditBlock?.("");
              onSelectBlock?.("");
            }
          }}
        >
          {blocks.map((block) => (
            <ProjectEstimateDocumentElement
              key={block.id}
              block={block}
              selected={selectedBlockId === block.id}
              editing={editingBlockId === block.id}
              editMode={editMode}
              linkedFields={linkedFields}
              onSelect={() => onSelectBlock?.(block.id)}
              onEdit={() => projectEstimateIsTextBlock(block) && !block.design?.locked ? onEditBlock?.(block.id) : null}
              onReplaceImage={() => onReplaceImage?.(block)}
              onResizeStart={startResize}
              onPreserveSelection={preserveSelection}
            />
          ))}
          {editMode && selectedBlock && editingBlockId !== selectedBlock.id ? (
            <ProjectEstimateObjectToolbar
              block={selectedBlock}
              onDuplicate={() => onDuplicateBlock?.(selectedBlock.id)}
              onDelete={() => onDeleteBlock?.(selectedBlock)}
              onBringForward={() => onMoveBlockLayer?.(selectedBlock.id, "front")}
              onSendBackward={() => onMoveBlockLayer?.(selectedBlock.id, "back")}
              onReplaceImage={() => onReplaceImage?.(selectedBlock)}
            />
          ) : null}
          {editMode && selectedBlock?.type === "quote_field" ? (
            <div style={{ position: "absolute", left: proposalBlockFrame(selectedBlock, page).x, top: Math.max(0, proposalBlockFrame(selectedBlock, page).y - 28), zIndex: 400, ...styles.projectEstimateLinkedIndicator }}>
              Linked to Project Setup
            </div>
          ) : null}
        </section>
      </DndContext>
      {editMode && selectedText ? (
        <WebsiteBuilderTextEditingToolbar
          visible
          textColor={selectedDesign.color || "#0f172a"}
          highlightColor={selectedDesign.backgroundColor || "#ffffff"}
          fontFamily={selectedDesign.fontFamily || "Arial"}
          fontSize={selectedDesign.fontSize || (selectedText.type === "heading" ? 40 : 17)}
          lineHeight={selectedDesign.lineHeight || 1.35}
          fontWeight={String(selectedDesign.fontWeight || 400)}
          fontStyle={selectedDesign.fontStyle || "normal"}
          textDecoration={selectedDesign.textDecoration || "none"}
          textAlign={selectedDesign.textAlign || "left"}
          blockType={selectedText.type === "heading" ? "H2" : "P"}
          position={toolbarPosition}
          onDragStart={startToolbarDrag}
          onClose={() => {
            commitEditingHtml();
            onEditBlock?.("");
          }}
          onPreserveSelection={preserveSelection}
          onCommand={(command) => applyTextCommand(command)}
          onTextColor={(value) => applyTextCommand("foreColor", value)}
          onHighlightColor={(value) => applyTextCommand("hiliteColor", value)}
          onFontSize={(value) => applyTextCommand("fontSize", value)}
          onLineHeight={(value) => applyTextCommand("lineHeight", value)}
          onBlockType={(value) => applyTextCommand("formatBlock", value)}
          onFontFamily={(value) => applyTextCommand("fontName", value)}
          hasCopiedFormat={false}
          canStyleBox={false}
        />
      ) : null}
    </>
  );
}

function ProjectEstimateDocumentElement({
  block,
  selected,
  editing,
  editMode,
  linkedFields,
  onSelect,
  onEdit,
  onReplaceImage,
  onResizeStart,
  onPreserveSelection,
}) {
  const frame = proposalBlockFrame(block);
  const textBlock = projectEstimateIsTextBlock(block);
  const imageBlock = projectEstimateIsImageBlock(block);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.id,
    disabled: !editMode || editing || block.design?.locked,
  });
  const style = {
    position: "absolute",
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    zIndex: Number(block.design?.zIndex || block.order || 0) + 10,
    boxSizing: "border-box",
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    outline: selected && editMode ? "2px solid #0ea5e9" : "none",
    outlineOffset: 0,
    background: selected && editMode ? "rgba(14,165,233,0.035)" : "transparent",
    cursor: editing ? "text" : editMode ? "move" : "default",
    touchAction: "none",
  };
  const dragProps = !editing ? { ...listeners, ...attributes } : {};

  return (
    <div
      ref={setNodeRef}
      data-project-estimate-element={block.id}
      style={style}
      onMouseDown={(event) => {
        if (!editMode) return;
        event.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(event) => {
        if (!editMode) return;
        event.stopPropagation();
        if (textBlock) onEdit?.();
        if (imageBlock) onReplaceImage?.();
      }}
      {...dragProps}
    >
      {textBlock ? (
        <ProjectEstimateDocumentText
          block={block}
          linkedFields={linkedFields}
          editing={editing}
          onPreserveSelection={onPreserveSelection}
        />
      ) : imageBlock ? (
        <ProjectEstimateDocumentImage block={block} />
      ) : (
        <ProjectEstimateOverlayShape block={block} />
      )}
      {selected && editMode && !editing ? ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
        <span
          key={handle}
          style={{ ...styles.projectEstimateResizeHandle, ...projectEstimateResizeHandleStyle(handle), pointerEvents: "auto" }}
          onPointerDown={(event) => onResizeStart?.(block, handle, event)}
        />
      )) : null}
    </div>
  );
}

function ProjectEstimateDocumentText({ block, linkedFields, editing, onPreserveSelection }) {
  const value = resolveProposalText(projectEstimateBlockTextValue(block, linkedFields), linkedFields);
  return (
    <div
      data-project-estimate-editable-text={block.id}
      contentEditable={editing && block.type !== "quote_field"}
      suppressContentEditableWarning
      onInput={onPreserveSelection}
      onMouseUp={onPreserveSelection}
      onKeyUp={onPreserveSelection}
      style={{
        ...projectEstimateBlockTextStyle(block),
        overflow: "hidden",
        cursor: editing ? "text" : "inherit",
      }}
      dangerouslySetInnerHTML={{ __html: looksLikeRichText(value) ? value : escapeProjectEstimateHtml(value).replace(/\n/g, "<br>") }}
    />
  );
}

function ProjectEstimateDocumentImage({ block }) {
  const src = block.content?.imageUrl || block.content?.logoUrl || block.content?.defaultImageUrl || block.content?.defaultLogoUrl || "";
  return src ? (
    <img
      src={src}
      alt={block.content?.alt || block.content?.editorLabel || "Project estimate image"}
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: block.design?.objectFit || block.design?.fit || "cover",
        objectPosition: `${Number(block.design?.objectPositionX ?? 50)}% ${Number(block.design?.objectPositionY ?? 50)}%`,
        borderRadius: Number(block.design?.borderRadius || 0),
        opacity: Number(block.design?.opacity ?? 1),
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  ) : <div style={styles.proposalImagePlaceholder}>{block.content?.editorLabel || "Image"}</div>;
}

function ProjectEstimateObjectToolbar({ block, onDuplicate, onDelete, onBringForward, onSendBackward, onReplaceImage }) {
  const frame = proposalBlockFrame(block);
  return (
    <div
      data-project-estimate-object-toolbar="true"
      style={{
        position: "absolute",
        left: frame.x,
        top: Math.max(0, frame.y - 38),
        zIndex: 500,
        display: "flex",
        gap: 4,
        alignItems: "center",
        padding: 5,
        borderRadius: 8,
        border: "1px solid rgba(14,165,233,0.45)",
        background: "#ffffff",
        boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {projectEstimateIsImageBlock(block) ? <button type="button" style={styles.secondaryButton} onClick={onReplaceImage}>Replace</button> : null}
      <button type="button" style={styles.secondaryButton} onClick={onDuplicate}>Duplicate</button>
      <button type="button" style={styles.secondaryButton} onClick={onBringForward}>Forward</button>
      <button type="button" style={styles.secondaryButton} onClick={onSendBackward}>Back</button>
      <button type="button" style={styles.dangerButton} onClick={() => onDelete?.()}>Delete</button>
    </div>
  );
}

function ProjectEstimateOverlayText({ block, linkedFields }) {
  const value = resolveProposalText(projectEstimateBlockTextValue(block, linkedFields), linkedFields);
  if (looksLikeRichText(value)) {
    return <div style={projectEstimateBlockTextStyle(block)} dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return (
    <div style={projectEstimateBlockTextStyle(block)}>
      {value}
    </div>
  );
}

function ProjectEstimateOverlayImage({ block }) {
  const src = block.type === "logo" ? block.content?.logoUrl : block.content?.imageUrl;
  const zoom = Math.max(10, Number(block.design?.zoom || 100)) / 100;
  return src ? (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: Number(block.design?.borderRadius || 0), opacity: Number(block.design?.opacity ?? 1) }}>
      <img
        src={src}
        alt={block.content?.alt || block.content?.editorLabel || proposalBlockLabel(block.type)}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: block.design?.objectFit || block.design?.fit || "cover",
          objectPosition: `${Number(block.design?.objectPositionX ?? 50)}% ${Number(block.design?.objectPositionY ?? 50)}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `${Number(block.design?.objectPositionX ?? 50)}% ${Number(block.design?.objectPositionY ?? 50)}%`,
        }}
      />
    </div>
  ) : <div style={styles.proposalImagePlaceholder}>{proposalBlockLabel(block.type)}</div>;
}

function ProjectEstimateOverlayShape({ block }) {
  if (block.type === "divider") {
    return <div style={{ width: "100%", height: block.design?.thickness || 2, background: block.design?.color || "#cbd5e1", marginTop: "10%" }} />;
  }
  return <div style={{ width: "100%", height: "100%", background: block.design?.backgroundColor || block.design?.fill || "rgba(14,165,233,0.10)", border: `${block.design?.borderWidth || 1}px solid ${block.design?.borderColor || "rgba(14,165,233,0.35)"}`, borderRadius: Number(block.design?.borderRadius || 8) }} />;
}

function ProjectEstimateAddElementMenu({ onAdd }) {
  const items = [
    ["heading", "Heading"],
    ["text", "Paragraph"],
    ["text_box", "Text box"],
    ["image", "Image"],
  ];
  return (
    <div style={styles.projectEstimateAddElementMenu}>
      {items.map(([type, label]) => (
        <button key={type} type="button" onClick={() => onAdd(type)}>{label}</button>
      ))}
    </div>
  );
}

function ProposalDocumentPage({ page, linkedFields, selectedBlockId, editingBlockId, previewMode, onSelectBlock, onEditBlock, onBlockContent, onDragStart, onDropBlock }) {
  return (
    <section
      className="proposal-builder-page"
      style={{
        ...styles.proposalDocumentPage,
        background: page.design?.backgroundColor || "#ffffff",
        backgroundImage: page.design?.backgroundImageUrl ? `linear-gradient(rgba(15,23,42,${page.design.overlayOpacity || 0}), rgba(15,23,42,${page.design.overlayOpacity || 0})), url(${page.design.backgroundImageUrl})` : undefined,
      }}
    >
      {page.blocks.map((block) => (
        <div
          key={block.id}
          draggable={!previewMode}
          onDragStart={() => onDragStart(block.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => onDropBlock(block.id)}
          onClick={(event) => {
            event.stopPropagation();
            onSelectBlock(block.id);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (!previewMode && ["heading", "text"].includes(block.type)) onEditBlock(block.id);
          }}
          style={{ ...styles.proposalCanvasBlock, ...(selectedBlockId === block.id && !previewMode ? styles.proposalCanvasBlockSelected : {}) }}
        >
          <ProposalBlockRenderer
            block={block}
            linkedFields={linkedFields}
            editing={editingBlockId === block.id && !previewMode}
            onTextChange={(value) => onBlockContent(block.id, "text", value)}
            onFinishEditing={() => onEditBlock("")}
          />
        </div>
      ))}
    </section>
  );
}

function ProposalBlockRenderer({ block, linkedFields, editing = false, onTextChange, onFinishEditing }) {
  const textAlign = block.design?.textAlign || "left";
  const textStyle = {
    color: block.design?.color || (block.type === "heading" ? "#0f172a" : "#334155"),
    fontSize: Number(block.design?.fontSize || (block.type === "heading" ? 40 : 17)),
    fontWeight: Number(block.design?.fontWeight || (block.type === "heading" ? 800 : 400)),
    lineHeight: block.design?.lineHeight || (block.type === "heading" ? 1.12 : 1.6),
    textAlign,
    whiteSpace: "pre-line",
  };
  if (block.type === "heading") {
    return editing ? (
      <ProposalInlineTextEditor value={block.content?.text || ""} style={{ ...textStyle, margin: 0 }} onChange={onTextChange} onFinish={onFinishEditing} />
    ) : (
      <h1 style={textStyle}>{resolveProposalText(block.content?.text, linkedFields)}</h1>
    );
  }
  if (block.type === "text") {
    return editing ? (
      <ProposalInlineTextEditor value={block.content?.text || ""} style={textStyle} onChange={onTextChange} onFinish={onFinishEditing} />
    ) : (
      <p style={textStyle}>{resolveProposalText(block.content?.text, linkedFields)}</p>
    );
  }
  if (block.type === "image") {
    return block.content?.imageUrl ? <img src={block.content.imageUrl} alt={block.content?.alt || "Proposal image"} style={{ ...styles.proposalBuilderImage, objectFit: block.design?.objectFit || "cover" }} /> : <div style={styles.proposalImagePlaceholder}>Image block</div>;
  }
  if (block.type === "logo") {
    return block.content?.logoUrl
      ? <img src={block.content.logoUrl} alt="Builder logo" style={{ ...styles.proposalBuilderLogo, width: Number(block.design?.width || 210), height: Number(block.design?.height || 130) }} />
      : <div style={{ ...styles.proposalLogoBox, width: Number(block.design?.width || 210), height: Number(block.design?.height || 130) }}>Builder Logo</div>;
  }
  if (block.type === "quote_field") {
    const field = linkedFields[block.content?.fieldKey] || { label: "Linked field", value: "" };
    return <div style={{ ...styles.proposalLinkedField, textAlign }}><span>{block.content?.label || field.label}</span><strong>{field.value || "-"}</strong></div>;
  }
  if (block.type === "pricing_summary") {
    return (
      <div style={styles.proposalPricingSummary}>
        <h3>{block.content?.heading || "Pricing Summary"}</h3>
        {linkedFields.pricingGroups.value.map((group) => <div key={group.stageNumber} style={styles.proposalPriceCard}><span>{group.stageNumber} - {group.label}</span><strong>{money(group.total)}</strong></div>)}
        <div style={styles.proposalTotalLine}><span>Final Quote Total</span><strong>{linkedFields.quoteTotal.value}</strong></div>
      </div>
    );
  }
  if (block.type === "inclusions") {
    return <ProposalSimpleList title={block.content?.heading || "Inclusions"} intro={block.content?.intro || ""} rows={(block.content?.items || []).length ? block.content.items : linkedFields.inclusions.value} />;
  }
  if (block.type === "signature") {
    return <div style={styles.proposalSignaturePanel}><h3>{block.content?.heading || "Acceptance"}</h3><p style={styles.proposalMultilineText}>{block.content?.text || "I/we accept this proposal and authorise the works to proceed."}</p><div style={styles.proposalSignatureLine}>Client signature</div></div>;
  }
  if (block.type === "spacer") {
    return <div style={{ height: Number(block.design?.height || 32) }} />;
  }
  if (block.type === "divider") {
    return <hr style={{ border: 0, borderTop: `${block.design?.thickness || 2}px solid ${block.design?.color || "#cbd5e1"}` }} />;
  }
  return null;
}

function ProposalInlineTextEditor({ value, style, onChange, onFinish }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) return;
    node.focus();
    node.selectionStart = node.value.length;
    node.selectionEnd = node.value.length;
  }, []);

  return (
    <textarea
      ref={editorRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onFinish}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onFinish();
        }
      }}
      style={{
        ...styles.proposalInlineTextarea,
        ...style,
        textAlign: style?.textAlign || "left",
      }}
    />
  );
}

function ProposalSimpleList({ title, intro, rows }) {
  return (
    <div style={styles.proposalListBlock}>
      <h3>{title}</h3>
      {intro ? <p style={styles.proposalMultilineText}>{intro}</p> : null}
      <ul>{rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}</ul>
    </div>
  );
}

function EstimateInclusionsBrochure({ packageData, accent = "#c89d4a", compact = false }) {
  const data = packageData?.package ? packageData : selectedEstimateInclusionsPackage(packageData);
  const sections = (data.sections || []).slice(0, compact ? 4 : 10);
  const suppliers = data.suppliers || [];
  return (
    <div style={{ ...styles.estimateBrochure, ...(compact ? styles.estimateBrochureCompact : {}) }}>
      <div style={styles.estimateBrochureIntro}>
        <span style={{ ...styles.luxuryEyebrow, color: accent }}>{data.package?.name || "Luxury Inclusions"}</span>
        <h2 style={styles.luxurySectionTitle}>Standard Inclusions Schedule</h2>
        <p style={styles.luxuryBodyText}>{data.package?.description || "A premium inclusions package tailored by the builder for this estimate."}</p>
      </div>
      <div style={styles.estimateBrochureSectionGrid}>
        {sections.map((section, index) => (
          <article key={section.id} style={{ ...styles.estimateBrochureSection, ...(index === 0 ? styles.estimateBrochureSectionFeature : {}) }}>
            <div style={styles.estimateBrochureImageWrap}>
              {section.hero_image_url || section.image_url ? (
                <img src={section.hero_image_url || section.image_url} alt={section.title} style={styles.estimateBrochureImage} />
              ) : (
                <div style={styles.estimateBrochureImagePlaceholder}>{section.title}</div>
              )}
            </div>
            <div style={styles.estimateBrochureCopy}>
              <span style={{ color: accent }}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{section.title}</h3>
              {section.subtitle ? <strong>{section.subtitle}</strong> : null}
              {section.body ? <p>{section.body}</p> : null}
              <ul>
                {(section.bullets || []).slice(0, compact ? 4 : 6).map((bullet, bulletIndex) => (
                  <li key={`${section.id}-${bulletIndex}`}>{bullet}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      {suppliers.length ? (
        <div style={styles.estimateBrochureSuppliers}>
          <strong>Supplier network</strong>
          <div>
            {suppliers.slice(0, compact ? 4 : 10).map((supplier) => (
              <span key={supplier.id} style={styles.estimateBrochureSupplierLogo}>
                {supplier.logo_url ? <img src={supplier.logo_url} alt={supplier.supplier_name} /> : null}
                <b>{supplier.supplier_name || supplier.category || "Supplier"}</b>
                {supplier.category ? <small>{supplier.category}</small> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProposalPropertiesPanel({ page, block, linkedFields, readonly, onPageChange, onBlockContent, onBlockDesign, onMoveBlock, onDuplicateBlock, onRemoveBlock, onUploadLogo, onUploadImage, onUploadBackground }) {
  return (
    <div style={styles.proposalPropertiesStack}>
      <h3>Page</h3>
      <ProposalPanelInput label="Page title" value={page.title} disabled={readonly} onCommit={(value) => onPageChange({ title: value })} />
      <ProposalPanelColor label="Background colour" value={page.design?.backgroundColor || "#ffffff"} disabled={readonly} onChange={(value) => onPageChange({ design: { ...page.design, backgroundColor: value } })} />
      <ProposalPanelInput label="Background image URL" value={page.design?.backgroundImageUrl || ""} disabled={readonly} onCommit={(value) => onPageChange({ design: { ...page.design, backgroundImageUrl: value } })} />
      <button style={styles.secondaryButton} disabled={readonly} onClick={onUploadBackground}>Upload background</button>
      <ProposalPanelInput label="Overlay opacity" type="number" value={page.design?.overlayOpacity || 0} disabled={readonly} onCommit={(value) => onPageChange({ design: { ...page.design, overlayOpacity: value } })} />
      <h3>Selected Block</h3>
      {!block ? <p style={styles.mutedText}>Select a block on the canvas.</p> : (
        <>
          <div style={styles.proposalSelectedBlockHeader}>
            <strong>{proposalBlockLabel(block.type)}</strong>
            <div style={styles.proposalMiniActions}>
              <button disabled={readonly} onClick={() => onMoveBlock(block.id, -1)}>Up</button>
              <button disabled={readonly} onClick={() => onMoveBlock(block.id, 1)}>Down</button>
              <button disabled={readonly} onClick={() => onDuplicateBlock(block.id)}>Duplicate</button>
              <button disabled={readonly} onClick={() => onRemoveBlock(block.id)}>Delete</button>
            </div>
          </div>
          <ProposalBlockFields block={block} linkedFields={linkedFields} readonly={readonly} onBlockContent={onBlockContent} onBlockDesign={onBlockDesign} onUploadLogo={onUploadLogo} onUploadImage={onUploadImage} />
        </>
      )}
    </div>
  );
}

function ProposalBlockFields({ block, linkedFields, readonly, onBlockContent, onBlockDesign, onUploadLogo, onUploadImage }) {
  const blockId = block.id;
  return (
    <div style={styles.proposalPropertiesStack}>
      {["heading", "text"].includes(block.type) && (
        <>
          <ProposalPanelTextarea label="Text" value={block.content?.text || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "text", value)} />
          <ProposalPanelInput label="Font size" type="number" value={block.design?.fontSize || ""} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "fontSize", value)} />
          <ProposalPanelInput label="Font weight" type="number" value={block.design?.fontWeight || (block.type === "heading" ? 800 : 400)} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "fontWeight", value)} />
          <ProposalPanelInput label="Line height" type="number" value={block.design?.lineHeight || 1.6} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "lineHeight", value)} />
          <ProposalPanelColor label="Text colour" value={block.design?.color || "#0f172a"} disabled={readonly} onChange={(value) => onBlockDesign(blockId, "color", value)} />
          <ProposalPanelSelect label="Alignment" value={block.design?.textAlign || "left"} disabled={readonly} options={["left", "center", "right"]} onChange={(value) => onBlockDesign(blockId, "textAlign", value)} />
        </>
      )}
      {block.type === "quote_field" && (
        <>
          <ProposalPanelSelect label="Linked workbook field" value={block.content?.fieldKey || "clientName"} disabled={readonly} options={Object.keys(linkedFields).filter((key) => !["pricingGroups", "inclusions"].includes(key))} labels={linkedFields} onChange={(value) => onBlockContent(blockId, "fieldKey", value)} />
          <ProposalPanelInput label="Display label" value={block.content?.label || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "label", value)} />
          <ProposalPanelSelect label="Alignment" value={block.design?.textAlign || "left"} disabled={readonly} options={["left", "center", "right"]} onChange={(value) => onBlockDesign(blockId, "textAlign", value)} />
        </>
      )}
      {block.type === "image" && (
        <>
          <ProposalPanelInput label="Image URL" value={block.content?.imageUrl || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "imageUrl", value)} />
          <button style={styles.secondaryButton} disabled={readonly} onClick={onUploadImage}>Upload image</button>
          <ProposalPanelSelect label="Object fit" value={block.design?.objectFit || "cover"} disabled={readonly} options={["cover", "contain"]} onChange={(value) => onBlockDesign(blockId, "objectFit", value)} />
        </>
      )}
      {block.type === "logo" && (
        <>
          <ProposalPanelInput label="Logo URL" value={block.content?.logoUrl || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "logoUrl", value)} />
          <button style={styles.secondaryButton} disabled={readonly} onClick={onUploadLogo}>Upload logo</button>
          <ProposalPanelInput label="Logo width" type="number" value={block.design?.width || 210} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "width", value)} />
          <ProposalPanelInput label="Logo height" type="number" value={block.design?.height || 130} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "height", value)} />
        </>
      )}
      {block.type === "pricing_summary" && <ProposalPanelInput label="Heading" value={block.content?.heading || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "heading", value)} />}
      {block.type === "inclusions" && (
        <>
          <ProposalPanelInput label="Heading" value={block.content?.heading || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "heading", value)} />
          <ProposalPanelTextarea label="Manual inclusions override, one per line" value={(block.content?.items || []).join("\n")} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "items", value.split("\n").filter(Boolean))} />
        </>
      )}
      {block.type === "signature" && (
        <>
          <ProposalPanelInput label="Heading" value={block.content?.heading || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "heading", value)} />
          <ProposalPanelTextarea label="Acceptance text" value={block.content?.text || ""} disabled={readonly} onCommit={(value) => onBlockContent(blockId, "text", value)} />
        </>
      )}
      {block.type === "spacer" && <ProposalPanelInput label="Height" type="number" value={block.design?.height || 32} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "height", value)} />}
      {block.type === "divider" && (
        <>
          <ProposalPanelColor label="Colour" value={block.design?.color || "#cbd5e1"} disabled={readonly} onChange={(value) => onBlockDesign(blockId, "color", value)} />
          <ProposalPanelInput label="Thickness" type="number" value={block.design?.thickness || 2} disabled={readonly} onCommit={(value) => onBlockDesign(blockId, "thickness", value)} />
        </>
      )}
    </div>
  );
}

function ProposalPanelInput({ label, value, onCommit, disabled, type = "text" }) {
  return <label style={styles.proposalPanelField}><span>{label}</span><BufferedInput commitOnChange disabled={disabled} type={type} style={styles.proposalPanelInput} value={value ?? ""} onCommit={onCommit} /></label>;
}

function NumberCommitInput({ label, value, onCommit, disabled }) {
  return (
    <label style={styles.proposalPanelField}>
      <span>{label}</span>
      <BufferedInput
        commitOnChange
        disabled={disabled}
        type="number"
        step="0.5"
        style={styles.proposalPanelInput}
        value={value ?? 0}
        onCommit={(nextValue) => onCommit?.(Number(nextValue) || 0)}
      />
    </label>
  );
}

function ProposalPanelTextarea({ label, value, onCommit, disabled }) {
  return <label style={styles.proposalPanelField}><span>{label}</span><BufferedTextarea commitOnChange disabled={disabled} style={styles.proposalPanelTextarea} value={value || ""} onCommit={onCommit} /></label>;
}

function ProposalPanelColor({ label, value, onChange, disabled }) {
  return <label style={styles.proposalPanelField}><span>{label}</span><input disabled={disabled} type="color" value={value || "#ffffff"} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ProposalPanelSelect({ label, value, options, labels = {}, onChange, disabled }) {
  return (
    <label style={styles.proposalPanelField}>
      <span>{label}</span>
      <select disabled={disabled} style={styles.proposalPanelInput} value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels[option]?.label || pretty(option)}</option>)}
      </select>
    </label>
  );
}

function ClientMeta({ label, value }) {
  return (
    <div style={styles.clientMetaItem}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ClientTextBlock({ title, value, summary, collapsed, onToggle }) {
  if (!String(value || "").trim()) return null;
  return (
    <section style={styles.clientSection}>
      <button style={styles.clientSectionToggle} onClick={onToggle}>
        <span>{collapsed ? ">" : "v"} {title}</span>
        <small style={styles.clientBlockSummary}>{summary}</small>
      </button>
      {!collapsed && <p style={styles.clientParagraph}>{value}</p>}
    </section>
  );
}

function ProjectEstimateContextualInspector({
  page,
  block,
  inclusionsDocument,
  pricedPlans,
  revisions = [],
  readonly,
  editMode,
  onToggleEditMode,
  onBlockContent,
  onBlockDesign,
  onSelectedBlockDesign,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
  onSelectBlock,
  onRenameBlock,
  activeTab = "properties",
  onActiveTab,
  addElementOpen = false,
  onToggleAddElement,
  onAddBlock,
  onUploadLogo,
  onUploadImage,
  onOpenMediaLibrary,
  onOpenAiRewrite,
  onUndo,
  onRedo,
  onViewDocument,
  onUploadStandardInclusions,
  onUploadModifiedInclusions,
  onUploadPlans,
  onRemoveInclusions,
  onRemovePlans,
  onOpenDocumentLibrary,
}) {
  const definition = projectEstimatePageDefinitionFor(page?.page_type || page?.id);
  if (!definition) return null;
  const tabs = (
    <>
      <div style={styles.projectEstimateInspectorTabs}>
        <button type="button" style={activeTab === "properties" ? styles.projectEstimateInspectorTabActive : styles.projectEstimateInspectorTab} onClick={() => onActiveTab?.("properties")}>Edit</button>
        <button type="button" style={activeTab === "layers" ? styles.projectEstimateInspectorTabActive : styles.projectEstimateInspectorTab} onClick={() => onActiveTab?.("layers")}>Layers</button>
      </div>
      {editMode ? (
        <div style={styles.projectEstimateAddDock}>
          <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={onToggleAddElement}>Add</button>
          {addElementOpen ? <ProjectEstimateAddElementMenu onAdd={onAddBlock} /> : null}
        </div>
      ) : null}
    </>
  );
  if (["standardInclusions", "pricedPlans"].includes(page?.page_type || page?.id)) {
    const documentTabs = (
      <div style={styles.projectEstimateInspectorTabs}>
        <button type="button" style={activeTab === "properties" ? styles.projectEstimateInspectorTabActive : styles.projectEstimateInspectorTab} onClick={() => onActiveTab?.("properties")}>Edit</button>
        <button type="button" style={activeTab === "layers" ? styles.projectEstimateInspectorTabActive : styles.projectEstimateInspectorTab} onClick={() => onActiveTab?.("layers")}>Layers</button>
      </div>
    );
    if (activeTab === "layers") {
      return (
        <div style={styles.proposalPropertiesStack}>
          {documentTabs}
          <p style={styles.mutedText}>Imported PDF contents are fixed document pages.</p>
        </div>
      );
    }
    return (
      <ProjectEstimateDocumentSlotPanel
        tabs={documentTabs}
        page={page}
        readonly={readonly}
        inclusionsDocument={inclusionsDocument}
        pricedPlans={pricedPlans}
        onViewDocument={onViewDocument}
        onUploadStandardInclusions={onUploadStandardInclusions}
        onUploadModifiedInclusions={onUploadModifiedInclusions}
        onUploadPlans={onUploadPlans}
        onRemoveInclusions={onRemoveInclusions}
        onRemovePlans={onRemovePlans}
        onOpenDocumentLibrary={onOpenDocumentLibrary}
      />
    );
  }
  if (activeTab === "layers") {
    return (
      <div style={styles.proposalPropertiesStack}>
        {tabs}
        <ProjectEstimateLayersPanel page={page} selectedBlockId={block?.id || ""} readonly={readonly} onSelectBlock={onSelectBlock} onMoveBlock={onMoveBlock} onBlockDesign={onBlockDesign} />
      </div>
    );
  }
  const frame = block ? proposalBlockFrame(block, page) : null;
  const setContent = (key, value) => block && onBlockContent(block.id, key, value);
  const setDesign = (key, value) => block && onBlockDesign(block.id, key, value);
  if (!block) {
    return (
      <div style={styles.proposalPropertiesStack}>
        {tabs}
        <button type="button" style={editMode ? styles.primaryButton : styles.secondaryButton} disabled={readonly} onClick={onToggleEditMode}>{editMode ? "Done Editing" : "Edit Page"}</button>
        <h3>{definition.navigationTitle}</h3>
        <p style={styles.mutedText}>Click text or an image on the page to edit it.</p>
        {process.env.NODE_ENV !== "production" ? (
          <ProjectEstimatePageRecoveryPanel page={page} revisions={revisions} />
        ) : null}
      </div>
    );
  }
  const field = definition.editorFields.find((item) => item.blockId === block.id) || {
    blockId: block.id,
    label: block.content?.editorLabel || block.type || "Element",
    type: block.type === "heading" ? "textarea" : "text",
  };
  const contentKey = projectEstimateEditorContentKey(block);
  const value = block.content?.[contentKey] || "";
  const isText = ["heading", "text", "quote_field", "signature"].includes(block.type);
  const isImage = ["image", "logo"].includes(block.type);
  const isShape = ["shape", "container", "divider", "spacer"].includes(block.type);
  return (
    <div style={styles.proposalPropertiesStack}>
      {tabs}
      <h3>{definition.navigationTitle}</h3>
      <p style={styles.mutedText}>{block.content?.editorLabel || field.label || proposalBlockLabel(block.type)}</p>
      {isText ? (
        <>
          <h4 style={styles.proposalPanelSubheading}>Content</h4>
          <button type="button" style={styles.primaryButton} disabled={readonly} onClick={onOpenAiRewrite}>Rewrite with AI</button>
          <ProposalPanelTextarea label={field.label || "Content"} value={value} disabled={readonly} onCommit={(nextValue) => setContent(contentKey, nextValue)} />
          <h4 style={styles.proposalPanelSubheading}>Typography</h4>
          <ProposalPanelInput label="Font" value={block.design?.fontFamily || "Arial"} disabled={readonly} onCommit={(nextValue) => setDesign("fontFamily", nextValue)} />
          <NumberCommitInput label="Font size" value={block.design?.fontSize || (block.type === "heading" ? 40 : 17)} disabled={readonly} onCommit={(nextValue) => setDesign("fontSize", nextValue)} />
          <ProposalPanelColor label="Text colour" value={block.design?.color || "#0f172a"} disabled={readonly} onChange={(nextValue) => setDesign("color", nextValue)} />
          <ProposalPanelColor label="Background" value={block.design?.backgroundColor || "#ffffff"} disabled={readonly} onChange={(nextValue) => setDesign("backgroundColor", nextValue)} />
          <NumberCommitInput label="Line height" value={block.design?.lineHeight || 1.3} disabled={readonly} onCommit={(nextValue) => setDesign("lineHeight", nextValue)} />
          <NumberCommitInput label="Letter spacing" value={block.design?.letterSpacing || 0} disabled={readonly} onCommit={(nextValue) => setDesign("letterSpacing", nextValue)} />
        </>
      ) : null}
      {isImage ? (
        <>
          <h4 style={styles.proposalPanelSubheading}>{block.id === "cover-hero-image" ? "Hero Image Controls" : "Image Source"}</h4>
          <ProposalPanelInput label="Image URL" value={block.type === "logo" ? block.content?.logoUrl || "" : block.content?.imageUrl || ""} disabled={readonly} onCommit={(nextValue) => setContent(block.type === "logo" ? "logoUrl" : "imageUrl", nextValue)} />
          <button type="button" style={styles.primaryButton} disabled={readonly || block.design?.locked} onClick={block.type === "logo" ? onUploadLogo : onUploadImage}>Replace Image</button>
          <button type="button" style={styles.secondaryButton} disabled={readonly || block.design?.locked} onClick={block.type === "logo" ? onUploadLogo : onUploadImage}>Upload Image</button>
          <button type="button" style={styles.secondaryButton} disabled={readonly || block.design?.locked} onClick={onOpenMediaLibrary}>Media Library</button>
          <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => setContent(block.type === "logo" ? "logoUrl" : "imageUrl", "")}>Clear Image Source</button>
          <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => setContent(block.type === "logo" ? "logoUrl" : "imageUrl", block.content?.defaultImageUrl || block.content?.defaultLogoUrl || "")}>Restore Default Image</button>
          <ProposalPanelSelect label="Fit" value={block.design?.objectFit || "cover"} disabled={readonly} options={["cover", "contain", "fill"]} onChange={(nextValue) => setDesign("objectFit", nextValue)} />
          <NumberCommitInput label="Zoom" value={block.design?.zoom || 100} disabled={readonly} onCommit={(nextValue) => setDesign("zoom", nextValue)} />
          <NumberCommitInput label="Horizontal Position" value={block.design?.objectPositionX ?? 50} disabled={readonly} onCommit={(nextValue) => setDesign("objectPositionX", nextValue)} />
          <NumberCommitInput label="Vertical Position" value={block.design?.objectPositionY ?? 50} disabled={readonly} onCommit={(nextValue) => setDesign("objectPositionY", nextValue)} />
        </>
      ) : null}
      {isShape ? (
        <>
          <h4 style={styles.proposalPanelSubheading}>Background</h4>
          <ProposalPanelColor label="Fill" value={block.design?.backgroundColor || block.design?.color || "#ffffff"} disabled={readonly} onChange={(nextValue) => setDesign("backgroundColor", nextValue)} />
        </>
      ) : null}
      {frame ? (
        <>
          <h4 style={styles.proposalPanelSubheading}>Position</h4>
          <div style={styles.standardPdfGeometryGrid}>
            <NumberCommitInput label="X" value={frame.x} disabled={readonly} onCommit={(value) => onSelectedBlockDesign({ frame: { ...frame, x: value } })} />
            <NumberCommitInput label="Y" value={frame.y} disabled={readonly} onCommit={(value) => onSelectedBlockDesign({ frame: { ...frame, y: value } })} />
            <NumberCommitInput label="Width" value={frame.width} disabled={readonly} onCommit={(value) => onSelectedBlockDesign({ frame: { ...frame, width: value } })} />
            <NumberCommitInput label="Height" value={frame.height} disabled={readonly} onCommit={(value) => onSelectedBlockDesign({ frame: { ...frame, height: value } })} />
          </div>
        </>
      ) : null}
      <h4 style={styles.proposalPanelSubheading}>Border / Padding / Opacity</h4>
      <NumberCommitInput label="Padding" value={block.design?.padding || 0} disabled={readonly} onCommit={(nextValue) => setDesign("padding", nextValue)} />
      <NumberCommitInput label="Border radius" value={block.design?.borderRadius || 0} disabled={readonly} onCommit={(nextValue) => setDesign("borderRadius", nextValue)} />
      <NumberCommitInput label="Opacity" value={block.design?.opacity ?? 1} disabled={readonly} onCommit={(nextValue) => setDesign("opacity", nextValue)} />
      <h4 style={styles.proposalPanelSubheading}>Layer</h4>
      <div style={styles.proposalPanelButtonRow}>
        <button type="button" style={styles.secondaryButton} disabled={readonly || block.design?.locked} onClick={() => onMoveBlock(block.id, "front")}>Bring Forward</button>
        <button type="button" style={styles.secondaryButton} disabled={readonly || block.design?.locked} onClick={() => onMoveBlock(block.id, "back")}>Send Backward</button>
      </div>
      <div style={styles.proposalPanelButtonRow}>
        <button type="button" style={styles.secondaryButton} disabled={readonly || block.design?.locked} onClick={() => onDuplicateBlock(block.id)}>Duplicate</button>
        <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => setDesign("locked", !block.design?.locked)}>{block.design?.locked ? "Unlock" : "Lock"}</button>
        <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => onSelectedBlockDesign({ hidden: !block.design?.hidden, hiddenBySubscriber: !block.design?.hidden ? true : false })}>{block.design?.hidden ? "Show" : "Hide"}</button>
        <button type="button" style={styles.dangerButton} disabled={readonly || block.design?.locked} onClick={() => onDeleteBlock(block.id)}>Delete Element</button>
      </div>
      {process.env.NODE_ENV !== "production" ? (
        <ProjectEstimatePageRecoveryPanel page={page} revisions={revisions} />
      ) : null}
    </div>
  );
}

function ProjectEstimateDocumentSlotPanel({
  tabs,
  page,
  readonly,
  inclusionsDocument,
  pricedPlans,
  onViewDocument,
  onUploadStandardInclusions,
  onUploadModifiedInclusions,
  onUploadPlans,
  onRemoveInclusions,
  onRemovePlans,
  onOpenDocumentLibrary,
}) {
  const pageType = page?.page_type || page?.id;
  const isPlans = pageType === "pricedPlans";
  const document = isPlans ? pricedPlans : inclusionsDocument;
  const pageCount = Number(document?.pageCount || document?.page_count || document?.pages?.length || 0) || 0;
  return (
    <div style={styles.proposalPropertiesStack}>
      {tabs}
      <h3>{isPlans ? "Plans Used to Prepare This Estimate" : "Standard Inclusions Schedule"}</h3>
      <section style={styles.standardScheduleContextPanel}>
        <div style={styles.standardSchedulePanel}>
          <strong>Current file</strong>
          <span>{referencedPdfUrl(document) ? (document.fileName || document.title || "Attached PDF") : "No PDF attached"}</span>
          <span>Page count: {pageCount || "-"}</span>
        </div>
        <div style={styles.importButtonRow}>
          <button type="button" style={styles.secondaryButton} disabled={!referencedPdfUrl(document)} onClick={() => onViewDocument?.(document)}>View PDF</button>
          <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={isPlans ? onUploadPlans : onUploadStandardInclusions}>Replace PDF</button>
          <button type="button" style={styles.dangerButton} disabled={readonly || !referencedPdfUrl(document)} onClick={isPlans ? onRemovePlans : onRemoveInclusions}>Remove PDF</button>
        </div>
        {isPlans ? (
          <div style={styles.importButtonRow}>
            <button type="button" style={styles.primaryButton} disabled={readonly} onClick={onUploadPlans}>Upload Plans</button>
            <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => onOpenDocumentLibrary?.("priced_plans")}>Choose from Document Library</button>
          </div>
        ) : (
          <>
            <div style={styles.importButtonRow}>
              <button type="button" style={styles.primaryButton} disabled={readonly} onClick={onUploadStandardInclusions}>Upload Standard Inclusions</button>
              <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={onUploadModifiedInclusions}>Upload Modified Inclusions</button>
            </div>
            <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => onOpenDocumentLibrary?.("standard_inclusions")}>Choose from Document Library</button>
          </>
        )}
      </section>
    </div>
  );
}

function ProjectEstimateLayersPanel({ page, selectedBlockId, readonly, onSelectBlock, onMoveBlock, onBlockDesign }) {
  return (
    <section style={styles.projectEstimateLayersPanel}>
      {(page?.blocks || []).slice().sort((a, b) => Number(b.order || 0) - Number(a.order || 0)).map((block) => (
        <div key={block.id} style={{ ...styles.projectEstimateLayerRow, ...(selectedBlockId === block.id ? styles.projectEstimateLayerRowActive : {}) }}>
          <button type="button" style={styles.projectEstimateLayerNameButton} onClick={() => onSelectBlock(block.id)}>{block.content?.editorLabel || proposalBlockLabel(block.type)}</button>
          <button type="button" disabled={readonly || block.design?.locked} style={styles.projectEstimateLayerIconButton} onClick={() => onMoveBlock(block.id, 1)}>Up</button>
          <button type="button" disabled={readonly || block.design?.locked} style={styles.projectEstimateLayerIconButton} onClick={() => onMoveBlock(block.id, -1)}>Dn</button>
          <button type="button" disabled={readonly} style={styles.projectEstimateLayerIconButton} onClick={() => onBlockDesign(block.id, "locked", !block.design?.locked)}>{block.design?.locked ? "Unlock" : "Lock"}</button>
          <button type="button" disabled={readonly} style={styles.projectEstimateLayerIconButton} onClick={() => {
            onBlockDesign(block.id, "hidden", !block.design?.hidden);
            if (!block.design?.hidden) onBlockDesign(block.id, "hiddenBySubscriber", true);
          }}>{block.design?.hidden ? "Show" : "Hide"}</button>
        </div>
      ))}
    </section>
  );
}

function ProjectEstimateMediaLibraryModal({ assets = [], loading = false, onClose, onSelect }) {
  return (
    <div style={styles.projectEstimateMediaOverlay} onMouseDown={onClose}>
      <div style={styles.projectEstimateMediaDialog} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.projectEstimateMediaHeader}>
          <strong>Media Library</strong>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>Close</button>
        </div>
        {loading ? <p style={styles.mutedText}>Loading media...</p> : null}
        {!loading && !assets.length ? <p style={styles.mutedText}>No images found in the shared Media Library.</p> : null}
        <div style={styles.projectEstimateMediaGrid}>
          {assets.map((asset) => {
            const src = asset?.src || asset?.url || asset?.publicUrl || "";
            if (!src) return null;
            return (
              <button key={asset.id || src} type="button" style={styles.projectEstimateMediaItem} onClick={() => onSelect(asset)}>
                <img src={src} alt={asset.name || "Media Library image"} style={styles.projectEstimateMediaThumb} />
                <span>{asset.name || "Library image"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectEstimateAiRewriteModal({ instruction, preview, onInstruction, onTryAgain, onReplace, onClose }) {
  const options = [
    "Make more professional",
    "Make clearer",
    "Make shorter",
    "Make warmer",
    "Make more persuasive",
    "Fix spelling and grammar",
    "Rewrite for my business",
    "Custom instruction",
  ];
  return (
    <div style={styles.projectEstimateMediaOverlay}>
      <div style={styles.projectEstimateMediaDialog}>
        <div style={styles.projectEstimateMediaHeader}>
          <strong>Rewrite with AI</strong>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>Cancel</button>
        </div>
        <label style={styles.proposalPanelField}>
          <span>Action</span>
          <select style={styles.proposalPanelInput} value={instruction} onChange={(event) => onInstruction(event.target.value)}>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        {instruction === "Custom instruction" ? (
          <ProposalPanelTextarea label="Custom instruction" value={instruction} onCommit={onInstruction} />
        ) : null}
        <label style={styles.proposalPanelField}>
          <span>Proposed replacement</span>
          <textarea readOnly style={{ ...styles.proposalPanelTextarea, minHeight: 180 }} value={preview || ""} />
        </label>
        <div style={styles.proposalPanelButtonRow}>
          <button type="button" style={styles.primaryButton} onClick={onReplace}>Replace Text</button>
          <button type="button" style={styles.secondaryButton} onClick={onTryAgain}>Try Again</button>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ProjectEstimatePageRecoveryPanel({ page, revisions = [] }) {
  const pageRevisions = projectEstimateRevisionsForPage(revisions, page?.page_type || page?.id);
  return (
    <details>
      <summary style={styles.proposalPanelSummary}>Page recovery</summary>
      {!pageRevisions.length ? <p style={styles.mutedText}>No page revisions saved yet.</p> : null}
      {pageRevisions.map((revision) => (
        <div key={`${revision.pageId}-${revision.savedAt}`} style={styles.proposalThemeStatRow}>
          <span>{revision.pageId}</span>
          <small>{revision.savedAt}</small>
        </div>
      ))}
    </details>
  );
}

function projectEstimateEditorContentKey(block = {}) {
  if (block.type === "signature") return "text";
  if (block.type === "pricing_summary") return "heading";
  if (Object.prototype.hasOwnProperty.call(block.content || {}, "text")) return "text";
  if (Object.prototype.hasOwnProperty.call(block.content || {}, "heading")) return "heading";
  return "text";
}

function projectEstimatePageContentOverrides(page = {}) {
  return (page.blocks || []).reduce((overrides, block) => {
    const contentKey = projectEstimateEditorContentKey(block);
    if (block.content && Object.prototype.hasOwnProperty.call(block.content, contentKey)) {
      overrides[block.id] = block.content[contentKey];
    }
    return overrides;
  }, {});
}

const PROJECT_ESTIMATE_PAGE_WIDTH = 794;
const PROJECT_ESTIMATE_PAGE_HEIGHT = 1123;

function normaliseProposalFrame(frame = null, block = {}) {
  const fallback = defaultProposalBlockFrame(block);
  return {
    x: clampNumber(Number(frame?.x ?? fallback.x), 0, PROJECT_ESTIMATE_PAGE_WIDTH - 24),
    y: clampNumber(Number(frame?.y ?? fallback.y), 0, PROJECT_ESTIMATE_PAGE_HEIGHT - 24),
    width: clampNumber(Number(frame?.width ?? fallback.width), 24, PROJECT_ESTIMATE_PAGE_WIDTH),
    height: clampNumber(Number(frame?.height ?? fallback.height), 18, PROJECT_ESTIMATE_PAGE_HEIGHT),
  };
}

function proposalBlockFrame(block = {}) {
  return normaliseProposalFrame(block.design?.frame, block);
}

function defaultProposalBlockFrame(block = {}) {
  const id = String(block.id || "");
  const order = Number(block.order || 0);
  if (id === "cover-hero-image") return { x: 0, y: 0, width: 794, height: 1123 };
  if (id === "cover-document-label") return { x: 74, y: 294, width: 520, height: 56 };
  if (id === "cover-title") return { x: 74, y: 350, width: 590, height: 112 };
  if (id === "cover-client-site") return { x: 74, y: 500, width: 450, height: 92 };
  if (id === "cover-intro") return { x: 74, y: 610, width: 500, height: 92 };
  if (id === "cover-estimate-number") return { x: 74, y: 1028, width: 220, height: 44 };
  if (id === "cover-estimate-date") return { x: 520, y: 1028, width: 210, height: 44 };
  if (block.type === "logo") return { x: 54, y: 48, width: 180, height: 90 };
  if (block.type === "image") return { x: 112, y: 238, width: 570, height: 320 };
  if (block.type === "divider") return { x: 74, y: 470 + order * 12, width: 210, height: 14 };
  if (block.type === "spacer") return { x: 74, y: 170 + order * 78, width: 300, height: Number(block.design?.height || 32) };
  return { x: 74, y: 150 + order * 118, width: block.type === "heading" ? 610 : 560, height: block.type === "heading" ? 92 : 86 };
}

function projectEstimateElementWithFrame(block = {}, pageType = "") {
  const frame = block.design?.frame || projectEstimateDefaultElementFrame(pageType, block);
  return {
    ...block,
    design: {
      ...(block.design || {}),
      frame,
      frameEdited: Boolean(block.design?.frameEdited),
    },
  };
}

function projectEstimateDefaultElementFrame(pageType = "", block = {}) {
  const id = String(block.id || "");
  const frames = {
    cover: {
      "cover-hero-image": { x: 0, y: 0, width: 794, height: 1123 },
      "cover-document-label": { x: 74, y: 312, width: 560, height: 42 },
      "cover-title": { x: 74, y: 360, width: 610, height: 132 },
      "cover-client-site": { x: 74, y: 524, width: 520, height: 82 },
      "cover-intro": { x: 74, y: 620, width: 520, height: 88 },
      "cover-estimate-number": { x: 74, y: 1028, width: 240, height: 42 },
      "cover-estimate-date": { x: 520, y: 1028, width: 220, height: 42 },
    },
    estimateSummary: {
      "estimateSummary-eyebrow": { x: 54, y: 150, width: 220, height: 32 },
      "estimateSummary-heading": { x: 54, y: 190, width: 660, height: 98 },
      "estimateSummary-intro": { x: 54, y: 306, width: 660, height: 96 },
      "estimateSummary-notice-heading": { x: 84, y: 854, width: 610, height: 44 },
      "estimateSummary-notice-body": { x: 84, y: 908, width: 610, height: 112 },
    },
    about: {
      "about-heading": { x: 40, y: 142, width: 330, height: 118 },
      "about-about-copy": { x: 40, y: 270, width: 330, height: 122 },
      "about-hero-image": { x: 404, y: 142, width: 350, height: 252 },
      "about-detail-image": { x: 557, y: 286, width: 151, height: 118 },
      "about-eyebrow": { x: 40, y: 430, width: 220, height: 28 },
      "about-subhead": { x: 40, y: 462, width: 690, height: 58 },
      "about-card-1-title": { x: 58, y: 548, width: 190, height: 24 },
      "about-card-1-body": { x: 58, y: 576, width: 190, height: 74 },
      "about-card-2-title": { x: 286, y: 548, width: 190, height: 24 },
      "about-card-2-body": { x: 286, y: 576, width: 190, height: 74 },
      "about-card-3-title": { x: 514, y: 548, width: 190, height: 24 },
      "about-card-3-body": { x: 514, y: 576, width: 190, height: 74 },
      "about-card-4-title": { x: 58, y: 684, width: 190, height: 24 },
      "about-card-4-body": { x: 58, y: 712, width: 190, height: 98 },
      "about-card-5-title": { x: 286, y: 684, width: 190, height: 24 },
      "about-card-5-body": { x: 286, y: 712, width: 190, height: 98 },
      "about-card-6-title": { x: 514, y: 684, width: 190, height: 24 },
      "about-card-6-body": { x: 514, y: 712, width: 190, height: 98 },
    },
    pricing: {
      "pricing-eyebrow": { x: 74, y: 160, width: 240, height: 34 },
      "pricing-heading": { x: 74, y: 205, width: 640, height: 88 },
      "pricing-intro": { x: 74, y: 330, width: 640, height: 95 },
      "pricing-pricing-summary": { x: 74, y: 520, width: 640, height: 52 },
      "pricing-total-line": { x: 74, y: 958, width: 640, height: 60 },
    },
    termsNotes: {
      "termsNotes-eyebrow": { x: 54, y: 142, width: 280, height: 32 },
      "termsNotes-heading": { x: 54, y: 190, width: 660, height: 94 },
      "termsNotes-intro": { x: 74, y: 336, width: 620, height: 104 },
      "termsNotes-quote-timing-heading": { x: 74, y: 502, width: 620, height: 42 },
      "termsNotes-quote-timing-list": { x: 74, y: 556, width: 620, height: 220 },
      "termsNotes-footer": { x: 74, y: 850, width: 620, height: 110 },
    },
    acceptance: {
      "acceptance-eyebrow": { x: 54, y: 150, width: 240, height: 32 },
      "acceptance-heading": { x: 54, y: 198, width: 660, height: 88 },
      "acceptance-intro": { x: 54, y: 312, width: 660, height: 90 },
      "acceptance-acknowledgement": { x: 74, y: 690, width: 620, height: 130 },
    },
  };
  return frames[pageType]?.[id] || defaultProposalBlockFrame(block);
}

function projectEstimateIsTextBlock(block = {}) {
  return ["heading", "text", "quote_field", "signature", "pricing_summary"].includes(block.type);
}

function projectEstimateIsImageBlock(block = {}) {
  return ["image", "logo"].includes(block.type) || String(block.id || "").includes("image");
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function moveProposalFrame(frame = null, dx = 0, dy = 0) {
  const current = normaliseProposalFrame(frame);
  const snap = 18;
  const nextX = clampNumber(current.x + dx, 0, PROJECT_ESTIMATE_PAGE_WIDTH - current.width);
  const nextY = clampNumber(current.y + dy, 0, PROJECT_ESTIMATE_PAGE_HEIGHT - current.height);
  return {
    ...current,
    x: Math.abs(nextX - snap) < 8 ? snap : nextX,
    y: Math.abs(nextY - snap) < 8 ? snap : nextY,
  };
}

function resizeProposalFrame(frame = null, handle = "se", dx = 0, dy = 0, aspectRatio = 0) {
  const current = normaliseProposalFrame(frame);
  let { x, y, width, height } = current;
  if (handle.includes("e")) width += dx;
  if (handle.includes("s")) height += dy;
  if (handle.includes("w")) {
    x += dx;
    width -= dx;
  }
  if (handle.includes("n")) {
    y += dy;
    height -= dy;
  }
  if (aspectRatio > 0 && (handle.includes("e") || handle.includes("w")) && (handle.includes("n") || handle.includes("s"))) {
    height = width / aspectRatio;
    if (handle.includes("n")) y = current.y + (current.height - height);
  } else if (aspectRatio > 0 && (handle.includes("e") || handle.includes("w"))) {
    height = width / aspectRatio;
  } else if (aspectRatio > 0 && (handle.includes("n") || handle.includes("s"))) {
    width = height * aspectRatio;
    if (handle.includes("w")) x = current.x + (current.width - width);
  }
  width = clampNumber(width, 36, PROJECT_ESTIMATE_PAGE_WIDTH - x);
  height = clampNumber(height, 24, PROJECT_ESTIMATE_PAGE_HEIGHT - y);
  x = clampNumber(x, 0, PROJECT_ESTIMATE_PAGE_WIDTH - width);
  y = clampNumber(y, 0, PROJECT_ESTIMATE_PAGE_HEIGHT - height);
  return { x, y, width, height };
}

function projectEstimateResizeHandleStyle(handle) {
  const offset = -6;
  const middle = "calc(50% - 6px)";
  const map = {
    nw: { left: offset, top: offset, cursor: "nwse-resize" },
    n: { left: middle, top: offset, cursor: "ns-resize" },
    ne: { right: offset, top: offset, cursor: "nesw-resize" },
    e: { right: offset, top: middle, cursor: "ew-resize" },
    se: { right: offset, bottom: offset, cursor: "nwse-resize" },
    s: { left: middle, bottom: offset, cursor: "ns-resize" },
    sw: { left: offset, bottom: offset, cursor: "nesw-resize" },
    w: { left: offset, top: middle, cursor: "ew-resize" },
  };
  return map[handle] || map.se;
}

function projectEstimateBlockRawTextValue(block = {}) {
  const key = projectEstimateEditorContentKey(block);
  if (block.content?.[key] !== undefined) return block.content[key];
  if (block.content?.label) return block.content.label;
  return "";
}

function escapeProjectEstimateHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssEscapeValue(value = "") {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(String(value || ""));
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function isSubscriberProjectEstimateBlock(block = {}, page = {}) {
  if (block.id === "cover-hero-image") return false;
  const pageType = page?.page_type || page?.id || "";
  if (!pageType) return true;
  return !defaultProjectEstimateBlocks(pageType).some((defaultBlock) => defaultBlock.id === block.id);
}

function looksLikeRichText(value = "") {
  return /<\/?(span|strong|b|em|i|u|font|div|p|br|ul|ol|li|h[1-6])\b/i.test(String(value || ""));
}

function normaliseProjectEstimateEditableText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function projectEstimateAiRewriteText(value = "", instruction = "Make clearer", client = {}) {
  const text = normaliseProjectEstimateEditableText(value);
  if (!text) return "";
  const builderName = client.companyName || "our building team";
  const projectAddress = client.projectAddress || "your project";
  const action = String(instruction || "").toLowerCase();
  if (action.includes("shorter")) return text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  if (action.includes("warmer")) return `We are pleased to help with ${projectAddress}. ${text}`.replace(/\s+/g, " ").trim();
  if (action.includes("persuasive")) return `${text}\n\nThis gives you a clear, practical path forward with ${builderName}, while keeping scope, selections and next steps easy to understand.`;
  if (action.includes("business")) return text.replace(/\bour building team\b/gi, builderName).replace(/\bthe builder\b/gi, builderName);
  if (action.includes("professional")) {
    return text.replace(/\bget\b/gi, "receive").replace(/\bstuff\b/gi, "items").replace(/\bdone\b/gi, "completed").replace(/\s+/g, " ").trim();
  }
  if (action.includes("spelling") || action.includes("grammar") || action.includes("clearer")) {
    return text.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/(^|[.!?]\s+)([a-z])/g, (_, start, char) => `${start}${char.toUpperCase()}`).trim();
  }
  return `${text}\n\n${instruction}`;
}

function projectEstimateBlockTextValue(block = {}, linkedFields = {}) {
  if (block.type === "quote_field") {
    const field = linkedFields[block.content?.fieldKey] || {};
    return `${block.content?.label || field.label || "Linked field"}\n${field.value || "-"}`;
  }
  return projectEstimateBlockRawTextValue(block);
}

function projectEstimateBlockTextStyle(block = {}) {
  const design = block.design || {};
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    padding: Number(design.padding || 0),
    color: design.color || (block.type === "heading" ? "#ffffff" : "#0f172a"),
    background: design.backgroundColor && design.backgroundColor !== "#ffffff" ? design.backgroundColor : "transparent",
    fontFamily: design.fontFamily || "Arial",
    fontSize: Number(design.fontSize || (block.type === "heading" ? 40 : 17)),
    fontWeight: Number(design.fontWeight || (block.type === "heading" ? 800 : 500)),
    fontStyle: design.fontStyle || "normal",
    textDecoration: design.textDecoration || "none",
    lineHeight: design.lineHeight || 1.25,
    letterSpacing: Number(design.letterSpacing || 0),
    textAlign: design.textAlign || "left",
    opacity: Number(design.opacity ?? 1),
    whiteSpace: "pre-wrap",
    overflow: "hidden",
    borderRadius: Number(design.borderRadius || 0),
  };
}

function createProposalVisualElement(type, linkedFields, order = 0) {
  const mappedType = type === "paragraph" ? "text" : type;
  const baseType = mappedType === "text_box" ? "text" : mappedType;
  const block = createProposalBuilderBlock(baseType, linkedFields, order, {
    content: {
      text: ["heading"].includes(baseType) ? "New heading" : "New text block",
      editorLabel: proposalBlockLabel(mappedType),
      ...(baseType === "image" ? { imageUrl: "/assets/builders/standard-inclusions-hero.jpg", defaultImageUrl: "/assets/builders/standard-inclusions-hero.jpg" } : {}),
    },
    design: {
      frame: { x: 247, y: 431, width: 300, height: baseType === "image" ? 220 : 110 },
      fontSize: baseType === "heading" ? 36 : 18,
      color: "#0f172a",
      backgroundColor: mappedType === "text_box" ? "#ffffff" : "transparent",
      borderColor: mappedType === "text_box" ? "#cbd5e1" : "transparent",
      borderWidth: mappedType === "text_box" ? 1 : 0,
      padding: mappedType === "text_box" ? 12 : 0,
    },
  });
  return normaliseProposalBuilderBlock({ ...block, type: baseType, source: "builder-created" });
}

function ProjectEstimateSheet({ sheet }) {
  const standardSource = workbookStandardInclusionsSource(sheet.workbook);
  const standardOptions = normaliseStandardInclusions(standardSource, sheet.workbook.builderId || "local-builder");
  const standard = selectedStandardInclusionsPackage(standardSource);
  return (
    <div style={styles.projectEstimateShell}>
      <div style={styles.projectEstimateBaselineBar}>
        <strong>Priced using: {standard.package?.name || "Premier Range Inclusions"}</strong>
        <select
          style={styles.selectInput}
          value={sheet.workbook.selected_standard_inclusions_package_id || standard.selectedPackageId || ""}
          onChange={(event) => sheet.selectStandardInclusionsPackage?.(event.target.value)}
        >
          {standardOptions.packages.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      <ClientPageSheet sheet={sheet} />
    </div>
  );
}

function ProductLibrarySheet({ sheet }) {
  const readonly = sheet.previewMode;
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [bulkSupplier, setBulkSupplier] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkActive, setBulkActive] = useState("");
  const products = useMemo(() => productLibraryProducts(sheet), [sheet.workbook.productLibrary, sheet.preview, sheet.quoteSections]);
  const savedCount = sheet.workbook.productLibrary?.products?.length || 0;
  const categories = useMemo(() => uniqueProductValues(products, "category"), [products]);
  const suppliers = useMemo(() => uniqueProductValues(products, "supplier"), [products]);
  const filteredProducts = useMemo(() => filterProductLibraryProducts(products, { search, categoryFilter, supplierFilter, activeFilter }), [products, search, categoryFilter, supplierFilter, activeFilter]);
  const stats = productLibraryStats(products);

  function saveProducts(nextProducts, extra = {}) {
    sheet.updateProductLibrary?.({
      ...(sheet.workbook.productLibrary || {}),
      products: nextProducts,
      updatedAt: new Date().toISOString(),
      ...extra,
    });
  }

  function updateProduct(id, key, value) {
    saveProducts(products.map((product) => product.id === id ? { ...product, [key]: value } : product));
  }

  function addProduct() {
    saveProducts([blankProductLibraryRecord(products.length + 1), ...products]);
    setMessage("Added a blank product row.");
  }

  function seedFromQuoteSheet() {
    const nextProducts = deriveProductLibraryFromQuoteSheet(sheet);
    saveProducts(nextProducts, { importedAt: new Date().toISOString() });
    setMessage(`Seeded Product Library from ${nextProducts.length} Quote Sheet rows.`);
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsvObjects(String(reader.result || ""));
        const nextPreview = previewProductLibraryImport(products, rows);
        setPreview(nextPreview);
        setMessage(`Import preview ready: ${nextPreview.newProducts.length} new, ${nextPreview.updatedProducts.length} updated, ${nextPreview.removedProducts.length} removed/deactivated, ${nextPreview.unchangedProducts.length} unchanged, ${nextPreview.invalidRows.length} invalid.`);
      } catch (error) {
        setPreview(null);
        setMessage(error?.message || "Product Library CSV could not be imported.");
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!preview) return;
    saveProducts(applyProductLibraryImport(products, preview), { importedAt: new Date().toISOString() });
    setMessage(`Product Library updated: ${preview.newProducts.length} new, ${preview.updatedProducts.length} updated, ${preview.removedProducts.length} deactivated.`);
    setPreview(null);
  }

  function applyBulkUpdate() {
    if (!bulkSupplier && !bulkCategory && !bulkActive) {
      setMessage("Choose at least one bulk update value first.");
      return;
    }
    const visibleIds = new Set(filteredProducts.map((product) => product.id));
    saveProducts(products.map((product) => visibleIds.has(product.id) ? {
      ...product,
      ...(bulkSupplier ? { supplier: bulkSupplier } : {}),
      ...(bulkCategory ? { category: bulkCategory } : {}),
      ...(bulkActive ? { active: bulkActive } : {}),
    } : product));
    setMessage(`Bulk updated ${visibleIds.size} visible products.`);
  }

  return (
    <div style={styles.productLibraryShell}>
      <section style={{ ...styles.dashboardHero, background: WORKSPACE_VISUALS.productLibrary.gradient }}>
        <div style={styles.dashboardHeroCopy}>
          <span style={styles.dashboardHeroIcon}><Package size={38} strokeWidth={2.4} /></span>
          <div>
            <div style={styles.dashboardEyebrow}>Builder Catalogue</div>
            <h2 style={styles.dashboardTitle}>Product Library</h2>
            <p style={styles.dashboardSubtitle}>Start from the current Quote Sheet, then export, edit, re-upload, add, update or deactivate product records.</p>
          </div>
        </div>
        <div style={styles.dashboardTotalCard}>
          <span>{savedCount ? "Saved products" : "Quote Sheet starter rows"}</span>
          <strong>{products.length}</strong>
        </div>
      </section>

      <section style={styles.productLibraryToolbar}>
        <input style={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, supplier, brand, notes" />
        <select style={styles.productLibrarySelect} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select style={styles.productLibrarySelect} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
          <option value="all">All suppliers</option>
          {suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>
        <select style={styles.productLibrarySelect} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">Active & inactive</option>
        </select>
        <button type="button" disabled={readonly} style={styles.primaryButton} onClick={addProduct}>Add product</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={seedFromQuoteSheet}>Seed from Quote Sheet</button>
      </section>

      <section style={styles.productLibraryActions}>
        <button type="button" style={styles.secondaryButton} onClick={() => exportProductLibraryCsv(products, sheet)}>Export CSV</button>
        <button type="button" style={styles.secondaryButton} onClick={downloadProductLibraryTemplate}>Download CSV template</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => fileRef.current?.click()}>Upload CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleImportFile} />
        <span style={styles.productLibraryStatus}>{message || `${stats.active} active, ${stats.inactive} inactive, ${filteredProducts.length} visible.`}</span>
      </section>

      <section style={styles.productLibraryBulkBar}>
        <strong>Bulk update visible rows</strong>
        <input style={styles.productLibraryMiniInput} value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} placeholder="Set category" />
        <input style={styles.productLibraryMiniInput} value={bulkSupplier} onChange={(event) => setBulkSupplier(event.target.value)} placeholder="Set supplier" />
        <select style={styles.productLibrarySelect} value={bulkActive} onChange={(event) => setBulkActive(event.target.value)}>
          <option value="">Leave active status</option>
          <option value="yes">Set active yes</option>
          <option value="no">Set active no</option>
        </select>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={applyBulkUpdate}>Apply bulk update</button>
      </section>

      {preview ? <ProductLibraryImportPreview preview={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} readonly={readonly} /> : null}

      <section style={styles.productLibraryTableWrap}>
        <div style={styles.productLibraryTable}>
          <div style={{ ...styles.productLibraryRow, ...styles.productLibraryHeaderRow }}>
            {PRODUCT_LIBRARY_HEADERS.map((header) => <strong key={header}>{header}</strong>)}
            <strong>Actions</strong>
          </div>
          {filteredProducts.map((product) => (
            <div key={product.id} style={styles.productLibraryRow}>
              <ProductLibraryCell value={product.product_code} disabled={readonly} onCommit={(value) => updateProduct(product.id, "product_code", value)} />
              <ProductLibraryCell value={product.category} disabled={readonly} onCommit={(value) => updateProduct(product.id, "category", value)} />
              <ProductLibraryCell value={product.subcategory} disabled={readonly} onCommit={(value) => updateProduct(product.id, "subcategory", value)} />
              <ProductLibraryCell value={product.product_name} disabled={readonly} onCommit={(value) => updateProduct(product.id, "product_name", value)} />
              <ProductLibraryCell value={product.description} disabled={readonly} onCommit={(value) => updateProduct(product.id, "description", value)} />
              <ProductLibraryCell value={product.unit} disabled={readonly} onCommit={(value) => updateProduct(product.id, "unit", value)} />
              <ProductLibraryCell value={product.supplier} disabled={readonly} onCommit={(value) => updateProduct(product.id, "supplier", value)} />
              <ProductLibraryCell value={product.brand} disabled={readonly} onCommit={(value) => updateProduct(product.id, "brand", value)} />
              <ProductLibraryCell value={product.cost_price} disabled={readonly} onCommit={(value) => updateProduct(product.id, "cost_price", value)} />
              <ProductLibraryCell value={product.sell_price} disabled={readonly} onCommit={(value) => updateProduct(product.id, "sell_price", value)} />
              <ProductLibraryCell value={product.margin_percent} disabled={readonly} onCommit={(value) => updateProduct(product.id, "margin_percent", value)} />
              <ProductLibraryCell value={product.gst} disabled={readonly} onCommit={(value) => updateProduct(product.id, "gst", value)} />
              <ProductLibraryYesNo value={product.allowance_item} disabled={readonly} onCommit={(value) => updateProduct(product.id, "allowance_item", value)} />
              <ProductLibraryYesNo value={product.active} disabled={readonly} onCommit={(value) => updateProduct(product.id, "active", value)} />
              <ProductLibraryCell value={product.notes} disabled={readonly} onCommit={(value) => updateProduct(product.id, "notes", value)} />
              <span style={styles.productLibraryActionCell}>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => updateProduct(product.id, "active", "no")}>Deactivate</button>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => saveProducts(products.filter((item) => item.id !== product.id))}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductLibraryCell({ value: currentValue, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(currentValue || "");
  useEffect(() => setDraft(currentValue || ""), [currentValue]);
  return (
    <input
      disabled={disabled}
      style={styles.productLibraryCellInput}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit?.(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ProductLibraryYesNo({ value, onCommit, disabled = false }) {
  return (
    <select disabled={disabled} style={styles.productLibraryCellInput} value={yesNo(value)} onChange={(event) => onCommit?.(event.target.value)}>
      <option value="yes">yes</option>
      <option value="no">no</option>
    </select>
  );
}

function ProductLibraryImportPreview({ preview, onConfirm, onCancel, readonly }) {
  const groups = [
    ["New products", preview.newProducts],
    ["Updated products", preview.updatedProducts],
    ["Removed/deactivated products", preview.removedProducts],
    ["Unchanged products", preview.unchangedProducts],
    ["Invalid rows", preview.invalidRows],
  ];
  return (
    <section style={styles.productLibraryPreview}>
      <div style={styles.dashboardPanelHeader}>
        <div>
          <h3 style={styles.dashboardPanelTitle}>CSV Import Preview</h3>
          <p style={styles.dashboardPanelSubtitle}>Review the CSV changes before saving them into the workbook.</p>
        </div>
        <span>
          <button type="button" disabled={readonly || preview.invalidRows.length > 0} style={styles.primaryButton} onClick={onConfirm}>Confirm import</button>
          <button type="button" style={styles.secondaryButton} onClick={onCancel}>Cancel</button>
        </span>
      </div>
      <div style={styles.productLibraryPreviewGrid}>
        {groups.map(([label, rows]) => (
          <div key={label} style={styles.productLibraryPreviewCard}>
            <strong>{label}: {rows.length}</strong>
            <div style={styles.productLibraryPreviewList}>
              {rows.slice(0, 8).map((item, index) => <span key={`${label}-${index}`}>{productLibraryPreviewLabel(item)}</span>)}
              {rows.length > 8 ? <span>+ {rows.length - 8} more</span> : null}
              {!rows.length ? <span>None</span> : null}
            </div>
          </div>
        ))}
      </div>
      {preview.invalidRows.length ? <p style={styles.errorText}>Fix invalid rows and upload again before confirming the import.</p> : null}
    </section>
  );
}

export function StandardInclusionsSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const { workspaceId } = useWorkspace();
  const workbookId = sheet.workbook?.id || sheet.workbook?.jobId || sheet.workbook?.openedFileName || "local";
  const pdfUploadRef = useRef(null);
  const pptxUploadRef = useRef(null);
  const replacePageRef = useRef(null);
  const elementFileRef = useRef(null);
  const exportPagesRef = useRef(null);
  const elementUploadTargetRef = useRef(null);
  const [standardStatus, setStandardStatus] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("");
  const [managementMode, setManagementMode] = useState("");
  const [savedScheduleCandidates, setSavedScheduleCandidates] = useState([]);
  const [savedScheduleLoading, setSavedScheduleLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const onlyOfficeAuthToken = "";
  const standard = normaliseStandardInclusions(workbookStandardInclusionsSource(sheet.workbook), sheet.workbook.builderId || "local-builder");
  const pages = normalisePremierPdfPages(standard.pdfPages);
  const selectedPageId = standard.selectedPdfPageId || pages[0]?.id || "";
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0] || null;
  const selectedPageIndex = pages.findIndex((page) => page.id === selectedPage?.id);
  const usesEditableCanvasEditor = Boolean(selectedPage);
  const selectedElement = selectedPage?.elements?.find((element) => element.id === selectedElementId) || null;
  const activeDocument = !standard.scheduleDeleted && Array.isArray(standard.documentBuilder?.pages) && standard.documentBuilder.pages.length
    ? standard.documentBuilder
    : null;
  const activeOnlyOfficeDocumentId = !standard.scheduleDeleted ? standard.onlyOfficeDocumentId || "" : "";
  const activeSummary = standardScheduleSummary(activeDocument, standard);

  async function saveStandard(next, options = {}) {
    const nextStandard = normaliseStandardInclusions({
      ...standard,
      ...next,
      pdfEditorMode: "document-page-builder",
    }, sheet.workbook.builderId || "local-builder");
    const savedStandard = await sheet.updateStandardInclusions?.(nextStandard, options);
    return normaliseStandardInclusions(savedStandard || nextStandard, sheet.workbook.builderId || "local-builder");
  }

  function saveDocumentBuilder(nextDocument) {
    const document = markStandardDocumentSaved(nextDocument, standard);
    saveStandard({
      documentBuilder: document,
      source: document.metadata?.documentSource || standard.activeDocumentSource || "document-builder",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: document.id,
      activeDocumentName: document.name,
      activeDocumentSource: document.metadata?.documentSource || standard.activeDocumentSource || "document-builder",
      activeDocumentLastSavedAt: document.metadata?.lastSavedAt || new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    });
    setStandardStatus("Standard Inclusions document saved.");
  }

  async function saveStandardWithRevision(patch, action, source = "", options = {}) {
    const revision = createStandardScheduleRevision(standard, action, source);
    const previousRevisionId = standard.revisionHistory?.[standard.revisionHistory.length - 1]?.revisionId || "";
    return saveStandard({
      ...patch,
      revisionHistory: [...(standard.revisionHistory || []), { ...revision, previousRevisionId }].slice(-50),
    }, options);
  }

  async function loadSavedSchedules() {
    setSavedScheduleLoading(true);
    setManagementMode("replace");
    try {
      const candidates = await collectSavedStandardScheduleCandidates({ workbook: sheet.workbook, standard });
      setSavedScheduleCandidates(candidates);
      setStandardStatus(candidates.length ? `Found ${candidates.length} saved schedule candidate${candidates.length === 1 ? "" : "s"}.` : "No saved Standard Inclusions documents were found.");
    } catch (error) {
      console.error("Saved Standard Inclusions lookup failed", error);
      setStandardStatus(error?.message || "Could not load saved schedules.");
      setSavedScheduleCandidates([]);
    } finally {
      setSavedScheduleLoading(false);
    }
  }

  function replaceWithCandidate(candidate) {
    if (!candidate?.document) return;
    if (!window.confirm("Replace the currently displayed schedule with this saved schedule?")) return;
    const nextDocument = cloneStandardDocumentForActiveUse(candidate.document, {
      source: candidate.source || "saved-schedule",
      name: candidate.name || candidate.document.name || "Standard Inclusions Schedule",
    });
    saveStandardWithRevision({
      documentBuilder: nextDocument,
      source: nextDocument.metadata?.documentSource || candidate.source || "saved-schedule",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: nextDocument.id,
      activeDocumentName: nextDocument.name,
      activeDocumentSource: nextDocument.metadata?.documentSource || candidate.source || "saved-schedule",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    }, "replace", candidate.source || "saved-schedule");
    setManagementMode("");
    setStandardStatus("Standard Inclusions schedule replaced from saved document.");
  }

  function deleteCurrentSchedule() {
    if (!window.confirm("Delete the current Standard Inclusions Schedule from this workbook?\n\nA complete versioned backup will be retained and the Premier Template will not be reinserted automatically.")) return;
    saveStandardWithRevision({
      documentBuilder: null,
      source: "deleted",
      scheduleDeleted: true,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      activeDocumentId: "",
      activeDocumentName: "",
      activeDocumentSource: "deleted",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    }, "delete", activeSummary.source || "active-document");
    setImportPreview(null);
    setManagementMode("");
    setStandardStatus("Current Standard Inclusions schedule deleted. A backup was retained in revision history.");
  }

  function startBlankSchedule() {
    if (!window.confirm("Start a new blank Standard Inclusions Schedule? A backup of the current schedule will be retained.")) return;
    const document = createBlankStandardScheduleDocument();
    saveStandardWithRevision({
      documentBuilder: document,
      source: "blank-schedule",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: document.id,
      activeDocumentName: document.name,
      activeDocumentSource: "blank-schedule",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    }, "start-blank", "blank-schedule");
    setStandardStatus("Started a new blank Standard Inclusions schedule.");
  }

  function usePremierTemplate() {
    if (!window.confirm("Load the Premier Template? This will only happen because you explicitly selected it. A backup of the current schedule will be retained.")) return;
    const document = createPremierInclusionsWorkingCopy({
      builderId: sheet.workbook?.builderId || "local-builder",
      workbookId,
    });
    const saved = markStandardDocumentSaved({
      ...document,
      name: standard.packages?.find((item) => item.id === standard.selectedPackageId)?.name || "Premier Inclusions Schedule",
      metadata: {
        ...(document.metadata || {}),
        documentSource: "premier-template",
        templateLoadedByUser: true,
      },
    }, standard);
    saveStandardWithRevision({
      documentBuilder: saved,
      source: "premier-template",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: saved.id,
      activeDocumentName: saved.name,
      activeDocumentSource: "premier-template",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    }, "use-premier-template", "premier-template");
    setStandardStatus("Premier Template loaded by explicit request.");
  }

  function restorePreviousVersion() {
    setManagementMode("restore");
  }

  function restoreRevision(revision) {
    if (!revision?.snapshot?.documentBuilder) return;
    if (!window.confirm("Restore this previous Standard Inclusions Schedule version? A backup of the current schedule will be retained first.")) return;
    const document = cloneStandardDocumentForActiveUse(revision.snapshot.documentBuilder, {
      source: `revision:${revision.revisionId}`,
      name: revision.snapshot.documentBuilder.name || "Restored Standard Inclusions Schedule",
    });
    saveStandardWithRevision({
      documentBuilder: document,
      source: document.metadata?.documentSource || "restored-revision",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: document.id,
      activeDocumentName: document.name,
      activeDocumentSource: document.metadata?.documentSource || "restored-revision",
      activeDocumentLastSavedAt: new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: "",
      pptxSourceName: "",
      pdfEditorMode: "document-page-builder",
    }, "restore", `revision:${revision.revisionId}`);
    setManagementMode("");
    setStandardStatus("Previous Standard Inclusions schedule restored.");
  }

  async function preparePowerPointImport(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile || !String(selectedFile.name || "").toLowerCase().endsWith(".pptx")) {
      event.target.value = "";
      return;
    }
    setStandardStatus("Uploading PowerPoint...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);
      event.target.value = "";
      const response = await fetch("/api/standard-inclusions/onlyoffice/upload-pptx", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        const code = payload?.code || "POWERPOINT_UPLOAD_FAILED";
        throw new Error(`${code}: ${payload?.error || "PowerPoint upload failed."}`);
      }
      const document = payload.document;
      setStandardStatus("Opening PowerPoint in the ONLYOFFICE editor...");
      await saveStandardWithRevision({
        source: "onlyoffice-pptx",
        scheduleDeleted: false,
        isDeleted: false,
        deletedAt: null,
        activeDocumentId: document.id,
        activeDocumentName: document.source_file_name || selectedFile.name,
        activeDocumentSource: "onlyoffice-pptx",
        activeDocumentLastSavedAt: new Date().toISOString(),
        pdfPages: [],
        selectedPdfPageId: "",
        pdfSourceName: "",
        pptxSourceName: document.source_file_name || selectedFile.name,
        pdfEditorMode: "onlyoffice",
        onlyOfficeDocumentId: document.id,
        onlyOfficeVersion: Number(document.version || 1),
        onlyOfficePptxAssetId: document.current_pptx_asset_id || "",
        onlyOfficeExportedPdfAssetId: document.current_exported_pdf_asset_id || "",
      }, "upload-pptx-onlyoffice", document.source_file_name || selectedFile.name, { persist: true });
      setImportPreview(null);
      setManagementMode("");
      setStandardStatus(`PowerPoint uploaded: "${document.source_file_name || selectedFile.name}" is now open in the ONLYOFFICE editor.`);
    } catch (error) {
      event.target.value = "";
      console.error("Standard Inclusions PowerPoint upload failed", error);
      setStandardStatus(error?.message || "PowerPoint upload failed.");
    }
  }

  async function preparePdfImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || file.type !== "application/pdf") return;
    setPendingPdfFile(file);
    setManagementMode("pdf-import-options");
    setStandardStatus("Choose how to import this PDF.");
  }

  async function prepareSelectedPdfImport(mode = "editable-text") {
    const file = pendingPdfFile;
    if (!file) return;
    setStandardStatus("Preparing PDF import preview...");
    try {
      setImportPreview(await importPdfAsStandardDocumentPreview(file, { mode }));
      setPendingPdfFile(null);
      setManagementMode("import-preview");
      setStandardStatus("PDF import preview ready. Confirm to replace the active schedule.");
    } catch (error) {
      console.error("Standard Inclusions PDF preview failed", error);
      setStandardStatus(error?.message || "PDF import preview failed.");
    }
  }

  async function confirmImportPreview() {
    if (!importPreview?.document) return;
    if (!window.confirm("Replace the currently displayed schedule with this imported schedule?")) return;
    const previewPages = Array.isArray(importPreview.document.pages) ? importPreview.document.pages : [];
    if (!previewPages.length) {
      setStandardStatus("Import failed: the preview document does not contain any pages.");
      return;
    }
    const importSource = importPreview.source || importPreview.document.metadata?.documentSource || "import";
    const document = markStandardDocumentSaved({
      ...importPreview.document,
      activePageId: previewPages[0]?.id || importPreview.document.activePageId || "",
      metadata: {
        ...(importPreview.document.metadata || {}),
        documentSource: importSource,
        sourceFileName: importPreview.fileName || importPreview.document.metadata?.sourceFileName || "",
      },
    }, { ...standard, activeDocumentSource: importSource });
    let persistedStandard = null;
    try {
      persistedStandard = await saveStandardWithRevision({
      documentBuilder: document,
      source: importSource,
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: document.id,
      activeDocumentName: document.name,
      activeDocumentSource: importSource,
      activeDocumentLastSavedAt: document.metadata?.lastSavedAt || new Date().toISOString(),
      pdfPages: [],
      selectedPdfPageId: "",
      pdfSourceName: importPreview.source === "pdf-import" ? importPreview.fileName : "",
      pptxSourceName: importPreview.source === "pptx-import" ? importPreview.fileName : "",
      pdfEditorMode: "document-page-builder",
      }, importPreview.source === "pptx-import" ? "import-pptx" : "import-pdf", importPreview.fileName, { persist: true });
    } catch (error) {
      console.error("Standard Inclusions import save failed", error);
      setStandardStatus(error?.message || "Import failed: the imported schedule could not be saved.");
      return;
    }
    const persistedDocument = persistedStandard?.documentBuilder || null;
    const persistedPageCount = Array.isArray(persistedDocument?.pages) ? persistedDocument.pages.length : 0;
    if (persistedDocument?.id !== document.id || persistedPageCount !== previewPages.length || persistedStandard.scheduleDeleted) {
      setStandardStatus(`Import failed: saved document validation did not match the preview (${persistedPageCount}/${previewPages.length} pages persisted).`);
      return;
    }
    setImportPreview(null);
    setManagementMode("");
    setStandardStatus(`Imported and saved ${persistedPageCount} Standard Inclusions page${persistedPageCount === 1 ? "" : "s"}.`);
  }

  function handleOnlyOfficeDocumentUpdated(document) {
    if (!document?.id) return;
    saveStandardWithRevision({
      source: "onlyoffice-pptx",
      scheduleDeleted: false,
      isDeleted: false,
      deletedAt: null,
      activeDocumentId: document.id,
      activeDocumentName: document.source_file_name || standard.activeDocumentName,
      activeDocumentSource: "onlyoffice-pptx",
      activeDocumentLastSavedAt: new Date().toISOString(),
      onlyOfficeDocumentId: document.id,
      onlyOfficeVersion: Number(document.version || 1),
      onlyOfficePptxAssetId: document.current_pptx_asset_id || "",
      onlyOfficeExportedPdfAssetId: document.current_exported_pdf_asset_id || "",
    }, "onlyoffice-version-change", document.source_file_name || "", { persist: true });
  }

  return (
    <div style={styles.standardPdfShell}>
      <section style={styles.standardPdfToolbar}>
        <div>
          <div style={styles.eyebrow}>Document Page Builder</div>
          <h2 style={styles.cashflowTitle}>Standard Inclusions</h2>
        </div>
        {standardStatus ? <div style={styles.proposalBuilderStatus}>{standardStatus}</div> : null}
      </section>
      <input ref={pptxUploadRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: "none" }} onChange={preparePowerPointImport} />
      <input ref={pdfUploadRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={preparePdfImport} />
      {activeOnlyOfficeDocumentId ? (
        <OnlyOfficePresentationEditor
          key={`${activeOnlyOfficeDocumentId}-v${standard.onlyOfficeVersion || 1}`}
          documentId={activeOnlyOfficeDocumentId}
          authToken={onlyOfficeAuthToken}
          onStatus={setStandardStatus}
          onClose={() => setStandardStatus("ONLYOFFICE editor closed.")}
          onDocumentUpdated={handleOnlyOfficeDocumentUpdated}
        />
      ) : activeDocument ? (
        <StandardScheduleLoadedEditor
          readonly={readonly}
          activeSummary={activeSummary}
          document={activeDocument}
          workbook={sheet.workbook}
          contextPanel={(
            <StandardScheduleContextPanel
              readonly={readonly}
              revisionHistory={standard.revisionHistory || []}
              managementMode={managementMode}
              savedScheduleCandidates={savedScheduleCandidates}
              savedScheduleLoading={savedScheduleLoading}
              importPreview={importPreview}
              pendingPdfFile={pendingPdfFile}
              onChoosePdfMode={prepareSelectedPdfImport}
              onSelectCandidate={replaceWithCandidate}
              onRestoreRevision={restoreRevision}
              onCancelManagement={() => {
                setManagementMode("");
                setImportPreview(null);
                setPendingPdfFile(null);
              }}
              onConfirmImport={confirmImportPreview}
            />
          )}
          onReplace={loadSavedSchedules}
          onDelete={deleteCurrentSchedule}
          onChange={saveDocumentBuilder}
          onStatus={setStandardStatus}
        />
      ) : (
        <StandardScheduleEmptyState
          readonly={readonly}
          revisionHistory={standard.revisionHistory || []}
          managementMode={managementMode}
          savedScheduleCandidates={savedScheduleCandidates}
          savedScheduleLoading={savedScheduleLoading}
          importPreview={importPreview}
          pendingPdfFile={pendingPdfFile}
          onUploadPptx={() => pptxUploadRef.current?.click()}
          onUploadPdf={() => pdfUploadRef.current?.click()}
          onRestore={restorePreviousVersion}
          onStartBlank={startBlankSchedule}
          onUsePremierTemplate={usePremierTemplate}
          onChoosePdfMode={prepareSelectedPdfImport}
          onSelectCandidate={replaceWithCandidate}
          onRestoreRevision={restoreRevision}
          onCancelManagement={() => {
            setManagementMode("");
            setImportPreview(null);
            setPendingPdfFile(null);
          }}
          onConfirmImport={confirmImportPreview}
        />
      )}
    </div>
  );

  function savePages(nextPages, nextSelectedId = selectedPageId, message = "") {
    const ordered = normalisePremierPdfPages(nextPages).map((page, index) => ({ ...page, order: index + 1 }));
    saveStandard({
      pdfPages: ordered,
      selectedPdfPageId: nextSelectedId || ordered[0]?.id || "",
    });
    if (message) setStandardStatus(message);
  }

  async function renderPdfToPageRecords(file) {
    const pdfjsLib = await loadPdfJs();
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const importedPages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.25 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      await page.render({ canvasContext: context, viewport }).promise;
      importedPages.push({
        id: `premier-inclusions-page-${Date.now()}-${pageNumber}`,
        name: `Premier-Inclusions-Page-${String(pageNumber).padStart(2, "0")}`,
        order: pageNumber,
        backgroundImage: canvas.toDataURL("image/jpeg", 0.96),
        width: canvas.width,
        height: canvas.height,
        elements: [],
      });
    }
    return importedPages;
  }

  async function renderPptxToEditablePageRecords(file) {
    const [{ default: JSZip }, fabricModule] = await Promise.all([
      import("jszip"),
      import("fabric"),
    ]);
    const fabric = fabricModule.fabric || fabricModule.default?.fabric || fabricModule.default || fabricModule;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const parser = new DOMParser();
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (!presentationXml) throw new Error("PowerPoint file is missing ppt/presentation.xml.");
    const presentationDoc = parser.parseFromString(presentationXml, "application/xml");
    const presentationRels = await readPptxRelationships(zip, "ppt/_rels/presentation.xml.rels", parser);
    const slideSize = pptxSlideSize(presentationDoc);
    const slidePaths = pptxSlidePaths(zip, presentationDoc, presentationRels);
    if (!slidePaths.length) throw new Error("No slides found in the PowerPoint template.");

    const pages = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
      const slidePath = slidePaths[index];
      const slideXml = await zip.file(slidePath)?.async("text");
      if (!slideXml) continue;
      const slideDoc = parser.parseFromString(slideXml, "application/xml");
      const relPath = pptxSlideRelPath(slidePath);
      const rels = await readPptxRelationships(zip, relPath, parser);
      const canvasElement = document.createElement("canvas");
      canvasElement.width = 794;
      canvasElement.height = 1123;
      const canvas = new fabric.Canvas(canvasElement, {
        width: 794,
        height: 1123,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      await addPptxSlideObjectsToCanvas({ zip, fabric, canvas, slideDoc, slidePath, rels, slideSize, pageNumber: index + 1 });
      const canvasJson = canvas.toJSON(["id", "name", "role", "assetKind"]);
      const renderedImage = canvas.toDataURL({ format: "jpeg", quality: 0.96, multiplier: 2 });
      canvas.dispose();
      pages.push({
        id: `premier-inclusions-pptx-page-${Date.now()}-${index + 1}`,
        name: `Premier-Inclusions-Page-${String(index + 1).padStart(2, "0")}`,
        order: index + 1,
        backgroundImage: "",
        renderedImage,
        width: 794,
        height: 1123,
        canvasJson,
        editableTemplate: true,
        templateKind: "pptx-editable-slide",
        elements: [],
      });
    }
    const uniqueOrders = new Set(pages.map((page) => page.order));
    if (uniqueOrders.size !== pages.length) throw new Error("PowerPoint import created duplicate slide order records.");
    return pages;
  }

  async function importPremierPdf(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || file.type !== "application/pdf") return;
    setStandardStatus("Importing Premier Inclusions PDF...");
    try {
      const importedPages = await renderPdfToPageRecords(file);
      saveStandard({
        pdfSourceName: file.name,
        pdfPages: importedPages,
        selectedPdfPageId: importedPages[0]?.id || "",
      });
      setSelectedElementId("");
      setStandardStatus(`Imported ${importedPages.length} standalone page${importedPages.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Premier Inclusions PDF import failed", error);
      setStandardStatus(error?.message || "PDF import failed.");
    }
  }

  async function importPremierPowerPoint(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !String(file.name || "").toLowerCase().endsWith(".pptx")) return;
    setStandardStatus("Importing PowerPoint template as editable pages...");
    try {
      const importedPages = await renderPptxToEditablePageRecords(file);
      saveStandard({
        pptxSourceName: file.name,
        pdfSourceName: "",
        pdfPages: importedPages,
        selectedPdfPageId: importedPages[0]?.id || "",
      });
      setSelectedElementId("");
      setStandardStatus(importedPages.length === 10
        ? "PowerPoint import complete: all 10 slides imported once as 10 editable pages."
        : `PowerPoint import complete: ${importedPages.length} editable page${importedPages.length === 1 ? "" : "s"} imported. Expected 10 slides.`);
    } catch (error) {
      console.error("Premier Inclusions PowerPoint import failed", error);
      setStandardStatus(error?.message || "PowerPoint import failed.");
    }
  }

  async function replaceSelectedPage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedPage) return;
    setStandardStatus("Replacing selected page...");
    try {
      let replacement = null;
      if (file.type === "application/pdf") {
        replacement = (await renderPdfToPageRecords(file))[0] || null;
      } else if (file.type?.startsWith("image/")) {
        const imageUrl = await readFileAsDataUrl(file);
        replacement = {
          ...selectedPage,
          backgroundImage: imageUrl,
        };
      }
      if (!replacement) throw new Error("Upload a PDF page or image file.");
      savePages(pages.map((page) => page.id === selectedPage.id ? {
        ...selectedPage,
        backgroundImage: replacement.backgroundImage,
        width: replacement.width || selectedPage.width,
        height: replacement.height || selectedPage.height,
      } : page), selectedPage.id, "Selected page replaced.");
    } catch (error) {
      console.error("Replace Premier Inclusions page failed", error);
      setStandardStatus(error?.message || "Page replacement failed.");
    }
  }

  async function handleElementFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = elementUploadTargetRef.current;
    elementUploadTargetRef.current = null;
    if (!file || !file.type?.startsWith("image/") || !selectedPage || !target) return;
    const imageUrl = await readFileAsDataUrl(file);
    if (target.mode === "replace" && selectedElement) {
      updateSelectedElement({ type: target.type, imageSrc: imageUrl });
      return;
    }
    addElement(target.type, { imageSrc: imageUrl });
  }

  function selectPage(pageId) {
    saveStandard({ selectedPdfPageId: pageId });
    setSelectedElementId("");
  }

  function updateSelectedPage(patch) {
    if (!selectedPage) return;
    savePages(pages.map((page) => page.id === selectedPage.id ? { ...page, ...patch } : page), selectedPage.id);
  }

  function saveEditablePage(nextPage) {
    if (!selectedPage || !nextPage) return;
    savePages(pages.map((page) => page.id === selectedPage.id ? { ...page, ...nextPage } : page), selectedPage.id, `${nextPage.name || selectedPage.name} saved.`);
  }

  async function ensureEditablePremierPages(sourcePages = pages) {
    const { createEditablePremierPageRecord } = await import("./standard-inclusions/PremierInclusionsCanvasEditor");
    const ordered = normalisePremierPdfPages(sourcePages);
    const editablePages = [];
    for (let index = 0; index < ordered.length; index += 1) {
      editablePages.push(await createEditablePremierPageRecord(ordered[index], index));
    }
    return normalisePremierPdfPages(editablePages);
  }

  async function saveAsMasterTemplate() {
    setStandardStatus("Saving editable Premier Inclusions master template...");
    const editablePages = await ensureEditablePremierPages(pages);
    const masterPages = clonePremierPages(editablePages);
    const masterTemplate = {
      id: "premier-inclusions-master-template",
      name: "Premier Inclusions Master Template",
      savedAt: new Date().toISOString(),
      pdfPages: masterPages,
      selectedPdfPageId: masterPages[Math.max(0, selectedPageIndex)]?.id || masterPages[0]?.id || "",
      pdfEditorMode: "editable-canvas-pages",
    };
    saveStandard({ masterTemplate, pdfPages: editablePages });
    try {
      window.localStorage.setItem("premier-inclusions-master-template", JSON.stringify(masterTemplate));
    } catch {}
    setStandardStatus("Premier Inclusions master template saved.");
  }

  async function createBuilderCopy() {
    setStandardStatus("Creating builder copy from the Premier Inclusions master template...");
    const source = standard.masterTemplate?.pdfPages?.length ? standard.masterTemplate : {
      id: "premier-inclusions-master-template",
      name: "Premier Inclusions Master Template",
      pdfPages: await ensureEditablePremierPages(pages),
      selectedPdfPageId,
    };
    const copyId = `builder-premier-inclusions-${Date.now()}`;
    const sourcePages = await ensureEditablePremierPages(source.pdfPages || []);
    const copiedPages = clonePremierPages(sourcePages, copyId);
    const builderCopy = {
      id: copyId,
      builderId: sheet.workbook.builderId || "local-builder",
      name: "Builder Premier Inclusions Copy",
      createdAt: new Date().toISOString(),
      pdfPages: copiedPages,
      selectedPdfPageId: copiedPages[0]?.id || "",
      sourceMasterTemplateId: source.id || "premier-inclusions-master-template",
    };
    saveStandard({
      builderCopies: [...(standard.builderCopies || []), builderCopy],
      activeBuilderCopyId: copyId,
      pdfPages: copiedPages,
      selectedPdfPageId: builderCopy.selectedPdfPageId,
    });
    setSelectedElementId("");
    setStandardStatus("Builder copy created from the master template.");
  }

  function addElement(type, patch = {}) {
    if (!selectedPage) return;
    const element = {
      id: `premier-element-${Date.now()}`,
      type,
      text: type === "text" ? "New text" : "",
      imageSrc: patch.imageSrc || "",
      x: 12,
      y: 12,
      width: type === "text" ? 34 : 22,
      height: type === "text" ? 8 : 12,
      fontSize: 18,
      color: "#0f172a",
      background: "transparent",
      ...patch,
    };
    updateSelectedPage({ elements: [...(selectedPage.elements || []), element] });
    setSelectedElementId(element.id);
  }

  function updateSelectedElement(patch) {
    if (!selectedPage || !selectedElement) return;
    updateSelectedPage({
      elements: selectedPage.elements.map((element) => element.id === selectedElement.id ? { ...element, ...patch } : element),
    });
  }

  function deleteSelectedElement() {
    if (!selectedPage || !selectedElement) return;
    updateSelectedPage({ elements: selectedPage.elements.filter((element) => element.id !== selectedElement.id) });
    setSelectedElementId("");
  }

  function duplicatePage() {
    if (!selectedPage) return;
    const copy = {
      ...selectedPage,
      id: `premier-inclusions-page-${Date.now()}`,
      name: `${selectedPage.name} Copy`,
      elements: (selectedPage.elements || []).map((element) => ({ ...element, id: `premier-element-${Date.now()}-${Math.random().toString(16).slice(2)}` })),
    };
    const index = pages.findIndex((page) => page.id === selectedPage.id);
    const nextPages = [...pages];
    nextPages.splice(index + 1, 0, copy);
    savePages(nextPages, copy.id, "Page duplicated.");
  }

  function deletePage() {
    if (!selectedPage) return;
    const nextPages = pages.filter((page) => page.id !== selectedPage.id);
    savePages(nextPages, nextPages[0]?.id || "", "Page deleted.");
    setSelectedElementId("");
  }

  function addPage() {
    const pageNumber = pages.length + 1;
    const page = {
      id: `premier-inclusions-page-${Date.now()}`,
      name: `Premier-Inclusions-Page-${String(pageNumber).padStart(2, "0")}`,
      order: pageNumber,
      backgroundImage: "",
      width: 794,
      height: 1123,
      elements: [],
    };
    savePages([...pages, page], page.id, "Blank page added.");
  }

  function movePage(pageId, direction) {
    const index = pages.findIndex((page) => page.id === pageId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
    const nextPages = [...pages];
    const [page] = nextPages.splice(index, 1);
    nextPages.splice(nextIndex, 0, page);
    savePages(nextPages, selectedPageId, "Page order updated.");
  }

  async function downloadPremierInclusionsPdf() {
    if (!exportPagesRef.current) return;
    setStandardStatus("Preparing Premier Inclusions PDF...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const pageElements = Array.from(exportPagesRef.current.querySelectorAll("[data-premier-pdf-page='true']"));
      if (!pageElements.length) throw new Error("No Premier Inclusions pages found to export.");
      const renderedPages = [];
      for (const element of pageElements) {
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2.4,
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: Math.ceil(element.scrollWidth),
          windowHeight: Math.ceil(element.scrollHeight),
        });
        renderedPages.push({
          orientation: "portrait",
          imageData: canvas.toDataURL("image/jpeg", 0.96),
        });
      }
      const response = await fetch("/api/builders/proposal-document-export", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/pdf, application/json" },
        body: JSON.stringify({
          name: "Premier Inclusions Schedule",
          fileName: "Premier Inclusions Schedule.pdf",
          renderedPages,
        }),
      });
      const responseType = response.headers.get("content-type") || "";
      if (!response.ok) {
        throw new Error(await formatProposalExportErrorResponse(response, responseType));
      }
      if (!responseType.includes("application/pdf")) {
        throw new Error(await formatProposalExportErrorResponse(response, responseType, { responseOk: true }));
      }
      const blob = await response.blob();
      downloadBlob(blob, "Premier Inclusions Schedule.pdf");
      setStandardStatus("Premier Inclusions PDF downloaded.");
    } catch (error) {
      console.error("Premier Inclusions PDF export failed", error);
      setStandardStatus(error?.message || "Premier Inclusions PDF export failed.");
    }
  }

  return (
    <div style={styles.standardPdfShell}>
      <section style={styles.standardPdfToolbar}>
        <div>
          <div style={styles.eyebrow}>Editable Standard Inclusions</div>
          <h2 style={styles.cashflowTitle}>Premier Inclusions Schedule</h2>
          <p style={styles.dashboardPanelSubtitle}>Page 1 is rebuilt as independent editable text, image, logo and shape objects. Imported PDF pages remain visual references until each page is rebuilt.</p>
        </div>
        <div style={styles.proposalMiniActions}>
          <button type="button" disabled={readonly} style={styles.primaryButton} onClick={() => pdfUploadRef.current?.click()}>Upload Premier Inclusions PDF</button>
          <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => pptxUploadRef.current?.click()}>Upload PowerPoint Template</button>
          <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => pdfUploadRef.current?.click()}>Replace Entire PDF</button>
          <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={addPage}>Add Page</button>
          <button type="button" disabled={!pages.length} style={styles.secondaryButton} onClick={() => setStandardStatus("Use the Up and Down controls in the page list to reorder pages.")}>Reorder Pages</button>
          <button type="button" disabled={readonly || !pages.length} style={styles.secondaryButton} onClick={saveAsMasterTemplate}>Save as Master Template</button>
          <button type="button" disabled={readonly || !pages.length} style={styles.secondaryButton} onClick={createBuilderCopy}>Create Builder Copy</button>
          <button type="button" disabled={!pages.length} style={styles.primaryButton} onClick={downloadPremierInclusionsPdf}>Download Premier Inclusions PDF</button>
        </div>
        {standardStatus ? <div style={styles.proposalBuilderStatus}>{standardStatus}</div> : null}
      </section>

      <div style={{ ...styles.standardPdfLayout, ...(usesEditableCanvasEditor ? styles.standardPdfLayoutEditable : {}) }}>
        <aside style={styles.standardPdfPageList}>
          <strong>Pages</strong>
          {!pages.length ? <p style={styles.dashboardPanelSubtitle}>Upload one multi-page PDF to create standalone page records.</p> : null}
          {pages.map((page, index) => (
            <div key={page.id} style={styles.standardPdfPageListRow}>
              <button type="button" style={{ ...styles.standardPdfPageButton, ...(selectedPage?.id === page.id ? styles.standardPdfPageButtonActive : {}) }} onClick={() => selectPage(page.id)}>
                <span>{index + 1}. {page.name}</span>
                <small>{page.editableTemplate ? `${page.canvasJson?.objects?.length || 0} editable object${(page.canvasJson?.objects?.length || 0) === 1 ? "" : "s"}` : `${page.elements?.length || 0} overlay${(page.elements?.length || 0) === 1 ? "" : "s"}`}</small>
              </button>
              <span style={styles.standardPdfReorderButtons}>
                <button type="button" disabled={readonly || index === 0} style={styles.miniButton} onClick={() => movePage(page.id, -1)}>Up</button>
                <button type="button" disabled={readonly || index === pages.length - 1} style={styles.miniButton} onClick={() => movePage(page.id, 1)}>Down</button>
              </span>
            </div>
          ))}
        </aside>

        <main style={styles.standardPdfPreviewPanel}>
          {selectedPage ? (
            <PremierInclusionsCanvasEditor page={selectedPage} pageIndex={selectedPageIndex} readonly={readonly} onSavePage={saveEditablePage} />
          ) : (
            <div style={styles.standardPdfEmptyState}>Upload Premier Inclusions PDF</div>
          )}
        </main>

        {!usesEditableCanvasEditor ? <aside style={styles.standardPdfEditorPanel}>
          <h3>Page Editor</h3>
          {selectedPage ? (
            <>
              <ProposalPanelInput label="Page name" value={selectedPage.name} disabled={readonly} onCommit={(value) => updateSelectedPage({ name: value || selectedPage.name })} />
              <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => replacePageRef.current?.click()}>Replace this page</button>
              <div style={styles.proposalMiniActions}>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => addElement("text")}>Add text</button>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => {
                  elementUploadTargetRef.current = { type: "image", mode: "add" };
                  elementFileRef.current?.click();
                }}>Replace image</button>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => {
                  elementUploadTargetRef.current = { type: "logo", mode: "add" };
                  elementFileRef.current?.click();
                }}>Replace logo</button>
              </div>

              {selectedElement ? (
                <div style={styles.standardPdfElementEditor}>
                  <strong>Selected element</strong>
                  {selectedElement.type === "text" ? (
                    <>
                      <ProposalPanelTextarea label="Edit selected text" value={selectedElement.text || ""} disabled={readonly} onCommit={(value) => updateSelectedElement({ text: value })} />
                      <ProposalPanelInput label="Text colour" value={selectedElement.color || "#0f172a"} disabled={readonly} onCommit={(value) => updateSelectedElement({ color: value })} />
                      <NumberCommitInput label="Font size" value={selectedElement.fontSize || 18} disabled={readonly} onCommit={(value) => updateSelectedElement({ fontSize: value })} />
                    </>
                  ) : (
                    <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => {
                      elementUploadTargetRef.current = { type: selectedElement.type, mode: "replace" };
                      elementFileRef.current?.click();
                    }}>Replace selected {selectedElement.type}</button>
                  )}
                  <div style={styles.standardPdfGeometryGrid}>
                    <NumberCommitInput label="X %" value={selectedElement.x} disabled={readonly} onCommit={(value) => updateSelectedElement({ x: value })} />
                    <NumberCommitInput label="Y %" value={selectedElement.y} disabled={readonly} onCommit={(value) => updateSelectedElement({ y: value })} />
                    <NumberCommitInput label="Width %" value={selectedElement.width} disabled={readonly} onCommit={(value) => updateSelectedElement({ width: value })} />
                    <NumberCommitInput label="Height %" value={selectedElement.height} disabled={readonly} onCommit={(value) => updateSelectedElement({ height: value })} />
                  </div>
                  <button type="button" disabled={readonly} style={styles.dangerButton} onClick={deleteSelectedElement}>Delete selected element</button>
                </div>
              ) : (
                <p style={styles.dashboardPanelSubtitle}>Select a text, image or logo overlay on the page to edit, move, resize or delete it.</p>
              )}

              <div style={styles.proposalMiniActions}>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={duplicatePage}>Duplicate page</button>
                <button type="button" disabled={readonly} style={styles.dangerButton} onClick={deletePage}>Delete page</button>
                <button type="button" disabled={readonly} style={styles.primaryButton} onClick={() => setStandardStatus(`${selectedPage.name} saved.`)}>Save page</button>
              </div>
            </>
          ) : (
            <p style={styles.dashboardPanelSubtitle}>No page selected.</p>
          )}
        </aside> : null}
      </div>

      <div ref={exportPagesRef} style={styles.standardPdfExportStack} aria-hidden="true">
        {pages.map((page) => <PremierPdfPageCanvas key={`export-${page.id}`} page={page} exportMode />)}
      </div>

      <input ref={pdfUploadRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={importPremierPdf} />
      <input ref={pptxUploadRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: "none" }} onChange={importPremierPowerPoint} />
      <input ref={replacePageRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={replaceSelectedPage} />
      <input ref={elementFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleElementFile} />
    </div>
  );
}

function StandardScheduleLoadedEditor({
  readonly,
  activeSummary,
  document,
  workbook,
  contextPanel,
  onReplace,
  onDelete,
  onChange,
  onStatus,
}) {
  return (
    <section style={styles.standardScheduleLoadedEditor}>
      <StandardScheduleActiveSummary summary={activeSummary} />
      <div style={styles.standardScheduleEditorToolbar}>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onReplace}>Replace Schedule</button>
        <button type="button" disabled={readonly} style={styles.dangerButton} onClick={onDelete}>Delete Schedule</button>
        <span style={styles.dashboardPanelSubtitle}>Save, Preview and Export PDF are available in the editor toolbar below.</span>
      </div>
      {contextPanel}
      <DocumentPageBuilder
        document={document}
        workbook={workbook}
        readonly={readonly}
        onChange={onChange}
        onStatus={onStatus}
      />
    </section>
  );
}

function StandardScheduleActiveSummary({ summary }) {
  return (
    <div style={styles.standardScheduleSummaryCard}>
      <strong>Active Schedule</strong>
      <span>Name: {summary.name || "No schedule attached"}</span>
      <span>Document ID: {summary.documentId || "-"}</span>
      <span>Source: {summary.source || "-"}</span>
      <span>Pages: {summary.pageCount}</span>
      <span>Last saved: {formatShortDateTime(summary.lastSavedAt)}</span>
    </div>
  );
}

function StandardScheduleContextPanel({
  readonly,
  revisionHistory,
  managementMode,
  savedScheduleCandidates,
  savedScheduleLoading,
  importPreview,
  pendingPdfFile,
  onChoosePdfMode,
  onSelectCandidate,
  onRestoreRevision,
  onCancelManagement,
  onConfirmImport,
}) {
  const hasPanel = (
    (managementMode === "pdf-import-options" && pendingPdfFile) ||
    managementMode === "replace" ||
    managementMode === "restore" ||
    (managementMode === "import-preview" && importPreview)
  );
  if (!hasPanel) return null;
  return (
    <section style={styles.standardScheduleContextPanel}>
      {managementMode === "pdf-import-options" && pendingPdfFile ? (
        <div style={styles.standardSchedulePanel}>
          <div style={styles.proposalMiniActions}>
            <strong>Import PDF</strong>
            <button type="button" style={styles.secondaryButton} onClick={onCancelManagement}>Cancel</button>
          </div>
          <p style={styles.dashboardPanelSubtitle}>{pendingPdfFile.name}</p>
          <div style={styles.standardSchedulePdfChoiceGrid}>
            <button type="button" disabled={readonly} style={styles.standardScheduleChoiceButton} onClick={() => onChoosePdfMode("editable-text")}>
              <strong>Editable conversion</strong>
              <span>Extract text into editable blocks where possible and keep page visuals as references only where needed.</span>
            </button>
            <button type="button" disabled={readonly} style={styles.standardScheduleChoiceButton} onClick={() => onChoosePdfMode("background")}>
              <strong>High-quality fixed-page import</strong>
              <span>This imports each PDF page as a high-quality visual page. It is not fully editable.</span>
            </button>
          </div>
        </div>
      ) : null}
      {managementMode === "replace" ? (
        <div style={styles.standardSchedulePanel}>
          <div style={styles.proposalMiniActions}>
            <strong>Saved Standard Inclusions Documents</strong>
            <button type="button" style={styles.secondaryButton} onClick={onCancelManagement}>Close</button>
          </div>
          {savedScheduleLoading ? <p style={styles.dashboardPanelSubtitle}>Loading saved schedules...</p> : null}
          {!savedScheduleLoading && !savedScheduleCandidates.length ? <p style={styles.dashboardPanelSubtitle}>No saved Standard Inclusions schedules were found.</p> : null}
          <div style={styles.standardScheduleCandidateGrid}>
            {savedScheduleCandidates.map((candidate) => (
              <article key={candidate.key} style={styles.standardScheduleCandidateCard}>
                {candidate.thumbnail ? <img src={candidate.thumbnail} alt="" style={styles.standardScheduleThumbnail} /> : <div style={styles.standardScheduleThumbnailPlaceholder}>No preview</div>}
                <strong>{candidate.name}</strong>
                <small>ID: {candidate.documentId}</small>
                <small>Modified: {formatShortDateTime(candidate.modifiedAt)}</small>
                <small>Pages: {candidate.pageCount}</small>
                <small>Source: {candidate.source}</small>
                <button type="button" disabled={readonly} style={styles.primaryButton} onClick={() => onSelectCandidate(candidate)}>Select this schedule</button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {managementMode === "restore" ? (
        <div style={styles.standardSchedulePanel}>
          <div style={styles.proposalMiniActions}>
            <strong>Previous Versions</strong>
            <button type="button" style={styles.secondaryButton} onClick={onCancelManagement}>Close</button>
          </div>
          {!revisionHistory.length ? <p style={styles.dashboardPanelSubtitle}>No previous versions are available yet.</p> : null}
          {revisionHistory.slice().reverse().map((revision) => (
            <article key={revision.revisionId} style={styles.standardScheduleRevisionRow}>
              <span>{formatShortDateTime(revision.timestamp)} - {revision.action}</span>
              <small>ID: {revision.documentId || "-"}</small>
              <small>Pages: {revision.pageCount || 0}</small>
              <small>Source: {revision.source || "-"}</small>
              <button type="button" disabled={readonly || !revision.snapshot?.documentBuilder} style={styles.secondaryButton} onClick={() => onRestoreRevision(revision)}>Restore</button>
            </article>
          ))}
        </div>
      ) : null}
      {managementMode === "import-preview" && importPreview ? (
        <div style={styles.standardSchedulePanel}>
          <div style={styles.proposalMiniActions}>
            <strong>Import Preview</strong>
            <button type="button" style={styles.secondaryButton} onClick={onCancelManagement}>Cancel</button>
            <button type="button" disabled={readonly} style={styles.primaryButton} onClick={onConfirmImport}>Confirm Replacement</button>
          </div>
          <p style={styles.dashboardPanelSubtitle}>
            {importPreview.fileName} - {importPreview.pageCount} page{importPreview.pageCount === 1 ? "" : "s"}.
            Editable text blocks: {importPreview.editableTextCount}. Fixed visual elements: {importPreview.fixedVisualCount}.
          </p>
          {importPreview.warnings?.length ? (
            <ul style={styles.standardScheduleWarningList}>{importPreview.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
          ) : null}
          <div style={styles.standardSchedulePreviewGrid}>
            {importPreview.document.pages.slice(0, 12).map((page, index) => (
              <article key={page.id} style={styles.standardSchedulePreviewCard}>
                <div style={styles.standardSchedulePreviewPage}>
                  {page.background?.imageRef ? <img src={page.background.imageRef} alt="" style={styles.standardSchedulePreviewImage} /> : null}
                  <strong>{index + 1}</strong>
                </div>
                <span>{page.name}</span>
                <small>{page.objects.length} editable/fixed block{page.objects.length === 1 ? "" : "s"}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StandardScheduleEmptyState({
  readonly,
  revisionHistory,
  managementMode,
  savedScheduleCandidates,
  savedScheduleLoading,
  importPreview,
  pendingPdfFile,
  onUploadPptx,
  onUploadPdf,
  onRestore,
  onStartBlank,
  onUsePremierTemplate,
  onChoosePdfMode,
  onSelectCandidate,
  onRestoreRevision,
  onCancelManagement,
  onConfirmImport,
}) {
  return (
    <section style={styles.standardScheduleEmptyState}>
      <h3>No Standard Inclusions Schedule is currently loaded.</h3>
      <div style={styles.proposalMiniActions}>
        <button type="button" disabled={readonly} style={styles.primaryButton} onClick={onUploadPptx}>Upload PowerPoint</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onUploadPdf}>Upload PDF</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onStartBlank}>Create Blank Schedule</button>
        <button type="button" disabled={readonly || !revisionHistory.length} style={styles.secondaryButton} onClick={onRestore}>Restore Previous Version</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onUsePremierTemplate}>Use Premier Template</button>
      </div>
      <StandardScheduleContextPanel
        readonly={readonly}
        revisionHistory={revisionHistory}
        managementMode={managementMode}
        savedScheduleCandidates={savedScheduleCandidates}
        savedScheduleLoading={savedScheduleLoading}
        importPreview={importPreview}
        pendingPdfFile={pendingPdfFile}
        onChoosePdfMode={onChoosePdfMode}
        onSelectCandidate={onSelectCandidate}
        onRestoreRevision={onRestoreRevision}
        onCancelManagement={onCancelManagement}
        onConfirmImport={onConfirmImport}
      />
    </section>
  );
}

function standardScheduleSummary(document, standard = {}) {
  return {
    name: document?.name || standard.activeDocumentName || "",
    documentId: document?.id || standard.activeDocumentId || "",
    source: document?.metadata?.documentSource || standard.activeDocumentSource || "",
    pageCount: Array.isArray(document?.pages) ? document.pages.length : 0,
    lastSavedAt: document?.metadata?.lastSavedAt || standard.activeDocumentLastSavedAt || document?.metadata?.importedAt || "",
  };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function markStandardDocumentSaved(document, standard = {}) {
  const timestamp = new Date().toISOString();
  return createDocument({
    ...cloneJson(document),
    id: document?.id,
    name: document?.name || standard.activeDocumentName || "Standard Inclusions Schedule",
    metadata: {
      ...(document?.metadata || {}),
      documentType: "standardInclusions",
      lastSavedAt: timestamp,
      documentSource: document?.metadata?.documentSource || standard.activeDocumentSource || "document-builder",
    },
  });
}

function createStandardScheduleRevision(standard = {}, action = "update", source = "") {
  const document = standard.scheduleDeleted ? null : standard.documentBuilder || null;
  const timestamp = new Date().toISOString();
  return {
    revisionId: `standard-inclusions-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    action,
    documentId: document?.id || standard.activeDocumentId || "",
    pageCount: Array.isArray(document?.pages) ? document.pages.length : 0,
    userId: "local-user",
    source: source || document?.metadata?.documentSource || standard.activeDocumentSource || "",
    previousRevisionId: "",
    snapshot: cloneJson({
      documentBuilder: document,
      scheduleDeleted: Boolean(standard.scheduleDeleted),
      activeDocumentId: standard.activeDocumentId || document?.id || "",
      activeDocumentName: standard.activeDocumentName || document?.name || "",
      activeDocumentSource: standard.activeDocumentSource || document?.metadata?.documentSource || "",
      activeDocumentLastSavedAt: standard.activeDocumentLastSavedAt || document?.metadata?.lastSavedAt || "",
      pdfSourceName: standard.pdfSourceName || "",
      pptxSourceName: standard.pptxSourceName || "",
    }),
  };
}

function cloneStandardDocumentForActiveUse(document, { source = "saved-schedule", name = "" } = {}) {
  const timestamp = new Date().toISOString();
  return createDocument({
    ...cloneJson(document),
    id: `standard-inclusions-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || document?.name || "Standard Inclusions Schedule",
    metadata: {
      ...(document?.metadata || {}),
      documentType: "standardInclusions",
      documentSource: source,
      sourceDocumentId: document?.id || "",
      importedAt: timestamp,
      lastSavedAt: timestamp,
    },
  });
}

function createBlankStandardScheduleDocument() {
  const timestamp = new Date().toISOString();
  const page = createA4Page({ name: "Blank Page" });
  return createDocument({
    id: `standard-inclusions-blank-${Date.now()}`,
    name: "Blank Standard Inclusions Schedule",
    pages: [page],
    activePageId: page.id,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "blank-schedule",
      createdAt: timestamp,
      lastSavedAt: timestamp,
    },
  });
}

async function collectSavedStandardScheduleCandidates({ workbook, standard }) {
  const candidates = [];
  const addCandidate = (document, meta = {}) => {
    if (!document?.pages?.length) return;
    const documentId = document.id || meta.documentId || "";
    const key = `${meta.source || "source"}:${documentId}:${meta.modifiedAt || ""}`;
    if (candidates.some((item) => item.key === key || (documentId && item.documentId === documentId))) return;
    candidates.push({
      key,
      name: document.name || meta.name || "Standard Inclusions Schedule",
      documentId,
      modifiedAt: meta.modifiedAt || document.metadata?.lastSavedAt || document.metadata?.importedAt || "",
      pageCount: document.pages.length,
      source: meta.source || document.metadata?.documentSource || "saved-document",
      thumbnail: standardDocumentThumbnail(document),
      document: cloneJson(document),
    });
  };
  addCandidate(standard.documentBuilder, { source: "current-workbook", modifiedAt: standard.activeDocumentLastSavedAt });
  (standard.revisionHistory || []).forEach((revision) => addCandidate(revision.snapshot?.documentBuilder, {
    source: `revision:${revision.action}`,
    modifiedAt: revision.timestamp,
  }));
  (standard.builderCopies || []).forEach((copy) => {
    if (copy.documentBuilder) addCandidate(copy.documentBuilder, { source: "builder-copy", modifiedAt: copy.createdAt || copy.savedAt });
  });
  if (standard.masterTemplate?.documentBuilder) addCandidate(standard.masterTemplate.documentBuilder, { source: "master-template", modifiedAt: standard.masterTemplate.savedAt });
  const indexedDbCandidates = await collectIndexedDbStandardScheduleCandidates();
  indexedDbCandidates.forEach((candidate) => addCandidate(candidate.document, candidate));
  return candidates.sort((left, right) => String(right.modifiedAt || "").localeCompare(String(left.modifiedAt || "")));
}

function standardDocumentThumbnail(document) {
  const firstPage = document?.pages?.[0];
  return firstPage?.background?.imageRef || firstPage?.objects?.find((object) => ["image", "logo"].includes(object.type))?.data?.imageRef || "";
}

async function collectIndexedDbStandardScheduleCandidates() {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const db = await new Promise((resolve) => {
    const request = window.indexedDB.open("estimate-builder-template-db");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  if (!db || !db.objectStoreNames.contains("jobs")) return [];
  return new Promise((resolve) => {
    const candidates = [];
    const transaction = db.transaction("jobs", "readonly");
    const store = transaction.objectStore("jobs");
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value || {};
      const workbook = record.workbook || record;
      const document = workbook?.standardInclusions?.documentBuilder;
      if (document?.pages?.length) {
        candidates.push({
          source: `IndexedDB:${record.type || "job"}`,
          modifiedAt: record.modifiedAt || record.savedAt || workbook.savedAt || "",
          name: `${record.name || workbook.name || workbook.jobName || "Saved job"} - ${document.name || "Standard Inclusions"}`,
          document,
        });
      }
      cursor.continue();
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(candidates);
    };
    transaction.onerror = () => {
      db.close();
      resolve(candidates);
    };
  });
}

async function renderPowerPointSlideBaseImages(file, { tenantId = "" } = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || "";
  const form = new FormData();
  form.append("file", file, file.name || "standard-inclusions.pptx");
  form.append("tenantId", tenantId || "");
  const response = await fetch("/api/standard-inclusions/pptx/render-preview-pdf", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.pdfDataUrl) {
    throw new Error(payload?.error || "PowerPoint slide rendering failed. Configure ONLYOFFICE before importing editable PowerPoint schedules.");
  }
  const slideImages = await renderPdfDataUrlToPageImages(payload.pdfDataUrl);
  if (!slideImages.length) throw new Error("PowerPoint slide rendering completed but produced no page images.");
  return {
    slideImages,
    documentId: payload.documentId || "",
    pptxAssetId: payload.pptxAssetId || "",
    renderSource: payload.renderSource || "onlyoffice",
  };
}

async function renderPdfDataUrlToPageImages(pdfDataUrl) {
  const pdfjsLib = await loadPdfJs();
  const bytes = await fetch(pdfDataUrl).then((response) => response.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const slideImages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    await page.render({ canvasContext: context, viewport }).promise;
    slideImages.push(canvas.toDataURL("image/png"));
  }
  return slideImages;
}

async function importPdfAsStandardDocumentPreview(file, { mode = "editable-text" } = {}) {
  const pdfjsLib = await loadPdfJs();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  let editableTextCount = 0;
  const warnings = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.25 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    await page.render({ canvasContext: context, viewport }).promise;
    const objects = [];
    if (mode === "editable-text") {
      const textContent = await page.getTextContent().catch(() => null);
      (textContent?.items || []).forEach((item, index) => {
        const text = String(item.str || "").trim();
        if (!text) return;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const x = tx[4];
        const y = canvas.height - tx[5];
        objects.push(createObject("text", {
          name: `Extracted text ${index + 1}`,
          x: (x / canvas.width) * 794,
          y: (y / canvas.height) * 1123,
          width: Math.min(700, Math.max(80, Number(item.width || 80) * (794 / canvas.width))),
          height: 24,
          style: { fontFamily: "Arial", fontSize: 13, fontWeight: "500", color: "#0f172a", lineHeight: 1.2, textAlign: "left" },
          data: { text },
        }));
        editableTextCount += 1;
      });
      if (!objects.length) warnings.push(`Page ${pageNumber}: no editable text could be extracted; page will import as a fixed visual page.`);
    }
    pages.push(createA4Page({
      id: `standard-inclusions-pdf-page-${Date.now()}-${pageNumber}`,
      name: `PDF Page ${pageNumber}`,
      background: { color: "#ffffff", imageRef: canvas.toDataURL("image/jpeg", 0.94) },
      objects,
    }));
  }
  const timestamp = new Date().toISOString();
  const documentBuilder = createDocument({
    id: `standard-inclusions-pdf-${Date.now()}`,
    name: file.name.replace(/\.pdf$/i, "") || "Imported PDF Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "pdf-import",
      importMode: mode,
      sourceFileName: file.name,
      importedAt: timestamp,
      lastSavedAt: timestamp,
    },
  });
  return { source: "pdf-import", fileName: file.name, document: documentBuilder, pageCount: pages.length, editableTextCount, fixedVisualCount: mode === "background" ? pages.length : warnings.length, warnings };
}

async function importPptxAsStandardDocumentPreview(file) {
  const [{ default: JSZip }] = await Promise.all([import("jszip")]);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presentationXml) throw new Error("PowerPoint file is missing ppt/presentation.xml.");
  const presentationDoc = parser.parseFromString(presentationXml, "application/xml");
  const presentationRels = await readPptxRelationships(zip, "ppt/_rels/presentation.xml.rels", parser);
  const slideSize = pptxSlideSize(presentationDoc);
  const slidePaths = pptxSlidePaths(zip, presentationDoc, presentationRels);
  if (!slidePaths.length) throw new Error("No slides found in the PowerPoint file.");
  const pages = [];
  const warnings = [];
  let editableTextCount = 0;
  let fixedVisualCount = 0;
  for (let index = 0; index < slidePaths.length; index += 1) {
    const slidePath = slidePaths[index];
    const slideXml = await zip.file(slidePath)?.async("text");
    if (!slideXml) continue;
    const slideDoc = parser.parseFromString(slideXml, "application/xml");
    const rels = await readPptxRelationships(zip, pptxSlideRelPath(slidePath), parser);
    const context = await createPptxSlideImportContext({ zip, parser, slideDoc, slidePath, rels, slideSize });
    const { objects, warningCount } = await pptxSlideToDocumentObjects({ zip, context, pageNumber: index + 1 });
    editableTextCount += objects.filter((object) => object.type === "text").length;
    fixedVisualCount += objects.filter((object) => object.data?.fixedVisual === true).length;
    if (warningCount) warnings.push(`Slide ${index + 1}: ${warningCount} unsupported element${warningCount === 1 ? "" : "s"} imported as fixed visual blocks.`);
    pages.push(createA4Page({
      id: `standard-inclusions-pptx-page-${Date.now()}-${index + 1}`,
      name: `Slide ${index + 1}`,
      background: { color: "#ffffff" },
      objects,
    }));
  }
  const timestamp = new Date().toISOString();
  const documentBuilder = createDocument({
    id: `standard-inclusions-pptx-${Date.now()}`,
    name: file.name.replace(/\.pptx$/i, "") || "Imported PowerPoint Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "pptx-import",
      sourceFileName: file.name,
      importedAt: timestamp,
      lastSavedAt: timestamp,
    },
  });
  return { source: "pptx-import", fileName: file.name, document: documentBuilder, pageCount: pages.length, editableTextCount, fixedVisualCount, warnings };
}

async function createPptxSlideImportContext({ zip, parser, slideDoc, slidePath, rels, slideSize }) {
  const layoutRel = Object.values(rels || {}).find((rel) => /slideLayout$/i.test(rel.type || ""));
  const layoutPath = layoutRel?.target ? normaliseZipPath(slidePath.split("/").slice(0, -1).join("/"), layoutRel.target) : "";
  const layoutDoc = layoutPath ? parser.parseFromString(await zip.file(layoutPath)?.async("text") || "", "application/xml") : null;
  const layoutRels = layoutPath ? await readPptxRelationships(zip, pptxSlideRelPath(layoutPath), parser) : {};
  const masterRel = Object.values(layoutRels || {}).find((rel) => /slideMaster$/i.test(rel.type || ""));
  const masterPath = masterRel?.target ? normaliseZipPath(layoutPath.split("/").slice(0, -1).join("/"), masterRel.target) : "";
  const masterDoc = masterPath ? parser.parseFromString(await zip.file(masterPath)?.async("text") || "", "application/xml") : null;
  const masterRels = masterPath ? await readPptxRelationships(zip, pptxSlideRelPath(masterPath), parser) : {};
  const themeRel = Object.values(masterRels || {}).find((rel) => /theme$/i.test(rel.type || ""));
  const themePath = themeRel?.target ? normaliseZipPath(masterPath.split("/").slice(0, -1).join("/"), themeRel.target) : "";
  const themeDoc = themePath ? parser.parseFromString(await zip.file(themePath)?.async("text") || "", "application/xml") : null;
  return { slideDoc, slidePath, rels, layoutDoc, layoutPath, layoutRels, masterDoc, masterPath, masterRels, themeDoc, themePath, slideSize };
}

async function pptxSlideToDocumentObjects({ zip, context, pageNumber }) {
  const elementContexts = [
    ...pptxDrawableElementContexts(context.masterDoc, context.masterPath, context.masterRels, context, { inherited: true, sourceLayer: "master" }),
    ...pptxDrawableElementContexts(context.layoutDoc, context.layoutPath, context.layoutRels, context, { inherited: true, sourceLayer: "layout" }),
    ...pptxDrawableElementContexts(context.slideDoc, context.slidePath, context.rels, context, { inherited: false, sourceLayer: "slide" }),
  ];
  const objects = [];
  let warningCount = 0;
  for (const item of elementContexts) {
    const { element } = item;
    const name = localName(element);
    if (name === "pic") {
      const object = await pptxPictureToDocumentObject({ zip, ...item, pageNumber });
      if (object) {
        objects.push(object);
      } else {
        warningCount += 1;
      }
    } else if (name === "sp") {
      const shapeObjects = await pptxShapeToDocumentObjects({ zip, ...item, pageNumber });
      objects.push(...shapeObjects);
    } else if (name === "cxnSp") {
      objects.push(pptxLineToDocumentObject({ ...item, pageNumber }));
    } else {
      warningCount += 1;
    }
  }
  return { objects: objects.map((object, layer) => ({ ...object, layer })), warningCount };
}

async function pptxShapeToDocumentObjects({ zip, element, box, rels, sourcePath, slideSize, themeDoc, sourceLayer, groupPath, zOrder, pageNumber }) {
  const text = pptxText(element);
  const imageFill = await pptxImageFillToDocumentObject({ zip, element, box, rels, sourcePath, sourceLayer, groupPath, zOrder });
  const fill = pptxShapeFill(element, themeDoc) || "transparent";
  const stroke = pptxLineColor(element, themeDoc) || "transparent";
  const name = pptxElementName(element) || (text ? "PowerPoint text" : "PowerPoint shape");
  const objects = [];
  if (imageFill) {
    objects.push(imageFill);
  } else if ((fill !== "transparent" || stroke !== "transparent") && !pptxIsTextOnlyShape(element)) {
    objects.push(createObject("shape", {
      name: text ? `${name} panel` : name,
      x: box.left,
      y: box.top,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      rotation: box.rotation,
      opacity: box.opacity,
      style: { fill, stroke, strokeWidth: stroke === "transparent" ? 0 : 1.5, borderRadius: 0 },
      data: { sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath },
    }));
  }
  if (text) {
    const textStyle = pptxTextStyle(element, box, themeDoc);
    objects.push(createObject("text", {
      name,
      x: box.left,
      y: box.top,
      width: Math.max(20, box.width),
      height: Math.max(12, box.height),
      rotation: box.rotation,
      opacity: box.opacity,
      style: {
        ...textStyle,
      },
      data: { text, sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath, runs: pptxTextRuns(element, themeDoc) },
    }));
  }
  return objects;
}

async function pptxPictureToDocumentObject({ zip, element, box, sourcePath, rels, sourceLayer, groupPath, zOrder }) {
  const blip = firstByLocalName(element, "blip");
  const embedId = attrByLocalName(blip, "embed") || attrByLocalName(blip, "link");
  const target = rels?.[embedId]?.target;
  if (!target) return null;
  const mediaPath = normaliseZipPath(sourcePath.split("/").slice(0, -1).join("/"), target);
  const media = zip.file(mediaPath);
  if (!media) return null;
  const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
  const imageRef = `data:${pptxMimeType(ext)};base64,${await media.async("base64")}`;
  const objectType = /logo/i.test(pptxElementName(element)) ? "logo" : "image";
  return createObject(objectType, {
    name: pptxElementName(element) || "PowerPoint image",
    x: box.left,
    y: box.top,
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { objectFit: objectType === "logo" ? "contain" : "cover" },
    data: {
      imageRef,
      alt: pptxElementName(element) || "PowerPoint image",
      relationshipId: embedId,
      mediaPath,
      sourceLayer,
      groupPath,
      zOrder,
      sourceXmlPath: sourcePath,
      crop: pptxImageCrop(element),
    },
  });
}

function pptxLineToDocumentObject({ element, box, themeDoc, sourcePath, sourceLayer, groupPath, zOrder, pageNumber }) {
  return createObject("shape", {
    name: pptxElementName(element) || `PowerPoint line ${pageNumber}`,
    x: box.left,
    y: box.top,
    width: Math.max(1, Math.abs(box.width)),
    height: Math.max(1, Math.abs(box.height) || 2),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { fill: pptxLineColor(element, themeDoc) || "#d29a37", stroke: pptxLineColor(element, themeDoc) || "#d29a37", strokeWidth: 0, borderRadius: 0 },
    data: { sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath },
  });
}

function formatShortDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function PremierPdfPageCanvas({ page, selectedElementId = "", onSelectElement = null, exportMode = false }) {
  const backgroundImage = page.renderedImage || page.backgroundImage;
  return (
    <article data-premier-pdf-page="true" style={styles.standardPdfCanvas} onClick={() => !exportMode && onSelectElement?.("")}>
      {backgroundImage ? (
        <img src={backgroundImage} alt="" style={styles.standardPdfBackgroundImage} />
      ) : (
        <div style={styles.standardPdfBlankPage}>Blank Premier Inclusions page</div>
      )}
      {(page.elements || []).map((element) => {
        const ElementTag = exportMode ? "div" : "button";
        return (
          <ElementTag
            key={element.id}
            type={exportMode ? undefined : "button"}
            style={{
              ...styles.standardPdfOverlayElement,
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              ...(selectedElementId === element.id && !exportMode ? styles.standardPdfOverlayElementSelected : {}),
            }}
            onClick={exportMode ? undefined : (event) => {
              event.stopPropagation();
              onSelectElement?.(element.id);
            }}
          >
            {element.type === "text" ? (
              <span style={{ ...styles.standardPdfTextOverlay, color: element.color || "#0f172a", fontSize: element.fontSize || 18 }}>{element.text}</span>
            ) : element.imageSrc ? (
              <img src={element.imageSrc} alt="" style={styles.standardPdfOverlayImage} />
            ) : null}
          </ElementTag>
        );
      })}
    </article>
  );
}

async function readPptxRelationships(zip, relPath, parser) {
  const relXml = await zip.file(relPath)?.async("text");
  if (!relXml) return {};
  const relDoc = parser.parseFromString(relXml, "application/xml");
  const rels = {};
  Array.from(relDoc.getElementsByTagName("Relationship")).forEach((rel) => {
    const id = rel.getAttribute("Id");
    if (!id) return;
    rels[id] = {
      target: rel.getAttribute("Target") || "",
      type: rel.getAttribute("Type") || "",
    };
  });
  return rels;
}

function pptxSlideSize(presentationDoc) {
  const size = firstByLocalName(presentationDoc, "sldSz");
  return {
    cx: Number(size?.getAttribute("cx")) || 9144000,
    cy: Number(size?.getAttribute("cy")) || 12801600,
  };
}

function pptxSlidePaths(zip, presentationDoc, presentationRels) {
  const slideIds = Array.from(firstByLocalName(presentationDoc, "sldIdLst")?.childNodes || [])
    .filter((node) => node.nodeType === 1 && localName(node) === "sldId");
  const ordered = slideIds
    .map((slideId) => presentationRels[attrByLocalName(slideId, "id")]?.target)
    .filter(Boolean)
    .map((target) => normaliseZipPath("ppt", target));
  if (ordered.length) return ordered;
  return Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));
}

function pptxSlideRelPath(slidePath) {
  const parts = slidePath.split("/");
  const fileName = parts.pop();
  return `${parts.join("/")}/_rels/${fileName}.rels`;
}

async function addPptxSlideObjectsToCanvas({ zip, fabric, canvas, slideDoc, slidePath, rels, slideSize, pageNumber }) {
  const spTree = firstByLocalName(slideDoc, "spTree");
  const elements = Array.from(spTree?.childNodes || []).filter((node) => node.nodeType === 1);
  for (const element of elements) {
    const name = localName(element);
    if (name === "pic") {
      await addPptxPicture({ zip, fabric, canvas, element, slidePath, rels, slideSize, pageNumber });
    } else if (name === "sp") {
      addPptxShapeOrText({ fabric, canvas, element, slideSize, pageNumber });
    } else if (name === "cxnSp") {
      addPptxLine({ fabric, canvas, element, slideSize, pageNumber });
    }
  }
}

function addPptxShapeOrText({ fabric, canvas, element, slideSize, pageNumber }) {
  const box = pptxElementBox(element, slideSize);
  const text = pptxText(element);
  const fill = pptxShapeFill(element) || "transparent";
  const stroke = pptxLineColor(element) || "transparent";
  const name = pptxElementName(element) || (text ? "PowerPoint text" : "PowerPoint shape");
  if (text) {
    if (fill !== "transparent" || stroke !== "transparent") {
      canvas.add(new fabric.Rect({
        id: `pptx-page-${pageNumber}-text-panel-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: `${name} panel`,
        role: "shape",
        left: box.left,
        top: box.top,
        width: Math.max(1, box.width),
        height: Math.max(1, box.height),
        fill,
        stroke,
        strokeWidth: stroke === "transparent" ? 0 : 1.5,
      }));
    }
    canvas.add(new fabric.Textbox(text, {
      id: `pptx-page-${pageNumber}-text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      role: "text",
      left: box.left,
      top: box.top,
      width: Math.max(20, box.width),
      height: Math.max(12, box.height),
      fontFamily: pptxFontFamily(element) || "Arial",
      fontSize: pptxFontSize(element, box.height),
      fontWeight: pptxIsBold(element) ? "800" : "600",
      fill: pptxTextColor(element) || "#0b2545",
      textAlign: pptxTextAlign(element),
      lineHeight: 1.12,
      editable: true,
    }));
    return;
  }
  if (fill !== "transparent" || stroke !== "transparent") {
    canvas.add(new fabric.Rect({
      id: `pptx-page-${pageNumber}-shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      role: "shape",
      left: box.left,
      top: box.top,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      fill,
      stroke,
      strokeWidth: stroke === "transparent" ? 0 : 1.5,
      rx: 0,
      ry: 0,
    }));
  }
}

async function addPptxPicture({ zip, fabric, canvas, element, slidePath, rels, slideSize, pageNumber }) {
  const box = pptxElementBox(element, slideSize);
  const blip = firstByLocalName(element, "blip");
  const embedId = attrByLocalName(blip, "embed") || attrByLocalName(blip, "link");
  const target = rels[embedId]?.target;
  if (!target) return;
  const mediaPath = normaliseZipPath(slidePath.split("/").slice(0, -1).join("/"), target);
  const media = zip.file(mediaPath);
  if (!media) return;
  const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
  const mime = pptxMimeType(ext);
  const dataUrl = `data:${mime};base64,${await media.async("base64")}`;
  await new Promise((resolve) => {
    fabric.Image.fromURL(dataUrl, (image) => {
      image.set({
        id: `pptx-page-${pageNumber}-image-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: pptxElementName(element) || "PowerPoint image",
        role: /logo/i.test(pptxElementName(element)) ? "logo" : "image",
        assetKind: /logo/i.test(pptxElementName(element)) ? "logo" : "image",
        left: box.left,
        top: box.top,
        selectable: true,
        evented: true,
      });
      image.set({
        scaleX: Math.max(1, box.width) / Math.max(1, image.width || 1),
        scaleY: Math.max(1, box.height) / Math.max(1, image.height || 1),
      });
      canvas.add(image);
      resolve();
    }, { crossOrigin: "anonymous" });
  });
}

function addPptxLine({ fabric, canvas, element, slideSize, pageNumber }) {
  const box = pptxElementBox(element, slideSize);
  const stroke = pptxLineColor(element) || "#d29a37";
  canvas.add(new fabric.Line([box.left, box.top, box.left + box.width, box.top + box.height], {
    id: `pptx-page-${pageNumber}-line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: pptxElementName(element) || "PowerPoint line",
    role: "shape",
    stroke,
    strokeWidth: 1.5,
  }));
}

function pptxDrawableElementContexts(doc, sourcePath, rels, context, options = {}) {
  const spTree = firstByLocalName(doc, "spTree");
  if (!spTree || !sourcePath) return [];
  const rootTransform = pptxIdentityGroupTransform(context.slideSize);
  const rows = [];
  let zOrder = 0;
  const walk = (parent, groupTransform, groupPath = "") => {
    Array.from(parent?.childNodes || []).forEach((element) => {
      if (element.nodeType !== 1) return;
      const name = localName(element);
      if (!["grpSp", "pic", "sp", "cxnSp"].includes(name)) return;
      const elementName = pptxElementName(element);
      const nextGroupPath = groupPath ? `${groupPath} / ${elementName || name}` : (elementName || name);
      if (name === "grpSp") {
        walk(element, pptxComposeGroupTransform(groupTransform, pptxGroupTransform(element)), nextGroupPath);
        return;
      }
      if (options.inherited && pptxIsPlaceholder(element)) {
        return;
      }
      rows.push({
        element,
        box: pptxElementBox(element, context.slideSize, groupTransform),
        sourcePath,
        rels,
        slideSize: context.slideSize,
        themeDoc: context.themeDoc,
        sourceLayer: options.sourceLayer || "slide",
        groupPath,
        inherited: Boolean(options.inherited),
        zOrder: zOrder += 1,
      });
    });
  };
  walk(spTree, rootTransform);
  return rows;
}

function pptxIdentityGroupTransform(slideSize) {
  return {
    x: 0,
    y: 0,
    cx: Number(slideSize?.cx || 1),
    cy: Number(slideSize?.cy || 1),
    chX: 0,
    chY: 0,
    chCx: Number(slideSize?.cx || 1),
    chCy: Number(slideSize?.cy || 1),
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

function pptxGroupTransform(element) {
  const xfrm = firstByLocalName(element, "xfrm");
  const off = firstByLocalName(xfrm, "off");
  const ext = firstByLocalName(xfrm, "ext");
  const chOff = firstByLocalName(xfrm, "chOff");
  const chExt = firstByLocalName(xfrm, "chExt");
  return {
    x: Number(off?.getAttribute("x")) || 0,
    y: Number(off?.getAttribute("y")) || 0,
    cx: Number(ext?.getAttribute("cx")) || 0,
    cy: Number(ext?.getAttribute("cy")) || 0,
    chX: Number(chOff?.getAttribute("x")) || 0,
    chY: Number(chOff?.getAttribute("y")) || 0,
    chCx: Number(chExt?.getAttribute("cx")) || 0,
    chCy: Number(chExt?.getAttribute("cy")) || 0,
    rotation: pptxRotationDegrees(xfrm),
    flipH: xfrm?.getAttribute("flipH") === "1",
    flipV: xfrm?.getAttribute("flipV") === "1",
  };
}

function pptxComposeGroupTransform(parent, child) {
  const parentScaleX = Number(parent.cx || 0) / Math.max(1, Number(parent.chCx || parent.cx || 1));
  const parentScaleY = Number(parent.cy || 0) / Math.max(1, Number(parent.chCy || parent.cy || 1));
  return {
    x: Number(parent.x || 0) + (Number(child.x || 0) - Number(parent.chX || 0)) * parentScaleX,
    y: Number(parent.y || 0) + (Number(child.y || 0) - Number(parent.chY || 0)) * parentScaleY,
    cx: Number(child.cx || 0) * parentScaleX,
    cy: Number(child.cy || 0) * parentScaleY,
    chX: Number(child.chX || 0),
    chY: Number(child.chY || 0),
    chCx: Number(child.chCx || child.cx || 1),
    chCy: Number(child.chCy || child.cy || 1),
    rotation: (Number(parent.rotation || 0) + Number(child.rotation || 0)) % 360,
    flipH: Boolean(parent.flipH) !== Boolean(child.flipH),
    flipV: Boolean(parent.flipV) !== Boolean(child.flipV),
  };
}

function pptxRotationDegrees(xfrm) {
  return (Number(xfrm?.getAttribute("rot") || 0) / 60000) || 0;
}

function pptxApplyGroupBox(local, groupTransform, slideSize) {
  const scaleX = Number(groupTransform.cx || 0) / Math.max(1, Number(groupTransform.chCx || slideSize.cx || 1));
  const scaleY = Number(groupTransform.cy || 0) / Math.max(1, Number(groupTransform.chCy || slideSize.cy || 1));
  let x = Number(groupTransform.x || 0) + (Number(local.x || 0) - Number(groupTransform.chX || 0)) * scaleX;
  let y = Number(groupTransform.y || 0) + (Number(local.y || 0) - Number(groupTransform.chY || 0)) * scaleY;
  const cx = Number(local.cx || 0) * scaleX;
  const cy = Number(local.cy || 0) * scaleY;
  if (groupTransform.flipH) x = Number(groupTransform.x || 0) + Number(groupTransform.cx || 0) - (x - Number(groupTransform.x || 0)) - cx;
  if (groupTransform.flipV) y = Number(groupTransform.y || 0) + Number(groupTransform.cy || 0) - (y - Number(groupTransform.y || 0)) - cy;
  return { x, y, cx, cy };
}

function pptxElementBox(element, slideSize) {
  const xfrm = firstByLocalName(element, "xfrm");
  const off = firstByLocalName(xfrm, "off");
  const ext = firstByLocalName(xfrm, "ext");
  const x = Number(off?.getAttribute("x")) || 0;
  const y = Number(off?.getAttribute("y")) || 0;
  const cx = Number(ext?.getAttribute("cx")) || 0;
  const cy = Number(ext?.getAttribute("cy")) || 0;
  const groupTransform = arguments.length >= 3 ? arguments[2] : pptxIdentityGroupTransform(slideSize);
  const absolute = pptxApplyGroupBox({ x, y, cx, cy }, groupTransform, slideSize);
  return {
    sourceX: x,
    sourceY: y,
    sourceCx: cx,
    sourceCy: cy,
    absoluteX: absolute.x,
    absoluteY: absolute.y,
    absoluteCx: absolute.cx,
    absoluteCy: absolute.cy,
    left: (absolute.x / slideSize.cx) * 794,
    top: (absolute.y / slideSize.cy) * 1123,
    width: (absolute.cx / slideSize.cx) * 794,
    height: (absolute.cy / slideSize.cy) * 1123,
    rotation: (pptxRotationDegrees(xfrm) + Number(groupTransform.rotation || 0)) % 360,
    opacity: pptxElementOpacity(element),
  };
}

function pptxText(element) {
  const paragraphs = descendantsByLocalName(element, "p")
    .map((paragraph) => descendantsByLocalName(paragraph, "t").map((node) => node.textContent || "").join(""))
    .filter((text) => text.trim());
  return paragraphs.join("\n").trim();
}

function pptxTextRuns(element, themeDoc = null) {
  return descendantsByLocalName(element, "r")
    .map((run) => {
      const rPr = firstByLocalName(run, "rPr");
      const text = descendantsByLocalName(run, "t").map((node) => node.textContent || "").join("");
      return {
        text,
        fontFamily: pptxFontFamily(run) || pptxFontFamily(element) || "Arial",
        fontSize: pptxFontSize(run, 18),
        bold: pptxIsBold(run),
        italic: rPr?.getAttribute("i") === "1",
        color: pptxSolidFill(rPr, themeDoc) || pptxTextColor(element, themeDoc) || "#0f172a",
      };
    })
    .filter((run) => run.text);
}

function pptxTextStyle(element, box, themeDoc = null) {
  return {
    fontFamily: pptxFontFamily(element) || "Arial",
    fontSize: pptxFontSize(element, box.height),
    fontWeight: pptxIsBold(element) ? "800" : "600",
    fontStyle: firstByLocalName(element, "rPr")?.getAttribute("i") === "1" ? "italic" : "normal",
    color: pptxTextColor(element, themeDoc) || "#0f172a",
    textAlign: pptxTextAlign(element),
    lineHeight: pptxLineHeight(element),
  };
}

function pptxFontSize(element, fallbackHeight = 30) {
  const rPr = firstByLocalName(element, "rPr");
  const sz = Number(rPr?.getAttribute("sz"));
  if (Number.isFinite(sz) && sz > 0) return Math.max(5, Math.round((sz / 100) * 1.333));
  return Math.max(9, Math.min(64, Math.round(fallbackHeight / 1.8)));
}

function pptxFontFamily(element) {
  return firstByLocalName(element, "latin")?.getAttribute("typeface") || "";
}

function pptxIsBold(element) {
  return firstByLocalName(element, "rPr")?.getAttribute("b") === "1";
}

function pptxTextAlign(element) {
  const algn = firstByLocalName(element, "pPr")?.getAttribute("algn") || "l";
  if (algn === "ctr" || algn === "center") return "center";
  if (algn === "r" || algn === "right") return "right";
  return "left";
}

function pptxLineHeight(element) {
  const lnSpc = firstByLocalName(firstByLocalName(element, "pPr"), "lnSpc");
  const pct = Number(firstByLocalName(lnSpc, "spcPct")?.getAttribute("val"));
  if (Number.isFinite(pct) && pct > 0) return Math.max(0.7, Math.min(2.2, pct / 100000));
  return 1.12;
}

function pptxTextColor(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(element, "rPr"), themeDoc) || "#0f172a";
}

function childByLocalName(node, name) {
  return Array.from(node?.childNodes || []).find((child) => child.nodeType === 1 && localName(child) === name) || null;
}

function pptxSolidFill(element, themeDoc = null) {
  const solid = childByLocalName(element, "solidFill");
  if (!solid) return "";
  const srgbNode = childByLocalName(solid, "srgbClr");
  const srgb = srgbNode?.getAttribute("val");
  if (srgb) return pptxApplyColourTransforms(`#${srgb}`, srgbNode);
  const schemeNode = childByLocalName(solid, "schemeClr");
  const scheme = schemeNode?.getAttribute("val");
  return pptxApplyColourTransforms(pptxSchemeColor(scheme, themeDoc), schemeNode);
}

function pptxShapeFill(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(element, "spPr"), themeDoc);
}

function pptxLineColor(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(firstByLocalName(element, "spPr"), "ln"), themeDoc);
}

function pptxSchemeColor(value = "", themeDoc = null) {
  const themeColor = pptxThemeColor(value, themeDoc);
  if (themeColor) return themeColor;
  const map = {
    tx1: "#0f172a",
    tx2: "#334155",
    bg1: "#ffffff",
    bg2: "#f8fafc",
    accent1: "#0b2545",
    accent2: "#d29a37",
    accent3: "#166534",
  };
  return map[value] || "";
}

function pptxThemeColor(value = "", themeDoc = null) {
  if (!value || !themeDoc) return "";
  const clrScheme = firstByLocalName(themeDoc, "clrScheme");
  const node = Array.from(clrScheme?.childNodes || []).find((child) => child.nodeType === 1 && localName(child) === value);
  const srgb = firstByLocalName(node, "srgbClr")?.getAttribute("val");
  if (srgb) return `#${srgb}`;
  const sys = firstByLocalName(node, "sysClr")?.getAttribute("lastClr");
  return sys ? `#${sys}` : "";
}

function pptxApplyColourTransforms(color, node) {
  if (!color) return "";
  const alpha = Number(firstByLocalName(node, "alpha")?.getAttribute("val"));
  if (Number.isFinite(alpha) && alpha >= 0 && alpha < 100000) {
    return pptxHexToRgba(color, alpha / 100000);
  }
  const tint = Number(firstByLocalName(node, "tint")?.getAttribute("val"));
  const shade = Number(firstByLocalName(node, "shade")?.getAttribute("val"));
  if (Number.isFinite(tint) && tint > 0) return pptxMixColor(color, "#ffffff", tint / 100000);
  if (Number.isFinite(shade) && shade > 0) return pptxMixColor(color, "#000000", 1 - shade / 100000);
  return color;
}

function pptxMixColor(color, target, amount) {
  const source = pptxHexRgb(color);
  const dest = pptxHexRgb(target);
  if (!source || !dest) return color;
  const mix = (a, b) => Math.round(a + (b - a) * Math.max(0, Math.min(1, amount)));
  return `#${[mix(source.r, dest.r), mix(source.g, dest.g), mix(source.b, dest.b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function pptxHexRgb(color) {
  const hex = String(color || "").replace("#", "").slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function pptxHexToRgba(color, alpha) {
  const rgb = pptxHexRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

async function pptxImageFillToDocumentObject({ zip, element, box, rels, sourcePath, sourceLayer, groupPath, zOrder }) {
  const blipFill = firstByLocalName(element, "blipFill");
  const blip = firstByLocalName(blipFill, "blip");
  const embedId = attrByLocalName(blip, "embed") || attrByLocalName(blip, "link");
  const target = rels?.[embedId]?.target;
  if (!embedId || !target) return null;
  const mediaPath = normaliseZipPath(sourcePath.split("/").slice(0, -1).join("/"), target);
  const media = zip.file(mediaPath);
  if (!media) return null;
  const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
  const imageRef = `data:${pptxMimeType(ext)};base64,${await media.async("base64")}`;
  const objectType = /logo|brand/i.test(pptxElementName(element)) ? "logo" : "image";
  return createObject(objectType, {
    name: pptxElementName(element) || "PowerPoint image fill",
    x: box.left,
    y: box.top,
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { objectFit: objectType === "logo" ? "contain" : "cover" },
    data: {
      imageRef,
      alt: pptxElementName(element) || "PowerPoint image fill",
      relationshipId: embedId,
      mediaPath,
      crop: pptxImageCrop(element),
      sourceLayer,
      groupPath,
      zOrder,
      sourceXmlPath: sourcePath,
      imageFill: true,
    },
  });
}

function pptxImageCrop(element) {
  const srcRect = firstByLocalName(firstByLocalName(element, "blipFill"), "srcRect");
  if (!srcRect) return null;
  return {
    left: Number(srcRect.getAttribute("l") || 0) / 100000,
    top: Number(srcRect.getAttribute("t") || 0) / 100000,
    right: Number(srcRect.getAttribute("r") || 0) / 100000,
    bottom: Number(srcRect.getAttribute("b") || 0) / 100000,
  };
}

function pptxElementOpacity(element) {
  const alpha = Number(firstByLocalName(element, "alpha")?.getAttribute("val"));
  if (Number.isFinite(alpha) && alpha >= 0) return Math.max(0, Math.min(1, alpha / 100000));
  return 1;
}

function pptxIsPlaceholder(element) {
  return Boolean(firstByLocalName(element, "ph"));
}

function pptxIsTextOnlyShape(element) {
  return Boolean(pptxText(element)) && !firstByLocalName(element, "solidFill") && !firstByLocalName(element, "blipFill") && !pptxLineColor(element);
}

function pptxElementName(element) {
  return firstByLocalName(element, "cNvPr")?.getAttribute("name") || "";
}

function pptxMimeType(ext) {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function normaliseZipPath(baseDir, target = "") {
  const raw = target.startsWith("/") ? target.slice(1) : `${baseDir}/${target}`;
  const parts = [];
  raw.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function localName(node) {
  return node?.localName || String(node?.nodeName || "").split(":").pop();
}

function firstByLocalName(node, name) {
  if (!node) return null;
  return descendantsByLocalName(node, name)[0] || null;
}

function descendantsByLocalName(node, name) {
  if (!node) return [];
  const matches = [];
  const visit = (current) => {
    Array.from(current?.childNodes || []).forEach((child) => {
      if (child.nodeType === 1) {
        if (localName(child) === name) matches.push(child);
        visit(child);
      }
    });
  };
  visit(node);
  return matches;
}

function attrByLocalName(node, name) {
  if (!node?.attributes) return "";
  const attr = Array.from(node.attributes).find((item) => localName(item) === name);
  return attr?.value || "";
}

function normalisePremierPdfPages(pages = []) {
  return (Array.isArray(pages) ? pages : [])
    .map((page, index) => ({
      id: page.id || `premier-inclusions-page-${index + 1}`,
      name: page.name || `Premier-Inclusions-Page-${String(index + 1).padStart(2, "0")}`,
      order: Number(page.order || index + 1),
      backgroundImage: page.backgroundImage || "",
      renderedImage: page.renderedImage || "",
      width: Number(page.width || 794),
      height: Number(page.height || 1123),
      canvasJson: page.canvasJson || null,
      editableTemplate: Boolean(page.editableTemplate),
      templateKind: page.templateKind || "",
      elements: Array.isArray(page.elements) ? page.elements : [],
    }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function clonePremierPages(pages = [], ownerPrefix = "master") {
  return normalisePremierPdfPages(pages).map((page, index) => ({
    ...page,
    id: `${ownerPrefix}-premier-inclusions-page-${String(index + 1).padStart(2, "0")}-${Date.now()}`,
    order: index + 1,
    elements: Array.isArray(page.elements) ? page.elements.map((element) => ({
      ...element,
      id: `${ownerPrefix}-premier-element-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    })) : [],
  }));
}

function workbookStandardInclusionsSource(workbook = {}) {
  return {
    ...(workbook.standardInclusions || {}),
    selectedPackageId: workbook.selected_standard_inclusions_package_id || workbook.standardInclusions?.selectedPackageId,
  };
}

function EstimateInclusionsSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);
  const estimateInclusions = normaliseEstimateInclusions(sheet.workbook.estimateInclusions, sheet.workbook.builderId || "local-builder");
  const selectedPackage = estimateInclusions.packages.find((item) => item.id === estimateInclusions.selectedPackageId) || estimateInclusions.packages[0];
  const sections = estimateInclusions.sections
    .filter((section) => section.package_id === selectedPackage?.id)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const suppliers = estimateInclusions.suppliers
    .filter((supplier) => supplier.package_id === selectedPackage?.id)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const saveInclusions = (next) => sheet.updateEstimateInclusions?.(next);
  const selectPackage = (packageId) => saveInclusions({ ...estimateInclusions, selectedPackageId: packageId });
  const updatePackage = (key, value) => sheet.updateEstimateInclusionPackage?.(selectedPackage.id, key, value);
  const updateSection = (sectionId, key, value) => sheet.updateEstimateInclusionSection?.(sectionId, key, value);
  const updateSupplier = (supplierId, key, value) => sheet.updateEstimateInclusionSupplier?.(supplierId, key, value);

  function addPackage() {
    const packageId = `pkg-${Date.now()}`;
    const nextPackage = {
      id: packageId,
      builder_id: sheet.workbook.builderId || "local-builder",
      name: "Custom Inclusions",
      description: "Editable builder inclusions package for this estimate pack.",
      is_default: false,
      active: true,
    };
    const nextSections = BUILDER_INCLUSION_SECTION_TITLES.map((title, index) => ({
      id: `sec-${Date.now()}-${index + 1}`,
      package_id: packageId,
      title,
      subtitle: "",
      body: "",
      bullets: [],
      hero_image_url: "",
      layout_type: index % 2 ? "image_right" : "image_left",
      sort_order: index + 1,
      active: true,
    }));
    saveInclusions({
      ...estimateInclusions,
      selectedPackageId: packageId,
      packages: [...estimateInclusions.packages, nextPackage],
      sections: [...estimateInclusions.sections, ...nextSections],
    });
  }

  function duplicatePackage() {
    if (!selectedPackage) return;
    const packageId = `pkg-${Date.now()}`;
    const sectionIdMap = new Map();
    const copiedSections = sections.map((section, index) => {
      const sectionId = `sec-${Date.now()}-${index + 1}`;
      sectionIdMap.set(section.id, sectionId);
      return {
        ...section,
        id: sectionId,
        package_id: packageId,
        sort_order: index + 1,
      };
    });
    const copiedMedia = estimateInclusions.media
      .filter((item) => sectionIdMap.has(item.section_id))
      .map((item, index) => ({ ...item, id: `media-${Date.now()}-${index + 1}`, section_id: sectionIdMap.get(item.section_id) }));
    const copiedSuppliers = suppliers.map((supplier, index) => ({ ...supplier, id: `supplier-${Date.now()}-${index + 1}`, package_id: packageId }));
    saveInclusions({
      ...estimateInclusions,
      selectedPackageId: packageId,
      packages: [
        ...estimateInclusions.packages,
        { ...selectedPackage, id: packageId, name: `${selectedPackage.name || "Inclusions"} Copy`, is_default: false },
      ],
      sections: [...estimateInclusions.sections, ...copiedSections],
      media: [...estimateInclusions.media, ...copiedMedia],
      suppliers: [...estimateInclusions.suppliers, ...copiedSuppliers],
    });
  }

  function setPackageDefault(packageId) {
    if (!packageId) return;
    saveInclusions({
      ...estimateInclusions,
      packages: estimateInclusions.packages.map((item) => ({ ...item, is_default: item.id === packageId })),
    });
  }

  function addSection() {
    if (!selectedPackage) return;
    const next = {
      id: `sec-${Date.now()}`,
      package_id: selectedPackage.id,
      title: "New Section",
      subtitle: "",
      body: "",
      bullets: ["New inclusion item"],
      hero_image_url: "",
      layout_type: "image_left",
      sort_order: sections.length + 1,
      active: true,
    };
    saveInclusions({ ...estimateInclusions, sections: [...estimateInclusions.sections, next] });
  }

  function removeSection(sectionId) {
    saveInclusions({
      ...estimateInclusions,
      sections: estimateInclusions.sections.filter((item) => item.id !== sectionId),
      media: estimateInclusions.media.filter((item) => item.section_id !== sectionId),
    });
  }

  function addBullet(section) {
    updateSection(section.id, "bullets", [...(section.bullets || []), "New inclusion item"]);
  }

  function updateBullet(section, index, value) {
    updateSection(section.id, "bullets", (section.bullets || []).map((bullet, bulletIndex) => bulletIndex === index ? value : bullet));
  }

  function removeBullet(section, index) {
    updateSection(section.id, "bullets", (section.bullets || []).filter((_, bulletIndex) => bulletIndex !== index));
  }

  function addMedia(section) {
    const next = {
      id: `media-${Date.now()}`,
      section_id: section.id,
      image_url: "",
      caption: "New image",
      media_type: "image",
      sort_order: estimateInclusions.media.filter((item) => item.section_id === section.id).length + 1,
    };
    saveInclusions({ ...estimateInclusions, media: [...estimateInclusions.media, next] });
  }

  function updateMedia(mediaId, key, value) {
    saveInclusions({
      ...estimateInclusions,
      media: estimateInclusions.media.map((item) => item.id === mediaId ? { ...item, [key]: value } : item),
    });
  }

  function removeMedia(mediaId) {
    saveInclusions({ ...estimateInclusions, media: estimateInclusions.media.filter((item) => item.id !== mediaId) });
  }

  function addSupplier() {
    const next = {
      id: `supplier-${Date.now()}`,
      package_id: selectedPackage.id,
      supplier_name: "New supplier",
      logo_url: "",
      category: "Supplier",
      sort_order: suppliers.length + 1,
    };
    saveInclusions({ ...estimateInclusions, suppliers: [...estimateInclusions.suppliers, next] });
  }

  function removeSupplier(supplierId) {
    saveInclusions({ ...estimateInclusions, suppliers: estimateInclusions.suppliers.filter((item) => item.id !== supplierId) });
  }

  function moveSection(section, direction) {
    const ordered = sections.map((item) => ({ ...item }));
    const index = ordered.findIndex((item) => item.id === section.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const [item] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, item);
    const resequenced = ordered.map((item, orderIndex) => ({ ...item, sort_order: orderIndex + 1 }));
    saveInclusions({
      ...estimateInclusions,
      sections: estimateInclusions.sections.map((item) => resequenced.find((section) => section.id === item.id) || item),
    });
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = uploadTargetRef.current;
    uploadTargetRef.current = null;
    if (!file || !file.type?.startsWith("image/") || !target) return;
    const url = await readFileAsDataUrl(file);
    if (target.type === "section") updateSection(target.id, "hero_image_url", url);
    if (target.type === "media") updateMedia(target.id, "image_url", url);
    if (target.type === "supplier") updateSupplier(target.id, "logo_url", url);
  }

  function openUpload(target) {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  }

  return (
    <div style={styles.estimateInclusionsShell}>
      <section style={styles.estimateInclusionsHero}>
        <div>
          <div style={styles.eyebrow}>Estimate Pack</div>
          <h2 style={styles.cashflowTitle}>Standard Inclusions Schedule</h2>
          <p style={styles.dashboardPanelSubtitle}>This is the editable brochure-style inclusions schedule inserted after the price summary in the estimate pack. It is separate from Client Selections and does not affect quote totals.</p>
        </div>
        <div style={styles.estimateInclusionsPackageCard}>
          <label style={styles.fieldWrap}>
            <span style={styles.label}>Inclusion package</span>
            <select disabled={readonly} style={styles.selectInput} value={selectedPackage?.id || ""} onChange={(event) => selectPackage(event.target.value)}>
              {estimateInclusions.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div style={styles.proposalMiniActions}>
            <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={addPackage}>New package</button>
            <button type="button" disabled={readonly || !selectedPackage} style={styles.secondaryButton} onClick={duplicatePackage}>Duplicate</button>
          </div>
          <div style={styles.proposalMiniActions}>
            <label style={styles.estimateInlineCheck}>
              <input type="checkbox" disabled={readonly || !selectedPackage} checked={selectedPackage?.active !== false} onChange={(event) => updatePackage("active", event.target.checked)} />
              Active
            </label>
            <label style={styles.estimateInlineCheck}>
              <input type="checkbox" disabled={readonly || !selectedPackage} checked={Boolean(selectedPackage?.is_default)} onChange={() => setPackageDefault(selectedPackage?.id)} />
              Default
            </label>
          </div>
          <BufferedInput disabled={readonly} style={styles.input} value={selectedPackage?.name || ""} onCommit={(value) => updatePackage("name", value)} />
          <BufferedTextarea disabled={readonly} style={styles.estimateInclusionsDescription} value={selectedPackage?.description || ""} onCommit={(value) => updatePackage("description", value)} />
        </div>
      </section>

      <section style={styles.estimateInclusionsPreviewPanel}>
        <h3 style={styles.dashboardPanelTitle}>Estimate Pack Preview</h3>
        <EstimateInclusionsBrochure packageData={selectedEstimateInclusionsPackage(estimateInclusions)} compact />
      </section>

      <section style={styles.estimateInclusionEditorCard}>
        <div style={styles.estimateInclusionEditorHeader}>
          <strong>Package Sections</strong>
          <button type="button" disabled={readonly || !selectedPackage} style={styles.secondaryButton} onClick={addSection}>Add section</button>
        </div>
        <p style={styles.dashboardPanelSubtitle}>Sections can be reordered, hidden, edited and filled with bullet inclusions, image cards and supplier references.</p>
      </section>

      <section style={styles.estimateInclusionsEditorGrid}>
        {sections.map((section) => {
          const sectionMedia = estimateInclusions.media
            .filter((item) => item.section_id === section.id)
            .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
          return (
            <article key={section.id} style={styles.estimateInclusionEditorCard}>
              <div style={styles.estimateInclusionEditorHeader}>
                <strong>{section.sort_order}. {section.title}</strong>
                <div style={styles.proposalMiniActions}>
                  <button disabled={readonly} type="button" onClick={() => moveSection(section, -1)}>Up</button>
                  <button disabled={readonly} type="button" onClick={() => moveSection(section, 1)}>Down</button>
                  <button disabled={readonly} type="button" onClick={() => updateSection(section.id, "active", !section.active)}>{section.active ? "Active" : "Inactive"}</button>
                  <button disabled={readonly} type="button" onClick={() => removeSection(section.id)}>Remove</button>
                </div>
              </div>
              <div style={styles.estimateInclusionFormGrid}>
                <ProposalPanelInput label="Heading" value={section.title} disabled={readonly} onCommit={(value) => updateSection(section.id, "title", value)} />
                <ProposalPanelInput label="Subtitle" value={section.subtitle} disabled={readonly} onCommit={(value) => updateSection(section.id, "subtitle", value)} />
                <ProposalPanelInput label="Hero image URL" value={section.hero_image_url} disabled={readonly} onCommit={(value) => updateSection(section.id, "hero_image_url", value)} />
                <ProposalPanelSelect label="Layout" value={section.layout_type} disabled={readonly} options={["image_left", "image_right", "feature", "supplier_grid"]} onChange={(value) => updateSection(section.id, "layout_type", value)} />
              </div>
              <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => openUpload({ type: "section", id: section.id })}>Upload hero image</button>
              <ProposalPanelTextarea label="Intro text" value={section.body} disabled={readonly} onCommit={(value) => updateSection(section.id, "body", value)} />
              <div style={styles.estimateBulletEditor}>
                <strong>Bullet inclusions</strong>
                {(section.bullets || []).map((bullet, index) => (
                  <div key={`${section.id}-bullet-${index}`} style={styles.estimateBulletRow}>
                    <BufferedInput disabled={readonly} style={styles.input} value={bullet} onCommit={(value) => updateBullet(section, index, value)} />
                    <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => removeBullet(section, index)}>Remove</button>
                  </div>
                ))}
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => addBullet(section)}>Add bullet</button>
              </div>
              <div style={styles.estimateMediaEditor}>
                <div style={styles.estimateInclusionEditorHeader}>
                  <strong>Product / image cards</strong>
                  <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => addMedia(section)}>Add card</button>
                </div>
                {sectionMedia.map((media) => (
                  <div key={media.id} style={styles.estimateMediaRow}>
                    <ProposalPanelInput label="Image URL" value={media.image_url} disabled={readonly} onCommit={(value) => updateMedia(media.id, "image_url", value)} />
                    <ProposalPanelInput label="Caption" value={media.caption} disabled={readonly} onCommit={(value) => updateMedia(media.id, "caption", value)} />
                    <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => openUpload({ type: "media", id: media.id })}>Upload</button>
                    <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => removeMedia(media.id)}>Remove</button>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section style={styles.estimateInclusionEditorCard}>
        <div style={styles.estimateInclusionEditorHeader}>
          <strong>Supplier Logos</strong>
          <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={addSupplier}>Add supplier</button>
        </div>
        <div style={styles.estimateSupplierEditorGrid}>
          {suppliers.map((supplier) => (
            <div key={supplier.id} style={styles.estimateSupplierEditorCard}>
              <ProposalPanelInput label="Supplier name" value={supplier.supplier_name} disabled={readonly} onCommit={(value) => updateSupplier(supplier.id, "supplier_name", value)} />
              <ProposalPanelInput label="Category" value={supplier.category} disabled={readonly} onCommit={(value) => updateSupplier(supplier.id, "category", value)} />
              <ProposalPanelInput label="Logo URL" value={supplier.logo_url} disabled={readonly} onCommit={(value) => updateSupplier(supplier.id, "logo_url", value)} />
              <div style={styles.proposalMiniActions}>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => openUpload({ type: "supplier", id: supplier.id })}>Upload logo</button>
                <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => removeSupplier(supplier.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleImageUpload} />
    </div>
  );
}

function CashflowSummarySheet({ sheet }) {
  const readonly = sheet.previewMode;
  const rows = cashflowSummaryRows(sheet);
  const finalQuoteTotal = sheet.preview.summary.finalQuoteTotal || 0;
  const totals = rows.reduce((sum, row) => ({
    percent: sum.percent + row.percent,
    incoming: sum.incoming + row.incoming,
    outgoing: sum.outgoing + row.outgoing,
    surplus: sum.surplus + row.surplus,
  }), { percent: 0, incoming: 0, outgoing: 0, surplus: 0 });
  return (
    <div style={styles.pageStack}>
      <section style={styles.cashflowHeader}>
        <div>
          <div style={styles.eyebrow}>Cashflow Summary</div>
          <h2 style={styles.cashflowTitle}>Progress Payments</h2>
        </div>
        <div style={styles.cashflowMetricGrid}>
          <CashflowMetric label="Contract total" value={money(finalQuoteTotal)} />
          <CashflowMetric label="Progress payments" value={money(totals.incoming)} detail={`${formatPercent(totals.percent)}%`} />
          <CashflowMetric label="Amortised costs" value={money(totals.outgoing)} />
          <CashflowMetric label="Cash surplus" value={money(totals.surplus)} tone={totals.surplus < 0 ? "negative" : "positive"} />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>Progress Payment Cashflow</div>
        <Spreadsheet headers={["Stage", "Progress Payment %", "Incoming Progress Payment", "Outgoing Costs", "Cash Surplus"]}>
          {rows.map((row) => (
            <tr key={row.stageNumber}>
              <Cell strong>{row.stageNumber} - {row.label}</Cell>
              <Cell>
                <BufferedInput
                  inputMode="decimal"
                  disabled={readonly}
                  style={styles.cashflowPercentInput}
                  value={row.percentDisplay}
                  onCommit={(next) => sheet.updateCashflowPayment(row.stageNumber, next)}
                />
              </Cell>
              <Cell final>{money(row.incoming)}</Cell>
              <Cell final>{money(row.outgoing)}</Cell>
              <Cell final>{money(row.surplus)}</Cell>
            </tr>
          ))}
          <tr>
            <Cell strong>Total</Cell>
            <Cell strong>{formatPercent(totals.percent)}%</Cell>
            <Cell final>{money(totals.incoming)}</Cell>
            <Cell final>{money(totals.outgoing)}</Cell>
            <Cell final>{money(totals.surplus)}</Cell>
          </tr>
        </Spreadsheet>
      </section>
    </div>
  );
}

function CashflowMetric({ label, value, detail = "", tone = "" }) {
  return (
    <div style={{ ...styles.cashflowMetric, ...(tone === "negative" ? styles.cashflowMetricNegative : {}), ...(tone === "positive" ? styles.cashflowMetricPositive : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

const PROCUREMENT_ORDER_STATUSES = [
  "Not Started",
  "Quote Requested",
  "Quote Received",
  "Approved",
  "Purchase Order Raised",
  "Ordered",
  "Delivered",
  "Backordered",
  "Cancelled",
  "Removed From Quote",
];

const PROCUREMENT_DELIVERY_STATUSES = [
  "Not Required Yet",
  "Scheduled",
  "Part Delivered",
  "Delivered",
  "Issue / Damage",
  "Returned",
];

const PROCUREMENT_CATEGORIES = [
  "Materials",
  "Labour",
  "Subcontractor",
  "Appliances",
  "Fixtures",
  "Fittings",
  "Windows & Doors",
  "Flooring",
  "Plumbing",
  "Electrical",
  "Cabinetry",
  "Hardware",
  "Other",
];

function ProcurementSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const procurement = sheet.workbook.procurement || {};
  const items = procurement.items || [];
  const activeItems = items.filter((item) => !item.removedFromQuote);
  const removedItems = items.filter((item) => item.removedFromQuote);
  const estimatedTotal = activeItems.reduce((sum, item) => sum + numberValue(item.estimatedTotal), 0);
  const [message, setMessage] = useState("");

  function run(action) {
    const result = action?.();
    setMessage(result?.message || "");
  }

  return (
    <div style={styles.pageStack}>
      <section style={styles.cashflowHeader}>
        <div>
          <div style={styles.eyebrow}>Procurement</div>
          <h2 style={styles.cashflowTitle}>Purchasing List</h2>
        </div>
        <div style={styles.cashflowMetricGrid}>
          <CashflowMetric label="Active items" value={String(activeItems.length)} />
          <CashflowMetric label="Estimated total" value={money(estimatedTotal)} />
          <CashflowMetric label="Removed" value={String(removedItems.length)} />
        </div>
      </section>

      {!readonly && (
        <div style={styles.tabBar}>
          <button style={styles.primaryButton} onClick={() => run(sheet.generateProcurementListFromQuote)}>Generate Procurement List From Quote</button>
          <button style={styles.secondaryButton} onClick={() => run(sheet.refreshProcurementListFromQuote)}>Refresh From Quote</button>
          <button style={styles.secondaryButton} onClick={() => exportProcurementCsv(sheet)}>Export Procurement CSV</button>
          <button style={styles.secondaryButton} onClick={() => run(sheet.pushProcurementToJobBoard)}>Push To Job Board</button>
          <button style={styles.secondaryButton} onClick={() => run(sheet.createPurchaseOrdersFromProcurement)}>Create Purchase Orders</button>
          {message && <span style={styles.okPill}>{message}</span>}
        </div>
      )}

      <Spreadsheet headers={[
        "Stage",
        "Section",
        "Item",
        "Qty",
        "Unit",
        "Est. Rate",
        "Est. Total",
        "Supplier",
        "Quote #",
        "Category",
        "Required By",
        "Order Status",
        "Delivery",
        "Officer",
        "Notes",
      ]}>
        {items.length ? items.map((item) => (
          <tr key={item.id} style={item.removedFromQuote ? styles.removedProcurementRow : undefined}>
            <Cell>{item.stageNumber} {item.stageName}</Cell>
            <Cell>{item.sectionNumber} {item.sectionName}</Cell>
            <Cell strong>{item.itemDescription}</Cell>
            <Cell>{item.qty}</Cell>
            <Cell>{item.unit}</Cell>
            <Cell>{money(item.estimatedRate)}</Cell>
            <Cell final>{money(item.estimatedTotal)}</Cell>
            <Cell><BufferedInput disabled={readonly || item.removedFromQuote} style={styles.itemInput} value={item.supplier || ""} onCommit={(next) => sheet.updateProcurementItem(item.id, "supplier", next)} /></Cell>
            <Cell><BufferedInput disabled={readonly || item.removedFromQuote} style={styles.itemInput} value={item.supplierQuoteNumber || ""} onCommit={(next) => sheet.updateProcurementItem(item.id, "supplierQuoteNumber", next)} /></Cell>
            <Cell>
              <select disabled={readonly || item.removedFromQuote} style={styles.selectInput} value={item.procurementCategory || "Other"} onChange={(event) => sheet.updateProcurementItem(item.id, "procurementCategory", event.target.value)}>
                {PROCUREMENT_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Cell>
            <Cell><BufferedInput disabled={readonly || item.removedFromQuote} type="date" style={styles.itemInput} value={item.requiredByDate || ""} onCommit={(next) => sheet.updateProcurementItem(item.id, "requiredByDate", next)} /></Cell>
            <Cell>
              <select disabled={readonly || item.removedFromQuote} style={styles.selectInput} value={item.orderStatus || "Not Started"} onChange={(event) => sheet.updateProcurementItem(item.id, "orderStatus", event.target.value)}>
                {PROCUREMENT_ORDER_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Cell>
            <Cell>
              <select disabled={readonly || item.removedFromQuote} style={styles.selectInput} value={item.deliveryStatus || "Not Required Yet"} onChange={(event) => sheet.updateProcurementItem(item.id, "deliveryStatus", event.target.value)}>
                {PROCUREMENT_DELIVERY_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Cell>
            <Cell><BufferedInput disabled={readonly || item.removedFromQuote} style={styles.itemInput} value={item.assignedPurchasingOfficer || ""} onCommit={(next) => sheet.updateProcurementItem(item.id, "assignedPurchasingOfficer", next)} /></Cell>
            <Cell><BufferedInput disabled={readonly || item.removedFromQuote} style={styles.itemInput} value={item.notes || ""} onCommit={(next) => sheet.updateProcurementItem(item.id, "notes", next)} /></Cell>
          </tr>
        )) : (
          <tr><Cell>No procurement items yet. Generate the list from the quote.</Cell></tr>
        )}
      </Spreadsheet>
    </div>
  );
}

function summaryTotalRow(label, amount, finalQuoteTotal) {
  return (
    <tr key={label}>
      <Cell strong>{label}</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell final>{money(amount)}</Cell>
      <Cell>{summaryPercentOfTotal(amount, finalQuoteTotal)}</Cell>
    </tr>
  );
}

function summaryAdjustmentRow(sheet, field, readonly) {
  const amount = sheet.preview.summary?.[field.amountKey] || 0;
  const percent = field.percentKey ? summaryAdjustmentPercentDisplayValue(sheet, field.percentKey) : "";
  const finalQuoteTotal = sheet.preview.summary?.finalQuoteTotal || 0;
  return (
    <tr key={field.label}>
      <Cell strong>{field.label}</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell>
        {field.amountAdjustmentKey ? (
          <BufferedInput
            inputMode="decimal"
            commitOnChange
            disabled={readonly}
            style={styles.rateInput}
            value={summaryAdjustmentAmountDisplayValue(sheet, field.amountAdjustmentKey, amount)}
            onCommit={(next) => sheet.updateSummaryAdjustment(field.amountAdjustmentKey, next)}
          />
        ) : field.percentKey ? (
          <BufferedInput
            inputMode="decimal"
            commitOnChange
            disabled={readonly}
            style={styles.rateInput}
            value={`${percent}%`}
            onCommit={(next) => sheet.updateSummaryAdjustment(field.percentKey, cleanPercentInputValue(next))}
          />
        ) : (
          ""
        )}
      </Cell>
      <Cell final>{money(amount)}</Cell>
      <Cell>{summaryPercentOfTotal(amount, finalQuoteTotal)}</Cell>
    </tr>
  );
}

function summaryFinalTotalRow(amount) {
  return (
    <tr key="Final quote total">
      <Cell strong>Final quote total</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell final>{money(amount)}</Cell>
      <Cell>100% of total</Cell>
    </tr>
  );
}

function summaryFloorAreaRow(sheet) {
  const floorArea = sheet.preview.quantities?.slabFloorAreaM2 || 0;
  return (
    <tr key="Total floor area">
      <Cell strong>Total floor area</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell>Imported from Data Input row 43</Cell>
      <Cell final>{formatArea(floorArea)} m2</Cell>
      <Cell />
    </tr>
  );
}

function summaryRatePerM2Row(sheet) {
  const finalQuoteTotal = sheet.preview.summary?.finalQuoteTotal || 0;
  const floorArea = summaryNumber(sheet.preview.quantities?.slabFloorAreaM2 || 0);
  const rate = floorArea > 0 ? finalQuoteTotal / floorArea : 0;
  return (
    <tr key="Rate per m2">
      <Cell strong>Rate per m2</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell>Final quote total / total floor area</Cell>
      <Cell final>{floorArea > 0 ? `${money(rate)} / m2` : "$0.00 / m2"}</Cell>
      <Cell />
    </tr>
  );
}

function summaryPercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0.00% of total";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent.toFixed(2)}% of total`;
}

function summaryStagePercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0.00%";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent.toFixed(2)}%`;
}

const SUMMARY_TABLE_ADJUSTMENT_ROWS = [
  { label: "Preliminaries", amountKey: "preliminaryCostsAmount", percentKey: "preliminaryCostsPercent" },
  { label: "Overheads", amountKey: "overheadsAmount", percentKey: "overheadsPercent" },
  { label: "Materials & labour margin", amountKey: "marginAmount", percentKey: "marginPercent" },
  { label: "Profit", amountKey: "profitAmount", percentKey: "profitPercent" },
  { label: "GST", amountKey: "gst", percentKey: "gstPercent" },
  { label: "QBSA registration", amountKey: "qbsaRegistration", amountAdjustmentKey: "qbsaRegistration" },
  { label: "Q Leave fees", amountKey: "qLeaveFees", amountAdjustmentKey: "qLeaveFees" },
  { label: "Sales commission", amountKey: "salesCommissionAmount", percentKey: "salesCommissionPercent" },
];

const CLIENT_HEADER_FIELDS = [
  { key: "companyName", label: "Company name" },
  { key: "estimateTitle", label: "Estimate / Quote title" },
  { key: "clientName", label: "Client name" },
  { key: "projectAddress", label: "Project address" },
  { key: "quoteNumber", label: "Quote number" },
  { key: "quoteDate", label: "Quote date" },
  { key: "expiryDate", label: "Expiry date" },
];

const CLIENT_TEXT_FIELDS = [
  { key: "introduction", label: "Introduction text" },
  { key: "scopeOfWorks", label: "Scope of works" },
  { key: "exclusions", label: "Exclusions" },
  { key: "terms", label: "Terms and conditions" },
  { key: "acceptance", label: "Acceptance section" },
];

const CLIENT_BLOCK_SUMMARIES = {
  introduction: "Sets the tone, confirms the opportunity, and frames the quote as a clear proposal.",
  scopeOfWorks: "Defines what is included so the client can see the practical extent of the works.",
  exclusions: "Clarifies boundaries early and reduces assumptions before acceptance.",
  terms: "Summarises validity, payment, and contract conditions in plain client-facing language.",
  acceptance: "Turns the quote into an actionable approval step with clear intent to proceed.",
};

const QUOTE_PROPOSAL_TEMPLATE_KEY = REGISTRY_PROJECT_ESTIMATE_TEMPLATE_ID;

const QUOTE_PROPOSAL_PAGES = projectEstimateNavigationPages();
const PROJECT_ESTIMATE_TEMPLATE_VERSION = REGISTRY_PROJECT_ESTIMATE_TEMPLATE_VERSION;
const PROJECT_ESTIMATE_PAGE_KEYS = REGISTRY_PROJECT_ESTIMATE_PAGE_KEYS;

const PROPOSAL_BUILDER_BLOCKS = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "text_box", label: "Text box" },
  { type: "image", label: "Image" },
  { type: "logo", label: "Logo" },
  { type: "shape", label: "Shape" },
  { type: "quote_field", label: "Linked Quote Field" },
  { type: "pricing_summary", label: "Pricing Summary" },
  { type: "inclusions", label: "Inclusions" },
  { type: "signature", label: "Signature / Acceptance" },
  { type: "spacer", label: "Spacer" },
  { type: "container", label: "Container" },
  { type: "divider", label: "Divider" },
];

const QUOTE_PROPOSAL_TEMPLATE_FIELDS = [
  "companyName",
  "logoUrl",
  "estimateTitle",
  "projectName",
  "estimatorName",
  "aboutUs",
  "whyChooseUs",
  "buildingYourDreamHome",
  "trustQualityCommunication",
  "projectDesignIntro",
  "inclusionsScheduleIntro",
  "pricingIntro",
  "introduction",
  "scopeOfWorks",
  "exclusions",
  "terms",
  "acceptance",
  "thankYouText",
  "contactDetails",
  "showcaseImages",
];

const CLIENT_STAGE_SUMMARIES = {
  1: "Site readiness, approvals, setup, and early project requirements.",
  2: "Groundworks, slab/base activities, and the foundation of the build.",
  3: "Structural framing work that gives the project its shape and strength.",
  4: "External enclosure items that move the project toward weather protection.",
  5: "Internal completion work, fixtures, finishes, and service fit-off.",
  6: "Final completion items, checks, cleaning, and presentation-ready works.",
  7: "Handover-ready items that close out the project for client occupancy.",
};

function clientPageValues(sheet) {
  const saved = sheet.workbook.clientPage || {};
  const projectName = clientWorkbookDataValue(sheet, "projectName") || saved.projectName || "";
  const companyName = clientWorkbookDataValue(sheet, "builderName") || saved.companyName || "";
  const estimatorName = clientWorkbookDataValue(sheet, "estimatorName") || saved.estimatorName || "";
  const clientName = clientWorkbookDataValue(sheet, "clientName") || saved.clientName || "";
  const projectAddress = clientWorkbookDataValue(sheet, "projectAddress") || saved.projectAddress || "";
  const jobNumber = clientWorkbookDataValue(sheet, "jobNumber") || saved.quoteNumber || "";
  const quoteDate = clientWorkbookDataValue(sheet, "quoteDate") || saved.quoteDate || "";
  const constructionType = clientWorkbookDataValue(sheet, "constructionType") || clientWorkbookDataValue(sheet, "projectType") || saved.constructionType || "";
  const storeys = clientWorkbookDataValue(sheet, "floorCount") || clientWorkbookDataValue(sheet, "storeys") || saved.storeys || "";
  const facade = clientWorkbookDataValue(sheet, "facade") || clientWorkbookDataValue(sheet, "facadeType") || saved.facade || "";
  const roofType = clientWorkbookDataValue(sheet, "roofType") || clientWorkbookDataValue(sheet, "roofCover") || saved.roofType || "";
  const engineering = clientWorkbookDataValue(sheet, "engineeringRequirements") || clientWorkbookDataValue(sheet, "engineering") || clientWorkbookDataValue(sheet, "engineeringStatus") || saved.engineering || "";
  const buildingApprovalDate = clientWorkbookDataValueByKeysOrLabels(sheet, [
    "buildingApprovalDate",
    "buildingApproval",
    "buildingApprovalReceivedDate",
    "buildingApprovalIssuedDate",
    "approvalDate",
    "baDate",
  ], [
    "Building Approval Date",
    "Building Approval",
    "Building Approval Received Date",
    "Building Approval Issued Date",
    "BA Date",
  ]);
  const estimatedStart = estimatedStartFromBuildingApproval(buildingApprovalDate);
  const estimatedDuration = clientWorkbookDataValue(sheet, "expectedBuildDuration") || clientWorkbookDataValue(sheet, "estimatedDuration") || clientWorkbookDataValue(sheet, "buildDuration") || saved.estimatedDuration || "";
  return {
    projectName,
    companyName,
    estimatorName,
    logoUrl: saved.logoUrl || "",
    estimateTitle: saved.estimateTitle || projectName || "Residential Building Quote Proposal",
    clientName,
    projectAddress,
    quoteNumber: jobNumber,
    quoteDate: quoteDate || new Date().toLocaleDateString("en-AU"),
    constructionType,
    storeys,
    facade,
    roofType,
    engineering,
    estimatedStart,
    estimatedDuration,
    expiryDate: saved.expiryDate || "",
    introduction: saved.introduction || "Thank you for the opportunity to provide this quotation.",
    scopeOfWorks: saved.scopeOfWorks || "This quote includes the works listed below.",
    exclusions: saved.exclusions || "Items not expressly included in this quotation are excluded.",
    terms: saved.terms || "This quotation is valid until the expiry date shown above and is subject to final contract documentation.",
    acceptance: saved.acceptance || "I/we accept this quotation and authorise the works to proceed.",
    heroImageUrl: saved.heroImageUrl || "",
    finalImageUrl: saved.finalImageUrl || "",
    showcaseImages: Array.isArray(saved.showcaseImages) ? saved.showcaseImages : [],
    designImages: Array.isArray(saved.designImages) ? saved.designImages : [],
    aboutUs: saved.aboutUs || proposalAiText({ companyName }).aboutUs,
    whyChooseUs: saved.whyChooseUs || proposalAiText({ companyName }).whyChooseUs,
    buildingYourDreamHome: saved.buildingYourDreamHome || proposalAiText({ companyName }).buildingYourDreamHome,
    trustQualityCommunication: saved.trustQualityCommunication || proposalAiText({ companyName }).trustQualityCommunication,
    projectDesignIntro: saved.projectDesignIntro || "This section presents the key design information for the project, including floorplans, facade renders, and project imagery.",
    inclusionsScheduleIntro: saved.inclusionsScheduleIntro || "The full inclusions schedule will be shown here once the structured inclusions system is connected.",
    pricingIntro: saved.pricingIntro || "The price breakdown below summarises the major stages and allowances included in this proposal.",
    thankYouText: saved.thankYouText || proposalAiText({ companyName }).thankYouText,
    contactDetails: saved.contactDetails || "",
    acceptanceClientName: saved.acceptanceClientName || clientName || "",
    acceptanceDate: saved.acceptanceDate || "",
    termsAcknowledged: Boolean(saved.termsAcknowledged),
    quoteAcceptedAt: saved.quoteAcceptedAt || "",
  };
}

function proposalAiText(client = {}) {
  const builder = client.companyName || "our building team";
  const tradeType = client.tradeType || "residential building";
  const clientName = client.clientName || "you";
  const projectAddress = client.projectAddress || "your project";
  return {
    introduction: `Thank you for inviting ${builder} to prepare this quote proposal for ${projectAddress}. This document has been prepared to give ${clientName} a clear, professional overview of the proposed scope, design direction, pricing, allowances, and acceptance process.`,
    aboutUs: `${builder} is a ${tradeType} business focused on delivering well-managed projects, clear communication, reliable workmanship, and a quality finish from the first conversation through to handover.`,
    whyChooseUs: `Clients choose ${builder} because we focus on practical planning, transparent quoting, organised site delivery, and consistent communication. Our aim is to make the building process feel structured, informed, and professionally managed.`,
    buildingYourDreamHome: `Building or renovating a home is a major decision. Our role is to help turn your ideas, plans, and selections into a finished result that reflects the way you want to live, while keeping the process clear and accountable.`,
    trustQualityCommunication: `We place strong emphasis on trust, workmanship, communication, and detail. You can expect regular updates, clear documentation, and a team that treats your project with care from start to finish.`,
    scopeOfWorks: "This proposal is based on the plans, selections, allowances, and information available at the time of quoting. The works include the quoted building stages and inclusions shown in this document.",
    exclusions: "Items not expressly included in this proposal, not shown in the accepted plans, or not listed in the inclusions schedule are excluded unless confirmed in writing.",
    terms: "This proposal is subject to final contract documentation, site conditions, authority requirements, engineering, selections, and any agreed variations. Pricing remains valid until the expiry date shown in this document.",
    acceptance: "By accepting this quote, the client confirms their intention to proceed with the proposed works subject to final contract documentation, agreed selections, and any required approvals.",
    thankYouText: `Thank you for considering ${builder}. We appreciate the opportunity to be part of your project and look forward to helping bring it to life.`,
  };
}

function quoteProposalTemplateFromClient(client = {}) {
  return QUOTE_PROPOSAL_TEMPLATE_FIELDS.reduce((template, key) => {
    template[key] = client[key];
    return template;
  }, {});
}

function normaliseQuoteProposalBuilder(savedBuilder, client, sheet) {
  if (savedBuilder?.version === 2 && Array.isArray(savedBuilder.pages)) {
    const defaultBuilder = defaultQuoteProposalBuilder(client, sheet);
    const cleanup = createProjectEstimateCleanupReport();
    const approvedPages = QUOTE_PROPOSAL_PAGES.map((definition) => {
      const fallback = defaultQuoteProposalPage(definition.key, client, sheet);
      const saved = savedBuilder.pages.find((page) => page.page_type === definition.key || page.id === definition.key) || {};
      const migrated = migrateProjectEstimateSavedBlocks(definition.key, saved.blocks, fallback.blocks, cleanup);
      return {
        ...fallback,
        ...saved,
        id: saved.id || fallback.id,
        page_type: definition.key,
        title: saved.title || fallback.title,
        design: { ...fallback.design, ...(saved.design || {}) },
        blocks: migrated,
      };
    });
    const addedPages = savedBuilder.pages
      .filter((page) => page?.source === "builder-created" || page?.page_type === "builderCreated")
      .map((page, index) => ({
        ...createBuilderProjectEstimatePage(QUOTE_PROPOSAL_PAGES.length + index),
        ...page,
        id: page.id || proposalBuilderId("page"),
        page_type: "builderCreated",
        source: "builder-created",
        title: page.title || "Custom Page",
        blocks: Array.isArray(page.blocks)
          ? page.blocks
            .map((block, blockIndex) => normaliseProposalBuilderBlock({ ...block, source: "builder-created", pageType: "builderCreated", order: Number(block.order ?? blockIndex) }))
            .filter((block) => !staleProjectEstimateBlockReason(block))
          : [],
      }));
    const pages = [...approvedPages, ...addedPages];
    logProjectEstimateCleanup(cleanup);
    return {
      ...defaultBuilder,
      ...savedBuilder,
      template: savedBuilder.template || APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
      templateId: savedBuilder.templateId || savedBuilder.template?.id || APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.id,
      templateVersion: savedBuilder.templateVersion || savedBuilder.template?.version || APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.version,
      theme: { ...defaultBuilder.theme, ...(savedBuilder.theme || {}) },
      importedDocuments: normaliseProposalImportedDocuments(savedBuilder.importedDocuments),
      pages,
      projectEstimateCleanupRecovery: cleanup.removed.length
        ? {
          cleanedAt: new Date().toISOString(),
          retained: cleanup.retained,
          removed: cleanup.removed,
          summary: cleanup.summary,
          previous: savedBuilder.projectEstimateCleanupRecovery || null,
        }
        : savedBuilder.projectEstimateCleanupRecovery,
    };
  }
  if (savedBuilder && typeof savedBuilder === "object" && !Array.isArray(savedBuilder)) {
    return defaultQuoteProposalBuilder({ ...client, ...savedBuilder }, sheet);
  }
  return defaultQuoteProposalBuilder(client, sheet);
}

function defaultQuoteProposalBuilder(client, sheet) {
  return {
    version: 2,
    template: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
    templateId: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.id,
    templateVersion: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS.version,
    name: client.estimateTitle || "Estimate Pack",
    templateName: "Estimate Pack",
    theme: defaultLuxuryProposalTheme(client),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    importedDocuments: normaliseProposalImportedDocuments(),
    pages: QUOTE_PROPOSAL_PAGES.map((page) => defaultQuoteProposalPage(page.key, client, sheet)),
  };
}

function createBuilderProjectEstimatePage(order = 0) {
  const id = proposalBuilderId("page");
  return {
    id,
    page_type: "builderCreated",
    source: "builder-created",
    title: "Custom Page",
    order,
    design: { backgroundColor: "#ffffff" },
    blocks: [],
  };
}

function migrateProjectEstimateSavedBlocks(pageType, savedBlocks = [], fallbackBlocks = [], cleanup = createProjectEstimateCleanupReport()) {
  const saved = Array.isArray(savedBlocks) ? savedBlocks.map((block) => normaliseProposalBuilderBlock(block)) : [];
  if (!saved.length) return fallbackBlocks;
  const repairEstimateSummaryIntroGeometry = projectEstimateSummaryIntroGeometryIsMalformed(pageType, saved);
  const usedSavedIds = new Set();
  const allowedBlockIds = new Set(fallbackBlocks.map((block) => block.id));
  const migratedFallbacks = fallbackBlocks.map((fallback) => {
    const match = findMatchingProjectEstimateBlock(fallback, saved, usedSavedIds);
    if (!match) return fallback;
    usedSavedIds.add(match.id);
    cleanup.retained.push({ pageType, blockId: fallback.id, reason: "approved-block" });
      const matchDesign = { ...(match.design || {}) };
      if (matchDesign.hidden === true && !matchDesign.hiddenBySubscriber) {
        delete matchDesign.hidden;
      }
      if (repairEstimateSummaryIntroGeometry && PROJECT_ESTIMATE_SUMMARY_INTRO_GEOMETRY_IDS.has(fallback.id)) {
        delete matchDesign.widthOverride;
        delete matchDesign.heightOverride;
        delete matchDesign.translateX;
        delete matchDesign.translateY;
      }
      return {
        ...fallback,
        ...match,
        id: fallback.id,
        type: fallback.type,
        order: fallback.order,
        content: { ...(fallback.content || {}), ...(match.content || {}) },
        design: { ...(fallback.design || {}), ...matchDesign },
        migratedFromBlockId: match.id !== fallback.id ? match.id : match.migratedFromBlockId,
        migratedForPageType: pageType,
      };
  });
  const builderBlocks = saved
    .filter((block) => !usedSavedIds.has(block.id))
    .filter((block) => {
      const belongsToPage = !block.pageType || block.pageType === pageType || block.page_type === pageType || block.pageId === pageType;
      const builderCreated = block.source === "builder-created" || block.content?.source === "builder-created";
      const duplicateApprovedId = allowedBlockIds.has(block.id);
      const staleReason = staleProjectEstimateBlockReason(block);
      if (builderCreated && belongsToPage && !duplicateApprovedId && !staleReason) {
        cleanup.retained.push({ pageType, blockId: block.id, reason: "builder-created" });
        return true;
      }
      cleanup.removed.push({
        pageType,
        block,
        reason: !belongsToPage ? "wrong-page" : duplicateApprovedId ? "duplicate-linked-field" : staleReason || legacyProjectEstimateBlockReason(block),
      });
      return false;
    })
    .map((block, index) => ({ ...block, source: "builder-created", pageType, order: Number(block.order ?? (fallbackBlocks.length + index)) }));
  cleanup.summary.validBlocksRetained = cleanup.retained.filter((entry) => entry.reason === "approved-block").length;
  cleanup.summary.builderCreatedBlocksRetained = cleanup.retained.filter((entry) => entry.reason === "builder-created").length;
  cleanup.summary.legacyBlocksRemoved = cleanup.removed.filter((entry) => entry.reason === "legacy-block" || entry.reason === "legacy-linked-field").length;
  cleanup.summary.duplicateBlocksRemoved = cleanup.removed.filter((entry) => entry.reason === "duplicate-linked-field").length;
  cleanup.summary.wrongPageBlocksRemoved = cleanup.removed.filter((entry) => entry.reason === "wrong-page").length;
  return [...migratedFallbacks, ...builderBlocks].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

const PROJECT_ESTIMATE_SUMMARY_INTRO_GEOMETRY_IDS = new Set([
  "estimateSummary-intro-section",
  "estimateSummary-eyebrow",
  "estimateSummary-heading",
  "estimateSummary-intro",
]);

function projectEstimateSummaryIntroGeometryIsMalformed(pageType, savedBlocks = []) {
  if (pageType !== "estimateSummary") return false;
  return savedBlocks.some((block) => {
    if (!PROJECT_ESTIMATE_SUMMARY_INTRO_GEOMETRY_IDS.has(block?.id)) return false;
    const design = block.design || {};
    return design.heightOverride !== undefined || design.translateY !== undefined;
  });
}

function findMatchingProjectEstimateBlock(fallback, savedBlocks, usedSavedIds) {
  const fallbackLabel = String(fallback.content?.editorLabel || fallback.content?.label || "").trim().toLowerCase();
  return savedBlocks.find((block) => block.id === fallback.id && !usedSavedIds.has(block.id))
    || savedBlocks.find((block) => {
      if (usedSavedIds.has(block.id)) return false;
      const label = String(block.content?.editorLabel || block.content?.label || "").trim().toLowerCase();
      return fallbackLabel && label === fallbackLabel;
    })
    || savedBlocks.find((block) => {
      if (usedSavedIds.has(block.id)) return false;
      if (block.type !== fallback.type) return false;
      const fallbackText = String(fallback.content?.text || fallback.content?.heading || "").slice(0, 40).toLowerCase();
      const blockText = String(block.content?.text || block.content?.heading || "").slice(0, 40).toLowerCase();
      return fallbackText && blockText && fallbackText === blockText;
    });
}

function createProjectEstimateCleanupReport() {
  return {
    retained: [],
    removed: [],
    summary: {
      validBlocksRetained: 0,
      legacyBlocksRemoved: 0,
      duplicateBlocksRemoved: 0,
      wrongPageBlocksRemoved: 0,
      builderCreatedBlocksRetained: 0,
    },
  };
}

const LEGACY_PROJECT_ESTIMATE_LABELS = [
  "client name",
  "quote date",
  "quote number",
  "prepared by",
  "thank you message",
  "company story",
  "testimonial",
  "stat 1",
  "stat 2",
  "stat 3",
  "stat 4",
];

function staleProjectEstimateBlockReason(block = {}) {
  const label = `${block.id || ""} ${block.type || ""} ${block.content?.editorLabel || ""} ${block.content?.label || ""} ${block.content?.text || ""} ${block.content?.heading || ""}`.toLowerCase();
  if (label.includes("progress payment source diagnostics") || label.includes("source diagnostics")) return "diagnostic-block";
  if (label.includes("progress-source-") || label.includes("sourcekey")) return "diagnostic-block";
  if ((block.design?.hidden === true && block.design?.hiddenBySubscriber !== true) || block.content?.hidden === true) return "hidden-block";
  const width = Number(block.design?.width);
  const height = Number(block.design?.height);
  if ((Number.isFinite(width) && width <= 0) || (Number.isFinite(height) && height <= 0)) return "zero-size-block";
  return "";
}

function legacyProjectEstimateBlockReason(block = {}) {
  const label = `${block.id || ""} ${block.content?.editorLabel || ""} ${block.content?.label || ""} ${block.content?.text || ""} ${block.content?.heading || ""}`.toLowerCase();
  if (block.type === "quote_field" || block.type === "linkedField" || block.content?.fieldKey) return "legacy-linked-field";
  if (LEGACY_PROJECT_ESTIMATE_LABELS.some((needle) => label.includes(needle))) return "legacy-block";
  return "unknown-block";
}

function logProjectEstimateCleanup(cleanup = createProjectEstimateCleanupReport()) {
  if (process.env.NODE_ENV === "production" || !cleanup.removed.length) return;
  console.info("Project Estimate cleanup:", {
    "Valid blocks retained": cleanup.summary.validBlocksRetained,
    "Legacy blocks removed": cleanup.summary.legacyBlocksRemoved,
    "Duplicate blocks removed": cleanup.summary.duplicateBlocksRemoved,
    "Wrong-page blocks removed": cleanup.summary.wrongPageBlocksRemoved,
    "Builder-created blocks retained": cleanup.summary.builderCreatedBlocksRetained,
    removedBlockIds: cleanup.removed.map((entry) => entry.block?.id || "").filter(Boolean),
  });
}

function normaliseProposalImportedDocuments(importedDocuments = {}) {
  const inclusions = importedDocuments?.inclusions && typeof importedDocuments.inclusions === "object"
    ? normaliseImportedProposalDocument(importedDocuments.inclusions)
    : null;
  const pricedPlans = importedDocuments?.pricedPlans && typeof importedDocuments.pricedPlans === "object"
    ? importedDocuments.pricedPlans
    : null;
  return {
    inclusions,
    pricedPlans: pricedPlans ? normaliseImportedProposalDocument(pricedPlans) : null,
  };
}

function proposalProjectId(sheet) {
  return sheet?.workbook?.commercialProjectId || sheet?.workbook?.projectId || "";
}

function proposalEstimateId(sheet) {
  return sheet?.workbook?.estimateSnapshotId || sheet?.workbook?.id || "";
}

function proposalLegacyInclusionsKeys(importedDocuments = {}) {
  return Object.keys(importedDocuments || {}).filter((key) => (
    key !== "inclusions"
    && /inclusion/i.test(key)
    && importedDocuments[key]
  ));
}

function activeInclusionsCandidates(importedDocuments = {}) {
  const candidates = [];
  if (importedDocuments?.inclusions && typeof importedDocuments.inclusions === "object") {
    candidates.push(normaliseImportedProposalDocument(importedDocuments.inclusions));
  }
  for (const key of proposalLegacyInclusionsKeys(importedDocuments)) {
    const value = importedDocuments[key];
    if (value && typeof value === "object" && (value.publicUrl || value.public_url || value.storagePath || value.storage_path)) {
      candidates.push(normaliseImportedProposalDocument(value));
    }
  }
  return candidates.filter((document) => document.active !== false && (document.publicUrl || document.storagePath));
}

function validateActiveInclusionsState(importedDocuments = {}) {
  const candidates = activeInclusionsCandidates(importedDocuments);
  const legacyKeys = proposalLegacyInclusionsKeys(importedDocuments);
  if (candidates.length > 1) {
    return { ok: false, error: "More than one active inclusions schedule exists. Remove the old schedule before exporting.", legacyFound: legacyKeys.length > 0 };
  }
  return { ok: true, document: candidates[0] || null, legacyFound: legacyKeys.length > 0 };
}

function replaceActiveInclusionsDocument(builder = {}, document = {}, sourceType = "standard_inclusions") {
  const importedDocuments = { ...(builder.importedDocuments || {}) };
  const {
    inclusions: _oldInclusions,
    inclusionsPdf: _oldInclusionsPdf,
    importedInclusionsPdf: _oldImportedInclusionsPdf,
    standardInclusionsPdf: _oldStandardInclusionsPdf,
    modifiedInclusionsPdf: _oldModifiedInclusionsPdf,
    ...remainingDocuments
  } = importedDocuments;
  return {
    ...builder,
    importedDocuments: {
      ...remainingDocuments,
      inclusions: {
        ...normaliseImportedProposalDocument(document),
        sourceType,
        active: true,
        status: "active",
        importedAt: new Date().toISOString(),
      },
    },
  };
}

function clearActiveInclusionsDocument(builder = {}) {
  const importedDocuments = { ...(builder.importedDocuments || {}) };
  const {
    inclusions: _oldInclusions,
    inclusionsPdf: _oldInclusionsPdf,
    importedInclusionsPdf: _oldImportedInclusionsPdf,
    standardInclusionsPdf: _oldStandardInclusionsPdf,
    modifiedInclusionsPdf: _oldModifiedInclusionsPdf,
    ...remainingDocuments
  } = importedDocuments;
  return {
    ...builder,
    importedDocuments: {
      ...remainingDocuments,
      inclusions: null,
    },
  };
}

function normaliseImportedProposalDocument(document = {}) {
  const pages = Array.isArray(document.pages) ? document.pages : [];
  return {
    id: document.id || proposalBuilderId("pdf"),
    title: document.title || document.fileName || "Imported PDF",
    fileName: document.fileName || document.file_name || document.name || "document.pdf",
    publicUrl: document.publicUrl || document.public_url || document.url || "",
    storagePath: document.storagePath || document.storage_path || "",
    sourceType: document.sourceType || document.source_type || "",
    status: document.status || (document.active === false ? "inactive" : "active"),
    active: document.active !== false && document.status !== "inactive" && document.status !== "removed",
    fileHash: document.fileHash || document.file_hash || document.hash || "",
    version: document.version || document.fileVersion || document.file_version || "",
    projectId: document.projectId || document.project_id || "",
    estimateId: document.estimateId || document.estimate_id || "",
    pageCount: Number(document.pageCount || document.page_count || pages.length || 1),
    uploadedAt: document.uploadedAt || document.uploaded_at || document.importedAt || "",
    uploadedBy: document.uploadedBy || document.uploaded_by || "",
    pages: pages.map((page, index) => ({
      ...page,
      order: Number(page.order || index + 1),
      rotation: Number(page.rotation || page.metadataRotation || 0),
      metadataRotation: Number(page.metadataRotation || page.rotation || 0),
      orientation: page.orientation || planPageOrientation(page),
    })),
  };
}

function defaultLuxuryProposalTheme(client = {}) {
  const builder = client.companyName || "Your Building Team";
  return {
    name: "Luxury Residential Proposal",
    accentColor: "#c89d4a",
    logoUrl: client.logoUrl || "",
    heroImageUrl: client.heroImageUrl || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=80",
    aboutImageUrl: client.showcaseImages?.[0] || "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1400&q=80",
    aboutDetailImageUrl: client.showcaseImages?.[1] || "",
    projectInfoImageUrl: client.showcaseImages?.[2] || "",
    whyImageUrl: client.showcaseImages?.[3] || "",
    designImageUrl: client.designImages?.[0] || "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1500&q=80",
    thankYouImageUrl: client.finalImageUrl || client.heroImageUrl || "",
    clientNameOverride: "",
    siteAddressOverride: "",
    companyStory: client.aboutUs || "We understand that building a home is about far more than bricks and mortar. It is about creating a place where your family will make memories for years to come. Our commitment is to deliver a home built with craftsmanship, honesty and clear communication every step of the way.",
    testimonial: client.testimonial || "",
    designNotes: client.projectDesignIntro || "The proposed scope is shaped around the plans, selections, site requirements, and the lifestyle outcome the client wants to achieve.",
    acceptanceNote: client.terms || "Acceptance is subject to final contract documentation, confirmed selections, site conditions, authority requirements, engineering and any agreed variations.",
    thankYouMessage: client.thankYouText || `Thank you for considering ${builder}. We appreciate the opportunity to help bring this project to life.`,
    stats: [
      { value: "18+", label: "Years Experience" },
      { value: "250+", label: "Homes Completed" },
      { value: "98%", label: "Client Satisfaction" },
      { value: "4.9/5", label: "Average Rating" },
    ],
  };
}

function hydrateProjectEstimatePageFromApi(pageShell, client, sheet) {
  if (Array.isArray(pageShell.blocks) && pageShell.blocks.length) return pageShell;
  const fallback = defaultQuoteProposalPage(pageShell.page_type, client, sheet);
  return {
    ...fallback,
    id: pageShell.id || fallback.id,
    hiddenFromPdf: pageShell.hiddenFromPdf,
    source: pageShell.source || fallback.source,
  };
}

function defaultQuoteProposalPage(pageType, client, sheet) {
  const title = QUOTE_PROPOSAL_PAGES.find((page) => page.key === pageType)?.label || pretty(pageType);
  const base = {
    id: pageType,
    page_type: pageType,
    title,
    design: {
      backgroundColor: "#ffffff",
      backgroundImageUrl: "",
      overlayOpacity: 0,
    },
    blocks: [],
  };
  const standaloneDefinition = projectEstimatePageDefinitionFor(pageType);
  if (standaloneDefinition) {
    const blocks = defaultProjectEstimateBlocks(pageType).map((block) => normaliseProposalBuilderBlock(block));
    if (pageType === "cover" && !blocks.some((block) => block.id === "cover-hero-image")) {
      blocks.unshift(normaliseProposalBuilderBlock({
        id: "cover-hero-image",
        type: "image",
        order: -1,
        content: {
          imageUrl: client.heroImageUrl || "/assets/builders/standard-inclusions-hero.jpg",
          defaultImageUrl: client.heroImageUrl || "/assets/builders/standard-inclusions-hero.jpg",
          editorLabel: "Cover hero image",
          alt: "Cover hero image",
        },
        design: {
          objectFit: "cover",
          frame: { x: 0, y: 0, width: 794, height: 1123 },
          opacity: 1,
        },
      }));
    }
    return {
      ...base,
      title: standaloneDefinition.navigationTitle,
      blocks,
    };
  }
  const linked = quoteProposalLinkedFields(sheet, client);
  const accent = "#c89d4a";
  const navy = "#07111f";
  const ink = "#0f172a";
  const soft = "#f5f1e8";
  const projectLine = "{{clientName}}\n{{projectAddress}}";
  const promiseLine = "A considered building proposal designed to feel clear, premium, and ready to move from plans to reality.";
  if (pageType === "cover") {
    return {
      ...base,
      design: { ...base.design, backgroundColor: navy, backgroundImageUrl: client.heroImageUrl || "", overlayOpacity: client.heroImageUrl ? 0.62 : 0 },
      blocks: [
        createProposalBuilderBlock("logo", linked, 0, { content: { logoUrl: client.logoUrl || "" }, design: { width: 190, height: 108 } }),
        createProposalBuilderBlock("spacer", linked, 1, { design: { height: 140 } }),
        createProposalBuilderBlock("text", linked, 2, { content: { text: "RESIDENTIAL BUILDING PROPOSAL" }, design: { color: accent, fontSize: 15, fontWeight: 900, lineHeight: 1.35, textAlign: "left" } }),
        createProposalBuilderBlock("heading", linked, 3, { content: { text: "{{quoteTitle}}" }, design: { color: "#ffffff", fontSize: 62, fontWeight: 900, lineHeight: 0.98, textAlign: "left" } }),
        createProposalBuilderBlock("divider", linked, 4, { design: { color: accent, thickness: 5 } }),
        createProposalBuilderBlock("text", linked, 5, { content: { text: projectLine }, design: { color: "#f8fafc", fontSize: 24, fontWeight: 700, lineHeight: 1.35, textAlign: "left" } }),
        createProposalBuilderBlock("text", linked, 6, { content: { text: promiseLine }, design: { color: "#cbd5e1", fontSize: 17, fontWeight: 500, lineHeight: 1.55, textAlign: "left" } }),
        createProposalBuilderBlock("quote_field", linked, 7, { content: { fieldKey: "quoteNumber", label: "Quote Number" }, design: { textAlign: "left" } }),
        createProposalBuilderBlock("quote_field", linked, 8, { content: { fieldKey: "quoteDate", label: "Quote Date" }, design: { textAlign: "left" } }),
      ],
    };
  }
  if (pageType === "about") {
    return { ...base, design: { ...base.design, backgroundColor: "#fbfaf6" }, blocks: [
      createProposalBuilderBlock("logo", linked, 0, { content: { logoUrl: client.logoUrl || "" }, design: { width: 170, height: 94 } }),
      createProposalBuilderBlock("text", linked, 1, { content: { text: "WHY THIS BUILDER" }, design: { color: accent, fontSize: 14, fontWeight: 900, lineHeight: 1.35 } }),
      createProposalBuilderBlock("heading", linked, 2, { content: { text: "Built around trust, detail, and a finish you will be proud to come home to." }, design: { color: ink, fontSize: 42, fontWeight: 900, lineHeight: 1.08 } }),
      createProposalBuilderBlock("divider", linked, 3, { design: { color: accent, thickness: 4 } }),
      createProposalBuilderBlock("text", linked, 4, { content: { text: client.aboutUs } , design: { color: "#334155", fontSize: 18, fontWeight: 500, lineHeight: 1.65 } }),
      createProposalBuilderBlock("image", linked, 5, { content: { imageUrl: client.showcaseImages?.[0] || client.heroImageUrl || "", alt: "Completed home detail" }, design: { objectFit: "cover" } }),
      createProposalBuilderBlock("text", linked, 6, { content: { text: "20+ Years Experience     150+ Projects Completed     98% Client Satisfaction     100% Safety Focus" }, design: { color: navy, fontSize: 21, fontWeight: 900, lineHeight: 1.55, textAlign: "center" } }),
    ] };
  }
  if (pageType === "design") {
    return { ...base, design: { ...base.design, backgroundColor: "#f8fafc" }, blocks: [
      createProposalBuilderBlock("text", linked, 0, { content: { text: "DESIGN INTENT" }, design: { color: accent, fontSize: 14, fontWeight: 900 } }),
      createProposalBuilderBlock("heading", linked, 1, { content: { text: "A home shaped around lifestyle, light, proportion, and everyday comfort." }, design: { color: ink, fontSize: 44, fontWeight: 900, lineHeight: 1.08 } }),
      createProposalBuilderBlock("image", linked, 2, { content: { imageUrl: client.designImages?.[0] || client.heroImageUrl || "", alt: "Project design image" }, design: { objectFit: "cover" } }),
      createProposalBuilderBlock("text", linked, 3, { content: { text: client.projectDesignIntro || client.scopeOfWorks }, design: { color: "#334155", fontSize: 18, fontWeight: 500, lineHeight: 1.62 } }),
      createProposalBuilderBlock("divider", linked, 4, { design: { color: accent, thickness: 3 } }),
      createProposalBuilderBlock("text", linked, 5, { content: { text: "Clear scope. Thoughtful selections. Confident delivery." }, design: { color: navy, fontSize: 26, fontWeight: 900, textAlign: "center", lineHeight: 1.25 } }),
    ] };
  }
  if (pageType === "standardInclusions") {
    return { ...base, title: "Standard Inclusions Schedule", design: { ...base.design, backgroundColor: soft }, blocks: [] };
  }
  if (pageType === "pricedPlans") {
    return { ...base, title: "Plans Used to Prepare This Estimate", design: { ...base.design, backgroundColor: "#ffffff" }, blocks: [] };
  }
  if (pageType === "termsNotes") {
    return { ...base, title: "Terms / Notes", design: { ...base.design, backgroundColor: "#ffffff" }, blocks: [] };
  }
  if (pageType === "inclusions") {
    return { ...base, design: { ...base.design, backgroundColor: soft }, blocks: [
      createProposalBuilderBlock("text", linked, 0, { content: { text: "WHAT IS INCLUDED" }, design: { color: accent, fontSize: 14, fontWeight: 900 } }),
      createProposalBuilderBlock("heading", linked, 1, { content: { text: "A clear inclusions story, so your client understands the value behind the number." }, design: { color: ink, fontSize: 40, fontWeight: 900, lineHeight: 1.1 } }),
      createProposalBuilderBlock("text", linked, 2, { content: { text: "This proposal brings together the major building stages, allowances, selections, and trade items that shape the finished home." }, design: { color: "#475569", fontSize: 19, fontWeight: 550, lineHeight: 1.55 } }),
      createProposalBuilderBlock("inclusions", linked, 3, { content: { heading: "Included in this proposal", intro: client.inclusionsScheduleIntro, items: [] } }),
      createProposalBuilderBlock("text", linked, 4, { content: { text: "Every allowance and inclusion can be refined as selections are confirmed." }, design: { color: navy, fontSize: 18, fontWeight: 800, textAlign: "center" } }),
    ] };
  }
  if (pageType === "pricing") {
    return { ...base, design: { ...base.design, backgroundColor: "#07111f" }, blocks: [
      createProposalBuilderBlock("text", linked, 0, { content: { text: "PRICE / TRADE SUMMARY" }, design: { color: accent, fontSize: 14, fontWeight: 900 } }),
      createProposalBuilderBlock("heading", linked, 1, { content: { text: "A transparent summary of the estimate value and staged payment structure." }, design: { color: "#ffffff", fontSize: 42, fontWeight: 900, lineHeight: 1.08 } }),
      createProposalBuilderBlock("text", linked, 2, { content: { text: client.pricingIntro }, design: { color: "#cbd5e1", fontSize: 18, fontWeight: 500, lineHeight: 1.6 } }),
      createProposalBuilderBlock("pricing_summary", linked, 3, { content: { heading: "Project Investment" } }),
      createProposalBuilderBlock("text", linked, 4, { content: { text: "Final Quote Total: {{quoteTotal}}" }, design: { color: "#ffffff", fontSize: 30, fontWeight: 900, textAlign: "center" } }),
    ] };
  }
  if (pageType === "acceptance") {
    return { ...base, design: { ...base.design, backgroundColor: "#fbfaf6" }, blocks: [
      createProposalBuilderBlock("text", linked, 0, { content: { text: "NEXT STEP" }, design: { color: accent, fontSize: 14, fontWeight: 900 } }),
      createProposalBuilderBlock("heading", linked, 1, { content: { text: "Ready to move from proposal to project." }, design: { color: ink, fontSize: 48, fontWeight: 900, lineHeight: 1.05 } }),
      createProposalBuilderBlock("text", linked, 2, { content: { text: "Once accepted, the project can move into final documentation, selections, scheduling, and contract preparation." }, design: { color: "#334155", fontSize: 20, fontWeight: 550, lineHeight: 1.55 } }),
      createProposalBuilderBlock("signature", linked, 3, { content: { heading: "Quote Acceptance", text: client.acceptance } }),
      createProposalBuilderBlock("text", linked, 4, { content: { text: client.terms }, design: { color: "#64748b", fontSize: 14, fontWeight: 500, lineHeight: 1.55 } }),
    ] };
  }
  return { ...base, blocks: [
    createProposalBuilderBlock("spacer", linked, 0, { design: { height: 120 } }),
    createProposalBuilderBlock("logo", linked, 1, { content: { logoUrl: client.logoUrl || "" }, design: { width: 180, height: 105 } }),
    createProposalBuilderBlock("text", linked, 2, { content: { text: "THANK YOU" }, design: { color: accent, textAlign: "center", fontSize: 15, fontWeight: 900 } }),
    createProposalBuilderBlock("heading", linked, 3, { content: { text: "Let’s build something worth coming home to." }, design: { color: ink, textAlign: "center", fontSize: 52, fontWeight: 900, lineHeight: 1.04 } }),
    createProposalBuilderBlock("divider", linked, 4, { design: { color: accent, thickness: 4 } }),
    createProposalBuilderBlock("text", linked, 5, { content: { text: client.thankYouText }, design: { color: "#334155", textAlign: "center", fontSize: 21, fontWeight: 500, lineHeight: 1.55 } }),
    createProposalBuilderBlock("quote_field", linked, 6, { content: { fieldKey: "companyName", label: "Prepared by" }, design: { textAlign: "center" } }),
  ] };
}

function createProposalBuilderBlock(type, linkedFields, order = 0, overrides = {}) {
  const base = {
    id: proposalBuilderId("block"),
    type,
    order,
    content: {},
    design: {
      color: "#0f172a",
      fontSize: type === "heading" ? 34 : 17,
      lineHeight: 1.6,
      textAlign: "left",
    },
  };
  const defaults = {
    heading: { content: { text: "Heading" } },
    text: { content: { text: "Add proposal text here." } },
    image: { content: { imageUrl: "", alt: "" }, design: { objectFit: "cover" } },
    logo: { content: { logoUrl: linkedFields.logoUrl?.value || "" }, design: { width: 210, height: 130 } },
    quote_field: { content: { fieldKey: "clientName", label: "Client Name" } },
    pricing_summary: { content: { heading: "Pricing Summary" } },
    inclusions: { content: { heading: "Inclusions", intro: "", items: [] } },
    signature: { content: { heading: "Acceptance", text: "I/we accept this proposal and authorise the works to proceed." } },
    spacer: { design: { height: 32 } },
    divider: { design: { color: "#cbd5e1", thickness: 2 } },
  }[type] || {};
  return normaliseProposalBuilderBlock({
    ...base,
    ...defaults,
    ...overrides,
    content: { ...base.content, ...(defaults.content || {}), ...(overrides.content || {}) },
    design: { ...base.design, ...(defaults.design || {}), ...(overrides.design || {}) },
  });
}

function normaliseProposalBuilderBlock(block) {
  return {
    id: block.id || proposalBuilderId("block"),
    type: block.type || "text",
    order: block.order || 0,
    source: block.source || "",
    pageType: block.pageType || block.page_type || block.pageId || "",
    content: { ...(block.content || {}) },
    design: { ...(block.design || {}), frame: normaliseProposalFrame(block.design?.frame, block) },
  };
}

function proposalBuilderId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function quoteProposalLinkedFields(sheet, client) {
  return {
    projectName: { label: "Project name", value: client.projectName },
    companyName: { label: "Company name", value: client.companyName },
    estimatorName: { label: "Estimator", value: client.estimatorName },
    logoUrl: { label: "Logo URL", value: client.logoUrl },
    quoteTitle: { label: "Quote title", value: client.estimateTitle },
    clientName: { label: "Client name", value: client.clientName },
    projectAddress: { label: "Project address", value: client.projectAddress },
    quoteNumber: { label: "Quote number", value: client.quoteNumber },
    quoteDate: { label: "Quote date", value: client.quoteDate },
    constructionType: { label: "Construction type", value: client.constructionType },
    storeys: { label: "Storeys", value: client.storeys },
    facade: { label: "Facade", value: client.facade },
    roofType: { label: "Roof type", value: client.roofType },
    engineering: { label: "Engineering", value: client.engineering },
    estimatedStart: { label: "Estimated start", value: client.estimatedStart },
    estimatedDuration: { label: "Estimated duration", value: client.estimatedDuration },
    quoteTotal: { label: "Quote total", value: money(sheet.preview.summary.finalQuoteTotal) },
    gst: { label: "GST", value: money(sheet.preview.summary.gst) },
    pricingGroups: { label: "Pricing groups", value: proposalProgressPaymentRowsFromCashflow(sheet) },
    inclusions: { label: "Inclusions", value: proposalInclusionRows(sheet, client) },
    estimateInclusionsPackage: { label: "Estimate inclusions package", value: selectedEstimateInclusionsPackage(sheet.workbook.estimateInclusions) },
    standardInclusionsPackage: { label: "Standard inclusions package", value: selectedStandardInclusionsPackage(sheet.workbook.standardInclusions) },
    scopeOfWorks: { label: "Scope of works", value: client.scopeOfWorks },
    exclusions: { label: "Exclusions", value: client.exclusions },
  };
}

function proposalInclusionRows(sheet, client) {
  const explicit = String(client.inclusionsScheduleIntro || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  return clientBuildStageGroups(sheet).slice(0, 8).map((group) => `${group.label}: ${money(group.total)}`);
}

function resolveProposalText(value, linkedFields) {
  return String(value || "").replace(/\{\{(\w+)\}\}/g, (_, key) => linkedFields[key]?.value ?? "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

async function prepareProposalImageDataUrl(file, { maxDimension = 1800, quality = 0.84 } = {}) {
  const original = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml") return original;
  if (typeof document === "undefined") return original;

  const image = await loadImageElement(original);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const largest = Math.max(width, height);
  if (!width || !height || largest <= maxDimension) return original;

  const ratio = maxDimension / largest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return original;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function proposalPerfLog(label, details = {}) {
  if (process.env.NODE_ENV === "production") return;
  if (typeof console === "undefined") return;
  if (typeof window !== "undefined" && window.localStorage?.getItem("estimate-builder-proposal-perf") !== "true") return;
  console.debug("[QuoteProposalBuilder]", label, details);
}

function proposalBlockLabel(type) {
  return PROPOSAL_BUILDER_BLOCKS.find((block) => block.type === type)?.label || pretty(type);
}

function clientWorkbookDataValue(sheet, key) {
  for (const section of Object.values(sheet.workbook.data || {})) {
    const row = section?.rows?.[key];
    if (row?.value !== undefined && row?.value !== null && row.value !== "") return row.value;
  }
  return "";
}

function clientWorkbookDataValueByKeysOrLabels(sheet, keys = [], labels = []) {
  for (const key of keys) {
    const value = clientWorkbookDataValue(sheet, key);
    if (String(value || "").trim()) return value;
  }
  const wanted = new Set(labels.map(normaliseWorkbookLookupText));
  for (const section of Object.values(sheet.workbook.data || {})) {
    for (const row of Object.values(section?.rows || {})) {
      const label = normaliseWorkbookLookupText(row?.label || row?.title || row?.name);
      if (!wanted.has(label)) continue;
      if (row?.value !== undefined && row?.value !== null && row.value !== "") return row.value;
    }
  }
  return "";
}

function normaliseWorkbookLookupText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function estimatedStartFromBuildingApproval(value) {
  const date = parseWorkbookDate(value);
  if (!date) return "Approximately 2 weeks after Building Approval";
  date.setDate(date.getDate() + 14);
  return formatIsoDate(date);
}

function parseWorkbookDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const au = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (au) {
    const year = Number(au[3].length === 2 ? `20${au[3]}` : au[3]);
    return validDate(year, Number(au[2]), Number(au[1]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasProjectInfoValue(value) {
  const text = String(value || "").trim();
  return Boolean(text) && text !== "Not entered";
}

function clientStageSummary(group) {
  const itemText = group.rows.length === 1 ? "1 included item" : `${group.rows.length} included items`;
  return `${itemText}. ${CLIENT_STAGE_SUMMARIES[group.stageNumber] || "Client-facing stage total with allowances already included."}`;
}

function quotePercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0% of overall quote";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent}% of overall quote`;
}

function clientBuildStageGroups(sheet) {
  const stageGroups = summaryBuildStageGroups(sheet);
  const sourceItems = stageGroups.flatMap((group) => group.rows.map((item) => ({ ...item, stageNumber: group.stageNumber, stageLabel: group.label })));
  const normalItems = sourceItems.filter((item) => !item.adjustment);
  const fixedItems = sourceItems.filter((item) => item.adjustment);
  const normalBaseSubtotal = roundMoney(normalItems.reduce((sum, item) => sum + summaryLineTotal(item.row), 0));
  const fixedTotal = roundMoney(fixedItems.reduce((sum, item) => sum + summaryLineTotal(item.row), 0));
  const finalQuoteTotal = roundMoney(sheet.preview.summary.finalQuoteTotal || 0);
  const hiddenAddons = roundMoney(finalQuoteTotal - normalBaseSubtotal - fixedTotal);
  let loadedItems = sourceItems.map((item) => {
    const baseTotal = roundMoney(summaryLineTotal(item.row));
    const qty = summaryNumber(item.row?.qty || item.row?.quantity || 0);
    const share = !item.adjustment && normalBaseSubtotal > 0 ? baseTotal / normalBaseSubtotal : 0;
    const loadedTotal = roundMoney(baseTotal + hiddenAddons * share);
    return {
      id: item.row.id,
      section: item.section,
      adjustment: Boolean(item.adjustment),
      stageNumber: item.stageNumber,
      stageLabel: item.stageLabel,
      description: clientItemDescription(item.section, item.row, sheet),
      qty,
      unit: item.row.unit || "",
      loadedTotal,
      loadedRate: qty ? roundMoney(loadedTotal / qty) : loadedTotal,
    };
  });
  const loadedTotal = roundMoney(loadedItems.reduce((sum, item) => sum + item.loadedTotal, 0));
  const correction = roundMoney(finalQuoteTotal - loadedTotal);
  if (loadedItems.length && correction) {
    const lastNormalIndex = loadedItems.map((item, index) => (item.adjustment ? -1 : index)).filter((index) => index >= 0).pop();
    const lastIndex = lastNormalIndex ?? loadedItems.length - 1;
    const correctedTotal = roundMoney(loadedItems[lastIndex].loadedTotal + correction);
    const qty = summaryNumber(loadedItems[lastIndex].qty);
    loadedItems[lastIndex] = {
      ...loadedItems[lastIndex],
      loadedTotal: correctedTotal,
      loadedRate: qty ? roundMoney(correctedTotal / qty) : correctedTotal,
    };
  }
  const groups = BUILD_STAGE_GROUPS.map((stage) => ({ ...stage, rows: [], total: 0 }));
  const byNumber = new Map(groups.map((group) => [group.stageNumber, group]));
  loadedItems.forEach((item) => {
    const group = byNumber.get(item.stageNumber);
    if (!group) return;
    group.rows.push(item);
    group.total = roundMoney(group.total + item.loadedTotal);
  });
  return groups.filter((group) => group.rows.length);
}

function cashflowSummaryRows(sheet) {
  const finalQuoteTotal = summaryNumber(sheet.preview.summary.finalQuoteTotal || 0);
  const outgoingGroups = summaryBuildStageGroups(sheet);
  const outgoingByStage = new Map(outgoingGroups.map((group) => [group.stageNumber, group]));
  const savedPayments = sheet.workbook.cashflowPayments || {};
  return BUILD_STAGE_GROUPS.filter((group) => Number(group.stageNumber) > 0).map((group) => {
    const savedPercent = savedPayments?.[group.stageNumber];
    const hasSavedPercent = String(savedPercent ?? "").trim() !== "";
    const defaultPercent = DEFAULT_CASHFLOW_PROGRESS_PAYMENTS[group.stageNumber] || 0;
    const percent = cashflowPercent(savedPercent, defaultPercent);
    const incoming = roundMoney(finalQuoteTotal * percent / 100);
    const outgoing = roundMoney(outgoingByStage.get(group.stageNumber)?.total || 0);
    return {
      stageNumber: group.stageNumber,
      label: group.label,
      percent,
      percentDisplay: cashflowPercentDisplay(hasSavedPercent ? savedPercent : "", percent),
      incoming,
      amount: incoming,
      outgoing,
      surplus: roundMoney(incoming - outgoing),
      sourceKey: hasSavedPercent ? `workbook.cashflowPayments.${group.stageNumber}` : `DEFAULT_CASHFLOW_PROGRESS_PAYMENTS.${group.stageNumber}`,
      sourceDescription: "Cashflow Summary progress payment table",
    };
  });
}

function proposalProgressPaymentRowsFromCashflow(sheet) {
  return cashflowSummaryRows(sheet).map((row) => ({
    stageNumber: row.stageNumber,
    label: row.label,
    percent: row.percent,
    percentDisplay: row.percentDisplay,
    amount: row.incoming,
    total: row.incoming,
    sourceKey: `cashflowSummary.stage-${row.stageNumber}`,
    sourceDescription: row.sourceDescription,
  }));
}

function cashflowPercent(value, fallback = 0) {
  const text = String(value ?? "").replace("%", "").trim();
  if (!text) return roundMoney(fallback);
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : roundMoney(fallback);
}

function cashflowPercentDisplay(savedValue, percent) {
  const text = String(savedValue ?? "").trim();
  if (text) return text.includes("%") ? text : `${text}%`;
  return `${formatPercent(percent)}%`;
}

function formatPercent(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function clientItemDescription(section, row, sheet) {
  const sectionLabel = summaryLineSectionLabel(section, sheet);
  const item = quoteItem(row);
  if (!sectionLabel) return item;
  return item ? `${sectionLabel} - ${item}` : sectionLabel;
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

const BUILD_STAGE_GROUPS = [
  { stageNumber: 0, label: "UNASSIGNED" },
  { stageNumber: 1, label: "PRELIMINARIES" },
  { stageNumber: 2, label: "BASE STAGE" },
  { stageNumber: 3, label: "FRAME STAGE" },
  { stageNumber: 4, label: "LOCK UP STAGE" },
  { stageNumber: 5, label: "FIX OUT STAGE" },
  { stageNumber: 6, label: "PRACTICAL COMPLETION" },
  { stageNumber: 7, label: "HANDOVER" },
];

const DEFAULT_CASHFLOW_PROGRESS_PAYMENTS = {
  1: 5,
  2: 15,
  3: 15,
  4: 20,
  5: 18,
  6: 17,
  7: 10,
};

function summaryBuildStageGroups(sheet) {
  const parentByChild = quoteParentByChildSection(sheet.quoteSections);
  const groups = BUILD_STAGE_GROUPS.map((stage) => ({ ...stage, rows: [], total: 0 }));
  const byNumber = new Map(groups.map((group) => [group.stageNumber, group]));
  summaryOpeningRows(sheet).forEach((item) => {
    const group = byNumber.get(item.stageNumber);
    if (!group) return;
    group.rows.push(item);
    group.total += item.total;
  });
  (Array.isArray(sheet.quoteSections) ? sheet.quoteSections : Object.keys(sheet.preview?.quotation || {})).forEach((section) => {
    selectedSummaryRows(sheet.preview.quotation?.[section]?.rows || []).forEach((row) => {
      const rowStageNumber = summaryStageNumberForRow(row, section, sheet, parentByChild);
      const group = byNumber.get(rowStageNumber);
      if (!group) return;
      const total = summaryLineTotal(row);
      group.rows.push({ section, row, total });
      group.total += total;
    });
  });
  groups.forEach((group) => {
    group.total = Math.round(group.total * 100) / 100;
  });
  return groups.filter((group) => group.rows.length);
}

function summaryOpeningRows(sheet) {
  return [
    summaryOpeningRow("summary-opening-preliminary-costs", "Preliminaries Costs", sheet.preview.summary?.preliminaryCostsAmount, "Imported from Preliminaries cost below"),
    summaryOpeningRow("summary-opening-qbcc-registration", "QBCC Registration", sheet.preview.summary?.qbsaRegistration, "Imported from QBSA/QBCC registration below"),
    summaryOpeningRow("summary-opening-q-leave-fees", "Q Leave Fees", sheet.preview.summary?.qLeaveFees, "Imported from Q Leave fees below"),
    summaryOpeningRow("summary-opening-sales-commission", "Sales Commission", sheet.preview.summary?.salesCommissionAmount, "Imported from Sales commission below", 2),
  ].filter(Boolean);
}

function summaryOpeningRow(id, label, amount, notes, stageNumber = 1) {
  const total = summaryNumber(amount || 0);
  if (!total) return null;
  return {
    stageNumber,
    section: "",
    total,
    adjustment: true,
    row: {
      id,
      item: label,
      qty: 1,
      quantity: 1,
      unit: "ITEM",
      finalRateUsed: total,
      cost: total,
      notes,
    },
  };
}

function summaryStageNumberForRow(row, section, sheet, parentByChild) {
  return summaryStageNumber(row?.stageNumber)
    || summaryStageNumber(row?.buildStage)
    || summaryStageNumber(row?.stage)
    || summaryStageNumber(row?.group)
    || summaryStageNumberForSection(section, sheet, parentByChild);
}

function summaryStageNumberForSection(section, sheet, parentByChild) {
  const sectionData = sheet.workbook.quotation?.[section] || {};
  const ownStage = summaryStageNumber(sectionData.stageNumber)
    || summaryStageNumber(sectionData.buildStage)
    || summaryStageNumber(sectionData.stage);
  if (ownStage) return ownStage;
  const parent = parentByChild.get(section);
  return parent ? summaryStageNumberForSection(parent, sheet, parentByChild) : 0;
}

function summaryStageNumber(value) {
  const match = String(value ?? "").trim().match(/[1-7]/);
  return match ? Number(match[0]) : 0;
}

function summaryLineSectionLabel(section, sheet) {
  const number = quoteSectionNumber(section, sheet);
  const displayName = summarySectionDisplayName(section, sheet);
  return number ? `${number} ${displayName}` : displayName;
}

function summarySectionDisplayName(section, sheet) {
  return sheet.workbook.quotation?.[section]?.displayName || section;
}

function summaryAdjustmentPercentDisplayValue(sheet, key) {
  const saved = sheet.workbook.summaryAdjustments?.[key];
  if (saved !== undefined && saved !== null && saved !== "") return value(summaryPercentNumber(saved));
  const preview = sheet.preview.summary || {};
  const fallbackByKey = {
    preliminaryCostsPercent: preview.preliminaryCostsPercent,
    overheadsPercent: preview.overheadsPercent,
    marginPercent: preview.marginPercent,
    profitPercent: preview.profitPercent,
    gstPercent: preview.gstPercent,
    salesCommissionPercent: preview.salesCommissionPercent,
  };
  return value(fallbackByKey[key]);
}

function cleanPercentInputValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const amount = summaryPercentNumber(text);
  return Number.isFinite(amount) ? String(amount) : "";
}

function summaryPercentNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[%$,\s]/g, "");
  const parsed = Number(cleaned);
  if (Number.isFinite(parsed)) return parsed;
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function summaryAdjustmentAmountDisplayValue(sheet, key, fallback = 0) {
  const saved = sheet.workbook.summaryAdjustments?.[key];
  if (saved !== undefined && saved !== null && saved !== "") return saved;
  return value(fallback);
}

function subcontractorQuoteStatus(saved = {}, quoteAmount = 0) {
  const explicit = String(saved.status || "").trim();
  if (explicit) {
    const key = explicit.replace(/\s+/g, "");
    return { key, label: explicit };
  }
  if (saved.completed) return { key: "Completed", label: "Completed" };
  if (saved.ordered) return { key: "Ordered", label: "Ordered" };
  if (saved.purchaseOrder) return { key: "PurchaseOrderRaised", label: "Purchase Order Raised" };
  if (saved.accepted) return { key: "Accepted", label: "Accepted" };
  if (quoteAmount > 0 || saved.quoteNumber || saved.quoteDate) return { key: "QuoteReceived", label: "Quote Received" };
  return { key: "NoQuote", label: "No Quote" };
}

function updateSummaryLineTotal(sheet, section, row, nextTotal) {
  const total = summaryNumber(nextTotal);
  const qty = summaryNumber(row?.qty || row?.quantity || 0);
  if (qty > 0) {
    sheet.updateQuote(section, row.id, "manualRate", total ? currencyInputValue(total / qty) : "");
    return;
  }
  sheet.updateQuote(section, row.id, "quantity", total ? "1" : "");
  sheet.updateQuote(section, row.id, "manualRate", total ? currencyInputValue(total) : "");
}

function quoteParentByChildSection(sections = []) {
  const map = new Map();
  topLevelQuoteSections(sections).forEach((parent) => {
    quoteChildSectionsForParent(parent, sections).forEach((child) => map.set(child, parent));
  });
  return map;
}

function selectedSummaryRows(rows = []) {
  return rows.filter((row) => {
    if (quoteFeeType(row)) return false;
    if (isHiddenQuoteRow(row)) return false;
    if (row.active === false) return false;
    if (Number(row.qty || 0) > 0) return true;
    if (Number(row.cost || 0) > 0) return true;
    return summaryLineTotal(row) > 0;
  });
}

function summaryLineTotal(row) {
  const cost = Number(row?.cost || 0);
  if (Number.isFinite(cost) && cost > 0) return cost;
  const qty = summaryNumber(row?.qty || row?.quantity || 0);
  const rate = summaryNumber(row?.finalRateUsed || row?.manualRate || row?.excelRate || 0);
  return Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0;
}

function summaryNumber(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatArea(value) {
  const amount = summaryNumber(value);
  return amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function subcontractorDeductionsForRow(contractorKey) {
  const keyMap = {
    cabinetmaker: "cabinetMaker",
  };
  return SUBCONTRACTOR_QUOTE_DEDUCTIONS[keyMap[contractorKey] || contractorKey] || [];
}

function subcontractorDeductionAmount(sheet, deduction, saved = {}) {
  if (deduction.sourceRow) {
    return summaryNumber(findPreviewQuoteRowBySource(sheet.preview.quotation, deduction.sourceRow)?.cost);
  }
  return summaryNumber(saved.deductions?.[`${deduction.key}Amount`]);
}

function quoteRowSourceNumber(row) {
  const direct  = row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow;
  const idMatch = String(row?.id || "").match(/^quote-(\d+)$/);
  const value   = direct ?? idMatch?.[1];
  const number  = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function findPreviewQuoteRowBySource(quotation = {}, sourceRow) {
  return Object.values(quotation || {})
    .flatMap((section) => section?.rows || [])
    .find((row) => quoteRowSourceNumber(row) === sourceRow) || null;
}

function QuoteSelectionReferenceCell({ row, readonly, onChange }) {
  const adjustment = quoteSelectionAdjustment(row);
  return (
    <div style={styles.selectionReferenceCell}>
      <BufferedInput
        disabled={readonly}
        style={styles.selectionSpecInput}
        value={quoteSelectionSpec(row)}
        onCommit={(next) => onChange("selectionSpec", next)}
      />
      <div style={styles.selectionReferenceMeta}>
        <span>Allowance {money(numberValue(row.selectionAllowanceAmount))}</span>
        <span>Selected {money(numberValue(row.selectionSelectedCost))}</span>
        {adjustment ? <strong style={adjustment > 0 ? styles.selectionAdjustmentBad : styles.selectionAdjustmentGood}>{money(adjustment)}</strong> : null}
      </div>
    </div>
  );
}

function Spreadsheet({ headers, children, compactColumns = [] }) {
  const compactSet = new Set(compactColumns);
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} style={{ ...styles.th, ...(compactSet.has(index) ? styles.compactColumn : {}) }}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong, heading, subheading, compact, calc, final, tone }) {
  return <td style={{ ...styles.td, ...(compact ? styles.compactColumn : {}), ...(tone ? styles[tone] : {}), ...(strong ? styles.strongCell : {}), ...(tone && strong ? styles[`${tone}Strong`] : {}), ...(heading ? styles.headingCell : {}), ...(subheading ? styles.subheadingCell : {}), ...(calc ? styles.calcCell : {}), ...(final ? styles.finalCell : {}) }}>{children}</td>;
}

const BufferedInput = memo(function BufferedInput({ value, onCommit, onFocus, commitOnChange = false, ...props }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const next = String(draft ?? "");
    if (next !== String(value ?? "")) onCommit(next);
  };

  return (
    <input
      {...props}
      value={draft}
      onFocus={onFocus}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (commitOnChange && next !== String(value ?? "")) onCommit(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value ?? "");
          event.currentTarget.blur();
        }
      }}
    />
  );
});

const BufferedTextarea = memo(function BufferedTextarea({ value, onCommit, commitOnChange = false, ...props }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const next = String(draft ?? "");
    if (next !== String(value ?? "")) onCommit(next);
  };

  return (
    <textarea
      {...props}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (commitOnChange && next !== String(value ?? "")) onCommit(next);
      }}
      onBlur={commit}
    />
  );
});

function Panel({ title, children }) {
  return <div style={styles.panel}><div style={styles.panelTitle}>{title}</div><div style={styles.panelBody}>{children}</div></div>;
}

function SummaryRow({ label, value }) {
  return <div style={styles.summaryRow}><span>{label}</span><strong>{value}</strong></div>;
}

const previewProtectionHandlers = {
  onCopy: blockPreviewAction,
  onCut: blockPreviewAction,
  onPaste: blockPreviewAction,
  onContextMenu: blockPreviewAction,
  onDragStart: blockPreviewAction,
  onKeyDown: (event) => {
    const key = String(event.key || "").toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ["a", "c", "p", "s", "x"].includes(key)) {
      blockPreviewAction(event);
    }
  },
};

function blockPreviewAction(event) {
  event.preventDefault();
  event.stopPropagation();
}

function insertQuoteQuantityReference(sheet, target, key) {
  if (!target?.section || !target?.id || !key) return;
  const row = sheet.workbook.quotation?.[target.section]?.rows?.find((item) => item.id === target.id);
  const current = String(row?.quantity || "").trim();
  const next = current.startsWith("=")
    ? `${current}${current === "=" ? "" : " + "}${key}`
    : `=${key}`;
  sheet.updateQuote(target.section, target.id, "quantity", next);
  sheet.setPage("quotation");
}

function TemplateFileMenu({ sheet, open, onToggle, onClose, onSaveAction, busy = false, showDeveloperControls = false }) {
  const simpleTemplateName = "Master Estimate Template";
  const simpleTemplateKey = "template:master-estimate-template";
  const [simpleMessage, setSimpleMessage] = useState("");

  async function runTemplateAction(label, action) {
    setSimpleMessage("");
    const result = typeof onSaveAction === "function"
      ? await onSaveAction(label, action)
      : await action();
    await sheet.refreshTemplateSummaries?.();
    setSimpleMessage(result?.message || "");
    if (result?.ok) onClose?.();
  }

  function createNewJob() {
    return runTemplateAction("Creating job", () => sheet.createJobFromTemplate());
  }

  function updateMaster() {
    return runTemplateAction("Updating master template", () => sheet.updateMasterTemplate());
  }

  function saveBaseTemplate() {
    return runTemplateAction("Saving base template", () => sheet.saveAsBaseTemplate());
  }

  return (
    <div style={styles.templateFileWrap}>
      <button style={styles.templateFileButton} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        <span style={styles.templateFileButtonLabel}>Template File</span>
        <small style={styles.templateFileButtonName}>{simpleTemplateName}</small>
      </button>
      {open && (
        <div style={styles.templateFileMenuSimple} role="menu">
          <div style={styles.templateFileHeader}>
            <strong>{simpleTemplateName}</strong>
            <span>{simpleTemplateKey || "No template linked"}</span>
          </div>
          <button
            type="button"
            style={styles.primaryActionButton}
            disabled={busy}
            onClick={createNewJob}
          >
            {busy ? "Working..." : "Create New Job From Master Template"}
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={busy}
            onClick={saveBaseTemplate}
          >
            {busy ? "Saving..." : "Save As Base Template"}
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={busy}
            onClick={updateMaster}
          >
            {busy ? "Saving..." : "Update Master Template"}
          </button>
          {simpleMessage && <div style={styles.templateInlineMessage}>{simpleMessage}</div>}
        </div>
      )}
    </div>
  );
}

/*
  const templates = sheet.templateSummaries || [];
  const currentTemplateName = sheet.workbook.templateName || "Untitled template";
  const sectionImportInputRef = useRef(null);
  const [selectedKey, setSelectedKey] = useState(sheet.workbook.templateKey || templates[0]?.key || "");
  const [newTemplateName, setNewTemplateName] = useState(sheet.workbook.templateName || suggestedUiTemplateName(sheet.workbook));
  const [permissionMode, setPermissionMode] = useState(() => {
    if (typeof window === "undefined") return "client";
    return window.localStorage.getItem("estimate-builder-permission-mode") || "client";
  });
  const [selectedSection, setSelectedSection] = useState("APPLIANCE PACKAGE");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sheet.workbook.templateKey) {
      setSelectedKey(sheet.workbook.templateKey);
      return;
    }
    if (!selectedKey && templates[0]?.key) setSelectedKey(templates[0].key);
  }, [sheet.workbook.templateKey, selectedKey, templates]);

  useEffect(() => {
    if (sheet.workbook.templateName) setNewTemplateName(sheet.workbook.templateName);
  }, [sheet.workbook.templateName]);

  async function run(action, closeAfter = false, label = "Saving template") {
    setMessage("");
    const shouldShowProgress = typeof onSaveAction === "function" && /^sav|^updat|^relink|^duplicat|^creat/i.test(label);
    const result = shouldShowProgress ? await onSaveAction(label, action) : await action();
    await sheet.refreshTemplateSummaries?.();
    setMessage(result?.message || "");
    if (result?.key) setSelectedKey(result.key);
    if (closeAfter && result?.ok) onClose?.();
  }

  const selectedTemplate = templates.find((template) => template.key === selectedKey) || null;
  const hasCurrentTemplate = Boolean(sheet.workbook.templateKey);
  const currentTemplateSummary = templates.find((template) => template.key === sheet.workbook.templateKey) || null;
  const currentJobName = currentJobDisplayName(sheet.workbook);
  const currentTemplateKey = sheet.workbook.templateKey || "Unlinked";
  const lastTemplateSavedAt = currentTemplateSummary?.modifiedAt || currentTemplateSummary?.savedAt || "";
  const isAdmin = permissionMode === "admin";
  const quoteSectionNames = sheet.quoteSections.map((section) => String(section || "").trim()).filter(Boolean);
  const selectedSectionExists = quoteSectionNames.includes(selectedSection);

  return (
    <div style={styles.templateFileWrap}>
      <button style={styles.templateFileButton} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        <span style={styles.templateFileButtonLabel}>Template File</span>
        <small style={styles.templateFileButtonName}>{currentTemplateName}</small>
      </button>
      {open && (
        <div style={styles.templateFileMenu} role="menu">
          <div style={styles.templateFileHeader}>
            <strong>{currentTemplateName}</strong>
            <span>{templateTypeLabel(currentTemplateSummary?.templateType || sheet.workbook.templateType, sheet.workbook.templateKey)}</span>
          </div>
          <label style={styles.templateNameField}>
            <span>Permission mode</span>
            <select
              style={styles.templateNameInput}
              value={permissionMode}
              onChange={(event) => {
                const nextMode = event.target.value;
                setPermissionMode(nextMode);
                try { window.localStorage.setItem("estimate-builder-permission-mode", nextMode); } catch {}
              }}
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {isAdmin && (
            <button
              type="button"
              style={{ ...styles.templateMenuItem, ...(!hasCurrentTemplate ? styles.templateMenuItemDisabled : {}) }}
              disabled={!hasCurrentTemplate || busy}
              onClick={() => run(() => sheet.saveTemplate(sheet.workbook.templateKey), false, "Saving template")}
            >
              {busy ? "Saving..." : "Update Existing Template"}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              style={styles.templateMenuDanger}
              disabled={busy}
              onClick={() => run(() => sheet.updateMasterTemplate(), false, "Updating master template")}
            >
              {busy ? "Saving..." : "Update Master Template"}
            </button>
          )}
          <button
            type="button"
            style={styles.templateMenuItem}
            disabled={busy}
            onClick={() => run(() => sheet.createJobFromTemplate(selectedKey || sheet.workbook.templateKey), true, "Creating job")}
          >
            {busy ? "Working..." : "Create Job From Template"}
          </button>
          <label style={styles.templateNameField}>
            <span>New template name</span>
            <input
              style={styles.templateNameInput}
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              placeholder="Template name"
            />
          </label>
          <button
            type="button"
            style={styles.templateMenuItem}
            disabled={busy}
            onClick={() => run(() => sheet.duplicateAsNewTemplate(selectedKey || sheet.workbook.templateKey), false, "Duplicating template")}
          >
            {busy ? "Working..." : "Duplicate As New Template"}
          </button>
          <button
            type="button"
            style={styles.templateMenuItem}
            disabled={busy}
            onClick={() => run(() => sheet.saveTemplateAs(newTemplateName), false, "Saving template")}
          >
            {busy ? "Saving..." : "Save As New Template"}
          </button>
          {showDeveloperControls ? (
            <button
              type="button"
              style={styles.templateMenuItem}
              disabled={busy}
              onClick={() => run(() => sheet.relinkCurrentJobToExistingTemplate(), false, "Relinking job")}
            >
              {busy ? "Working..." : "Relink Current Job To Existing Template"}
            </button>
          ) : null}
          {showDeveloperControls ? (
            <div style={styles.templateDebugPanel}>
              <TemplateDebugRow label="Current job" value={currentJobName} />
              <TemplateDebugRow label="Current template" value={currentTemplateName} />
              <TemplateDebugRow label="Template key" value={currentTemplateKey} />
              <TemplateDebugRow label="Last job saved" value={formatTemplateDate(sheet.lastSavedAt)} />
              <TemplateDebugRow label="Last template saved" value={formatTemplateDate(lastTemplateSavedAt)} />
            </div>
          ) : null}
          {showDeveloperControls ? (
            <>
              <div style={styles.templateMenuDivider} />
              <div style={styles.templateListHeading}>Section CSV</div>
              <label style={styles.templateNameField}>
                <span>Selected section</span>
                <select style={styles.templateNameInput} value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>
                  {quoteSectionNames.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>
              <div style={styles.templateActionRow}>
                <button
                  type="button"
                  style={{ ...styles.templateMenuItem, ...(!selectedSectionExists ? styles.templateMenuItemDisabled : {}) }}
                  disabled={!selectedSectionExists}
                  onClick={() => exportSectionCsv(sheet, selectedSection)}
                >
                  Export Section CSV
                </button>
                <button
                  type="button"
                  style={{ ...styles.templateMenuItem, ...(!selectedSectionExists ? styles.templateMenuItemDisabled : {}) }}
                  disabled={!selectedSectionExists}
                  onClick={() => sectionImportInputRef.current?.click()}
                >
                  Import Section CSV
                </button>
              </div>
              <button
                type="button"
                style={styles.templateMenuItem}
                onClick={() => run(() => restoreSectionBackupFromPrompt(sheet))}
              >
                Restore Section Backup
              </button>
              <input
                ref={sectionImportInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(event) => importSectionCsvFile(event, sheet, selectedSection, setMessage)}
              />
            </>
          ) : null}
          <div style={styles.templateMenuDivider} />
          <div style={styles.templateListHeading}>Open Existing Template</div>
          {templates.length ? (
            <div style={styles.templateDropdownList}>
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.key}
                  style={{ ...styles.templateDropdownItem, ...(selectedKey === template.key ? styles.templateDropdownItemActive : {}) }}
                  onClick={() => setSelectedKey(template.key)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.category || "Uncategorised"} · Modified {formatTemplateDate(template.modifiedAt || template.savedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={styles.templateEmptyInline}>No saved templates yet.</div>
          )}
          <div style={styles.templateActionRow}>
            <button
              type="button"
              style={{ ...styles.templateMenuItem, ...(!selectedTemplate ? styles.templateMenuItemDisabled : {}) }}
              disabled={!selectedTemplate}
              onClick={() => run(() => sheet.loadTemplate(selectedKey), true)}
            >
              Open Existing Template
            </button>
            <button
              type="button"
              style={{ ...styles.templateMenuDanger, ...(!selectedTemplate ? styles.templateMenuItemDisabled : {}) }}
              disabled={!selectedTemplate}
              onClick={() => run(() => sheet.deleteTemplate(selectedKey))}
            >
              Delete Template
            </button>
          </div>
          {message && <div style={styles.templateInlineMessage}>{message}</div>}
        </div>
      )}
    </div>
  );
}
*/

function suggestedUiTemplateName(workbook) {
  return workbook?.projectName || workbook?.data?.project?.rows?.projectName?.value || "Estimate template";
}

function openJobHeaderDetails(workbook = {}) {
  return {
    projectName: valueOrNotEntered(workbookDataValue(workbook, "projectName")),
    jobNumber: valueOrNotEntered(workbookDataValue(workbook, "jobNumber")),
    projectAddress: valueOrNotEntered(workbookDataValue(workbook, "projectAddress")),
    fileName: valueOrNotEntered(workbook?.openedFileName || workbook?.sourceFileName),
  };
}

function valueOrNotEntered(value) {
  const text = String(value || "").trim();
  return text || "Not entered";
}

function currentJobDisplayName(workbook) {
  return workbook?.data?.project?.rows?.projectName?.value
    || workbook?.registeredJob?.jobName
    || workbook?.jobFileMeta?.jobName
    || workbook?.projectName
    || "simple.gr8job";
}

function estimateTakeoffPersistenceCounts(workbook = {}) {
  return {
    workbookPages: Array.isArray(workbook?.aiTakeoffProject?.pages) ? workbook.aiTakeoffProject.pages.length : 0,
    reducerPages: null,
    activePageId: workbook?.aiTakeoffProject?.activePageId || workbook?.aiTakeoffProject?.pages?.[0]?.id || null,
    workbookPlans: Array.isArray(workbook?.plans) ? workbook.plans.length : 0,
    localStoragePages: (() => {
      if (typeof window === "undefined") return null;
      try {
        const jobId = workbook?.openedFileName || workbook?.id || "";
        const projects = JSON.parse(window.localStorage.getItem("gr8:takeoff:v1") || "[]");
        const project = Array.isArray(projects) ? projects.find((item) => item?.jobId === jobId) : null;
        return Array.isArray(project?.pages) ? project.pages.length : 0;
      } catch {
        return null;
      }
    })(),
    indexedDBPages: Array.isArray(workbook?.aiTakeoffProject?.pages) ? workbook.aiTakeoffProject.pages.length : 0,
  };
}

function workbookToJobFileData(workbook = {}) {
  const meta = workbook?.jobFileMeta || {};
  const now = new Date().toISOString();
  if (typeof window !== "undefined") {
    console.info("[Estimate Builder] Saving workbook", estimateTakeoffPersistenceCounts(workbook));
  }
  return {
    jobName: meta.jobName || workbookDataValue(workbook, "projectName") || workbook?.projectName || "",
    clientName: meta.clientName || workbookDataValue(workbook, "clientName") || workbookDataValue(workbook, "customerName") || "",
    jobNumber: meta.jobNumber || workbookDataValue(workbook, "jobNumber") || workbookDataValue(workbook, "quoteNumber") || "",
    address: meta.address || workbookDataValue(workbook, "siteAddress") || workbookDataValue(workbook, "address") || "",
    notes: meta.notes || workbookDataValue(workbook, "projectNotes") || workbookDataValue(workbook, "notes") || "",
    rooms: workbook?.plans || [],
    products: workbook?.procurement || [],
    pricing: workbook?.summaryAdjustments || {},
    created: meta.created || workbook?.createdFromMasterTemplateAt || now,
    lastModified: workbook?.savedAt || meta.lastModified || now,
    workbook,
  };
}

function isWorkbookLoaded(workbook = {}) {
  return Boolean(
    workbook?.quotation && Object.keys(workbook.quotation || {}).length
    || workbook?.data && Object.keys(workbook.data || {}).length
    || workbook?.openedFileName
    || workbook?.sourceFileName
    || workbook?.registeredJob
  );
}

function commercialProjectMetadataFromWorkbook(workbook = {}, jobFilePayload = {}) {
  const meta = workbook?.jobFileMeta || {};
  const registeredJob = workbook?.registeredJob || {};
  const clientPage = workbook?.clientPage || {};
  return {
    projectName: jobFilePayload.jobName || meta.jobName || registeredJob.jobName || workbookDataValue(workbook, "projectName") || workbook?.projectName || "",
    clientName: jobFilePayload.clientName || meta.clientName || registeredJob.clientName || clientPage.clientName || workbookDataValue(workbook, "clientName") || workbookDataValue(workbook, "customerName") || "",
    clientEmail: registeredJob.clientEmail || "",
    clientPhone: registeredJob.clientPhone || "",
    address: jobFilePayload.address || meta.address || registeredJob.siteAddress || clientPage.projectAddress || workbookDataValue(workbook, "siteAddress") || workbookDataValue(workbook, "address") || "",
    notes: jobFilePayload.notes || meta.notes || registeredJob.jobDescription || "",
    sourceWorkbookJobId: workbook?.id || workbook?.jobId || meta.jobNumber || "",
    sourceWorkbookFileName: workbook?.openedFileName || workbook?.sourceFileName || "",
    sourceRegisteredJobId: registeredJob.jobId || workbook?.registeredJobId || "",
    quoteNumber: clientPage.quoteNumber || meta.jobNumber || registeredJob.jobNumber || workbookDataValue(workbook, "quoteNumber") || "",
    quoteDate: clientPage.quoteDate || "",
    templateKey: workbook?.templateKey || "",
    templateName: workbook?.templateName || "",
  };
}

function TemplateDebugRow({ label, value }) {
  return (
    <div style={styles.templateDebugRow}>
      <span style={styles.templateDebugLabel}>{label}</span>
      <strong style={styles.templateDebugValue}>{value || "Not recorded"}</strong>
    </div>
  );
}

function templateTypeLabel(type, key) {
  if (type === "master_base_template" || key === "template:single-storey-dwelling-rendered-bv-waffle-pod-slab") return "Master Base Template";
  if (type === "client_template") return "Client Template";
  if (type === "job") return "Job";
  return "Template";
}

function formatTemplateDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function formatProposalDate(value) {
  if (!value) return "unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown date" : date.toLocaleString();
}

function FileMenu({ open, items, recentJobs = [], onOpenRecentJob, onToggle, onClose, busy = false }) {
  return (
    <div style={styles.fileMenuWrap}>
      <button style={styles.fileMenuButton} onClick={onToggle} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        {busy ? "Saving..." : "File"}
      </button>
      {open && (
        <div style={styles.fileMenu} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              style={{ ...styles.fileMenuItem, ...(item.primary ? styles.fileMenuItemPrimary : {}), ...(busy ? styles.fileMenuItemDisabled : {}) }}
              disabled={busy}
              onClick={async () => {
                await Promise.resolve(item.action());
                onClose();
              }}
              role="menuitem"
            >
              {busy && item.primary ? "Saving..." : item.label}
            </button>
          ))}
          <div style={styles.fileMenuDivider} />
          <div style={styles.fileMenuSectionTitle}>Recent Jobs</div>
          {recentJobs.length ? recentJobs.slice(0, 4).map((job) => (
            <button
              key={job.id}
              style={{ ...styles.fileMenuItem, ...styles.fileMenuRecentItem, ...(busy ? styles.fileMenuItemDisabled : {}) }}
              disabled={busy}
              onClick={async () => {
                await Promise.resolve(onOpenRecentJob?.(job.id));
                onClose();
              }}
              role="menuitem"
            >
              <span>{job.jobName || "Saved estimate job"}</span>
              <small>{formatTemplateDate(job.lastModified)}</small>
            </button>
          )) : (
            <div style={styles.fileMenuEmpty}>No recent jobs</div>
          )}
        </div>
      )}
    </div>
  );
}

function NewJobModal({ form, onChange, busy = false, onClose, onCreate }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.newJobModal} role="dialog" aria-modal="true" aria-label="Create new job">
        <div style={styles.jobPickerHeader}>
          <div>
            <div style={styles.eyebrow}>New Job</div>
            <h2 style={styles.jobPickerTitle}>Create Job</h2>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={onClose} disabled={busy}>Close</button>
        </div>
        <div style={styles.newJobGrid}>
          <label style={styles.fieldWrap}>
            <span style={styles.label}>Job Name</span>
            <input style={styles.input} value={form.jobName || ""} onChange={(event) => onChange("jobName", event.target.value)} />
          </label>
          <label style={styles.fieldWrap}>
            <span style={styles.label}>Client Name</span>
            <input style={styles.input} value={form.clientName || ""} onChange={(event) => onChange("clientName", event.target.value)} />
          </label>
          <label style={styles.fieldWrap}>
            <span style={styles.label}>Job Number</span>
            <input style={styles.input} value={form.jobNumber || ""} onChange={(event) => onChange("jobNumber", event.target.value)} />
          </label>
          <label style={styles.fieldWrap}>
            <span style={styles.label}>Address</span>
            <input style={styles.input} value={form.address || ""} onChange={(event) => onChange("address", event.target.value)} />
          </label>
          <label style={{ ...styles.fieldWrap, gridColumn: "1 / -1" }}>
            <span style={styles.label}>Notes</span>
            <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} value={form.notes || ""} onChange={(event) => onChange("notes", event.target.value)} />
          </label>
        </div>
        <div style={styles.jobPickerActions}>
          <button type="button" style={styles.primaryButton} disabled={busy || !String(form.jobName || "").trim()} onClick={onCreate}>
            {busy ? "Creating..." : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobPickerModal({ jobs = [], message = "", busy = false, onRefresh, onOpen, onClose }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.jobPickerModal} role="dialog" aria-modal="true" aria-label="Open saved estimate job">
        <div style={styles.jobPickerHeader}>
          <div>
            <div style={styles.eyebrow}>Open Job</div>
            <h2 style={styles.jobPickerTitle}>Saved Estimate Jobs</h2>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>Close</button>
        </div>
        <div style={styles.jobPickerActions}>
          <button type="button" style={styles.secondaryButton} onClick={onRefresh} disabled={busy}>Refresh List</button>
        </div>
        {message && <div style={styles.jobPickerMessage}>{message}</div>}
        {!jobs.length ? (
          <div style={styles.jobPickerEmpty}>No saved jobs found</div>
        ) : (
          <div style={styles.jobPickerList}>
            {jobs.map((job) => (
              <button
                key={job.key}
                type="button"
                style={styles.jobPickerRow}
                disabled={busy}
                onClick={() => onOpen?.(job.key)}
              >
                <strong>{job.name || job.projectName || "Saved estimate job"}</strong>
                <span>{job.openedFileName || job.key}</span>
                <small>Saved {formatTemplateDate(job.savedAt)}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveProgress({ status }) {
  const isSaving = status.state === "saving";
  const isError = status.state === "error";
  return (
    <span style={{ ...styles.saveProgress, ...(isError ? styles.saveProgressError : {}) }} aria-live="polite">
      {isSaving && <span style={styles.saveSpinner} />}
      <span>{isSaving ? status.label : status.label || "Saved"}</span>
      {status.detail && <small>{status.detail}</small>}
    </span>
  );
}

function HistoryPanel({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section style={styles.section}>
      <div style={styles.staticSectionHeader}>{title}</div>
      <Spreadsheet headers={["When", "Item", "Field", "Value / Note"]}>
        {rows.slice(-12).reverse().map((row, index) => (
          <tr key={`${row.changedAt}-${index}`}>
            <Cell>{new Date(row.changedAt).toLocaleString()}</Cell>
            <Cell>{pretty(row.key || row.id || row.section || "")}</Cell>
            <Cell>{row.field || "formula"}</Cell>
            <Cell>{String(row.value || row.note || "")}</Cell>
          </tr>
        ))}
      </Spreadsheet>
    </section>
  );
}

function tabStyle(active) {
  return { ...styles.tabButton, ...(active ? styles.tabButtonActive : {}) };
}

function quoteReviewRows(sheet) {
  return Object.values(sheet.preview.quotation).flatMap((group) => group.rows).filter((row) => row.quoteRequired || row.sourceOfRate === "rate missing" || row.discontinuedWarning);
}

function exportCurrentPageCsv(sheet) {
  if (typeof window === "undefined") return;
  const page = sheet.workbook.page || "dataInput";
  const pageLabel = sheet.pages.find((item) => item.key === page)?.label || page;
  const rows = csvRowsForPage(sheet, page);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(pageLabel)}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveJobFile(sheet) {
  if (typeof window === "undefined") return;
  const savedAt = new Date().toISOString();
  const payload = {
    type: "estimate-builder-job",
    version: 1,
    savedAt,
    workbook: compactWorkbookForStorage({ ...sheet.workbook, savedAt }),
  };
  const fileName = `${jobFileName(sheet.workbook)}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Estimate Builder job file",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openJobFile(event, sheet) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await sheet.loadJobFileText(String(reader.result || ""), file.name);
    } catch {
      window.alert("That job file could not be opened. Please choose a valid Estimate Builder JSON file.");
    }
  };
  reader.readAsText(file);
}

function compactWorkbookForStorage(workbook = {}) {
  const {
    importedWorkbook,
    importedSheets,
    importReport,
    ...compact
  } = workbook;
  return compact;
}

function jobFileName(workbook) {
  const name = workbookDataValue(workbook, "projectName") || "simple";
  return slug(name) || "simple";
}

function openWorkbookFileName(workbook) {
  const fileName = currentJobDisplayName(workbook);
  if (String(fileName).toLowerCase().endsWith(".gr8job")) return fileName;
  return `${fileName}.gr8job`;
}

function workbookDataValue(workbook, key) {
  for (const section of Object.values(workbook.data || {})) {
    const value = section?.rows?.[key]?.value;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function csvRowsForPage(sheet, page) {
  if (page === "dataInput") return dataInputCsvRows(sheet);
  if (page === "windowsDoors") return windowsDoorsCsvRows(sheet);
  if (page === "formulaSheet") return formulaCsvRows(sheet);
  if (page === "quotation") return quotationCsvRows(sheet);
  if (page === "summary") return summaryCsvRows(sheet);
  if (page === "procurement") return procurementCsvRows(sheet);
  return [["Page", "Value"], [page, "No export rows available"]];
}

function exportSectionCsv(sheet, sectionName) {
  const section = sheet.workbook.quotation?.[sectionName];
  if (!section) return;
  const rows = sectionCsvRows(sectionName, section);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${slug(sectionName)}-section.csv`);
}

function exportProcurementCsv(sheet) {
  const rows = procurementCsvRows(sheet);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${slug(openWorkbookFileName(sheet.workbook))}-procurement.csv`);
}

function exportQuoteSelectionsCsv(sheet) {
  const rows = quoteSelectionsCsvRows(sheet);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${slug(openWorkbookFileName(sheet.workbook))}-selections-bridge.csv`);
}

function exportQuoteSheetCsv(sheet) {
  const rows = quoteSheetCsvRows(sheet);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), quoteSheetExportFileName(sheet));
}

const PRODUCT_LIBRARY_HEADERS = [
  "Product Code",
  "Category",
  "Subcategory",
  "Product Name",
  "Description",
  "Unit",
  "Supplier",
  "Brand",
  "Cost Price",
  "Sell Price",
  "Margin %",
  "GST",
  "Allowance Item",
  "Active",
  "Notes",
];

const PRODUCT_LIBRARY_FIELDS = [
  "product_code",
  "category",
  "subcategory",
  "product_name",
  "description",
  "unit",
  "supplier",
  "brand",
  "cost_price",
  "sell_price",
  "margin_percent",
  "gst",
  "allowance_item",
  "active",
  "notes",
];

const PRODUCT_LIBRARY_SEARCH_KEYS = ["product_code", "category", "subcategory", "product_name", "description", "supplier", "brand", "notes"];

function productLibraryProducts(sheet) {
  const saved = sheet.workbook.productLibrary?.products || [];
  return saved.length ? saved.map(normaliseProductLibraryRecord) : deriveProductLibraryFromQuoteSheet(sheet);
}

function deriveProductLibraryFromQuoteSheet(sheet) {
  const [headers, ...rows] = quoteSheetCsvRows(sheet);
  return rows.map((row, index) => {
    const source = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] || ""]));
    return normaliseProductLibraryRecord({
      id: `quote-product-${index + 1}`,
      product_code: `QS-${String(index + 1).padStart(4, "0")}`,
      category: source.category || source.section || "",
      subcategory: source.subcategory || "",
      product_name: source.quote_item || source.description || "",
      description: source.description || source.quote_item || "",
      unit: source.unit || "",
      supplier: source.supplier || "",
      brand: source.brand || "",
      cost_price: "",
      sell_price: source.current_rate || "",
      margin_percent: "",
      gst: "",
      allowance_item: yesNo(source.standard_allowance || source.selection_required === "TRUE" ? "yes" : "no"),
      active: "yes",
      notes: source.notes || "",
    });
  }).filter((product) => product.product_name || product.description);
}

function normaliseProductLibraryRecord(product = {}, index = 0) {
  return {
    id: product.id || `product-${Date.now().toString(36)}-${index + 1}`,
    product_code: String(product.product_code || product.productCode || "").trim(),
    category: String(product.category || "").trim(),
    subcategory: String(product.subcategory || "").trim(),
    product_name: String(product.product_name || product.productName || product.name || "").trim(),
    description: String(product.description || "").trim(),
    unit: String(product.unit || "").trim(),
    supplier: String(product.supplier || "").trim(),
    brand: String(product.brand || "").trim(),
    cost_price: String(product.cost_price || product.costPrice || "").trim(),
    sell_price: String(product.sell_price || product.sellPrice || product.rate || "").trim(),
    margin_percent: String(product.margin_percent || product.marginPercent || "").trim(),
    gst: String(product.gst || "").trim(),
    allowance_item: yesNo(product.allowance_item ?? product.allowanceItem ?? "no"),
    active: yesNo(product.active ?? "yes"),
    notes: String(product.notes || "").trim(),
  };
}

function blankProductLibraryRecord(index = 1) {
  return normaliseProductLibraryRecord({
    id: `product-${Date.now().toString(36)}-${index}`,
    product_code: `PRD-${String(index).padStart(4, "0")}`,
    product_name: "New product",
    active: "yes",
  });
}

function exportProductLibraryCsv(products, sheet) {
  const rows = [PRODUCT_LIBRARY_HEADERS, ...products.map(productLibraryCsvRow)];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${slug(openWorkbookFileName(sheet.workbook))}-product-library.csv`);
}

function downloadProductLibraryTemplate() {
  const rows = [PRODUCT_LIBRARY_HEADERS, productLibraryTemplateRow()];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "product-library-template.csv");
}

function productLibraryCsvRow(product = {}) {
  const item = normaliseProductLibraryRecord(product);
  return PRODUCT_LIBRARY_FIELDS.map((field) => item[field] || "");
}

function productLibraryTemplateRow() {
  return ["PRD-0001", "Kitchen", "Appliances", "Example product", "Editable product description", "each", "Supplier name", "Brand", "0.00", "0.00", "", "", "yes", "yes", ""];
}

function previewProductLibraryImport(existingProducts, csvRows) {
  const existing = existingProducts.map(normaliseProductLibraryRecord);
  const existingByCode = new Map(existing.filter((product) => product.product_code).map((product) => [product.product_code.toLowerCase(), product]));
  const existingByComposite = new Map(existing.map((product) => [productLibraryCompositeKey(product), product]).filter(([key]) => key));
  const matchedIds = new Set();
  const newProducts = [];
  const updatedProducts = [];
  const unchangedProducts = [];
  const invalidRows = [];

  csvRows.forEach((row, index) => {
    const product = productLibraryRecordFromCsv(row, index);
    const invalidReason = productLibraryInvalidReason(product);
    if (invalidReason) {
      invalidRows.push({ rowNumber: index + 2, reason: invalidReason, product });
      return;
    }
    const match = product.product_code
      ? existingByCode.get(product.product_code.toLowerCase()) || existingByComposite.get(productLibraryCompositeKey(product))
      : existingByComposite.get(productLibraryCompositeKey(product));
    if (!match) {
      newProducts.push(product);
      return;
    }
    matchedIds.add(match.id);
    const merged = { ...match, ...product, id: match.id };
    if (productLibraryChanged(match, merged)) updatedProducts.push({ before: match, after: merged });
    else unchangedProducts.push(match);
  });

  const removedProducts = existing
    .filter((product) => yesNo(product.active) !== "no" && !matchedIds.has(product.id))
    .map((product) => ({ before: product, after: { ...product, active: "no" } }));

  return { newProducts, updatedProducts, removedProducts, unchangedProducts, invalidRows };
}

function applyProductLibraryImport(existingProducts, preview) {
  const updatedById = new Map([
    ...preview.updatedProducts.map((item) => [item.before.id, item.after]),
    ...preview.removedProducts.map((item) => [item.before.id, item.after]),
  ]);
  const nextExisting = existingProducts.map((product) => updatedById.get(product.id) || product);
  return [...nextExisting, ...preview.newProducts].map(normaliseProductLibraryRecord);
}

function productLibraryRecordFromCsv(row, index) {
  const get = (...labels) => {
    for (const label of labels) {
      const value = row[label] ?? row[normaliseCsvHeader(label)] ?? row[label.toLowerCase()];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  };
  const keyedRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [normaliseCsvHeader(key), value]));
  const source = { ...keyedRow, ...row };
  return normaliseProductLibraryRecord({
    id: `import-product-${Date.now().toString(36)}-${index + 1}`,
    product_code: source.product_code || source.productcode || get("Product Code"),
    category: source.category || get("Category"),
    subcategory: source.subcategory || get("Subcategory"),
    product_name: source.product_name || source.productname || get("Product Name"),
    description: source.description || get("Description"),
    unit: source.unit || get("Unit"),
    supplier: source.supplier || get("Supplier"),
    brand: source.brand || get("Brand"),
    cost_price: source.cost_price || source.costprice || get("Cost Price"),
    sell_price: source.sell_price || source.sellprice || get("Sell Price"),
    margin_percent: source.margin_percent || source.margin || source.marginpercent || get("Margin %"),
    gst: source.gst || get("GST"),
    allowance_item: source.allowance_item || source.allowanceitem || get("Allowance Item"),
    active: source.active || get("Active") || "yes",
    notes: source.notes || get("Notes"),
  }, index);
}

function normaliseCsvHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[%]/g, "percent").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function productLibraryInvalidReason(product) {
  if (!product.product_name) return "Product Name is required.";
  if (!product.product_code && (!product.category || !product.supplier)) return "Rows without Product Code need Category and Supplier for matching.";
  return "";
}

function productLibraryCompositeKey(product = {}) {
  const category = String(product.category || "").trim().toLowerCase();
  const name = String(product.product_name || "").trim().toLowerCase();
  const supplier = String(product.supplier || "").trim().toLowerCase();
  if (!category || !name) return "";
  return `${category}::${name}::${supplier}`;
}

function productLibraryChanged(before = {}, after = {}) {
  return PRODUCT_LIBRARY_FIELDS.some((field) => String(before[field] || "") !== String(after[field] || ""));
}

function productLibraryPreviewLabel(item) {
  const product = item.product || item.after || item.before || item;
  const prefix = item.rowNumber ? `Row ${item.rowNumber}: ` : "";
  const reason = item.reason ? ` (${item.reason})` : "";
  return `${prefix}${product.product_code ? `${product.product_code} - ` : ""}${product.product_name || product.description || "Unnamed product"}${reason}`;
}

function filterProductLibraryProducts(products, filters) {
  const q = String(filters.search || "").trim().toLowerCase();
  return products.filter((product) => {
    const isActive = yesNo(product.active) !== "no";
    if (filters.activeFilter === "active" && !isActive) return false;
    if (filters.activeFilter === "inactive" && isActive) return false;
    if (filters.categoryFilter !== "all" && product.category !== filters.categoryFilter) return false;
    if (filters.supplierFilter !== "all" && product.supplier !== filters.supplierFilter) return false;
    if (!q) return true;
    return PRODUCT_LIBRARY_SEARCH_KEYS.some((key) => String(product[key] || "").toLowerCase().includes(q));
  });
}

function uniqueProductValues(products, key) {
  return [...new Set(products.map((product) => product[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function productLibraryStats(products) {
  return products.reduce((stats, product) => {
    if (yesNo(product.active) === "no") stats.inactive += 1;
    else stats.active += 1;
    return stats;
  }, { active: 0, inactive: 0 });
}

function yesNo(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["false", "no", "n", "0", "inactive"].includes(text)) return "no";
  if (["true", "yes", "y", "1", "active"].includes(text)) return "yes";
  return text || "no";
}

function procurementCsvRows(sheet) {
  const items = sheet.workbook.procurement?.items || [];
  return [
    ["stage number", "stage name", "section number", "section name", "item description", "qty", "unit", "estimated rate", "estimated total", "supplier", "supplier quote number", "procurement category", "required by date", "order status", "delivery status", "assigned purchasing officer", "notes", "removed from quote", "linked quote row id"],
    ...items.map((item) => [
      item.stageNumber,
      item.stageName,
      item.sectionNumber,
      item.sectionName,
      item.itemDescription,
      item.qty,
      item.unit,
      item.estimatedRate,
      item.estimatedTotal,
      item.supplier,
      item.supplierQuoteNumber,
      item.procurementCategory,
      item.requiredByDate,
      item.orderStatus,
      item.deliveryStatus,
      item.assignedPurchasingOfficer,
      item.notes,
      item.removedFromQuote ? "yes" : "no",
      item.quoteRowId,
    ]),
  ];
}

function sectionCsvRows(sectionName, section) {
  const rows = [["section name", "subsection name", "item name", "qty", "unit", "rate", "notes", "brand/package"]];
  (section.rows || []).forEach((row) => {
    rows.push([
      section.displayName || sectionName,
      subsectionNameForCsv(sectionName),
      row.item || row.values?.[0] || "",
      row.quantity || row.importedQuantity || "",
      row.unit || "",
      row.manualRate || row.supplierQuote || row.excelRate || "",
      row.notes || "",
      [row.applianceBrand, row.appliancePackage].filter(Boolean).join("/"),
    ]);
  });
  return rows;
}

function subsectionNameForCsv(sectionName) {
  const parts = String(sectionName || "").split(" - ");
  return parts.length > 1 ? parts.slice(1).join(" - ") : "";
}

function importSectionCsvFile(event, sheet, sectionName, setMessage) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !sectionName) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsvObjects(String(reader.result || ""));
      const preview = sheet.previewSectionCsvImport(sectionName, rows);
      const text = sectionImportPreviewText(preview);
      if (!preview.ok || !window.confirm(`${text}\n\nApply import to ${sectionName}?`)) {
        setMessage("Section CSV import cancelled.");
        return;
      }
      const result = sheet.applySectionCsvImport(sectionName, preview);
      setMessage(result?.message || "");
    } catch (error) {
      setMessage(error?.message || "Section CSV could not be imported.");
    }
  };
  reader.readAsText(file);
}

function parseCsvObjects(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => String(cell || "").trim()));
  const headers = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function sectionImportPreviewText(preview) {
  return [
    "Section CSV import preview",
    `Rows to update: ${preview.updates?.length || 0}`,
    `Rows to add: ${preview.adds?.length || 0}`,
    `Rows ignored: ${preview.ignored?.length || 0}`,
    `Errors: ${preview.errors?.length || 0}`,
  ].join("\n");
}

function restoreSectionBackupFromPrompt(sheet) {
  const backups = Object.values(sheet.workbook.sectionBackups || {});
  if (!backups.length) return { ok: false, message: "No section backups available." };
  const labels = backups.map((backup, index) => `${index + 1}. ${backup.section} - ${formatTemplateDate(backup.createdAt)}`).join("\n");
  const answer = window.prompt(`Restore which section backup?\n${labels}`, "1");
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || !backups[index]) return { ok: false, message: "Section backup restore cancelled." };
  return sheet.restoreSectionBackup(backups[index].key);
}

function dataInputCsvRows(sheet) {
  const rows = [["Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result"]];
  sheet.dataInputSections.forEach((section) => {
    section.rows.forEach((row) => {
      if (row.heading) {
        rows.push([row.label, "", "", "", row.userNote || "", ""]);
        return;
      }
      const saved = sheet.workbook.data?.[section.key]?.rows?.[row.key] || {};
      const result = row.calculated ? value(sheet.preview.quantities[row.key]) : "";
      rows.push([
        row.sectionLabel || section.label,
        row.label,
        row.calculated ? result : value(saved.value),
        row.unit || "",
        row.calculated ? formulaForRow(sheet, row) : saved.notes || "",
        result,
      ]);
    });
  });
  return rows;
}

function windowsDoorsCsvRows(sheet) {
  const rows = [["Section", "Code", "Size Code", "Type", "Qty", "Level", "Height", "Width", "Area", "Sill", "Arch", "Notes"]];
  sheet.preview.windowsDoors.rows.forEach((row) => {
    rows.push([
      row.section || "",
      row.code || "",
      row.sizeCode || windowDoorSizeCodeForRow(row),
      row.type || "",
      value(row.quantity),
      row.level || "",
      value(row.height),
      value(row.width),
      value(row.totalArea),
      value(row.sillLength),
      value(row.architraveLength),
      row.notes || "",
    ]);
  });
  rows.push([
    "Totals",
    "",
    "",
    "",
    value(sheet.preview.windowsDoors.totals.itemCount),
    "",
    "",
    "",
    value(sheet.preview.windowsDoors.totals.totalArea),
    value(sheet.preview.windowsDoors.totals.sillLength),
    value(sheet.preview.windowsDoors.totals.architraveLength),
    "",
  ]);
  return rows;
}

function formulaCsvRows(sheet) {
  const rows = [["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note"]];
  formulaRows(sheet).forEach((row) => {
    rows.push([
      row.label,
      formulaForRow(sheet, row),
      value(sheet.preview.quantities[row.key]),
      row.unit || "",
      sheet.workbook.formulaNotes?.[row.key] || "",
    ]);
  });
  return rows;
}

function quotationCsvRows(sheet) {
  const rows = [["Section", "Row", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"]];
  sheet.quoteSections.forEach((section) => {
    const previewSection = sheet.preview.quotation[section];
    (previewSection?.rows || []).forEach((row, rowIndex) => {
      if (isRemovedQuoteOutput(section, row)) return;
      if (quoteFeeType(row)) return;
      if (isHiddenQuoteRow(row)) return;
      rows.push([
        section,
        quoteRowNumber(row, rowIndex),
        quoteItem(row),
        isLinkedQuoteQty(row) ? value(row.qty) : quoteInputQty(row, sheet),
        row.unit || "",
        value(row.finalRateUsed || row.manualRate || row.excelRate),
        quoteCost(row),
        row.sourceOfRate || "",
        row.notes || "",
      ]);
    });
    rows.push([section, "", "Section total", "", "", "", value(previewSection?.subtotal || 0), "", ""]);
  });
  return rows;
}

function summaryCsvRows(sheet) {
  const rows = [["Section", "Total"]];
  sheet.quoteSections.forEach((section) => {
    rows.push([section, value(sheet.preview.quotation[section]?.subtotal || 0)]);
  });
  rows.push(["Base line item subtotal", value(sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin)]);
  rows.push([`Preliminaries ${sheet.preview.summary.preliminaryCostsPercent || 0}%`, value(sheet.preview.summary.preliminaryCostsAmount)]);
  rows.push([`Overheads ${sheet.preview.summary.overheadsPercent}%`, value(sheet.preview.summary.overheadsAmount)]);
  rows.push([`Materials & labour margin ${sheet.preview.summary.marginPercent}%`, value(sheet.preview.summary.marginAmount)]);
  rows.push([`Profit ${sheet.preview.summary.profitPercent}%`, value(sheet.preview.summary.profitAmount)]);
  rows.push(["Subtotal before GST", value(sheet.preview.summary.subtotalBeforeGst)]);
  rows.push([`GST ${sheet.preview.summary.gstPercent || 10}%`, value(sheet.preview.summary.gst)]);
  rows.push(["QBSA registration", value(sheet.preview.summary.qbsaRegistration)]);
  rows.push(["Q Leave fees", value(sheet.preview.summary.qLeaveFees)]);
  rows.push([`Sales commission ${sheet.preview.summary.salesCommissionPercent}%`, value(sheet.preview.summary.salesCommissionAmount)]);
  rows.push(["Final quote total", value(sheet.preview.summary.finalQuoteTotal)]);
  return rows;
}

function csvCell(input) {
  const text = String(input ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(input) {
  return String(input || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
}

function formulaRows(sheet) {
  const defaultRows = sheet.dataSections.flatMap((section) => section.rows.filter((row) => row.calculated).map((row) => ({ ...row, section: section.label })));
  const hiddenRows = new Set(sheet.workbook.hiddenFormulaRows || []);
  const floorCount = workbookDataValue(sheet.workbook, "floorCount") || "Single storey";
  return [
    ...defaultRows.map((row, index) => ({ ...row, order: index * 1000 })),
    ...(sheet.workbook.formulaRows || [])
      .filter((row) => !framedWallFormulaKeyForLabel(row?.label) && !wallLengthTotalKeyForLabel(row?.label) && !plasterboardFormulaKeyForLabel(row?.label))
      .map((row) => ({ ...row, calculated: true, custom: true })),
  ].filter((row) => !hiddenRows.has(row.key) && isCalculatedRowVisible(row, sheet.workbook, floorCount)).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function framedWallFormulaKeyForLabel(label) {
  return FRAMED_WALL_FORMULA_LABELS[String(label || "").toLowerCase().replace(/\s+/g, " ").trim()] || "";
}

function plasterboardFormulaKeyForLabel(label) {
  return PLASTERBOARD_FORMULA_LABELS[String(label || "").toLowerCase().replace(/\s+/g, " ").trim()] || "";
}

function isCalculatedRowVisible(row, workbook, floorCount) {
  if (HIDDEN_CALCULATED_ROW_KEYS.has(String(row?.key || ""))) return false;
  if (!isFormulaRelevantForFloorCount(row, floorCount)) return false;
  if (!isRelevantForWallThicknessSelection(row, workbook)) return false;
  return true;
}

function isFormulaRelevantForFloorCount(row, floorCount) {
  return levelForDataRow(row) <= floorCountToLevels(floorCount);
}

function windowDoorGroups(rows) {
  const groups = [];
  rows.forEach((row) => {
    const label = row.section || "Other Windows / Doors";
    const key = rowDomId("window-section", label);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label, defaultType: windowDoorDefaultType(label), rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  });
  return groups;
}

function windowSizeOptions(rows = [], current = "", row = null) {
  if (isEntryDoorScheduleRow(row)) return ["820 ENTRY DOORS", "1200 ENTRY DOORS"];
  const options = Array.from(new Set([
    current,
    ...rows.map((row) => row.code),
  ].map((item) => String(item || "").trim()))).filter(Boolean);
  return options.length ? options : [""];
}

function isEntryDoorScheduleRow(row) {
  const text = `${row?.section || ""} ${row?.type || ""} ${row?.code || ""}`.toLowerCase();
  return text.includes("entry door") && !text.includes("garage") && !text.includes("internal");
}

function shouldSkipWindowSizeCode(row) {
  const text = `${row?.section || ""} ${row?.type || ""} ${row?.code || ""}`.toLowerCase();
  return text.includes("entry door");
}

function windowDoorDefaultType(section) {
  const text = String(section || "").toLowerCase();
  if (text.includes("entry doors")) return "Entry Door";
  if (text.includes("doors") && text.includes("sliding")) return "Sliding Door";
  if (text.includes("sliding")) return "Sliding Window";
  if (text.includes("awning")) return "Awning Window";
  if (text.includes("double hung")) return "Double Hung Window";
  if (text.includes("casement")) return "Casement Window";
  if (text.includes("louvre")) return "Louvre Window";
  if (text.includes("fixed")) return "Fixed Window";
  return "Workbook item";
}

function windowDoorLevelWarning(rows = []) {
  const validLevels = new Set(["Ground Level", "Second Level", "Third Level"]);
  const totalOpenings = rows.reduce((sum, row) => sum + summaryNumber(row?.quantity || 0), 0);
  const assignedOpenings = rows.reduce((sum, row) => (
    validLevels.has(levelDisplayValue(row?.level))
      ? sum + summaryNumber(row?.quantity || 0)
      : sum
  ), 0);
  const missingOpenings = Math.max(0, totalOpenings - assignedOpenings);
  if (!totalOpenings || missingOpenings === 0) return "";
  return `${missingOpenings} of ${totalOpenings} openings do not have a level selected. Select Ground Level, Second Level, or Third Level before finishing.`;
}

function levelTone(row) {
  const text = `${row.key || ""} ${row.label || ""}`.toLowerCase();
  if (text.includes("third")) return "thirdLevelCell";
  if (text.includes("second") || text.includes("upper")) return "upperLevelCell";
  if (text.includes("ground") || text.includes("lower")) return "lowerLevelCell";
  return "";
}

function rowDomId(...parts) {
  return parts.join("-").replace(/[^A-Za-z0-9_-]/g, "-");
}

function focusRowEditor(id) {
  if (typeof document === "undefined") return;
  const element = document.getElementById(id);
  if (!element) return;
  element.focus();
  if (typeof element.select === "function") element.select();
}

function value(v) {
  return v === "" || v === undefined || v === null ? "" : v;
}

function currencyInputValue(v) {
  const text = String(v ?? "").trim();
  if (!text) return "";
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!cleaned) return "";
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return text;
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formulaForRow(sheet, row) {
  return userFacingFormula(internalFormulaForRow(sheet, row));
}

function internalFormulaForRow(sheet, row) {
  const dynamicFormula = dynamicDefaultFormulaForRow(sheet, row);
  const key = String(row?.key || "");
  const correctedDefaultFormula = CORRECTED_DEFAULT_FORMULA_KEYS.has(key) ? V4_DEFAULT_FORMULAS[row.key] : "";
  const defaultFormula = correctedDefaultFormula || dynamicFormula || V4_DEFAULT_FORMULAS[row.key] || row.defaultFormula || row.formula || "";
  const savedFormula = String(sheet.workbook.formulas?.[row.key] || "").trim();
  if (CORRECTED_DEFAULT_FORMULA_KEYS.has(key)) return defaultFormula;
  if (dynamicFormula && (TOTAL_WALL_LENGTH_RESULT_KEYS.has(key) || FRAMED_WALL_LENGTH_RESULT_KEYS.has(key))) return dynamicFormula;
  if (dynamicFormula && (!savedFormula || savedFormula === V4_DEFAULT_FORMULAS[row.key])) return dynamicFormula;
  if (!savedFormula || isStaleFormula(row.key, savedFormula)) return defaultFormula;
  return savedFormula;
}

function userFacingFormula(formula) {
  return String(formula || "")
    .replace(/\blower/g, "GroundLevel")
    .replace(/\bupper/g, "SecondLevel")
    .replace(/\bthird/g, "ThirdLevel")
    .replace(/\bLower/g, "GroundLevel")
    .replace(/\bUpper/g, "SecondLevel")
    .replace(/\bThird/g, "ThirdLevel");
}

function dynamicDefaultFormulaForRow(sheet, row) {
  const key = String(row?.key || "");
  const levels = floorCountToLevels(workbookDataValue(sheet.workbook, "floorCount") || "Single storey");
  const termsByKey = {
    totalExternal70mmWallsLm: wallLengthTerms(sheet.workbook, levels, "external", "70"),
    totalExternal90mmWallsLm: wallLengthTerms(sheet.workbook, levels, "external", "90"),
    totalInternal70mmWallsLm: wallLengthTerms(sheet.workbook, levels, "internal", "70"),
    totalInternal90mmWallsLm: wallLengthTerms(sheet.workbook, levels, "internal", "90"),
    total70mmWallsLm: ["totalExternal70mmWallsLm", "totalInternal70mmWallsLm"],
    total90mmWallsLm: ["totalExternal90mmWallsLm", "totalInternal90mmWallsLm"],
    externalFramedWall70mmLm: framedWallTerms(sheet.workbook, levels, "external", "70"),
    externalFramedWall90mmLm: framedWallTerms(sheet.workbook, levels, "external", "90"),
    internalFramedWall70mmLm: framedWallTerms(sheet.workbook, levels, "internal", "70"),
    internalFramedWall90mmLm: framedWallTerms(sheet.workbook, levels, "internal", "90"),
  };
  const terms = termsByKey[key];
  return terms ? terms.join(" + ") : "";
}

function dataInputFormulaForRow(sheet, row) {
  const levels = floorCountToLevels(workbookDataValue(sheet.workbook, "floorCount") || "Single storey");
  const framedWallFormulaNote = FRAMED_WALL_LENGTH_FORMULA_NOTES[row.key];
  if (framedWallFormulaNote) return framedWallFormulaNote;
  if (row.key === "lowerRoofPlanAreaM2") {
    if (levels === 1) return "Ground Level roof plan = Ground Level total floor area";
    if (levels === 2) return "Ground Level roof plan = Ground Level total floor area - Second Level roof plan";
    return "Ground Level roof plan = Ground Level total floor area - Third Level roof plan";
  }
  if (row.key === "upperRoofPlanAreaM2") return "Second Level roof plan = Second Level total floor area";
  if (row.key === "thirdRoofPlanAreaM2") return "Third Level roof plan = Third Level total floor area";
  return "";
}

function isStaleFormula(key, formula) {
  if (V4_DEFAULT_FORMULAS[key] && formula === key) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\bC\d+\b/i.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /![A-Z]+\d+/i.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\b(?:GroundLevel|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)WallsLm\b/.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\b(?:GroundFloor|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)FramedWallLm\b/.test(formula)) return true;
  if (key === "corniceLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "skirtingLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "lowerSkirtingLm" && (formula === "lowerInternalWallsLm + lowerExternalWallsLm" || formula === "(lowerInternalWallsLm * 2) + lowerExternalWallsLm")) return true;
  if (key === "upperSkirtingLm" && (formula === "upperInternalWallsLm + upperExternalWallsLm" || formula === "(upperInternalWallsLm * 2) + upperExternalWallsLm")) return true;
  if (key === "thirdSkirtingLm" && (formula === "thirdInternalWallsLm + thirdExternalWallsLm" || formula === "(thirdInternalWallsLm * 2) + thirdExternalWallsLm")) return true;
  if (key === "skirtingLengthsEach" && formula === "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 1.15 / 5.4") return true;
  if (key === "upperExternalWallAreaM2" && (formula.includes("+ 0.3") || formula === "upperExternalWallsLm * upperCeilingHeight")) return true;
  if (key === "thirdExternalWallAreaM2" && (formula.includes("+ 0.3") || formula === "thirdExternalWallsLm * thirdCeilingHeight")) return true;
  return false;
}

function isRequiredDataInputRow(key) {
  return REQUIRED_DATA_INPUT_ROW_KEYS.has(key);
}

function editableInputValue(sheet, row, saved) {
  if (saved.value !== "" && saved.value !== undefined && saved.value !== null) return saved.value;
  if (AUTO_FILLED_EDITABLE_ROWS.has(row.key)) return value(sheet.preview.quantities[row.key]);
  return "";
}

function selectInputValue(row, saved) {
  if (saved.value !== "" && saved.value !== undefined && saved.value !== null) return saved.value;
  if (["lowerFloorDepthMm", "upperFloorDepthMm", "thirdFloorDepthMm"].includes(row.key)) return row.options?.[0] || "";
  return "";
}

function floorCountToLevels(floorCount) {
  const text = String(floorCount || "").toLowerCase();
  if (text.includes("three") || text.includes("3")) return 3;
  if (text.includes("two") || text.includes("2") || text.includes("double")) return 2;
  return 1;
}

function levelForDataRow(row) {
  const key = String(row?.key || "");
  const text = `${row?.section || ""} ${row?.label || ""}`.toLowerCase();
  if (
    key.startsWith("third") ||
    key === "upperBalconyAreaM2" ||
    text.includes("third level") ||
    text.includes("third storey")
  ) {
    return 3;
  }
  if (
    key.startsWith("upper") ||
    key.startsWith("second") ||
    key === "balconyAreaM2" ||
    text.includes("second level") ||
    text.includes("second storey") ||
    text.includes("upper level")
  ) {
    return 2;
  }
  return 1;
}

function isRelevantForWallThicknessSelection(row, workbook) {
  const key = wallLengthTotalKeyForLabel(row?.label) || String(row?.key || "");
  if (ALWAYS_VISIBLE_TOTAL_MATERIAL_KEYS.has(key)) return true;
  if (key === "totalExternal70mmWallsLm") return true;
  if (key === "totalExternal90mmWallsLm") return true;
  if (key === "totalInternal70mmWallsLm") return true;
  if (key === "totalInternal90mmWallsLm") return hasSelectedWallLengthThickness(workbook, "internal", "90");
  if (key === "total70mmWallsLm") return hasSelectedWallThickness(workbook, "70");
  if (key === "total90mmWallsLm") return hasSelectedWallThickness(workbook, "90");
  const spec = WALL_THICKNESS_SPECIFIC_RESULT_ROWS[key];
  if (spec) return hasSelectedThicknessForRows(workbook, spec.thickness, spec.pairs);
  if (WALL_THICKNESS_70MM_RESULT_KEYS.has(key)) return hasSelectedWallThickness(workbook, "70");
  if (WALL_THICKNESS_90MM_RESULT_KEYS.has(key)) return hasSelectedWallThickness(workbook, "90");
  return true;
}

function wallLengthTotalKeyForLabel(label) {
  const normalized = String(label || "").toLowerCase().replace(/\s+/g, " ").trim();
  return WALL_LENGTH_TOTAL_LABELS[normalized] || "";
}

const WALL_LENGTH_TOTAL_LABELS = {
  "total external 70mm framed wall lm": "totalExternal70mmWallsLm",
  "total external 90mm framed wall lm": "totalExternal90mmWallsLm",
  "total internal 70mm framed wall lm": "totalInternal70mmWallsLm",
  "total internal 90mm framed wall lm": "totalInternal90mmWallsLm",
};

const ALWAYS_VISIBLE_TOTAL_MATERIAL_KEYS = new Set([
  "total70mmStudMaterialLm",
  "total90mmStudMaterialLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
]);

const PLASTERBOARD_FORMULA_LABELS = {
  "ground level external plasterboard wall m2": "lowerExternalPlasterboardWallM2",
  "ground level internal plasterboard wall m2": "lowerInternalPlasterboardWallM2",
  "ground level plasterboard wall m2": "lowerPlasterboardWallM2",
  "second level external plasterboard wall m2": "upperExternalPlasterboardWallM2",
  "second level internal plasterboard wall m2": "upperInternalPlasterboardWallM2",
  "second level plasterboard wall m2": "upperPlasterboardWallM2",
  "third level external plasterboard wall m2": "thirdExternalPlasterboardWallM2",
  "third level internal plasterboard wall m2": "thirdInternalPlasterboardWallM2",
  "third level plasterboard wall m2": "thirdPlasterboardWallM2",
  "total plasterboard walls m2": "plasterboardWallM2",
};

function framedWallTerms(workbook, levels, wallType, thickness) {
  const prefix = wallType === "external" ? "External" : "Internal";
  const pairs = wallType === "external"
    ? [
        ["lowerWallThicknessMm", "lowerExternal70mmFramedWallLm", "lowerExternal90mmFramedWallLm", 1],
        ["upperWallThicknessMm", "upperExternal70mmFramedWallLm", "upperExternal90mmFramedWallLm", 2],
        ["thirdWallThicknessMm", "thirdExternal70mmFramedWallLm", "thirdExternal90mmFramedWallLm", 3],
      ]
    : [
        ["lowerInternalWallThicknessMm", "lowerInternal70mmFramedWallLm", "lowerInternal90mmFramedWallLm", 1],
        ["upperInternalWallThicknessMm", "upperInternal70mmFramedWallLm", "upperInternal90mmFramedWallLm", 2],
        ["thirdInternalWallThicknessMm", "thirdInternal70mmFramedWallLm", "thirdInternal90mmFramedWallLm", 3],
      ];
  const terms = pairs
    .filter(([thicknessKey,, , level]) => level <= levels && selectedThickness(workbook, thicknessKey) === thickness)
    .map(([, term70, term90]) => (thickness === "70" ? term70 : term90));
  return terms.length ? terms : [`No selected ${prefix.toLowerCase()} ${thickness}mm framed walls`];
}

function wallLengthTerms(workbook, levels, wallType, thickness) {
  const pairs = wallType === "external"
    ? [
        ["lowerWallThicknessMm", "lowerExternal70mmWallsLm", "lowerExternal90mmWallsLm", 1],
        ["upperWallThicknessMm", "upperExternal70mmWallsLm", "upperExternal90mmWallsLm", 2],
        ["thirdWallThicknessMm", "thirdExternal70mmWallsLm", "thirdExternal90mmWallsLm", 3],
      ]
    : [
        ["lowerInternalWallThicknessMm", "lowerInternal70mmWallsLm", "lowerInternal90mmWallsLm", 1],
        ["upperInternalWallThicknessMm", "upperInternal70mmWallsLm", "upperInternal90mmWallsLm", 2],
        ["thirdInternalWallThicknessMm", "thirdInternal70mmWallsLm", "thirdInternal90mmWallsLm", 3],
      ];
  return pairs
    .filter(([thicknessKey,, , level]) => level <= levels && selectedThickness(workbook, thicknessKey) === thickness)
    .map(([, term70, term90]) => (thickness === "70" ? term70 : term90));
}

function hasSelectedWallLengthThickness(workbook, wallType, thickness) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return wallLengthTerms(workbook, levels, wallType, thickness).length > 0;
}

function hasSelectedThicknessForRows(workbook, thickness, pairs) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return pairs.some(([thicknessKey]) => thicknessKeyLevel(thicknessKey) <= levels && selectedThickness(workbook, thicknessKey) === thickness);
}

function hasSelectedWallThickness(workbook, thickness) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return [
    "lowerWallThicknessMm",
    "upperWallThicknessMm",
    "thirdWallThicknessMm",
    "lowerInternalWallThicknessMm",
    "upperInternalWallThicknessMm",
    "thirdInternalWallThicknessMm",
  ].some((key) => thicknessKeyLevel(key) <= levels && selectedThickness(workbook, key) === thickness);
}

function selectedThickness(workbook, key) {
  return String(workbookDataValue(workbook, key) || "").replace(/\D/g, "");
}

function thicknessKeyLevel(key) {
  if (String(key || "").startsWith("third")) return 3;
  if (String(key || "").startsWith("upper")) return 2;
  return 1;
}

const AUTO_FILLED_EDITABLE_ROWS = new Set([
  "lowerRoofPlanAreaM2",
  "upperRoofPlanAreaM2",
  "thirdRoofPlanAreaM2",
]);

const HIDDEN_CALCULATED_ROW_KEYS = new Set([
  "ceilingAreaM2",
  "totalExternalWallsLm",
  "totalInternalWallsLm",
  "total70mmWallsLm",
  "total90mmWallsLm",
  "externalFramedWallLm",
  "internalFramedWallLm",
  "studsEach",
  "externalWallPlatesLm",
  "internalWallPlatesLm",
  "wallPlatesNoggins70mmLm",
  "wallPlatesNoggins90mmLm",
  "lowerStudMaterialLm",
  "upperStudMaterialLm",
  "thirdStudMaterialLm",
  "totalStudMaterialLm",
  "totalTimberFramingLm",
  "totalTimberLengthsEach",
]);

const TOTAL_WALL_LENGTH_RESULT_KEYS = new Set([
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "total70mmWallsLm",
  "total90mmWallsLm",
]);

const FRAMED_WALL_LENGTH_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "externalFramedWall90mmLm",
  "internalFramedWall70mmLm",
  "internalFramedWall90mmLm",
]);

const CORRECTED_DEFAULT_FORMULA_KEYS = new Set([
  "lowerSlabAreaM2",
  "secondLevelFloorAreaM2",
  "thirdLevelFloorAreaM2",
  "slabFloorAreaM2",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "lowerExternalWallAreaM2",
  "upperExternalWallAreaM2",
  "thirdExternalWallAreaM2",
  "totalExternalWallAreaM2",
  "lowerWindowDoorDeductionsM2",
  "upperWindowDoorDeductionsM2",
  "thirdWindowDoorDeductionsM2",
  "lowerNetExternalWallAreaM2",
  "upperNetExternalWallAreaM2",
  "thirdNetExternalWallAreaM2",
  "netExternalWallAreaM2",
  "lowerExternalPlasterboardWallM2",
  "lowerInternalPlasterboardWallM2",
  "upperExternalPlasterboardWallM2",
  "upperInternalPlasterboardWallM2",
  "thirdExternalPlasterboardWallM2",
  "thirdInternalPlasterboardWallM2",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total90mmStudMaterialLm",
  "total90mmTimberFramingLm",
  "total90mmTimberLengthsEach",
  "lowerPlasterboardWallM2",
  "upperPlasterboardWallM2",
  "thirdPlasterboardWallM2",
  "plasterboardWallM2",
  "architraveLm",
  "architraveLengthsEach",
  "lowerSkirtingLm",
  "upperSkirtingLm",
  "thirdSkirtingLm",
  "skirtingLm",
]);

const FRAMED_WALL_LENGTH_FORMULA_NOTES = {
  externalFramedWall70mmLm: "= ALL GROUND LEVEL 70MM EXTERNAL WALLS + SECOND LEVEL 70MM EXTERNAL WALLS + THIRD LEVEL 70MM EXTERNAL WALLS",
  externalFramedWall90mmLm: "= ALL GROUND LEVEL 90MM EXTERNAL WALLS + SECOND LEVEL 90MM EXTERNAL WALLS + THIRD LEVEL 90MM EXTERNAL WALLS",
  internalFramedWall70mmLm: "= ALL GROUND LEVEL 70MM INTERNAL WALLS + SECOND LEVEL 70MM INTERNAL WALLS + THIRD LEVEL 70MM INTERNAL WALLS",
  internalFramedWall90mmLm: "= ALL GROUND LEVEL 90MM INTERNAL WALLS + SECOND LEVEL 90MM INTERNAL WALLS + THIRD LEVEL 90MM INTERNAL WALLS",
};

const FRAMED_WALL_FORMULA_LABELS = {
  "total external 70mm framed wall lm": "totalExternal70mmWallsLm",
  "total external 90mm framed wall lm": "totalExternal90mmWallsLm",
  "total internal 70mm framed wall lm": "totalInternal70mmWallsLm",
  "total internal 90mm framed wall lm": "totalInternal90mmWallsLm",
};

const WALL_THICKNESS_70MM_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "internalFramedWall70mmLm",
  "studs70mmEach",
  "wallPlatesNoggins70mmExternalWallsLm",
  "wallPlatesNoggins70mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial70mmLm",
  "upperStudMaterial70mmLm",
  "thirdStudMaterial70mmLm",
  "total70mmStudMaterialLm",
  "total70mmTimberFramingLm",
  "total70mmTimberLengthsEach",
]);

const WALL_THICKNESS_90MM_RESULT_KEYS = new Set([
  "externalFramedWall90mmLm",
  "internalFramedWall90mmLm",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total90mmStudMaterialLm",
  "total90mmTimberFramingLm",
  "total90mmTimberLengthsEach",
]);

const WALL_THICKNESS_SPECIFIC_RESULT_ROWS = {
  externalFramedWall70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  externalFramedWall90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  internalFramedWall70mmLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  internalFramedWall90mmLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  wallPlatesNoggins70mmExternalWallsLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  wallPlatesNoggins90mmExternalWallsLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  wallPlatesNoggins70mmInternalWallsLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  wallPlatesNoggins90mmInternalWallsLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  lowerStudMaterial70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["lowerInternalWallThicknessMm"]] },
  upperStudMaterial70mmLm: { thickness: "70", pairs: [["upperWallThicknessMm"], ["upperInternalWallThicknessMm"]] },
  thirdStudMaterial70mmLm: { thickness: "70", pairs: [["thirdWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  lowerStudMaterial90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["lowerInternalWallThicknessMm"]] },
  upperStudMaterial90mmLm: { thickness: "90", pairs: [["upperWallThicknessMm"], ["upperInternalWallThicknessMm"]] },
  thirdStudMaterial90mmLm: { thickness: "90", pairs: [["thirdWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
};

const REQUIRED_DATA_INPUT_ROW_KEYS = new Set([
  "totalExternalWallsLm",
  "totalInternalWallsLm",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "externalFramedWall70mmLm",
  "externalFramedWall90mmLm",
  "internalFramedWall70mmLm",
  "internalFramedWall90mmLm",
  "studs70mmEach",
  "studs90mmEach",
  "wallPlatesNoggins70mmExternalWallsLm",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins70mmInternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial70mmLm",
  "upperStudMaterial70mmLm",
  "thirdStudMaterial70mmLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total70mmStudMaterialLm",
  "total90mmStudMaterialLm",
  "total70mmTimberFramingLm",
  "total90mmTimberFramingLm",
  "total70mmTimberLengthsEach",
  "total90mmTimberLengthsEach",
]);

function levelDisplayValue(level) {
  const text = String(level || "").trim().toLowerCase();
  if (["1", "ground", "ground floor", "ground level", "lower", "lower level"].includes(text)) return "Ground Level";
  if (["2", "second", "second floor", "second level", "upper", "upper level"].includes(text)) return "Second Level";
  if (["3", "third", "third floor", "third level"].includes(text)) return "Third Level";
  return level || "";
}

function money(v) {
  return v ? `$${Number(v).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function quoteCost(row) {
  const qty = Number(row?.qty || row?.quantity || 0);
  if (!qty) return "";
  return money(row?.cost);
}

function quoteSelectionsCsvRows(sheet) {
  const rows = [[
    "source_quote_row_id",
    "section",
    "item",
    "description",
    "quantity",
    "unit",
    "current_rate",
    "current_total",
    "supplier",
    "current_specification",
    "allowance_amount",
    "selected_product",
    "selected_brand",
    "selected_model",
    "selected_colour",
    "selected_supplier",
    "selected_cost",
    "upgrade_downgrade",
    "image_url",
    "notes",
    "selection_status",
  ]];

  sheet.quoteSections.forEach((section) => {
    const previewSection = sheet.preview.quotation[section];
    (previewSection?.rows || []).forEach((row) => {
      if (quoteFeeType(row) || isHiddenQuoteRow(row) || isApplianceHeadingQuoteRow(row)) return;
      const qty = quoteInputQty(row, sheet) || row.qty || row.quantity || "";
      const currentRate = row.finalRateUsed || row.manualRate || row.supplierQuote || row.excelRate || "";
      const currentTotal = row.cost || "";
      const allowance = row.selectionAllowanceAmount || currentTotal || currentRate || "";
      const selectedCost = row.selectionSelectedCost || "";
      rows.push([
        quoteRowSourceNumber(row) || row.id || "",
        section,
        quoteItem(row),
        row.description || row.rawText || quoteItem(row),
        qty,
        row.unit || "",
        value(currentRate),
        value(currentTotal),
        row.supplier || row.sourceOfRate || "",
        quoteSelectionSpec(row) || row.notes || "",
        value(allowance),
        row.selectedProductName || row.selectionSpec || "",
        row.selectedBrand || row.selectedDetails?.brand || "",
        row.selectedModel || row.selectedDetails?.model || "",
        row.selectedColour || row.selectedDetails?.colour || "",
        row.selectedSupplier || row.selectedDetails?.supplier || "",
        value(selectedCost),
        value(row.selectionAdjustment || quoteSelectionAdjustment(row) || ""),
        quoteSelectionImageUrl(row),
        row.notes || "",
        row.selectionStatus || "",
      ]);
    });
  });
  return rows;
}

function quoteSheetCsvRows(sheet) {
  const rows = [[
    "sort_order",
    "section",
    "category",
    "subcategory",
    "room",
    "quote_item",
    "description",
    "unit",
    "quantity",
    "standard_allowance",
    "current_rate",
    "current_total",
    "supplier",
    "brand",
    "model_or_colour",
    "selection_required",
    "selection_type",
    "standard_inclusion",
    "notes",
  ]];

  const parentByChild = quoteParentByChildSection(sheet.quoteSections);
  let sortOrder = 1;
  quoteSheetExportSections(sheet).forEach((section) => {
    const previewSection = sheet.preview?.quotation?.[section];
    (previewSection?.rows || []).forEach((row) => {
      if (isRemovedQuoteOutput(section, row)) return;
      if (quoteFeeType(row) || isHiddenQuoteRow(row) || isApplianceHeadingQuoteRow(row)) return;
      const item = quoteItem(row);
      const parentSection = parentByChild[section] || "";
      const category = parentSection || section;
      const subcategory = parentSection ? section : "";
      const qty = quoteInputQty(row, sheet) || row.qty || row.quantity || "";
      const currentRate = row.finalRateUsed || row.manualRate || row.supplierQuote || row.excelRate || "";
      const currentTotal = row.cost || "";
      const selectionType = quoteSelectionType(section, row);
      const selectionRequired = quoteSelectionRequired(section, row, selectionType);
      const standardAllowance = row.standardAllowance || row.selectionAllowanceAmount || row.allowanceAmount || currentTotal || currentRate || "";
      rows.push([
        sortOrder,
        quoteSectionDisplayLabel(section),
        quoteSectionDisplayLabel(category),
        subcategory ? quoteSectionDisplayLabel(subcategory) : "",
        quoteExportRoom(section, row),
        item,
        row.description || row.rawText || item,
        row.unit || "",
        qty,
        value(standardAllowance),
        value(currentRate),
        value(currentTotal),
        row.supplier || row.selectedSupplier || row.selectedDetails?.supplier || "",
        row.brand || row.selectedBrand || row.selectedDetails?.brand || row.applianceBrand || applianceBrandFromSection(section) || "",
        quoteModelOrColour(row),
        selectionRequired ? "TRUE" : "FALSE",
        selectionType,
        quoteStandardInclusion(row) ? "TRUE" : "FALSE",
        row.notes || "",
      ]);
      sortOrder += 1;
    });
  });
  return rows;
}

function quoteSheetExportSections(sheet) {
  const ordered = [];
  const add = (section) => {
    if (section && !isRemovedQuoteOutput(section, {}) && !ordered.includes(section)) ordered.push(section);
  };
  topLevelQuoteSections(sheet.quoteSections).forEach((section) => {
    add(section);
    quoteChildSectionsForParent(section, sheet.quoteSections, sheet).forEach(add);
  });
  sheet.quoteSections.forEach(add);
  return ordered;
}

function quoteSheetExportFileName(sheet) {
  const workbook = sheet?.workbook || {};
  const projectName = workbookDataValue(workbook, "projectName")
    || workbook?.projectName
    || workbook?.jobDetails?.jobName
    || workbook?.jobFileMeta?.jobName
    || "project";
  const snapshotName = workbook?.snapshotName
    || workbook?.snapshot_label
    || workbook?.snapshotLabel
    || workbook?.estimateSnapshotName
    || workbook?.jobFileMeta?.lastModified
    || workbook?.lastSavedAt
    || workbook?.savedAt
    || "current";
  return `quote-sheet-export-${slug(projectName)}-${slug(snapshotName)}.csv`;
}

function quoteModelOrColour(row = {}) {
  return firstQuoteText(
    row.modelOrColour,
    row.model_or_colour,
    row.selectedModel,
    row.selectedColour,
    row.selectedDetails?.model,
    row.selectedDetails?.colour,
    row.colour,
    row.color,
    row.model
  );
}

function quoteExportRoom(section, row = {}) {
  const explicit = firstQuoteText(row.room, row.area, row.location, row.space);
  if (explicit) return explicit;
  const text = `${section || ""} ${row.item || ""} ${row.rawText || ""}`.toLowerCase();
  if (text.includes("kitchen")) return "Kitchen";
  if (text.includes("laundry")) return "Laundry";
  if (text.includes("ensuite")) return "Ensuite";
  if (text.includes("bathroom") || text.includes("bath ")) return "Bathroom";
  if (text.includes("powder")) return "Powder Room";
  if (text.includes("bedroom")) return "Bedroom";
  if (text.includes("robe") || text.includes("wardrobe")) return "Bedroom";
  if (text.includes("garage")) return "Garage";
  if (text.includes("external") || text.includes("facade")) return "External";
  if (text.includes("roof")) return "Roof";
  return "";
}

function quoteSelectionType(section, row = {}) {
  const text = `${section || ""} ${row.item || ""} ${row.rawText || ""} ${row.description || ""}`.toLowerCase();
  const matches = [
    ["air_conditioning", ["air conditioning", "air-condition", "aircondition", "air con"]],
    ["hot_water", ["hot water"]],
    ["shower_screen", ["shower screen"]],
    ["plumbing", ["plumbing", "plumber", "tap", "mixer", "basin", "toilet", "bath", "shower", "sink"]],
    ["appliance", ["appliance", "oven", "cooktop", "rangehood", "dishwasher", "microwave", "white goods"]],
    ["tile", ["tile", "tiling"]],
    ["flooring", ["flooring", "vinyl", "hybrid floor", "timber floor", "floorcovering"]],
    ["carpet", ["carpet"]],
    ["cabinetry", ["cabinet", "joinery", "vanity", "benchtop", "butlers pantry", "butler's pantry"]],
    ["stone", ["stone", "caesarstone", "quantum quartz", "smartstone"]],
    ["paint", ["paint", "painter"]],
    ["lighting", ["lighting", "light fitting", "downlight", "pendant"]],
    ["electrical", ["electrical", "electrician", "power point", "switch", "fan"]],
    ["door", ["door", "entry door", "internal door", "cavity sliding"]],
    ["window", ["window", "glazing", "aluminium frame"]],
    ["hardware", ["hardware", "handle", "lock", "hinge", "privacy set"]],
    ["roofing", ["roofing", "roof cover", "colorbond", "gutter", "fascia", "downpipe"]],
    ["cladding", ["cladding", "weatherboard", "linea", "stria"]],
    ["concrete", ["concrete", "slab", "driveway", "footing"]],
    ["robe", ["robe", "wardrobe", "linen"]],
    ["mirror", ["mirror"]],
    ["stairs", ["stair"]],
    ["balustrade", ["balustrade", "handrail"]],
  ];
  return matches.find(([, needles]) => needles.some((needle) => text.includes(needle)))?.[0] || "other";
}

function quoteSelectionRequired(section, row = {}, selectionType = "other") {
  if (row.selectionRequired !== undefined) return booleanValue(row.selectionRequired);
  if (row.selection_required !== undefined) return booleanValue(row.selection_required);
  if (row.requiresSelection !== undefined) return booleanValue(row.requiresSelection);
  if (row.quoteRequired || row.selectionSpec || row.selectedProductName || row.selectedDetails) return true;
  const typeRequiresSelection = !["other", "concrete"].includes(selectionType);
  if (!typeRequiresSelection) return false;
  const text = `${section || ""} ${row.item || ""} ${row.rawText || ""} ${row.description || ""}`.toLowerCase();
  if (["labour", "labor", "install", "fix", "frame", "structural", "earthworks", "termite", "waterproofing", "insulation", "sisalation"].some((needle) => text.includes(needle))) {
    return false;
  }
  return true;
}

function quoteStandardInclusion(row = {}) {
  if (row.standardInclusion !== undefined) return booleanValue(row.standardInclusion);
  if (row.standard_inclusion !== undefined) return booleanValue(row.standard_inclusion);
  if (row.optional || row.upgradeOnly || row.excluded) return false;
  return true;
}

function booleanValue(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["false", "no", "n", "0", "off"].includes(text)) return false;
  if (["true", "yes", "y", "1", "on"].includes(text)) return true;
  return Boolean(value);
}

function quoteSelectionSpec(row = {}) {
  return row.selectionSpec || row.selectedProductSpecification || row.selectedProductName || row.selectedDetails?.default_selection_specification || row.selectedDetails?.model || "";
}

function firstQuoteText(...values) {
  const found = values.find((value) => String(value ?? "").trim());
  return found === undefined ? "" : String(found).trim();
}

function imageCandidateUrl(candidate) {
  if (typeof candidate === "string") return candidate.trim();
  if (!candidate || typeof candidate !== "object") return "";
  return String(candidate.url || candidate.src || candidate.imageUrl || candidate.image_url || "").trim();
}

function quoteProductImages(row = {}) {
  const details = row.selectedDetails || {};
  const arrays = [
    row.productImages,
    row.images,
    row.selectionImages,
    details.images,
    details.productImages,
    details.product_images,
  ].filter(Array.isArray);
  const candidates = [
    row.selectionImageUrl,
    row.productImageUrl,
    row.imageUrl,
    details.product_image_url,
    details.productImageUrl,
    details.imageUrl,
    details.image_url,
    ...arrays.flat(),
  ];
  return Array.from(new Set(candidates.map(imageCandidateUrl).filter(Boolean)));
}

function productPreviewFromQuoteRow(section, row = {}) {
  const details = row.selectedDetails || {};
  return {
    section,
    rowId: row.id,
    row,
    images: quoteProductImages(row),
    productName: firstQuoteText(
      quoteSelectionSpec(row),
      row.productName,
      row.selectedProductName,
      details.product_name,
      details.productName,
      quoteItem(row),
      "No product selected",
    ),
    supplier: firstQuoteText(row.supplier, row.rateSource, row.sourceOfRate, details.supplier, details.supplier_name),
    sku: firstQuoteText(row.sku, row.productSku, row.selectedSku, details.sku, details.product_sku, details.productSku),
    manufacturer: firstQuoteText(row.manufacturer, row.productManufacturer, row.brand, details.manufacturer, details.brand, details.brand_name),
    description: firstQuoteText(row.productDescription, row.description, row.rawText, details.description, details.product_description),
  };
}

function quoteSelectionAdjustment(row = {}) {
  if (row.selectionAdjustment !== undefined && row.selectionAdjustment !== "") return numberValue(row.selectionAdjustment);
  const selected = numberValue(row.selectionSelectedCost);
  const allowance = numberValue(row.selectionAllowanceAmount);
  if (!selected && !allowance) return 0;
  return selected - allowance;
}

function quoteInputQty(row, sheet = null) {
  if (quoteRowNumber(row) === 1210) return "";
  const floorSystemQty = floorSystemQuoteDisplayQty(row, sheet);
  if (floorSystemQty !== "") return value(floorSystemQty);
  if (isFormulaQuoteQty(row) && (row?.quantity === "" || row?.quantity === undefined || row?.quantity === null)) {
    return row?.qty ? value(row.qty) : "";
  }
  if (isEditableLinkedQuoteQty(row) && row?.quantityManualOverride !== true) {
    return row?.qty ? value(row.qty) : "";
  }
  return value(row?.quantity);
}

function floorSystemQuoteDisplayQty(row, sheet) {
  const key = floorSystemQuoteKey(row);
  if (!key || !sheet) return "";
  const direct = sheet.preview?.quantities?.[key];
  if (Number(direct)) return direct;

  const lowerSystem = floorSystemWorkbookValue(sheet, "lowerFloorDepthMm");
  const secondSystem = floorSystemWorkbookValue(sheet, "upperFloorDepthMm");
  const thirdSystem = floorSystemWorkbookValue(sheet, "thirdFloorDepthMm");
  const groundArea = sheet.preview?.quantities?.lowerSlabAreaM2 || workbookDataValue(sheet.workbook, "lowerSlabAreaM2");
  const secondArea = sheet.preview?.quantities?.secondLevelFloorAreaM2 || workbookDataValue(sheet.workbook, "secondLevelFloorAreaM2");
  const thirdArea = sheet.preview?.quantities?.thirdLevelFloorAreaM2 || workbookDataValue(sheet.workbook, "thirdLevelFloorAreaM2");

  if (key === "quoteFloorSystemGround300M2") return isSelected300FloorSystem(lowerSystem) ? groundArea : "";
  if (key === "quoteFloorSystemGround360M2") return isSelected360FloorSystem(lowerSystem) ? groundArea : "";
  if (key === "quoteFloorSystemSecond300M2") return isSelected300FloorSystem(secondSystem) ? secondArea : "";
  if (key === "quoteFloorSystemSecond360M2") return isSelected360FloorSystem(secondSystem) ? secondArea : "";
  if (key === "quoteFloorSystemThird300M2") return isSelected300FloorSystem(thirdSystem) ? thirdArea : "";
  if (key === "quoteFloorSystemThird360M2") return isSelected360FloorSystem(thirdSystem) ? thirdArea : "";
  return "";
}

function floorSystemWorkbookValue(sheet, key) {
  const saved = workbookDataValue(sheet?.workbook, key);
  if (saved) return saved;
  const row = findDataInputRowByKey(key);
  return row?.options?.[0] || "";
}

function findDataInputRowByKey(key) {
  for (const section of DATA_INPUT_SECTIONS_FOR_LOOKUP) {
    const row = (section.rows || []).find((item) => item.key === key);
    if (row) return row;
  }
  return null;
}

function floorSystemQuoteKey(row) {
  const byId = {
    "quote-593.4": "quoteFloorSystemGround300M2",
    "quote-593.5": "quoteFloorSystemGround360M2",
    "quote-593.6": "quoteFloorSystemSecond300M2",
    "quote-593.7": "quoteFloorSystemSecond360M2",
    "quote-593.8": "quoteFloorSystemThird300M2",
    "quote-593.9": "quoteFloorSystemThird360M2",
  };
  if (byId[String(row?.id || "")]) return byId[String(row?.id || "")];
  const rowNumber = Number(row?.excelRow || row?.sourceRow || row?.values?.sourceRow || 0);
  if (rowNumber === 593.4) return "quoteFloorSystemGround300M2";
  if (rowNumber === 593.5) return "quoteFloorSystemGround360M2";
  if (rowNumber === 593.6) return "quoteFloorSystemSecond300M2";
  if (rowNumber === 593.7) return "quoteFloorSystemSecond360M2";
  if (rowNumber === 593.8) return "quoteFloorSystemThird300M2";
  if (rowNumber === 593.9) return "quoteFloorSystemThird360M2";
  return String(row?.quantityKey || "").startsWith("quoteFloorSystem") ? row.quantityKey : "";
}

function isSelected300FloorSystem(system) {
  const text = floorSystemText(system);
  return text.includes("suspended timber floor system") || text.includes("300mm i beams") || text.includes("300mm i beam") || text.startsWith("319mm");
}

function isSelected360FloorSystem(system) {
  const text = floorSystemText(system);
  return text.includes("360mm i beams") || text.includes("360mm i beam") || text.startsWith("379mm");
}

function floorSystemText(value) {
  return String(value || "").toLowerCase().replace(/[-\u2010-\u2015]/g, " ").replace(/\s+/g, " ").trim();
}

function quoteRowNumber(row, rowIndex = 0) {
  return row?.excelRow || row?.sourceRow || row?.values?.sourceRow || rowIndex + 1;
}

function isRemovedQuoteOutput(section, row = {}) {
  const rowNumber = Number(quoteRowNumber(row, 0));
  if ([161, 162, 163, 30076, 30077, 30080].includes(rowNumber)) return true;
  if (["quote-161", "quote-162", "quote-30076", "quote-30077", "quote-30080"].includes(String(row?.id || ""))) return true;
  const text = `${section || ""} ${row?.section || ""} ${row?.item || ""} ${row?.rawText || ""} ${Array.isArray(row?.values) ? row.values.join(" ") : ""}`.toLowerCase();
  return (text.includes("plumber") || text.includes("electrician")) && text.includes("fit off");
}

function displayQuoteRowNumber(row, rowIndex = 0) {
  return row?.displayRowNumber || quoteRowNumber(row, rowIndex);
}

function quoteSectionNumber(section, sheet) {
  const savedNumber = sheet.workbook?.quotation?.[section]?.groupNumber;
  if (savedNumber) return savedNumber;
  const override = QUOTE_SECTION_NUMBER_OVERRIDES[quoteSectionBaseName(section)];
  if (override) return override;
  const rows = sheet.preview?.quotation?.[section]?.rows || sheet.workbook?.quotation?.[section]?.rows || [];
  const firstNumberedRow = rows.find((row) => quoteRowNumber(row, 0));
  return firstNumberedRow ? quoteRowNumber(firstNumberedRow, 0) : "";
}

function findSectionByNumber(sections, number, sheet) {
  const needle = String(number || "").trim();
  if (!needle) return "";
  return sections.find((section) => String(quoteSectionNumber(section, sheet)) === needle) || "";
}

function moveSectionBefore(sections, movingSection, targetSection) {
  const withoutMoving = sections.filter((section) => section !== movingSection);
  const targetIndex = withoutMoving.indexOf(targetSection);
  if (targetIndex < 0) return sections;
  return [...withoutMoving.slice(0, targetIndex), movingSection, ...withoutMoving.slice(targetIndex)];
}

function moveSectionAfter(sections, movingSection, afterSection) {
  const withoutMoving = sections.filter((section) => section !== movingSection);
  const afterIndex = withoutMoving.indexOf(afterSection);
  if (afterIndex < 0) return sections;
  return [...withoutMoving.slice(0, afterIndex + 1), movingSection, ...withoutMoving.slice(afterIndex + 1)];
}

function dataInputRowNumber(row, rowIndex = 0) {
  return row?.sourceRow ?? rowIndex + 1;
}

function quoteItem(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  if (itemText === "install window architraves") return "INSTALL EXTERIOR DOOR AND WINDOW ARCHITRAVES";
  if (itemText === "70 x 35 mpg 12") return "PLATES AND NOGGINS 70 X 35 MPG 12";
  if (itemText === "brick window sills required (add y for yes)") return "BRICK SILLS";
  return row?.item || "";
}

function isApplianceHeadingQuoteRow(row) {
  return row?.applianceHeading === true || row?.lineType === "Appliance heading";
}

function isAppliancePackageSection(section) {
  return ["appliance package", "appliances & white goods"].includes(quoteSectionBaseName(section));
}

function isApplianceBrandSubsection(section) {
  const name = quoteSectionBaseName(section);
  return name.startsWith("appliance package - ") || name.startsWith("appliances & white goods - ");
}

function quoteSectionDisplayLabel(section) {
  const label = isApplianceBrandSubsection(section)
    ? section.replace(/^(appliance package|appliances & white goods)\s*-\s*/i, "")
    : quoteMainSectionDisplayLabel(section);
  return quoteHeadingDisplayLabel(label);
}

function quoteMainSectionDisplayLabel(section) {
  const name = quoteSectionBaseName(section);
  if (name === "fix out materials" || name === "skirting & architraves") return "FIX OUT";
  if (name === "appliance package") return "APPLIANCES & WHITE GOODS";
  return section;
}

function orderedApplianceBrandSubsections(sections = []) {
  return orderedKnownSubsections(sections, [
    "appliances & white goods - euromaid",
    "appliances & white goods - omega",
    "appliances & white goods - blanco",
    "appliances & white goods - ariston",
    "appliances & white goods - westinghouse",
    "appliances & white goods - smeg",
    "appliance package - euromaid",
    "appliance package - omega",
    "appliance package - blanco",
    "appliance package - ariston",
    "appliance package - westinghouse",
    "appliance package - smeg",
  ], isApplianceBrandSubsection).filter((section, index, all) => {
    const brand = applianceBrandFromSection(section);
    return brand && all.findIndex((item) => applianceBrandFromSection(item) === brand) === index;
  });
}

function applianceBrandFromSection(section) {
  const name = quoteSectionBaseName(section);
  return ["euromaid", "omega", "blanco", "ariston", "westinghouse", "smeg"].find((brand) => name.endsWith(`- ${brand}`)) || "";
}

function quoteHeadingDisplayLabel(label) {
  return String(label || "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

function applianceBrandKey(row) {
  return String(row?.applianceBrand || quoteItem(row) || row?.id || "").trim().toLowerCase();
}

function visibleApplianceRows(rows = [], openApplianceBrands = {}) {
  let currentBrandKey = "";
  let currentBrandOpen = true;
  return rows.filter((row) => {
    if (isApplianceHeadingQuoteRow(row) && row.applianceHeadingLevel === 1) {
      currentBrandKey = applianceBrandKey(row);
      currentBrandOpen = Boolean(openApplianceBrands[currentBrandKey]);
      return true;
    }
    if (currentBrandKey && !currentBrandOpen) return false;
    return true;
  });
}

function quoteDisplayNumbering(sheet, openApplianceBrands = {}) {
  const sections = [];
  topLevelQuoteSections(sheet.quoteSections).forEach((section) => {
    sections.push(section);
    quoteChildSectionsForParent(section, sheet.quoteSections, sheet).forEach((child) => sections.push(child));
  });
  const numbering = { sections: {}, rows: {} };
  let sectionNumber = 1;
  let rowNumber = 1;
  sections.forEach((section) => {
    const rows = visibleQuoteRowsForDisplay(sheet, section, openApplianceBrands);
    numbering.sections[section] = String(sectionNumber);
    sectionNumber += 1;
    rows.forEach((row) => {
      if (isApplianceHeadingQuoteRow(row)) return;
      numbering.rows[row.id] = String(rowNumber);
      rowNumber += 1;
    });
  });
  return numbering;
}

function visibleQuoteRowsForDisplay(sheet, section, openApplianceBrands = {}) {
  const search = String(sheet.lineSearch || "").toLowerCase();
  const rows = (sheet.preview?.quotation?.[section]?.rows || []).filter((row) => {
    if (quoteFeeType(row)) return false;
    if (isHiddenQuoteRow(row)) return false;
    if (!isQuoteRowRelevantForFloorCount(row, sheet.workbook)) return false;
    if (!hasSelectedWallThickness(sheet.workbook, "90") && is90mmWallFrameQuoteRow(row)) return false;
    if (isApplianceHeadingQuoteRow(row)) return true;
    const haystack = `${row.item || ""} ${row.rawText || ""}`.toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (sheet.hideUnused && !isUsedQuoteRow(row)) return false;
    return true;
  });
  return isAppliancePackageSection(section) ? visibleApplianceRows(rows, openApplianceBrands) : rows;
}

function applianceRowsForBrand(rows = [], brandKey = "") {
  const result = [];
  let collecting = false;
  rows.forEach((row) => {
    if (isApplianceHeadingQuoteRow(row) && row.applianceHeadingLevel === 1) {
      collecting = applianceBrandKey(row) === brandKey;
      return;
    }
    if (collecting) result.push(row);
  });
  return result;
}

function sumQuoteRows(rows = []) {
  return rows.reduce((total, row) => total + Number(row?.cost || 0), 0);
}

function isUsedQuoteRow(row = {}) {
  return Boolean(
    summaryNumber(row.qty || row.quantity || row.importedQuantity || 0)
    || summaryNumber(row.cost || row.importedCost || 0)
    || String(row.supplierQuote || "").trim()
    || row.quoteRequired
  );
}

function isQuoteRowRelevantForFloorCount(row, workbook) {
  const floorCount = workbookDataValue(workbook, "floorCount") || "Single storey";
  return quoteRowLevel(row) <= floorCountToLevels(floorCount);
}

function quoteRowLevel(row = {}) {
  const key = String(row.quantityKey || "");
  const text = `${row.section || ""} ${row.item || ""} ${row.rawText || ""} ${row.lineType || ""}`.toLowerCase();
  if (key.startsWith("third") || text.includes("third level") || text.includes("third storey") || text.includes("third floor")) return 3;
  if (key.startsWith("upper") || key.startsWith("second") || text.includes("second level") || text.includes("second storey") || text.includes("second floor") || text.includes("upper level")) return 2;
  return 1;
}

function isLinkedQuoteQty(row) {
  if (isBlankQuoteQtyRow(row)) return false;
  return Boolean(row?.quantityKey && !row?.quantity && row?.qty);
}

function isEditableLinkedQuoteQty(row) {
  return Boolean(row?.quantityKey);
}

function isFormulaQuoteQty(row) {
  return Boolean(row?.formulas?.B);
}

function isBlankQuoteQtyRow(row) {
  if (quoteRowNumber(row) === 116) return false;
  if (quoteRowNumber(row) === 1356) return false;
  if (quoteRowNumber(row) === 1363) return false;
  const itemText = String(row?.item || "").trim().toLowerCase();
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if ([
    "install window infills to gables",
    "window infills",
    "additional height walls (window infills)",
    "fabricate entry door jamb",
    "install single entry door inc. jamb/furn",
    "install window architraves",
    "install exterior door and window architraves",
    "install skirting",
    "wall studs 70 x 35 mpg 12",
    "70 x 35 mpg 12",
    "plates and noggins 70 x 35 mpg 12",
    "tie down plates",
  ].includes(itemText)) return true;
  return [
    "title search",
    "titles search",
    "add for tile roof trusses",
    "porch/verandah roof & ceiling framework",
  ].some((item) => text.includes(item));
}

function isHiddenQuoteRow(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  return itemText === "install exterior door architraves";
}

function is90mmWallFrameQuoteRow(row) {
  const text = `${row?.item || ""} ${row?.rawText || ""} ${row?.quantityKey || ""}`.toLowerCase();
  const mentions90mm = /\b90\s*mm\b/.test(text) || /\b90\s*x\s*35\b/.test(text) || text.includes("90mm");
  if (!mentions90mm) return false;
  return [
    "wall frame",
    "walls frame",
    "framed wall",
    "stud material",
    "plates and noggins",
    "timber framing",
    "mpg 12",
  ].some((phrase) => text.includes(phrase));
}

function isConcreteSlabSection(section) {
  return quoteSectionBaseName(section) === "concrete slab";
}

function isConcreteSlabSubsection(section) {
  return CONCRETE_SLAB_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isWallFramesSection(section) {
  const name = quoteSectionBaseName(section);
  return name === "wall frames" || name === "ground floor framing";
}

function isWallFramesSubsection(section) {
  return WALL_FRAMES_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRoofFramingSection(section) {
  return quoteSectionBaseName(section) === "roof framing";
}

function isRoofFramingSubsection(section) {
  return ROOF_FRAMING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isHardwareSection(section) {
  return quoteSectionBaseName(section) === "hardware";
}

function isHardwareSubsection(section) {
  return HARDWARE_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRoofingMaterialsSection(section) {
  return quoteSectionBaseName(section) === "roofing materials";
}

function isRoofingMaterialsSubsection(section) {
  return ROOFING_MATERIALS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isExternalCladdingSection(section) {
  return quoteSectionBaseName(section) === "external cladding";
}

function isExternalCladdingSubsection(section) {
  return EXTERNAL_CLADDING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isEntryDoorsSection(section) {
  return quoteSectionBaseName(section) === "doors";
}

function isEntryDoorsSubsection(section) {
  return ENTRY_DOORS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isTilingSection(section) {
  return quoteSectionBaseName(section) === "tiling";
}

function isTilingSubsection(section) {
  return TILING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPlumbingFittingsSection(section) {
  return quoteSectionBaseName(section) === "plumbing fittings & tapwear";
}

function isPlumbingFittingsSubsection(section) {
  return PLUMBING_FITTINGS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isElectricalSection(section) {
  return quoteSectionBaseName(section) === "electrical";
}

function isElectricalSubsection(section) {
  return ELECTRICAL_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPainterSection(section) {
  return quoteSectionBaseName(section) === "painter";
}

function isPainterSubsection(section) {
  return PAINTER_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isFloorcoveringsSection(section) {
  return quoteSectionBaseName(section) === "floorcoverings";
}

function isFloorcoveringsSubsection(section) {
  return FLOORCOVERINGS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isMirrorsShowerScreensSection(section) {
  return quoteSectionBaseName(section) === "mirrors & shower screens";
}

function isMirrorsShowerScreensSubsection(section) {
  return MIRRORS_SHOWER_SCREENS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function topLevelQuoteSections(sections = []) {
  return sections.filter((section) => !isGroupedQuoteSubsection(section, sections));
}

function isGroupedQuoteSubsection(section, sections = []) {
  if (isConcreteSlabSubsection(section)) return true;
  if (sections.some((item) => isWallFramesSection(item)) && isWallFramesSubsection(section)) return true;
  if (sections.some((item) => isWallFramesSection(item)) && isFramingMovedSubsection(section)) return true;
  if (sections.some((item) => isRoofFramingSection(item)) && isRoofFramingSubsection(section)) return true;
  if (sections.some((item) => isHardwareSection(item)) && isHardwareSubsection(section)) return true;
  if (sections.some((item) => isRoofingMaterialsSection(item)) && isRoofingMaterialsSubsection(section)) return true;
  if (sections.some((item) => isExternalCladdingSection(item)) && isExternalCladdingSubsection(section)) return true;
  if (sections.some((item) => isEntryDoorsSection(item)) && isEntryDoorsSubsection(section)) return true;
  if (sections.some((item) => isTilingSection(item)) && isTilingSubsection(section)) return true;
  if (sections.some((item) => isPlumbingFittingsSection(item)) && isPlumbingFittingsSubsection(section)) return true;
  if (sections.some((item) => isElectricalSection(item)) && isElectricalSubsection(section)) return true;
  if (sections.some((item) => isPainterSection(item)) && isPainterSubsection(section)) return true;
  if (sections.some((item) => isFloorcoveringsSection(item)) && isFloorcoveringsSubsection(section)) return true;
  if (sections.some((item) => isMirrorsShowerScreensSection(item)) && isMirrorsShowerScreensSubsection(section)) return true;
  if (sections.some((item) => isFaceBrickworkSection(item)) && isFaceBrickworkSubsection(section)) return true;
  if (sections.some((item) => isRenderingSection(item)) && isRenderingSubsection(section)) return true;
  if (sections.some((item) => isPlasterSupplyInstallSection(item)) && isPlasterSupplyInstallSubsection(section)) return true;
  if (sections.some((item) => isFixOutMaterialsSection(item)) && isFixOutMaterialsSubsection(section)) return true;
  if (sections.some((item) => isCabinetMakerSection(item)) && isCabinetMakerSubsection(section)) return true;
  if (sections.some((item) => isAppliancePackageSection(item)) && isApplianceBrandSubsection(section)) return true;
  return false;
}

function expandManagedQuoteSectionOrder(topLevelOrder = [], allSections = []) {
  const expanded = [];
  const seen = new Set();
  const add = (section) => {
    if (!section || seen.has(section) || !allSections.includes(section)) return;
    expanded.push(section);
    seen.add(section);
  };
  topLevelOrder.forEach((section) => {
    add(section);
    quoteChildSectionsForParent(section, allSections).forEach(add);
  });
  allSections.forEach(add);
  return expanded;
}

function quoteChildSectionsForParent(section, sections = []) {
  if (isConcreteSlabSection(section)) return sections.filter((item) => isConcreteSlabSubsection(item));
  if (isWallFramesSection(section)) return orderedFramingSubsections(sections);
  if (isRoofFramingSection(section)) return sections.filter((item) => isRoofFramingSubsection(item));
  if (isHardwareSection(section)) return sections.filter((item) => isHardwareSubsection(item));
  if (isRoofingMaterialsSection(section)) return sections.filter((item) => isRoofingMaterialsSubsection(item));
  if (isExternalCladdingSection(section)) return sections.filter((item) => isExternalCladdingSubsection(item));
  if (isEntryDoorsSection(section)) return sections.filter((item) => isEntryDoorsSubsection(item));
  if (isTilingSection(section)) return orderedTilingSubsections(sections.filter((item) => isTilingSubsection(item)));
  if (isPlumbingFittingsSection(section)) return orderedPlumbingFittingsSubsections(sections.filter((item) => isPlumbingFittingsSubsection(item)));
  if (isElectricalSection(section)) return orderedElectricalSubsections(sections.filter((item) => isElectricalSubsection(item)));
  if (isPainterSection(section)) return orderedPainterSubsections(sections.filter((item) => isPainterSubsection(item)));
  if (isFloorcoveringsSection(section)) return orderedFloorcoveringsSubsections(sections.filter((item) => isFloorcoveringsSubsection(item)));
  if (isMirrorsShowerScreensSection(section)) return orderedMirrorsShowerScreensSubsections(sections.filter((item) => isMirrorsShowerScreensSubsection(item)));
  if (isFaceBrickworkSection(section)) return sections.filter((item) => isFaceBrickworkSubsection(item));
  if (isRenderingSection(section)) return sections.filter((item) => isRenderingSubsection(item));
  if (isPlasterSupplyInstallSection(section)) return sections.filter((item) => isPlasterSupplyInstallSubsection(item));
  if (isFixOutMaterialsSection(section)) return sections.filter((item) => isFixOutMaterialsSubsection(item));
  if (isCabinetMakerSection(section)) return orderedCabinetMakerSubsections(sections.filter((item) => isCabinetMakerSubsection(item)));
  if (isAppliancePackageSection(section)) return orderedApplianceBrandSubsections(sections);
  return [];
}

function isFaceBrickworkSection(section) {
  return quoteSectionBaseName(section) === "face brickwork";
}

function isFaceBrickworkSubsection(section) {
  return FACE_BRICKWORK_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRenderingSection(section) {
  return quoteSectionBaseName(section) === "rendering";
}

function isRenderingSubsection(section) {
  return RENDERING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPlasterSupplyInstallSection(section) {
  return quoteSectionBaseName(section) === "plasterer - supply and install";
}

function isPlasterSupplyInstallSubsection(section) {
  return PLASTER_SUPPLY_INSTALL_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isFixOutMaterialsSection(section) {
  return ["fix out", "fix out materials", "skirting & architraves"].includes(quoteSectionBaseName(section));
}

function isFixOutMaterialsSubsection(section) {
  return FIX_OUT_MATERIALS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isCabinetMakerSection(section) {
  return quoteSectionBaseName(section) === "cabinet maker";
}

function isCabinetMakerSubsection(section) {
  return CABINET_MAKER_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function wallFramesDisplayLabel(section) {
  if (!isWallFramesSection(section)) return undefined;
  return "FRAMING";
}

function orderedFixOutSubsections(sections = []) {
  return orderedKnownSubsections(sections, [
    "install skirting",
    "internal final fix-out",
    "shelving",
    "standard wardrobes complete (2.4m wide)",
    "standard 3 door robe up to 3.6m wide",
    "standard 2 door linen up to 2.4m wide",
    "standard 3 door linen up to 3.6m wide",
  ], isFixOutMaterialsSubsection);
}

function orderedFramingSubsections(sections = []) {
  return orderedKnownSubsections(sections, [
    "structural steel",
    "pre-fab wall frames",
    "framing timber",
    "wall frames - lineal",
    "lintels & beams",
    "misc timber",
    "bracing and tie down",
    "ply bracing sheets",
    "tie down",
    "upper level timber flooring",
    "flooring",
    "roof framing",
    "ceiling battens",
    "hardware",
    "bolts nuts & screws",
    "couplings",
    "nails",
    "adhesives",
    "misc",
  ], (section) => isWallFramesSubsection(section) || isFramingMovedSubsection(section));
}

function orderedKnownSubsections(sections = [], preferredNames = [], predicate = () => true) {
  const matching = sections.filter(predicate);
  const preferred = [];
  preferredNames.forEach((name) => {
    const found = matching.find((section) => quoteSectionBaseName(section) === name && !preferred.includes(section));
    if (found) preferred.push(found);
  });
  return [...preferred, ...matching.filter((section) => !preferred.includes(section))];
}

function isFramingMovedSubsection(section) {
  const name = quoteSectionBaseName(section);
  return name === "structural steel"
    || name === "upper level timber flooring"
    || name === "flooring"
    || isRoofFramingSection(section)
    || isRoofFramingSubsection(section)
    || isHardwareSection(section)
    || isHardwareSubsection(section);
}

function quoteSectionBaseName(section) {
  return String(section || "").toLowerCase().replace(/['’]/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

const CONCRETE_SLAB_SUBSECTIONS = new Set([
  "slab items cost",
  "excavations & machine hire costs",
  "trench mesh",
  "reinforcing fabric",
  "deformed bar",
  "starter bars & corner bars",
  "dowells",
  "accessories",
  "waffle pods",
  "bulk materials",
  "concrete",
  "internal beams",
  "concrete pumping",
]);

const WALL_FRAMES_SUBSECTIONS = new Set([
  "pre-fab wall frames",
  "framing timber",
  "wall frames - lineal",
  "lintels & beams",
  "misc timber",
  "bracing and tie down",
  "ply bracing sheets",
  "tie down",
]);

const ROOF_FRAMING_SUBSECTIONS = new Set([
  "ceiling battens",
]);

const HARDWARE_SUBSECTIONS = new Set([
  "bolts nuts & screws",
  "couplings",
  "nails",
  "adhesives",
  "misc",
]);

const ROOFING_MATERIALS_SUBSECTIONS = new Set([
  "roofing labour",
]);

const EXTERNAL_CLADDING_SUBSECTIONS = new Set([
  "exterior cladding",
  "blue board",
  "hardiflex",
  "styrofoam exterior cladding",
  "j beads",
  "weather boards",
  "soffits",
  "soffits - lineal",
  "timber and trims",
]);

const ENTRY_DOORS_SUBSECTIONS = new Set([
  "double entry doors",
  "pivot door",
  "laundry/garage 820 1/3 panel glass door",
  "door jambs",
  "side lights",
  "door furniture",
  "garage door jambs",
  "garage doors - sectional panel lift",
  "garage doors - manual roll-a-door",
]);

const TILING_SUBSECTIONS = new Set([
  "bathroom",
  "ensuite",
  "toilet",
  "other room/s",
  "kitchen",
  "tile layer",
]);

const TILING_SUBSECTION_ORDER = [
  "bathroom",
  "ensuite",
  "toilet",
  "other room/s",
  "kitchen",
  "tile layer",
];

function orderedTilingSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = TILING_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = TILING_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? TILING_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? TILING_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const PLUMBING_FITTINGS_SUBSECTIONS = new Set([
  "kitchen sinks",
  "kitchen taps",
  "vanity basins",
  "wall mixers",
  "bath spouts",
  "showers",
  "toilets",
  "baths",
  "spa baths",
  "laundry tubs",
  "laundry taps",
  "washing machine taps",
  "projix",
  "lucerne",
  "singulier",
  "filtered water taps",
  "insinkerators",
  "plumbing fixtures",
]);

const PLUMBING_FITTINGS_SUBSECTION_ORDER = [
  "kitchen sinks",
  "kitchen taps",
  "vanity basins",
  "wall mixers",
  "bath spouts",
  "showers",
  "toilets",
  "baths",
  "spa baths",
  "laundry tubs",
  "laundry taps",
  "washing machine taps",
  "projix",
  "lucerne",
  "singulier",
  "filtered water taps",
  "insinkerators",
  "plumbing fixtures",
];

function orderedPlumbingFittingsSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = PLUMBING_FITTINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = PLUMBING_FITTINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? PLUMBING_FITTINGS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? PLUMBING_FITTINGS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const ELECTRICAL_SUBSECTIONS = new Set([
  "electrical fixtures",
  "lightfittings",
  "ceiling fans",
  "misc electrical fittings",
]);

const ELECTRICAL_SUBSECTION_ORDER = [
  "electrical fixtures",
  "lightfittings",
  "ceiling fans",
  "misc electrical fittings",
];

function orderedElectricalSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = ELECTRICAL_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = ELECTRICAL_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? ELECTRICAL_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? ELECTRICAL_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const PAINTER_SUBSECTIONS = new Set([
  "cleaning",
  "landscaping",
]);

const PAINTER_SUBSECTION_ORDER = [
  "cleaning",
  "landscaping",
];

function orderedPainterSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = PAINTER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = PAINTER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? PAINTER_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? PAINTER_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const FLOORCOVERINGS_SUBSECTIONS = new Set([
  "ceramic tiles",
  "porcelain tiles",
  "laminated flooring",
  "vinyl flooring",
  "hybrid flooring",
  "engeineered timber",
  "engineered timber",
  "solid timber flooring",
  "carpets",
  "misc flooring",
]);

const FLOORCOVERINGS_SUBSECTION_ORDER = [
  "ceramic tiles",
  "porcelain tiles",
  "laminated flooring",
  "vinyl flooring",
  "hybrid flooring",
  "engeineered timber",
  "engineered timber",
  "solid timber flooring",
  "carpets",
  "misc flooring",
];

function orderedFloorcoveringsSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = FLOORCOVERINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = FLOORCOVERINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? FLOORCOVERINGS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? FLOORCOVERINGS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const MIRRORS_SHOWER_SCREENS_SUBSECTIONS = new Set([
  "mirrors",
  "softline - framed 1870 high",
  "grange -semi frameless",
]);

const MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER = [
  "mirrors",
  "softline - framed 1870 high",
  "grange -semi frameless",
];

function orderedMirrorsShowerScreensSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const QUOTE_SECTION_NUMBER_OVERRIDES = {
  "garage door jambs": 73,
  "garage doors - sectional panel lift": 74,
};

const FACE_BRICKWORK_SUBSECTIONS = new Set([
  "bricklayers labour",
]);

const RENDERING_SUBSECTIONS = new Set([
  "renderers labour",
  "misc rendering",
]);

const PLASTER_SUPPLY_INSTALL_SUBSECTIONS = new Set([
  "plastering extras",
]);

const FIX_OUT_MATERIALS_SUBSECTIONS = new Set([
  "install skirting",
  "internal final fix-out",
  "shelving",
  "standard wardrobes complete (2.4m wide)",
  "standard 3 door robe up to 3.6m wide",
  "standard 2 door linen up to 2.4m wide",
  "standard 3 door linen up to 3.6m wide",
]);

const CABINET_MAKER_SUBSECTIONS = new Set([
  "butlers pantry",
  "laundry",
  "bathrooms",
  "wardrobes",
]);

const CABINET_MAKER_SUBSECTION_ORDER = [
  "butlers pantry",
  "laundry",
  "bathrooms",
  "wardrobes",
];

function orderedCabinetMakerSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = CABINET_MAKER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = CABINET_MAKER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? CABINET_MAKER_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? CABINET_MAKER_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

function formulaPickButtonStyle(active) {
  return active ? styles.formulaPickButtonActive : styles.formulaPickButton;
}

function quoteFeeType(row) {
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (text.includes("qbsa registration")) return "qbsaRegistration";
  if (text.includes("q leave fees")) return "qLeaveFees";
  return "";
}

function pretty(v) {
  return String(v).replace(/M2/g, " m2").replace(/Lm/g, " lm").replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

const styles = {
  shell: { display: "grid", gridTemplateColumns: "280px minmax(880px, 1fr) 330px", gap: 22, alignItems: "start", fontSize: 16, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  previewShell: { userSelect: "none", WebkitUserSelect: "none" },
  nav: { background: "#ffffff", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: 18, padding: 16, position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.10)" },
  main: { minWidth: 0 },
  summary: { background: "#ffffff", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: 18, padding: 18, position: "sticky", top: 16, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.10)" },
  eyebrow: { color: "#0f766e", fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" },
  navBrand: { display: "grid", gridTemplateColumns: "54px minmax(0, 1fr)", gap: 12, alignItems: "center", marginBottom: 18 },
  navBrandIcon: { width: 54, height: 54, borderRadius: 16, color: "#ffffff", background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 30px rgba(37, 99, 235, 0.30)" },
  navEyebrow: { display: "block", color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  navTitle: { display: "block", margin: "2px 0 0", color: "#0f172a", fontSize: 22, lineHeight: 1.1, fontWeight: 900 },
  navQuoteTotalLine: { margin: "0 0 14px", border: "1px solid #99f6e4", background: "#ecfdf5", color: "#0f766e", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 14, fontWeight: 900 },
  navButton: { width: "100%", border: "2px solid #cbd5e1", borderRadius: 14, padding: "11px 12px", marginBottom: 10, textAlign: "left", fontSize: 15, fontWeight: 900, cursor: "pointer", display: "grid", gridTemplateColumns: "38px minmax(0, 1fr)", gap: 10, alignItems: "center", transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease" },
  navButtonIcon: { width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 180ms ease" },
  navButtonActive: { background: "#0f766e", borderColor: "#0f766e", color: "#ffffff" },
  navNote: { marginTop: 12, color: "#475569", fontSize: 16, lineHeight: 1.5 },
  dashboardShell: { display: "grid", gap: 22 },
  dashboardHero: { border: "1px solid rgba(255,255,255,0.55)", color: "#ffffff", borderRadius: 24, padding: 26, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 22, alignItems: "center", boxShadow: "0 28px 70px rgba(37, 99, 235, 0.22)", overflow: "hidden" },
  dashboardHeroCopy: { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 18, alignItems: "center" },
  dashboardHeroIcon: { width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.24)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" },
  dashboardEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  dashboardTitle: { margin: "2px 0", color: "#ffffff", fontSize: 48, fontWeight: 600, lineHeight: 1.05 },
  dashboardSubtitle: { margin: 0, color: "rgba(255,255,255,0.88)", fontSize: 18, fontWeight: 650, maxWidth: 820, lineHeight: 1.45 },
  dashboardTotalCard: { border: "1px solid rgba(255,255,255,0.30)", background: "rgba(255,255,255,0.18)", color: "#ffffff", borderRadius: 18, padding: 20, display: "grid", gap: 6, textAlign: "right", backdropFilter: "blur(14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.20)" },
  dashboardTopGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignItems: "start" },
  dashboardPanel: { border: "1px solid rgba(148, 163, 184, 0.32)", background: "#ffffff", borderRadius: 18, padding: 20, display: "grid", gap: 16, boxShadow: "0 18px 44px rgba(15, 23, 42, 0.08)" },
  dashboardPanelHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  dashboardPanelTitle: { margin: 0, color: "#0f172a", fontSize: 24, fontWeight: 900 },
  dashboardPanelSubtitle: { margin: "5px 0 0", color: "#64748b", fontSize: 16, fontWeight: 650, lineHeight: 1.45 },
  dashboardSmallNavButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 12px 26px rgba(15, 118, 110, 0.20)" },
  dashboardFieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 },
  dashboardField: { display: "grid", gap: 6, color: "#334155", fontSize: 14, fontWeight: 900 },
  dashboardInput: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 10, padding: "11px 12px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 800 },
  dashboardReadOnly: { minHeight: 42, boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 12px", color: "#0f172a", background: "#f8fafc", fontSize: 16, fontWeight: 900 },
  dashboardUnavailable: { minHeight: 42, boxSizing: "border-box", border: "1px dashed #cbd5e1", borderRadius: 10, padding: "11px 12px", color: "#64748b", background: "#f8fafc", fontSize: 16, fontWeight: 800 },
  dashboardCardGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(190px, 1fr))", gap: 18 },
  dashboardWorkspaceCard: { minHeight: 188, border: "1px solid #d8e0ea", color: "#0f172a", borderRadius: 20, padding: 20, cursor: "pointer", textAlign: "left", display: "grid", gridTemplateColumns: "64px minmax(0, 1fr)", gridTemplateRows: "auto 1fr", gap: "15px 14px", boxShadow: "0 14px 34px rgba(15, 23, 42, 0.08)", transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease" },
  dashboardCardIcon: { width: 62, height: 62, borderRadius: 18, color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #bae6fd", boxShadow: "0 16px 28px rgba(15, 23, 42, 0.14)", transition: "transform 180ms ease" },
  dashboardCardCopy: { display: "grid", gap: 6, alignSelf: "start" },
  dashboardCardTitle: { fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.15 },
  dashboardCardSubtitle: { fontSize: 16, fontWeight: 650, color: "#475569", lineHeight: 1.42 },
  dashboardCardBadge: { gridColumn: "2 / 3", justifySelf: "start", alignSelf: "end", border: "1px solid #bbf7d0", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 950 },
  productLibraryShell: { display: "grid", gap: 14 },
  productLibraryToolbar: { border: "1px solid #ccfbf1", background: "#f0fdfa", borderRadius: 14, padding: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  productLibraryActions: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  productLibraryBulkBar: { border: "1px solid #d8dee8", background: "#f8fafc", borderRadius: 14, padding: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", color: "#0f172a" },
  productLibrarySelect: { border: "1px solid #94a3b8", borderRadius: 8, padding: "8px 10px", color: "#0f172a", background: "#ffffff", fontWeight: 800, minHeight: 38 },
  productLibraryMiniInput: { border: "1px solid #94a3b8", borderRadius: 8, padding: "8px 10px", color: "#0f172a", background: "#ffffff", fontWeight: 750, minHeight: 38 },
  productLibraryStatus: { color: "#334155", fontSize: 13, fontWeight: 850 },
  productLibraryTableWrap: { overflow: "auto", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 14, boxShadow: "0 14px 34px rgba(15,23,42,0.08)" },
  productLibraryTable: { minWidth: 1960, display: "grid" },
  productLibraryRow: { display: "grid", gridTemplateColumns: "120px 140px 140px 180px 260px 90px 150px 130px 110px 110px 100px 90px 116px 90px 220px 190px", gap: 0, borderBottom: "1px solid #e2e8f0", alignItems: "stretch" },
  productLibraryHeaderRow: { position: "sticky", top: 0, zIndex: 1, background: "#0f766e", color: "#ffffff", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" },
  productLibraryCellInput: { width: "100%", minHeight: 38, boxSizing: "border-box", border: 0, borderRight: "1px solid #e2e8f0", borderRadius: 0, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 13, fontWeight: 700, fontFamily: "inherit" },
  productLibraryActionCell: { display: "flex", alignItems: "center", gap: 6, padding: 6, borderRight: "1px solid #e2e8f0", background: "#ffffff" },
  productLibraryPreview: { border: "1px solid #99f6e4", background: "#f0fdfa", borderRadius: 14, padding: 14, display: "grid", gap: 12 },
  productLibraryPreviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 },
  productLibraryPreviewCard: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 10, padding: 10, display: "grid", gap: 8, color: "#0f172a", fontSize: 13 },
  productLibraryPreviewList: { display: "grid", gap: 4, color: "#475569", fontSize: 12, lineHeight: 1.35 },
  errorText: { margin: 0, color: "#b91c1c", fontWeight: 900 },
  workspacePlaceholder: { border: "1px dashed #cbd5e1", background: "#f8fafc", color: "#475569", borderRadius: 8, padding: 18, fontWeight: 800, lineHeight: 1.5 },
  floatingSaveJob: { position: "sticky", top: 0, zIndex: 4, marginTop: 14, background: "#ffffff", padding: "8px 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" },
  floatingSaveJobButton: { width: "100%", background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 7, padding: "10px 11px", fontWeight: 900, cursor: "pointer" },
  compactControlRow: { position: "sticky", top: 12, zIndex: 5, marginBottom: 12, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  topbar: { position: "relative", zIndex: 1, border: "1px solid rgba(255,255,255,0.45)", borderRadius: 24, padding: "22px 24px", marginBottom: 22, display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(210px, 300px) minmax(360px, 0.95fr)", gap: 18, alignItems: "center", boxShadow: "0 28px 70px rgba(15, 23, 42, 0.18)", color: "#ffffff" },
  pageBannerTitleGroup: { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 18, alignItems: "center", minWidth: 0 },
  pageBannerIcon: { width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.24)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" },
  pageBannerEyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  pageTitle: { margin: "1px 0 0", color: "#ffffff", fontSize: 48, lineHeight: 1.05, fontWeight: 600 },
  pageBannerSubtitle: { margin: "5px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 18, lineHeight: 1.35, fontWeight: 650 },
  openFileBanner: { justifySelf: "stretch", minWidth: 0, textAlign: "left", border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.18)", borderRadius: 18, padding: "13px 14px", backdropFilter: "blur(14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" },
  openFileLabel: { display: "block", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" },
  openFileName: { display: "block", color: "#ffffff", fontSize: 18, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  openJobBanner: { minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  openJobField: { minWidth: 0, border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.16)", borderRadius: 14, padding: "10px 12px", display: "grid", gap: 3, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)" },
  openJobFieldWide: { gridColumn: "1 / -1" },
  openJobLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase" },
  openJobValue: { color: "#ffffff", fontSize: 16, lineHeight: 1.25, fontWeight: 900, overflowWrap: "anywhere" },
  topControls: { minWidth: 0, display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  bannerBackButton: { minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0f172a", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: "8px 12px", fontSize: 14, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)" },
  lockedBadge: { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 999, padding: "8px 12px", fontSize: 16, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
  previewFieldset: { border: 0, padding: 0, margin: 0, minWidth: 0 },
  fileMenuWrap: { position: "relative", display: "inline-flex" },
  fileMenuButton: { background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 12, padding: "9px 14px", fontWeight: 900, cursor: "pointer", minWidth: 76, boxShadow: "0 8px 18px rgba(15, 118, 110, 0.18)" },
  fileMenu: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 190, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 6 },
  fileMenuItem: { width: "100%", background: "#ffffff", color: "#0f172a", border: 0, borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 600, cursor: "pointer" },
  fileMenuItemPrimary: { background: "#ecfdf5", color: "#0f766e" },
  fileMenuItemDisabled: { opacity: 0.55, cursor: "wait" },
  fileMenuDivider: { height: 1, background: "#dbe4ef", margin: "6px 0" },
  fileMenuSectionTitle: { padding: "6px 10px 4px", color: "#64748b", fontSize: 11, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" },
  fileMenuRecentItem: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, lineHeight: 1.25 },
  fileMenuEmpty: { padding: "8px 10px", color: "#64748b", fontSize: 12, fontWeight: 700 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(15, 23, 42, 0.45)" },
  jobPickerModal: { width: "min(760px, calc(100vw - 40px))", maxHeight: "min(720px, calc(100vh - 40px))", overflowY: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)", padding: 18, color: "#0f172a" },
  newJobModal: { width: "min(820px, calc(100vw - 40px))", maxHeight: "min(720px, calc(100vh - 40px))", overflowY: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)", padding: 18, color: "#0f172a" },
  newJobGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 },
  jobPickerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 12 },
  jobPickerTitle: { margin: 0, color: "#0f172a", fontSize: 26, fontWeight: 900 },
  jobPickerActions: { display: "flex", justifyContent: "flex-end", marginBottom: 10 },
  jobPickerMessage: { padding: "9px 10px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, fontWeight: 800, marginBottom: 10 },
  jobPickerEmpty: { padding: 24, border: "1px dashed #cbd5e1", borderRadius: 8, textAlign: "center", color: "#64748b", fontWeight: 800 },
  jobPickerList: { display: "grid", gap: 8 },
  jobPickerRow: { border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#0f172a", padding: "12px 14px", display: "grid", gap: 3, textAlign: "left", cursor: "pointer" },
  fileErrorBanner: { marginTop: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  saveProgress: { minHeight: 38, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #99f6e4", background: "#ecfdf5", color: "#0f766e", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" },
  saveProgressError: { borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" },
  saveSpinner: { width: 10, height: 10, borderRadius: 999, background: "#0f766e", boxShadow: "0 0 0 4px rgba(15, 118, 110, 0.14)" },
  templateButton: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  templateFileWrap: { position: "relative", display: "inline-flex" },
  templateFileButton: { width: 190, maxWidth: 190, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 12, padding: "7px 10px", fontWeight: 900, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, whiteSpace: "nowrap", overflow: "hidden", boxShadow: "0 8px 18px rgba(154, 52, 18, 0.10)" },
  templateFileButtonLabel: { maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" },
  templateFileButtonName: { maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" },
  templateFileMenuSimple: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30, width: 300, maxWidth: "calc(100vw - 32px)", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 10, display: "grid", gap: 10 },
  templateFileMenu: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30, width: 360, maxWidth: "calc(100vw - 32px)", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 10 },
  templateFileHeader: { borderBottom: "1px solid #e2e8f0", padding: "2px 2px 9px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 2, color: "#0f172a" },
  templateMenuItem: { width: "100%", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 800, cursor: "pointer" },
  templateMenuDanger: { width: "100%", background: "#fff1f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 800, cursor: "pointer" },
  templateMenuItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
  templateNameField: { display: "flex", flexDirection: "column", gap: 5, color: "#475569", fontSize: 13, fontWeight: 800, margin: "8px 0" },
  templateNameInput: { width: "100%", boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 6, padding: "8px 9px", color: "#0f172a", fontWeight: 700 },
  templateDebugPanel: { margin: "10px 0", border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", padding: 8, display: "grid", gap: 6, color: "#0f172a", fontSize: 12 },
  templateDebugRow: { display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 8, alignItems: "start" },
  templateDebugLabel: { color: "#64748b", fontWeight: 900, textTransform: "uppercase" },
  templateDebugValue: { color: "#0f172a", fontWeight: 800, overflowWrap: "anywhere" },
  templateMenuDivider: { height: 1, background: "#e2e8f0", margin: "10px 0" },
  templateListHeading: { color: "#334155", fontSize: 13, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 },
  templateDropdownList: { maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  templateDropdownItem: { width: "100%", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 6, padding: 8, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, color: "#0f172a" },
  templateDropdownItemActive: { borderColor: "#0f766e", background: "#ecfdf5" },
  templateActionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  templateEmptyInline: { color: "#64748b", fontWeight: 800, padding: "10px 2px", marginBottom: 8 },
  templateInlineMessage: { marginTop: 8, background: "#ecfdf5", color: "#0f766e", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 9px", fontWeight: 800 },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 },
  templateModal: { width: "min(1120px, 96vw)", maxHeight: "92vh", overflow: "hidden", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 24px 70px rgba(15,23,42,0.28)", display: "flex", flexDirection: "column" },
  templateModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: "1px solid #e2e8f0" },
  templateModalTitle: { margin: "3px 0 0", color: "#0f172a", fontSize: 28, fontWeight: 800 },
  modalCloseButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 7, padding: "8px 12px", fontWeight: 700, cursor: "pointer" },
  templateSearch: { margin: "14px 18px", border: "1px solid #64748b", borderRadius: 7, padding: "10px 12px", fontSize: 16, fontWeight: 700, color: "#0f172a" },
  templateManagerGrid: { minHeight: 0, flex: 1, display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 0, borderTop: "1px solid #e2e8f0", overflow: "hidden" },
  templateList: { overflowY: "auto", borderRight: "1px solid #e2e8f0", padding: 10, display: "flex", flexDirection: "column", gap: 8 },
  templateListItem: { width: "100%", display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 10, alignItems: "center", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 8, padding: 8, textAlign: "left", cursor: "pointer" },
  templateListItemActive: { borderColor: "#0f766e", background: "#ecfdf5" },
  templateThumb: { width: 56, height: 46, borderRadius: 7, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, overflow: "hidden" },
  templateThumbLarge: { width: 118, height: 92, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, overflow: "hidden", flexShrink: 0 },
  templateThumbImage: { width: "100%", height: "100%", objectFit: "cover" },
  templateListText: { minWidth: 0, display: "flex", flexDirection: "column", gap: 2, color: "#475569", fontSize: 13, fontWeight: 700 },
  templateDetails: { overflowY: "auto", padding: 18 },
  templateDetailTop: { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 },
  templateDetailTitle: { margin: "0 0 8px", color: "#0f172a", fontSize: 26, fontWeight: 900 },
  templateMeta: { color: "#475569", fontSize: 15, fontWeight: 700, marginBottom: 4 },
  templateActionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, margin: "14px 0" },
  primaryActionButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  secondaryActionButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  dangerActionButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  versionBox: { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" },
  versionTitle: { color: "#0f172a", fontWeight: 900, marginBottom: 8 },
  versionRow: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid #e2e8f0", color: "#334155", fontWeight: 700 },
  versionButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 6, padding: "5px 8px", fontWeight: 800, cursor: "pointer" },
  templateEmpty: { color: "#64748b", fontWeight: 800, padding: 16 },
  templateModalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" },
  savedText: { color: "#0f766e", fontSize: 16, fontWeight: 800, whiteSpace: "nowrap" },
  commercialSyncButton: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 12, padding: "9px 12px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  commercialSyncButtonDisabled: { opacity: 0.65, cursor: "not-allowed" },
  commercialSyncStatus: { margin: "10px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#1e3a8a", padding: "9px 11px", fontSize: 14, fontWeight: 700 },
  commercialSyncStatusSuccess: { borderColor: "#99f6e4", background: "#ecfdf5", color: "#0f766e" },
  commercialSyncStatusError: { borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" },
  quoteSearchControls: { display: "flex", gap: 8, alignItems: "center", flex: "1 1 260px", minWidth: 260 },
  searchInput: { border: "1px solid #64748b", borderRadius: 7, padding: "8px 10px", color: "#0f172a", fontWeight: 600, minWidth: 0, flex: "1 1 180px" },
  checkLabel: { color: "#334155", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  pageStack: { display: "flex", flexDirection: "column", gap: 10 },
  subcontractorPanel: { padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "#ffffff" },
  subcontractorIntro: { color: "#334155", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 15, lineHeight: 1.5, fontWeight: 800 },
  subcontractorCardList: { display: "flex", flexDirection: "column", gap: 12 },
  subcontractorCard: { overflow: "hidden", border: "2px solid #bfdbfe", borderRadius: 12, boxShadow: "0 10px 24px rgba(15,23,42,0.10)", color: "#0f172a" },
  subcontractorCardBlue: { background: "#eef7ff" },
  subcontractorCardGrey: { background: "#f8f9fb" },
  subcontractorCardAccepted: { borderColor: "#22c55e" },
  subcontractorCardPending: { borderColor: "#f59e0b" },
  subcontractorCardMissing: { borderColor: "#ef4444" },
  subcontractorCardHeader: { minHeight: 50, background: "#0f3f75", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px" },
  subcontractorHeaderTitle: { display: "flex", alignItems: "center", gap: 10, fontSize: 18, lineHeight: 1.2, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  subcontractorIcon: { width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 },
  subcontractorStatusBadge: { borderRadius: 999, padding: "6px 11px", fontSize: 13, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid transparent" },
  subcontractorStatusNoQuote: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" },
  subcontractorStatusQuoteReceived: { background: "#dbeafe", color: "#1d4ed8", borderColor: "#bfdbfe" },
  subcontractorStatusAccepted: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" },
  subcontractorStatusPurchaseOrderRaised: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" },
  subcontractorStatusOrdered: { background: "#e0f2fe", color: "#075985", borderColor: "#bae6fd" },
  subcontractorStatusCompleted: { background: "#ccfbf1", color: "#0f766e", borderColor: "#99f6e4" },
  subcontractorCardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 0, padding: 14 },
  subcontractorColumn: { minWidth: 0, padding: "4px 14px 8px 0", display: "flex", flexDirection: "column", gap: 8 },
  subcontractorColumnDivider: { borderLeft: "2px solid #94a3b8", paddingLeft: 14 },
  subcontractorColumnTitle: { color: "#0f3f75", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 },
  subcontractorInput: { width: "100%", minWidth: 0, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 700 },
  subcontractorFieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginBottom: 2 },
  subcontractorCheckLabel: { minHeight: 36, color: "#334155", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 9, cursor: "pointer" },
  largeCheckbox: { width: 24, height: 24, minWidth: 24, accentColor: "#0f766e", cursor: "pointer" },
  useQuoteToggleModern: { minHeight: 52, display: "inline-flex", alignItems: "center", gap: 11, cursor: "pointer", userSelect: "none", fontSize: 16, fontWeight: 900 },
  toggleInput: { position: "absolute", opacity: 0, pointerEvents: "none" },
  toggleTrack: { width: 68, height: 34, borderRadius: 999, position: "relative", display: "inline-flex", alignItems: "center", padding: 3, transition: "background 0.18s ease", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.18)" },
  toggleTrackOff: { background: "#cbd5e1" },
  toggleTrackOn: { background: "#22c55e" },
  toggleKnob: { width: 28, height: 28, borderRadius: "50%", background: "#ffffff", boxShadow: "0 2px 6px rgba(15,23,42,0.28)", transform: "translateX(0)", transition: "transform 0.18s ease" },
  toggleKnobOn: { transform: "translateX(34px)" },
  deductionList: { display: "flex", flexDirection: "column", gap: 10, minWidth: 220, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  deductionRow: { display: "grid", gridTemplateColumns: "24px minmax(130px, 1fr) auto", alignItems: "center", gap: 10, color: "#0f172a", fontSize: 15, lineHeight: 1.35, fontWeight: 800, cursor: "pointer" },
  balanceStack: { display: "flex", flexDirection: "column", gap: 9, minWidth: 170, color: "#14532d", background: "#dcfce7", border: "2px solid #86efac", borderRadius: 12, padding: 14, fontSize: 16, fontWeight: 800 },
  balanceLine: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#166534" },
  balanceNet: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", paddingTop: 10, marginTop: 2, borderTop: "1px solid #86efac", color: "#14532d", fontSize: 18 },
  summaryToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  summaryStageRow: { height: 48 },
  summaryToggleButton: {
    width: "100%",
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    background: "transparent",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
    textAlign: "left",
    cursor: "pointer",
  },
  cashflowHeader: { display: "grid", gridTemplateColumns: "minmax(240px, 0.7fr) minmax(520px, 1.3fr)", gap: 14, alignItems: "stretch", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14 },
  cashflowTitle: { margin: "2px 0 0", color: "#0f172a", fontSize: 34, fontWeight: 800 },
  cashflowMetricGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(135px, 1fr))", gap: 10 },
  cashflowMetric: { minHeight: 78, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", padding: 10, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, color: "#0f172a" },
  cashflowMetricPositive: { background: "#ecfdf5", borderColor: "#99f6e4" },
  cashflowMetricNegative: { background: "#fff1f2", borderColor: "#fecaca" },
  cashflowPercentInput: { width: 96, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "7px 8px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 800, textAlign: "right" },
  adjustmentsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, padding: 12, background: "#ffffff" },
  adjustmentField: { display: "flex", flexDirection: "column", gap: 5, color: "#334155", fontWeight: 700 },
  adjustmentLabel: { fontSize: 14, textTransform: "uppercase" },
  adjustmentInput: { width: "100%", boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "7px 8px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 700 },
  summarySectionInput: { width: "100%", minWidth: 190, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  quoteProposalShell: { display: "flex", flexDirection: "column", gap: 14 },
  quoteProposalToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 },
  quoteProposalWorkspace: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 14, alignItems: "start" },
  quoteProposalNav: { position: "sticky", top: 98, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 7 },
  quoteProposalNavButton: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#0f172a", padding: "11px 12px", fontSize: 16, fontWeight: 900, textAlign: "left", cursor: "pointer" },
  quoteProposalNavButtonActive: { background: "#0f3f75", color: "#ffffff", borderColor: "#0f3f75" },
  quoteProposalDocument: { display: "flex", flexDirection: "column", gap: 18, minWidth: 0 },
  quoteProposalPage: { background: "#ffffff", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 14, padding: 28, minHeight: 820, boxShadow: "0 20px 45px rgba(15,23,42,0.08)", display: "flex", flexDirection: "column", gap: 18 },
  quoteProposalPageHeader: { borderBottom: "2px solid #0f3f75", paddingBottom: 14, marginBottom: 6 },
  proposalCoverGrid: { display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: 24, alignItems: "start" },
  proposalCoverBrand: { display: "flex", flexDirection: "column", gap: 12 },
  proposalLogoBox: { width: 210, minHeight: 150, border: "2px dashed #94a3b8", borderRadius: 12, background: "#f8fafc", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, textAlign: "center", overflow: "hidden" },
  proposalLogoImage: { maxWidth: 210, maxHeight: 150, objectFit: "contain" },
  proposalCoverDetails: { display: "flex", flexDirection: "column", gap: 12 },
  proposalMiniGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 },
  proposalField: { display: "flex", flexDirection: "column", gap: 5, color: "#475569", fontSize: 13, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  proposalInput: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 8, padding: "10px 11px", color: "#0f172a", background: "#ffffff", fontSize: 17, fontWeight: 800, textTransform: "none", letterSpacing: 0 },
  proposalHero: { display: "flex", flexDirection: "column", gap: 10 },
  proposalHeroImage: { width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, border: "1px solid #cbd5e1" },
  proposalImagePlaceholder: { minHeight: 180, border: "2px dashed #94a3b8", borderRadius: 12, background: "#f8fafc", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, textAlign: "center", padding: 20 },
  proposalGallery: { display: "flex", flexDirection: "column", gap: 10 },
  proposalGalleryHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, color: "#0f172a", fontSize: 18 },
  proposalImageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  proposalImageGridLarge: { gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" },
  proposalImageTile: { position: "relative", overflow: "hidden", border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", minHeight: 150 },
  proposalGalleryImage: { width: "100%", height: 190, objectFit: "cover", display: "block" },
  proposalImageRemove: { position: "absolute", right: 8, top: 8, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "5px 8px", fontWeight: 900, cursor: "pointer" },
  proposalTextBlock: { display: "flex", flexDirection: "column", gap: 7, color: "#0f3f75", fontSize: 14, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  proposalTextarea: { width: "100%", minHeight: 135, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 10, padding: "12px 13px", color: "#0f172a", background: "#ffffff", fontSize: 16, lineHeight: 1.6, fontWeight: 650, fontFamily: "inherit", resize: "vertical", textTransform: "none", letterSpacing: 0 },
  proposalThreeColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 },
  proposalPlaceholderPanel: { border: "1px solid #bfdbfe", borderRadius: 12, background: "#eff6ff", padding: 18, display: "flex", flexDirection: "column", gap: 8, color: "#1e3a8a", fontSize: 16, lineHeight: 1.55 },
  proposalPriceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  proposalPriceCard: { border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", padding: 14, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", color: "#0f172a", fontSize: 16, fontWeight: 800 },
  proposalTotalsCard: { marginTop: 8, border: "2px solid #0f3f75", borderRadius: 12, background: "#f8fafc", padding: 16, display: "grid", gap: 10 },
  proposalAcceptanceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end" },
  proposalSignatureBox: { minHeight: 92, border: "1px solid #94a3b8", borderRadius: 10, background: "#f8fafc", color: "#64748b", display: "flex", alignItems: "flex-end", padding: 12, fontWeight: 900 },
  proposalTermsCheck: { display: "flex", alignItems: "center", gap: 10, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", padding: 12, color: "#0f172a", fontSize: 16, fontWeight: 800 },
  proposalThankYou: { minHeight: 620, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center" },
  projectEstimateShell: { display: "grid", gap: 12 },
  projectEstimateTabs: { display: "inline-flex", width: "fit-content", gap: 6, border: "1px solid #f3d08a", borderRadius: 10, background: "#fff7ed", padding: 6 },
  projectEstimateTab: { border: "1px solid transparent", borderRadius: 8, background: "transparent", color: "#92400e", padding: "9px 13px", fontSize: 13, fontWeight: 950, cursor: "pointer" },
  projectEstimateTabActive: { background: "#92400e", borderColor: "#92400e", color: "#ffffff", boxShadow: "0 8px 18px rgba(146,64,14,0.18)" },
  projectEstimateBaselineBar: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 12, alignItems: "center", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 12, padding: 12, fontWeight: 950 },
  standardPricedUsing: { border: "2px solid #15803d", background: "#f0fdf4", color: "#14532d", borderRadius: 12, padding: "10px 12px", fontSize: 16, fontWeight: 950 },
  standardInclusionsShell: { display: "grid", gap: 16 },
  standardInclusionsHero: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 410px", gap: 18, alignItems: "stretch", border: "1px solid #bbf7d0", background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", borderRadius: 18, padding: 22, boxShadow: "0 18px 44px rgba(22,101,52,0.10)" },
  standardPackagePanel: { display: "grid", gap: 10, border: "1px solid #bbf7d0", background: "#ffffff", borderRadius: 14, padding: 14 },
  standardInclusionsLayout: { display: "grid", gridTemplateColumns: "minmax(680px, 1fr) 380px", gap: 14, alignItems: "start" },
  standardPreviewPanel: { border: "1px solid #cbd5e1", background: "#e5e7eb", borderRadius: 16, padding: 16, overflow: "auto", maxHeight: "calc(100vh - 170px)" },
  standardEditorPanel: { position: "sticky", top: 90, maxHeight: "calc(100vh - 110px)", overflowY: "auto", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 },
  standardFeatureEditorCard: { border: "1px solid #d8dee8", background: "#f8fafc", borderRadius: 10, padding: 10, display: "grid", gap: 8 },
  standardSectionList: { display: "grid", gap: 6 },
  standardSectionButton: { border: "1px solid #d1fae5", background: "#f0fdf4", color: "#14532d", borderRadius: 8, padding: "8px 10px", textAlign: "left", fontWeight: 900, cursor: "pointer" },
  standardSectionButtonActive: { background: "#166534", color: "#ffffff", borderColor: "#166534" },
  standardSectionEditor: { display: "grid", gap: 9, border: "1px solid #bbf7d0", background: "#f8fff8", borderRadius: 10, padding: 10 },
  estimateInclusionsShell: { display: "grid", gap: 18 },
  estimateInclusionsHero: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 18, alignItems: "stretch", border: "1px solid #fde68a", background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)", borderRadius: 18, padding: 22, boxShadow: "0 18px 44px rgba(146,64,14,0.10)" },
  estimateInclusionsPackageCard: { display: "grid", gap: 10, border: "1px solid #f3d08a", background: "#ffffff", borderRadius: 14, padding: 14 },
  estimateInclusionsDescription: { width: "100%", minHeight: 82, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 8, padding: "9px 10px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 650, fontFamily: "inherit", resize: "vertical" },
  estimateInclusionsPreviewPanel: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 16, padding: 18, display: "grid", gap: 14 },
  estimateInclusionsEditorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 },
  estimateInclusionEditorCard: { border: "1px solid #d8dee8", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 12, boxShadow: "0 14px 32px rgba(15,23,42,0.07)" },
  estimateInclusionEditorHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: "#0f172a", fontSize: 16, fontWeight: 900 },
  estimateInclusionFormGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  estimateBulletEditor: { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 10, padding: 10, display: "grid", gap: 8 },
  estimateBulletRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center" },
  estimateMediaEditor: { display: "grid", gap: 8 },
  estimateMediaRow: { border: "1px solid #e2e8f0", borderRadius: 10, background: "#fbfdff", padding: 10, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto auto", gap: 8, alignItems: "end" },
  estimateSupplierEditorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  estimateSupplierEditorCard: { border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 10, display: "grid", gap: 8 },
  estimateInlineCheck: { display: "inline-flex", alignItems: "center", gap: 7, color: "#334155", fontSize: 13, fontWeight: 900 },
  estimateBrochure: { display: "grid", gap: 18, minHeight: 0 },
  estimateBrochureCompact: { maxHeight: 720, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "#fbfaf6" },
  estimateBrochureIntro: { display: "grid", gridTemplateColumns: "0.7fr 1fr", gap: 18, alignItems: "end", borderBottom: "1px solid rgba(15,23,42,0.12)", paddingBottom: 16 },
  estimateBrochureSectionGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 },
  estimateBrochureSection: { minHeight: 250, display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 0, overflow: "hidden", border: "1px solid rgba(200,157,74,0.32)", borderRadius: 18, background: "#ffffff", boxShadow: "0 16px 34px rgba(15,23,42,0.08)" },
  estimateBrochureSectionFeature: { gridColumn: "1 / -1", minHeight: 310, gridTemplateColumns: "1.05fr 1fr" },
  estimateBrochureImageWrap: { minHeight: 220, background: "#e2e8f0" },
  estimateBrochureImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  estimateBrochureImagePlaceholder: { width: "100%", height: "100%", minHeight: 220, display: "grid", placeItems: "center", color: "#64748b", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.08em" },
  estimateBrochureCopy: { padding: 18, display: "grid", gap: 8, alignContent: "start", color: "#334155" },
  estimateBrochureSuppliers: { borderTop: "2px solid rgba(200,157,74,0.45)", paddingTop: 14, display: "grid", gap: 12 },
  estimateBrochureSupplierLogo: { minHeight: 74, border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 12, padding: 10, display: "grid", placeItems: "center", gap: 4, textAlign: "center", color: "#0f172a", fontWeight: 900 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5, color: "#475569", fontSize: 13, fontWeight: 900 },
  proposalBuilderShell: { display: "flex", flexDirection: "column", gap: 12, minHeight: 760 },
  proposalBuilderToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#0f172a", color: "#ffffff", border: "1px solid #1e293b", borderRadius: 10, padding: 10 },
  proposalBuilderStatus: { border: "1px solid #bae6fd", background: "#eff6ff", color: "#075985", borderRadius: 8, padding: "9px 12px", fontWeight: 800, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  proposalBuilderLayout: { display: "grid", gridTemplateColumns: "230px minmax(680px, 1fr) 330px", gap: 12, alignItems: "start" },
  proposalPreviewLayout: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  proposalBuilderSidebar: { position: "sticky", top: 90, maxHeight: "calc(100vh - 110px)", overflowY: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 },
  projectEstimatePageControls: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderTop: "1px solid #e2e8f0", paddingTop: 8, marginBottom: 8 },
  proposalBuilderPanel: { position: "sticky", top: 90, maxHeight: "calc(100vh - 110px)", overflowY: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12 },
  proposalPageListButton: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#0f172a", padding: "10px 11px", marginBottom: 7, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, fontWeight: 900, cursor: "pointer" },
  proposalPageListButtonActive: { background: "#0f3f75", border: "1px solid #0f3f75", color: "#ffffff" },
  proposalBlockPalette: { marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "grid", gap: 7 },
  proposalBlockAddButton: { border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#1e3a8a", padding: "9px 10px", textAlign: "left", fontWeight: 900, cursor: "pointer" },
  proposalBuilderCanvas: { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, minWidth: 0, background: "#dbe4ee", border: "1px solid #94a3b8", borderRadius: 10, padding: 18, overflow: "auto" },
  proposalAddElementWrap: { position: "relative", display: "inline-flex" },
  projectEstimateAddElementMenu: { position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 80, width: 230, display: "grid", gap: 4, background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, boxShadow: "0 18px 45px rgba(15,23,42,0.22)" },
  projectEstimateVisualEditorFrame: { position: "relative", width: 794, minHeight: 1123, flex: "0 0 auto" },
  projectEstimatePageBoundaryGuide: { position: "absolute", inset: 0, zIndex: 95, pointerEvents: "none", border: "3px solid #dc2626", boxShadow: "inset 0 0 0 2px rgba(220,38,38,0.16)" },
  projectEstimateResizeHandle: { position: "absolute", width: 12, height: 12, border: "2px solid #0369a1", background: "#ffffff", borderRadius: "50%", zIndex: 8, boxSizing: "border-box", boxShadow: "0 2px 8px rgba(15,23,42,0.18)" },
  projectEstimateMoveHandle: { position: "absolute", left: 6, top: -34, zIndex: 6, pointerEvents: "auto", border: "1px solid #0369a1", background: "#ffffff", color: "#075985", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 900, cursor: "move", boxShadow: "0 8px 18px rgba(15,23,42,0.16)" },
  projectEstimateElementName: { position: "absolute", left: 0, top: -24, background: "#0369a1", color: "#ffffff", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  projectEstimateElementDimensions: { position: "absolute", right: 0, bottom: -22, background: "#0f172a", color: "#ffffff", borderRadius: 4, padding: "2px 5px", fontSize: 10, fontWeight: 800 },
  projectEstimateToolbarButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 900, cursor: "pointer" },
  projectEstimateLinkedIndicator: { border: "1px solid #bae6fd", background: "#eff6ff", color: "#075985", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 900 },
  projectEstimateAdminModalOverlay: { position: "fixed", inset: 0, zIndex: 2600, background: "rgba(15,23,42,0.55)", display: "grid", placeItems: "center", padding: 18 },
  projectEstimateAdminModal: { width: "min(520px, 94vw)", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 10, padding: 18, display: "grid", gap: 12, boxShadow: "0 24px 70px rgba(15,23,42,0.34)" },
  projectEstimateAdminModalActions: { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  projectEstimateInspectorTabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", padding: 4 },
  projectEstimateInspectorTab: { border: 0, borderRadius: 6, background: "transparent", color: "#475569", padding: "8px 10px", fontWeight: 950, cursor: "pointer" },
  projectEstimateInspectorTabActive: { border: 0, borderRadius: 6, background: "#0f172a", color: "#ffffff", padding: "8px 10px", fontWeight: 950, cursor: "pointer" },
  projectEstimateAddDock: { position: "relative", display: "flex", justifyContent: "flex-start" },
  projectEstimateLayersPanel: { display: "grid", gap: 5 },
  projectEstimateLayerRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto auto auto", gap: 4, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 7, padding: 5, background: "#ffffff" },
  projectEstimateLayerRowActive: { borderColor: "#0ea5e9", background: "#f0f9ff" },
  projectEstimateLayerNameButton: { minWidth: 0, border: 0, background: "transparent", color: "#0f172a", textAlign: "left", fontSize: 12, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" },
  projectEstimateLayerIconButton: { border: "1px solid #cbd5e1", borderRadius: 5, background: "#f8fafc", color: "#0f172a", padding: "5px 6px", fontSize: 11, fontWeight: 900, cursor: "pointer" },
  projectEstimateMediaOverlay: { position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.55)", display: "grid", placeItems: "center", padding: 20 },
  projectEstimateMediaDialog: { width: "min(860px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gap: 12 },
  projectEstimateMediaHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  projectEstimateMediaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 },
  projectEstimateMediaItem: { border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 8, display: "grid", gap: 6, color: "#0f172a", fontSize: 12, fontWeight: 850, textAlign: "left", cursor: "pointer" },
  projectEstimateMediaThumb: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 6, background: "#e2e8f0" },
  proposalExportSource: { position: "fixed", left: -12000, top: 0, zIndex: 0, width: "max-content", height: "auto", overflow: "visible", pointerEvents: "none", background: "#ffffff", display: "grid", gap: 0 },
  proposalDocumentPage: { width: 794, minHeight: 1123, boxSizing: "border-box", color: "#0f172a", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 22px 55px rgba(15,23,42,0.22)", padding: 54, display: "flex", flexDirection: "column", gap: 18, flex: "0 0 auto" },
  proposalCanvasBlock: { border: "1px solid transparent", borderRadius: 8, padding: 6, cursor: "grab" },
  proposalCanvasBlockSelected: { borderColor: "#0ea5e9", background: "rgba(14,165,233,0.08)", boxShadow: "0 0 0 3px rgba(14,165,233,0.14)" },
  proposalBuilderImage: { width: "100%", minHeight: 240, maxHeight: 430, borderRadius: 14, border: "1px solid #cbd5e1", display: "block" },
  proposalBuilderLogo: { maxWidth: 210, maxHeight: 130, objectFit: "contain" },
  importPlaceholderPage: { justifyContent: "center", alignItems: "center", background: "#fbfaf6" },
  importPlaceholderContent: { width: "100%", maxWidth: 610, display: "grid", gap: 18, textAlign: "center", justifyItems: "center" },
  importPlaceholderTitle: { margin: 0, color: "#0f172a", fontSize: 38, lineHeight: 1.08, fontWeight: 950, letterSpacing: 0 },
  importPlaceholderText: { margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.55, fontWeight: 650 },
  importButtonRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9, flexWrap: "wrap" },
  importedSummaryBox: { width: "100%", border: "1px solid #d6c28b", borderRadius: 10, background: "#fffaf0", color: "#3f321c", padding: 16, display: "grid", gap: 10, justifyItems: "center", fontWeight: 850 },
  importedPdfPortraitPage: { width: 794, height: 1123, boxSizing: "border-box", background: "#ffffff", boxShadow: "0 22px 55px rgba(15,23,42,0.22)", padding: 28, flex: "0 0 auto" },
  importedPdfLandscapePage: { width: 1123, height: 794, boxSizing: "border-box", background: "#ffffff", boxShadow: "0 22px 55px rgba(15,23,42,0.22)", padding: 28, flex: "0 0 auto" },
  importedPdfFrame: { width: "100%", height: "100%", border: "1px solid #cbd5e1", background: "#ffffff", display: "block" },
  importedPdfImage: { width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#ffffff" },
  importedPdfLoading: { width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#ffffff", color: "#64748b", fontSize: 16, fontWeight: 850, textAlign: "center", padding: 20, boxSizing: "border-box" },
  planThumbGrid: { width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 },
  planThumb: { minHeight: 92, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", padding: 9, display: "grid", gap: 5, alignContent: "start", color: "#0f172a", textAlign: "left" },
  planThumbActions: { display: "flex", gap: 5, flexWrap: "wrap" },
  miniButton: { border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", color: "#0f172a", padding: "5px 7px", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: "1px solid #fecaca", borderRadius: 8, background: "#fff1f2", color: "#b91c1c", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  standardPdfShell: { display: "grid", gap: 14 },
  standardPdfToolbar: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center", border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 16, padding: 16 },
  sectionTitle: { margin: "2px 0 0", color: "#0f172a", fontSize: 20, fontWeight: 900 },
  standardScheduleLoadedEditor: { display: "grid", gap: 12 },
  standardScheduleEditorToolbar: { border: "1px solid #d8dee8", background: "#ffffff", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 10px 24px rgba(15,23,42,0.06)" },
  standardScheduleSummaryCard: { border: "1px solid #bae6fd", background: "#eff6ff", color: "#0f172a", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, fontWeight: 800 },
  standardScheduleContextPanel: { display: "grid", gap: 12 },
  standardSchedulePanel: { border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 12, padding: 12, display: "grid", gap: 10 },
  standardSchedulePdfChoiceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 },
  standardScheduleChoiceButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, padding: 12, display: "grid", gap: 6, textAlign: "left", cursor: "pointer", fontWeight: 800 },
  standardScheduleCandidateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  standardScheduleCandidateCard: { border: "1px solid #d8dee8", background: "#ffffff", borderRadius: 10, padding: 10, display: "grid", gap: 6, color: "#0f172a", fontSize: 13 },
  standardScheduleThumbnail: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc" },
  standardScheduleThumbnailPlaceholder: { width: "100%", aspectRatio: "4 / 3", display: "grid", placeItems: "center", borderRadius: 8, border: "1px dashed #cbd5e1", color: "#64748b", background: "#f8fafc", fontWeight: 900 },
  standardScheduleRevisionRow: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "minmax(0, 1fr) repeat(3, auto)", gap: 8, alignItems: "center", color: "#0f172a" },
  standardScheduleWarningList: { margin: 0, paddingLeft: 18, color: "#92400e", fontWeight: 800 },
  standardSchedulePreviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  standardSchedulePreviewCard: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 10, padding: 8, display: "grid", gap: 6, color: "#0f172a", fontSize: 12, fontWeight: 800 },
  standardSchedulePreviewPage: { position: "relative", width: "100%", aspectRatio: "1 / 1.414", border: "1px solid #cbd5e1", borderRadius: 6, background: "#ffffff", overflow: "hidden", display: "grid", placeItems: "center" },
  standardSchedulePreviewImage: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  standardScheduleEmptyState: { border: "1px dashed #94a3b8", background: "#f8fafc", borderRadius: 14, padding: 22, display: "grid", gap: 12, placeItems: "start", color: "#0f172a" },
  standardPdfLayout: { display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 320px", gap: 14, alignItems: "start" },
  standardPdfLayoutEditable: { gridTemplateColumns: "240px minmax(0, 1fr)" },
  standardPdfPageList: { position: "sticky", top: 90, maxHeight: "calc(100vh - 120px)", overflow: "auto", display: "grid", gap: 8, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 10 },
  standardPdfPageListRow: { display: "grid", gap: 5 },
  standardPdfPageButton: { width: "100%", border: "1px solid #d1fae5", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "9px 10px", display: "grid", gap: 3, textAlign: "left", fontWeight: 900, cursor: "pointer" },
  standardPdfPageButtonActive: { background: "#166534", color: "#ffffff", borderColor: "#166534" },
  standardPdfReorderButtons: { display: "flex", gap: 5 },
  standardPdfPreviewPanel: { minHeight: 720, overflow: "auto", border: "1px solid #cbd5e1", background: "#e5e7eb", borderRadius: 14, padding: 18, display: "grid", justifyItems: "center" },
  standardPdfEmptyState: { minHeight: 520, width: "100%", display: "grid", placeItems: "center", border: "2px dashed #94a3b8", borderRadius: 12, color: "#64748b", fontWeight: 900, background: "#f8fafc" },
  standardPdfEditorPanel: { position: "sticky", top: 90, maxHeight: "calc(100vh - 120px)", overflow: "auto", display: "grid", gap: 10, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 12 },
  standardPdfElementEditor: { display: "grid", gap: 9, border: "1px solid #d1fae5", background: "#f8fff8", borderRadius: 10, padding: 10 },
  standardPdfGeometryGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  standardPdfExportStack: { position: "fixed", left: -12000, top: 0, width: 794, display: "grid", gap: 0, pointerEvents: "none", zIndex: 0 },
  standardPdfCanvas: { position: "relative", width: 794, height: 1123, overflow: "hidden", background: "#ffffff", boxShadow: "0 18px 45px rgba(15,23,42,0.16)", flex: "0 0 auto" },
  standardPdfBackgroundImage: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", display: "block" },
  standardPdfBlankPage: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#94a3b8", fontWeight: 900, background: "#ffffff" },
  standardPdfOverlayElement: { position: "absolute", zIndex: 2, border: "1px dashed transparent", background: "transparent", padding: 0, margin: 0, cursor: "pointer", overflow: "hidden", display: "block", boxSizing: "border-box", fontFamily: "inherit" },
  standardPdfOverlayElementSelected: { borderColor: "#0ea5e9", boxShadow: "0 0 0 2px rgba(14,165,233,0.25)" },
  standardPdfTextOverlay: { display: "block", width: "100%", height: "100%", whiteSpace: "pre-wrap", textAlign: "left", lineHeight: 1.2, fontWeight: 700 },
  standardPdfOverlayImage: { width: "100%", height: "100%", objectFit: "contain", display: "block" },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.46)", display: "grid", placeItems: "center", padding: 18 },
  documentLibraryModal: { width: "min(760px, 96vw)", maxHeight: "82vh", overflow: "auto", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gap: 12, boxShadow: "0 24px 70px rgba(15,23,42,0.24)" },
  documentLibraryHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "#0f172a", fontSize: 20 },
  documentLibraryList: { display: "grid", gap: 8 },
  documentLibraryRow: { width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#0f172a", padding: 11, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" },
  proposalLinkedField: { display: "flex", flexDirection: "column", gap: 5, border: "1px solid rgba(148,163,184,0.55)", background: "rgba(255,255,255,0.78)", borderRadius: 10, padding: 12 },
  proposalPricingSummary: { display: "grid", gap: 10, border: "1px solid #cbd5e1", borderRadius: 14, background: "rgba(248,250,252,0.95)", padding: 18 },
  proposalTotalLine: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#0f3f75", color: "#ffffff", borderRadius: 10, padding: "12px 14px", fontSize: 20, fontWeight: 900 },
  proposalListBlock: { border: "1px solid #cbd5e1", borderRadius: 14, background: "rgba(255,255,255,0.94)", padding: 18, fontSize: 16, lineHeight: 1.55 },
  proposalMultilineText: { whiteSpace: "pre-line" },
  proposalSignaturePanel: { border: "1px solid #cbd5e1", borderRadius: 14, background: "rgba(248,250,252,0.95)", padding: 18, display: "grid", gap: 18 },
  proposalSignatureLine: { minHeight: 80, borderBottom: "1px solid #64748b", display: "flex", alignItems: "flex-end", color: "#64748b", fontWeight: 800 },
  proposalPropertiesStack: { display: "grid", gap: 10 },
  proposalPanelButtonRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  proposalSelectedBlockHeader: { border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 9, display: "grid", gap: 8 },
  proposalMiniActions: { display: "flex", flexWrap: "wrap", gap: 5 },
  proposalPanelField: { display: "flex", flexDirection: "column", gap: 5, color: "#475569", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  proposalPanelInput: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 700, textTransform: "none" },
  proposalPanelTextarea: { width: "100%", minHeight: 110, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 650, fontFamily: "inherit", resize: "vertical", textTransform: "none" },
  proposalInlineTextarea: { width: "100%", minHeight: 96, boxSizing: "border-box", border: "1px solid #0ea5e9", borderRadius: 8, padding: 8, background: "rgba(255,255,255,0.92)", outline: "3px solid rgba(14,165,233,0.18)", fontFamily: "inherit", resize: "vertical", whiteSpace: "pre-line" },
  proposalThemeHint: { marginTop: 16, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#334155", padding: 12, display: "grid", gap: 6, fontSize: 13, lineHeight: 1.45 },
  proposalThemeLinkedBox: { border: "1px solid #d6c28b", borderRadius: 10, background: "#fffaf0", color: "#3f321c", padding: 12, display: "grid", gap: 6, fontSize: 13, lineHeight: 1.35, textTransform: "none" },
  proposalStatEditor: { border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 10, display: "grid", gap: 8 },
  luxuryPage: { width: 794, minHeight: 1123, boxSizing: "border-box", color: "#0f172a", background: "#ffffff", boxShadow: "0 22px 55px rgba(15,23,42,0.22)", padding: 54, display: "flex", flexDirection: "column", gap: 24, flex: "0 0 auto", overflow: "hidden", position: "relative" },
  luxuryProjectInfoPage: { height: 1123, minHeight: 1123, padding: 44, gap: 16 },
  luxuryCoverPage: { padding: 0, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
  luxuryCoverOverlay: { minHeight: 1123, boxSizing: "border-box", padding: 60, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#ffffff" },
  luxuryLogoLockup: { display: "flex", alignItems: "center", gap: 16, minHeight: 76, fontSize: 19, fontWeight: 950, letterSpacing: "0.06em", textTransform: "uppercase" },
  luxuryLogoImage: { width: 108, height: 74, objectFit: "contain", display: "block", flex: "0 0 auto" },
  luxuryLogoMark: { width: 74, height: 74, border: "1px solid rgba(200,157,74,0.9)", color: "#c89d4a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, letterSpacing: 0 },
  luxuryCoverContent: { maxWidth: 580, display: "grid", gap: 18 },
  luxuryThankYouContent: { maxWidth: 620, display: "grid", gap: 18, alignSelf: "center", textAlign: "center" },
  luxuryEyebrow: { fontSize: 13, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase" },
  luxuryCoverTitle: { margin: 0, color: "#ffffff", fontSize: 62, lineHeight: 0.98, fontWeight: 950, letterSpacing: 0, display: "grid", gap: 6, textShadow: "0 8px 24px rgba(0,0,0,0.42)" },
  luxuryProjectEstimateCoverTitle: { margin: 0, color: "#ffffff", display: "grid", gap: 6, textAlign: "left", fontFamily: "inherit", textShadow: "0 8px 24px rgba(0,0,0,0.42)" },
  luxuryProjectEstimateCoverTitleLine: { display: "block", color: "#ffffff", fontSize: 62, lineHeight: 0.98, fontWeight: 950, letterSpacing: 0, fontFamily: "inherit", textAlign: "left", textShadow: "0 8px 24px rgba(0,0,0,0.42)" },
  luxuryAccentRule: { width: 132, height: 5, borderRadius: 999 },
  luxuryCoverClient: { margin: 0, color: "#ffffff", fontSize: 25, lineHeight: 1.35, fontWeight: 850, whiteSpace: "pre-line" },
  luxuryCoverAddress: { margin: 0, color: "#e2e8f0", fontSize: 19, lineHeight: 1.55, fontWeight: 550, whiteSpace: "pre-line" },
  luxuryCoverMeta: { display: "flex", justifyContent: "space-between", gap: 18, borderTop: "1px solid rgba(255,255,255,0.35)", paddingTop: 18, color: "#f8fafc", fontSize: 16, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase" },
  luxuryPageHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, minHeight: 76 },
  luxuryHeaderTitle: { fontSize: 15, fontWeight: 950, letterSpacing: "0.14em", textTransform: "uppercase" },
  luxurySectionTitle: { margin: 0, color: "#0f172a", fontSize: 40, lineHeight: 1.08, fontWeight: 950, letterSpacing: 0 },
  luxuryBodyText: { margin: 0, color: "#334155", fontSize: 18, lineHeight: 1.62, fontWeight: 520, whiteSpace: "pre-line" },
  luxuryFinePrint: { margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.55, fontWeight: 650 },
  luxuryProjectIntro: { display: "grid", gridTemplateColumns: "0.74fr 1fr", gap: 24, alignItems: "end", borderBottom: "1px solid #e2e8f0", paddingBottom: 18 },
  luxuryInfoGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 },
  luxuryInfoCard: { minHeight: 78, border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 5, alignContent: "start" },
  luxuryInfoIcon: { fontSize: 11, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase" },
  luxuryInfoDetail: { color: "#475569", fontSize: 13, lineHeight: 1.35, fontWeight: 800 },
  luxuryFeatureBox: { border: "2px solid #c89d4a", borderRadius: 16, background: "#ffffff", padding: 22, display: "grid", gap: 8, color: "#0f172a", fontSize: 17, lineHeight: 1.55 },
  luxuryProjectInfoFeatureBox: { padding: 16, gap: 4, marginTop: "auto" },
  luxuryEstimateSummaryPage: { gap: 10, padding: 40 },
  luxuryEstimateSummaryIntro: { gap: 18, paddingBottom: 12 },
  luxuryEstimateSummaryTitle: { fontSize: 34, lineHeight: 1.04 },
  luxuryEstimateSummaryBody: { fontSize: 16, lineHeight: 1.42 },
  luxuryEstimateSummaryInfoGrid: { gap: 7 },
  luxuryEstimateSummaryInfoCard: { minHeight: 65, padding: 9, gap: 3, borderRadius: 10 },
  luxuryEstimateSummaryNoticeBox: { padding: 13, gap: 4 },
  luxuryNoticeHeading: { margin: 0, fontSize: 22, lineHeight: 1.15, fontWeight: 950 },
  luxuryNoticeBody: { margin: 0, textAlign: "left", fontSize: 14, lineHeight: 1.38, fontWeight: 550, color: "#334155" },
  luxuryAboutWhyPage: { height: 1123, minHeight: 1123, padding: 40, gap: 18, background: "#fbfaf6" },
  luxuryAboutWhyTop: { display: "grid", gridTemplateColumns: "0.95fr 1fr", gap: 24, alignItems: "start", minHeight: 350 },
  luxuryAboutWhyCopy: { display: "grid", gap: 12, alignContent: "start" },
  luxuryAboutWhyTitle: { margin: 0, color: "#0f172a", fontSize: 34, lineHeight: 1.04, fontWeight: 950, letterSpacing: 0 },
  luxuryAboutWhyBody: { margin: 0, color: "#334155", fontSize: 15.5, lineHeight: 1.48, fontWeight: 540, whiteSpace: "pre-line" },
  luxuryAboutWhyLogoStrip: { marginTop: 8, borderTop: "1px solid #e2e8f0", paddingTop: 12 },
  luxuryAboutWhyImageStack: { position: "relative", minHeight: 345 },
  luxuryAboutWhyHeroImage: { width: "86%", height: 300, objectFit: "cover", display: "block", borderRadius: "76px 16px 76px 16px", border: "1px solid #e2e8f0", boxShadow: "0 24px 50px rgba(15,23,42,0.18)" },
  luxuryAboutWhyImageInset: { position: "absolute", right: 0, bottom: 0, width: "46%", height: 150, objectFit: "cover", display: "block", borderRadius: "16px 54px 16px 54px", border: "6px solid #fbfaf6", boxShadow: "0 18px 38px rgba(15,23,42,0.20)" },
  luxuryAboutWhyLower: { display: "grid", gap: 14, borderTop: "1px solid #e2e8f0", paddingTop: 18 },
  luxuryAboutWhySubhead: { margin: "6px 0 0", color: "#0f172a", fontSize: 25, lineHeight: 1.08, fontWeight: 950 },
  luxuryAboutWhyCardGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 11 },
  luxuryAboutWhyCard: { minHeight: 112, border: "1px solid #e7dcc5", borderRadius: 14, background: "#ffffff", padding: 10, display: "grid", gap: 5, alignContent: "start", boxShadow: "0 12px 24px rgba(15,23,42,0.07)" },
  luxuryAboutWhyIcon: { width: 32, height: 32, borderRadius: 999, color: "#07111f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 950 },
  luxuryAboutWhyStatsBar: { marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, paddingTop: 14, borderTop: "2px solid #e2e8f0" },
  luxuryAboutWhyStatCard: { display: "grid", gap: 5, textAlign: "center", color: "#334155", fontSize: 10.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", background: "#fffaf0", border: "1px solid #ead9b5", borderRadius: 12, padding: "10px 6px" },
  luxuryAboutGrid: { display: "grid", gridTemplateColumns: "1fr 310px", gap: 30, alignItems: "stretch" },
  luxuryImageFrame: { width: "100%", height: 420, objectFit: "cover", borderRadius: "90px 18px 90px 18px", border: "1px solid #e2e8f0", display: "block" },
  luxuryImageFrameWide: { height: 320, borderRadius: 20 },
  luxuryImageFrameTall: { height: 520 },
  luxuryImageFrameDeep: { height: 610, borderRadius: 22 },
  luxuryImagePlaceholder: { width: "100%", minHeight: 360, boxSizing: "border-box", border: "2px dashed #cbd5e1", borderRadius: "90px 18px 90px 18px", background: "#f8fafc", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900 },
  luxuryAboutImageRow: { marginTop: -8, display: "grid", gridTemplateColumns: "1fr 0.82fr", gap: 16, alignItems: "end" },
  luxuryStatsBar: { marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, borderTop: "2px solid #e2e8f0", paddingTop: 20 },
  luxuryStatCard: { display: "grid", gap: 7, textAlign: "center", color: "#334155", fontSize: 15, fontWeight: 850, border: "1px solid #e2e8f0", background: "#fffaf0", borderRadius: 14, padding: "14px 10px" },
  luxuryQuote: { margin: "22px 0 0", borderLeft: "5px solid #c89d4a", padding: "10px 0 10px 18px", color: "#0f172a", fontSize: 19, lineHeight: 1.5, fontWeight: 800 },
  luxuryCardGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: 8 },
  luxuryDarkCard: { border: "1px solid rgba(255,255,255,0.16)", borderRadius: 18, background: "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))", padding: 18, minHeight: 172, display: "grid", gap: 8, alignContent: "start", color: "#e2e8f0", boxShadow: "0 18px 38px rgba(0,0,0,0.18)" },
  luxuryIconDot: { width: 44, height: 44, borderRadius: 999, color: "#07111f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950 },
  luxuryWhyPage: { backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
  luxuryWhyHero: { maxWidth: 720, display: "grid", gap: 12, color: "#e2e8f0" },
  luxuryWhyStatsBar: { marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, padding: 16, border: "1px solid rgba(255,255,255,0.42)", background: "linear-gradient(135deg, #c89d4a 0%, #f8d58a 100%)", boxShadow: "0 24px 48px rgba(0,0,0,0.28)" },
  luxuryWhyStatCard: { display: "grid", gap: 5, textAlign: "center", color: "#07111f", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" },
  luxuryTwoColumn: { display: "grid", gridTemplateColumns: "0.95fr 1fr", gap: 26, alignItems: "start" },
  luxuryDesignTextBlock: { marginTop: 34, paddingTop: 18, display: "grid", gridTemplateColumns: "0.82fr 1fr", gap: 30, alignItems: "end", borderTop: "1px solid #e2e8f0" },
  luxuryInclusionsLeader: { gap: 16 },
  luxuryInclusionHero: { position: "relative", display: "grid", gridTemplateColumns: "0.66fr 1.34fr", gap: 24, alignItems: "center", minHeight: 825 },
  luxuryInclusionTextPanel: { position: "relative", zIndex: 20, display: "grid", gap: 18, color: "#0f172a", background: "rgba(245,241,232,0.92)", border: "1px solid rgba(200,157,74,0.35)", borderRadius: 20, padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.12)" },
  luxuryInclusionScheduleNote: { color: "#07111f", background: "#f8d58a", borderRadius: 999, padding: "10px 14px", display: "inline-flex", width: "fit-content", fontWeight: 950 },
  luxuryInclusionCollage: { position: "relative", minHeight: 720 },
  luxuryInclusionImageTile: { margin: 0, position: "absolute", overflow: "hidden", borderRadius: 22, border: "4px solid rgba(255,255,255,0.92)", boxShadow: "0 24px 48px rgba(15,23,42,0.26)", background: "#ffffff" },
  luxuryInclusionImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  luxuryInclusionCaption: { position: "absolute", left: 10, right: 10, bottom: 10, color: "#ffffff", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.06em", textShadow: "0 2px 8px rgba(0,0,0,0.55)" },
  luxuryPriceHero: { border: "1px solid rgba(255,255,255,0.16)", borderRadius: 22, background: "rgba(255,255,255,0.07)", padding: 28, display: "grid", gap: 8, textAlign: "center" },
  luxuryPriceGrid: { display: "grid", gap: 10 },
  luxuryProgressHeading: { margin: "6px 0 0", color: "#ffffff", fontSize: 26, lineHeight: 1.15, fontWeight: 950, letterSpacing: 0 },
  luxuryPriceHeaderRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 150px", alignItems: "center", gap: 16, color: "#f8d58a", fontSize: 12, fontWeight: 950, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid rgba(248,213,138,0.32)", paddingBottom: 8 },
  luxuryPriceRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 150px", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(255,255,255,0.15)", padding: "13px 0", color: "#e2e8f0", fontSize: 16, fontWeight: 750 },
  luxurySignatureGrid: { display: "grid", gridTemplateColumns: "1fr 220px", gap: 22, margin: "30px 0" },
  luxurySignatureLine: { minHeight: 110, borderBottom: "2px solid #0f172a", color: "#64748b", display: "flex", alignItems: "flex-end", paddingBottom: 10, fontWeight: 850 },
  commercialModuleLoading: { minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, color: "#475569", fontSize: 16 },
  clientPageShell: { display: "flex", flexDirection: "column", gap: 12 },
  clientToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 },
  clientEditor: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 },
  clientLogoEditor: { display: "grid", gridTemplateColumns: "104px minmax(0, 1fr)", gap: 12, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" },
  clientLogoPreview: { width: 88, height: 88, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontWeight: 800, overflow: "hidden" },
  clientLogoActions: { display: "flex", flexDirection: "column", gap: 7, minWidth: 0 },
  clientLogoHint: { color: "#475569", fontSize: 14, fontWeight: 600 },
  clientEditorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  clientTextarea: { width: "100%", minHeight: 82, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 6, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 600, fontFamily: "inherit", resize: "vertical" },
  clientDocument: { background: "#ffffff", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 10, padding: 28, display: "flex", flexDirection: "column", gap: 18 },
  clientHeader: { display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(260px, 360px)", gap: 24, borderBottom: "2px solid #0f766e", paddingBottom: 18 },
  clientBrand: { display: "flex", alignItems: "center", gap: 16 },
  clientLogoMark: { width: 88, height: 88, border: "2px solid #0f766e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontWeight: 800, fontSize: 18 },
  clientLogoImage: { width: 88, height: 88, objectFit: "contain", borderRadius: 8 },
  clientCompanyName: { fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 },
  clientDocumentTitle: { marginTop: 6, fontSize: 20, fontWeight: 700, color: "#475569", textTransform: "uppercase" },
  clientMetaGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 7 },
  clientMetaItem: { display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 10, color: "#475569", fontSize: 15 },
  clientSection: { display: "flex", flexDirection: "column", gap: 8 },
  clientSectionTitle: { margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 800, textTransform: "uppercase" },
  clientSectionToggle: { width: "100%", minHeight: 74, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start", gap: 8, background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "10px 12px", fontSize: 20, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  clientBlockSummary: { display: "block", color: "#64748b", fontSize: 13, lineHeight: 1.35, fontWeight: 700, textTransform: "none" },
  clientParagraph: { margin: 0, color: "#334155", fontSize: 16, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  clientStage: { display: "flex", flexDirection: "column", gap: 0, border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  clientStageHeader: { width: "100%", minHeight: 72, display: "grid", gridTemplateColumns: "minmax(160px, 0.8fr) minmax(220px, 1.3fr) auto", alignItems: "center", gap: 12, background: "#ecfdf5", color: "#0f172a", border: 0, padding: "10px 12px", fontWeight: 800, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  clientStageSummary: { color: "#475569", fontSize: 13, lineHeight: 1.35, fontWeight: 700, textTransform: "none" },
  clientStageHeaderPrint: { display: "none", justifyContent: "space-between", gap: 12, background: "#ecfdf5", color: "#0f172a", padding: "10px 12px", fontWeight: 800, textTransform: "uppercase" },
  clientTable: { width: "100%", borderCollapse: "collapse", fontSize: 15 },
  clientTh: { background: "#f8fafc", color: "#334155", borderBottom: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left", fontWeight: 800 },
  clientTd: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#334155", verticalAlign: "top" },
  clientTdNumber: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#334155", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" },
  clientTdFinal: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#0f172a", textAlign: "right", whiteSpace: "nowrap", fontWeight: 800, verticalAlign: "top" },
  clientTdStrong: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#0f172a", fontWeight: 800 },
  clientGrandTotal: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "13px 15px", fontSize: 22, fontWeight: 800, marginTop: 4 },
  clientSignatureGrid: { display: "grid", gridTemplateColumns: "1fr 220px", gap: 26, marginTop: 18 },
  clientSignatureLine: { borderTop: "1px solid #64748b", paddingTop: 8, color: "#334155", fontWeight: 700 },
  quotationWorkspace: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 350px", gap: 14, alignItems: "start" },
  quotationTablePane: { minWidth: 0, display: "flex", flexDirection: "column", gap: 0 },
  quoteGroup: { display: "flex", flexDirection: "column", gap: 0, minWidth: 0 },
  quoteNotesInput: { width: 118, maxWidth: 118 },
  productPreviewPanel: { position: "sticky", top: 88, alignSelf: "start", maxHeight: "calc(100vh - 110px)", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 14, background: "#ffffff", padding: 14, display: "grid", gap: 12, boxShadow: "0 20px 48px rgba(15, 23, 42, 0.14)" },
  productPreviewHeader: { display: "grid", gap: 4, borderBottom: "1px solid #e2e8f0", paddingBottom: 10, color: "#0f172a" },
  productPreviewImageButton: { width: "100%", aspectRatio: "4 / 3", border: "1px solid #cbd5e1", borderRadius: 12, backgroundColor: "#f8fafc", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat", cursor: "zoom-in", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)" },
  productPreviewEmpty: { minHeight: 240, border: "1px dashed #94a3b8", borderRadius: 12, background: "#f8fafc", color: "#64748b", display: "grid", placeItems: "center", textAlign: "center", padding: 18, gap: 6, fontWeight: 800 },
  productPreviewNav: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "#475569", fontSize: 13, fontWeight: 900 },
  productPreviewThumbs: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 },
  productPreviewThumb: { minHeight: 54, border: "1px solid #cbd5e1", borderRadius: 8, backgroundColor: "#f8fafc", backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" },
  productPreviewThumbActive: { borderColor: "#0f766e", boxShadow: "0 0 0 3px rgba(15, 118, 110, 0.18)" },
  productPreviewField: { display: "grid", gap: 5, color: "#475569", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  productPreviewInput: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "7px 8px", color: "#0f172a", fontSize: 13, fontWeight: 700, textTransform: "none" },
  productPreviewMeta: { display: "grid", gap: 7 },
  productPreviewDescription: { borderTop: "1px solid #e2e8f0", paddingTop: 10, color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  productPreviewDescriptionText: { margin: "6px 0 0", color: "#334155", fontSize: 14, fontWeight: 650, lineHeight: 1.45, textTransform: "none" },
  selectionReferenceCell: { minWidth: 210, display: "grid", gap: 5 },
  selectionSpecInput: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 13, fontWeight: 700 },
  selectionReferenceMeta: { display: "flex", flexWrap: "wrap", gap: 5, color: "#475569", fontSize: 11, fontWeight: 800 },
  selectionAdjustmentBad: { color: "#b45309" },
  selectionAdjustmentGood: { color: "#15803d" },
  imageModalBackdrop: { position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.76)", display: "grid", placeItems: "center", padding: 24 },
  imageModal: { maxWidth: "min(920px, 92vw)", maxHeight: "92vh", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10, boxShadow: "0 28px 80px rgba(0,0,0,0.35)" },
  imageModalImg: { maxWidth: "100%", maxHeight: "76vh", objectFit: "contain", borderRadius: 10, background: "#f8fafc" },
  imageModalClose: { justifySelf: "end", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "8px 11px", fontWeight: 900, cursor: "pointer" },
  nestedQuoteStack: { display: "flex", flexDirection: "column", gap: 8, padding: "8px 8px 10px 22px", background: "#f8fafc", border: "1px solid #cbd5e1", borderTop: 0, borderRadius: "0 0 10px 10px" },
  nestedQuoteSection: { background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 8, overflow: "hidden" },
  orderPanel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 },
  orderPanelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  orderPanelTitle: { color: "#0f172a", fontSize: 24, fontWeight: 700 },
  orderPanelNote: { color: "#475569", fontSize: 15, fontWeight: 600, marginTop: 3 },
  orderToolRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: 10 },
  orderToolText: { color: "#334155", fontWeight: 700 },
  orderList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#f8fafc" },
  orderItem: { display: "grid", gridTemplateColumns: "32px 62px 84px minmax(220px, 1fr) auto auto", gap: 8, alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 },
  orderItemNumber: { color: "#0f766e", fontWeight: 800 },
  orderGroupInput: { width: 68, border: "1px solid #94a3b8", borderRadius: 6, padding: "6px 6px", fontSize: 14, fontWeight: 700, textAlign: "center" },
  orderItemName: { color: "#0f172a", fontWeight: 700, textTransform: "uppercase" },
  orderActions: { display: "flex", gap: 8, alignItems: "center" },
  tabBar: { display: "flex", gap: 8, alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 8 },
  tabButton: { background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 11px", fontWeight: 600, cursor: "pointer" },
  tabButtonActive: { background: "#0f766e", color: "#ffffff", borderColor: "#0f766e" },
  section: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" },
  sectionHeader: { width: "100%", display: "grid", gridTemplateColumns: "78px 44px minmax(0, 1fr)", alignItems: "stretch", background: "#ecfdf5", border: 0, borderBottom: "1px solid #99f6e4", color: "#0f172a" },
  nestedSectionHeader: { width: "100%", display: "grid", gridTemplateColumns: "78px 44px minmax(0, 1fr)", alignItems: "stretch", background: "#eff6ff", border: 0, borderBottom: "1px solid #bfdbfe", color: "#0f172a" },
  sectionGroupInput: { width: 58, height: 42, alignSelf: "center", justifySelf: "center", border: "1px solid #020617", borderRadius: 4, padding: "6px 6px", fontSize: 16, fontWeight: 900, textAlign: "center", background: "#020617", color: "#ffffff", boxSizing: "border-box" },
  sectionStageInput: { width: 34, height: 34, alignSelf: "center", justifySelf: "center", border: "2px solid #f59e0b", borderRadius: 3, padding: "5px 4px", fontSize: 15, fontWeight: 900, textAlign: "center", background: "#fef3c7", color: "#7c2d12", boxSizing: "border-box" },
  sectionHeaderButton: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "transparent", border: 0, color: "#0f172a", padding: "14px 16px 14px 0", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  sectionTotalStack: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, whiteSpace: "nowrap", textAlign: "right" },
  staticSectionHeader: { background: "#ecfdf5", borderBottom: "1px solid #99f6e4", color: "#0f172a", padding: "14px 16px", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headerButton: { background: "#ffffff", color: "#0f172a", border: "1px solid #99f6e4", borderRadius: 6, padding: "6px 9px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  subSection: { borderTop: "1px solid #e2e8f0", background: "#ffffff" },
  subSectionHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: 0, borderBottom: "1px solid #e2e8f0", color: "#0f172a", padding: "12px 14px", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  tableWrap: { overflow: "auto", maxHeight: "calc(100vh - 235px)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 16 },
  th: { position: "sticky", top: 0, zIndex: 2, background: "#dbeafe", color: "#0f172a", padding: "8px 9px", border: "1px solid #bfdbfe", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "5px 7px", border: "1px solid #e2e8f0", color: "#0f172a", verticalAlign: "middle", background: "#ffffff" },
  compactColumn: { width: 38, minWidth: 38, maxWidth: 38, paddingLeft: 4, paddingRight: 4, textAlign: "center", whiteSpace: "nowrap" },
  lowerLevelCell: { background: "#eef6ff" },
  upperLevelCell: { background: "#fff7e6" },
  thirdLevelCell: { background: "#f0fdf4" },
  lowerLevelCellStrong: { background: "#dbeafe" },
  upperLevelCellStrong: { background: "#ffedd5" },
  thirdLevelCellStrong: { background: "#dcfce7" },
  strongCell: { fontWeight: 600, background: "#f8fafc" },
  headingCell: { background: "#e0f2fe", color: "#0f172a", padding: "18px 12px", fontSize: 28, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", borderTop: "2px solid #38bdf8", borderBottom: "2px solid #38bdf8" },
  subheadingCell: { background: "#f8fafc", color: "#334155", padding: "7px 10px", fontSize: 15, lineHeight: 1.2, fontWeight: 700, textTransform: "uppercase", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" },
  calcCell: { background: "#f1f5f9", fontWeight: 600, color: "#0f172a" },
  finalCell: { background: "#dcfce7", fontWeight: 600, color: "#14532d" },
  input: { width: "100%", minWidth: 95, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 600 },
  shortInput: { width: 80, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  numberInput: { width: 76, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  itemInput: { width: "100%", minWidth: 280, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  selectInput: { width: "100%", minWidth: 150, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 700 },
  removedProcurementRow: { opacity: 0.55, background: "#f8fafc" },
  formulaInput: { width: "100%", minWidth: 260, boxSizing: "border-box", border: "1px solid #0f766e", borderRadius: 5, padding: "6px 7px", color: "#0f172a", background: "#f0fdfa", fontFamily: "Consolas, monospace", fontSize: 16, fontWeight: 600 },
  formulaText: { fontFamily: "Consolas, monospace", color: "#0f172a", fontWeight: 600 },
  formulaPickButton: { width: "100%", background: "transparent", color: "inherit", border: 0, padding: 0, textAlign: "left", font: "inherit", fontWeight: 600 },
  formulaPickButtonActive: { width: "100%", background: "#bbf7d0", color: "#14532d", border: "1px solid #86efac", borderRadius: 5, padding: "4px 6px", textAlign: "left", font: "inherit", fontWeight: 600, cursor: "pointer" },
  applianceBrandHeading: { display: "block", fontSize: 18, fontWeight: 800, letterSpacing: 0, paddingLeft: 0 },
  applianceBrandToggle: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", border: 0, color: "#0f172a", padding: 0, font: "inherit", fontSize: 18, fontWeight: 800, letterSpacing: 0, textAlign: "left", cursor: "pointer", textTransform: "uppercase" },
  applianceBrandMeta: { color: "#475569", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", textTransform: "none" },
  appliancePackageHeading: { display: "block", fontSize: 15, fontWeight: 800, letterSpacing: 0, paddingLeft: 24 },
  unitInput: { width: 86, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  lineTypeInput: { minWidth: 150, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  rateInput: { width: 86, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  readOnly: { color: "#475569", fontWeight: 600 },
  primaryButton: { alignSelf: "flex-start", background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer" },
  secondaryButton: { background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer" },
  smallButton: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 7px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  addLineButton: { margin: 8, background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "7px 10px", fontWeight: 600, cursor: "pointer" },
  sectionFooterActions: { display: "flex", alignItems: "center", gap: 8, padding: 8 },
  closeSectionButton: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 7, padding: "7px 10px", fontWeight: 600, cursor: "pointer" },
  rowActions: { display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", minWidth: 145 },
  draggableRow: { cursor: "grab" },
  dragHandle: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 24, border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", color: "#475569", fontWeight: 600, cursor: "grab", lineHeight: 1 },
  rowNumber: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, color: "#334155", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  dataRowNumber: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, color: "#64748b", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  dangerButton: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 8px", fontWeight: 600, cursor: "pointer" },
  summaryRow: { display: "flex", justifyContent: "space-between", gap: 10, color: "#334155", fontSize: 16, borderBottom: "1px solid #e2e8f0", padding: "7px 0" },
  finalBox: { background: "#0f766e", color: "#ffffff", borderRadius: 9, padding: 12, margin: "10px 0 14px", display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 600 },
  panel: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: 10, marginTop: 10 },
  panelTitle: { color: "#0f172a", fontSize: 16, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 },
  panelBody: { display: "flex", flexDirection: "column", gap: 6 },
  warningPill: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 999, padding: "5px 8px", fontSize: 16, fontWeight: 600 },
  windowLevelWarning: { margin: 10, display: "flex", flexDirection: "column", gap: 4, background: "#fff7ed", border: "1px solid #fb923c", color: "#9a3412", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontWeight: 700 },
  okPill: { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 999, padding: "5px 8px", fontSize: 16, fontWeight: 600 },
};
