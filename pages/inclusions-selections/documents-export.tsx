import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DocumentsExportProjectSummary } from "../../src/modules/inclusions-selections/components/DocumentsExportProjectSummary";
import { DocumentsExportStageActions } from "../../src/modules/inclusions-selections/components/DocumentsExportStageActions";
import { EstimateExportPreview } from "../../src/modules/inclusions-selections/components/EstimateExportPreview";
import { EstimateMappingIssues } from "../../src/modules/inclusions-selections/components/EstimateMappingIssues";
import { EstimateMappingOverrideDialog } from "../../src/modules/inclusions-selections/components/EstimateMappingOverrideDialog";
import { EstimateMappingSummary } from "../../src/modules/inclusions-selections/components/EstimateMappingSummary";
import { ExportAggregationSummary } from "../../src/modules/inclusions-selections/components/ExportAggregationSummary";
import { ExportHistoryPanel } from "../../src/modules/inclusions-selections/components/ExportHistoryPanel";
import { ExportReconciliationPanel } from "../../src/modules/inclusions-selections/components/ExportReconciliationPanel";
import { GeneratedDocumentsPanel } from "../../src/modules/inclusions-selections/components/GeneratedDocumentsPanel";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { OutputTypeSelector } from "../../src/modules/inclusions-selections/components/OutputTypeSelector";
import { SnapshotVersionSelector } from "../../src/modules/inclusions-selections/components/SnapshotVersionSelector";
import { BuilderSchedulePreview, ClientSelectionSchedulePreview, SiteSchedulePreview, SupplierSchedulePreview, TradeSchedulePreview, VariationSummaryPreview } from "../../src/modules/inclusions-selections/components/SchedulePreviewPanels";
import type { DocumentProjectionType, EstimateMappingOverride } from "../../src/modules/inclusions-selections/repositories/documentsExportRepository";
import { documentsExportRepository } from "../../src/modules/inclusions-selections/repositories/documentsExportRepository";
import {
  buildDocumentProjection,
  createMappingOverride,
  executeEstimateExport,
  generateSelectionDocument,
  loadDocumentsExportStage,
  retryFailedExportLines,
  type DocumentsExportStage,
} from "../../src/modules/inclusions-selections/services/documentsExportService";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage, queryValue } from "../../src/modules/inclusions-selections/routing/stageNavigation";

export default function SelectionDocumentsExportPage() {
  const router = useRouter();
  const [stage, setStage] = useState<DocumentsExportStage | null>(null);
  const [outputType, setOutputType] = useState<DocumentProjectionType>("client_selection_schedule");
  const [selectedLineId, setSelectedLineId] = useState<string | undefined>();
  const [override, setOverride] = useState<Partial<EstimateMappingOverride>>({ actorId: "builder", reason: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);
  const hasProjectContext = Boolean(context.organisationId && context.projectId);

  const loadStage = useCallback(async (options: { snapshotVersion?: number; snapshotId?: string } = {}) => {
    if (!hasProjectContext) {
      setStage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const querySnapshotVersion = Number(queryValue(router.query.snapshotVersion) || 0) || undefined;
      setStage(await loadDocumentsExportStage(context as ProjectSelectionContext, { ...options, snapshotId: options.snapshotId ?? queryValue(router.query.snapshotId), snapshotVersion: options.snapshotVersion ?? querySnapshotVersion }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Documents and export stage could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [context, hasProjectContext, router.query.snapshotId, router.query.snapshotVersion]);

  useEffect(() => {
    void loadStage();
  }, [loadStage]);

  const projection = stage?.selectedSnapshot ? buildDocumentProjection(stage.selectedSnapshot, outputType) : null;
  const canContinue = Boolean(stage?.selectedSnapshot && stage.generatedDocuments.some((document) => document.snapshotId === stage.selectedSnapshot?.id && document.status === "generated") && (stage.exportBatches.some((batch) => batch.snapshotId === stage.selectedSnapshot?.id && batch.status === "completed") || stage.exportStatus === "deferred"));

  async function reloadWithMessage(text: string) {
    await loadStage({ snapshotId: stage?.selectedSnapshot?.id });
    setMessage(text);
  }

  const preview = projection ? outputType === "client_selection_schedule" ? <ClientSelectionSchedulePreview projection={projection} /> : outputType === "builder_internal_schedule" ? <BuilderSchedulePreview projection={projection} /> : outputType === "site_supervisor_schedule" || outputType === "room_by_room_schedule" || outputType === "category_schedule" ? <SiteSchedulePreview projection={projection} /> : outputType === "trade_schedule" ? <TradeSchedulePreview projection={projection} /> : outputType === "supplier_schedule" ? <SupplierSchedulePreview projection={projection} /> : outputType === "variation_summary" ? <VariationSummaryPreview projection={projection} /> : <EstimateExportPreview lines={stage?.exportPreview ?? []} /> : null;

  return (
    <main className="documentsExportPage">
      <InclusionsSelectionsStageNav currentStage="documents-export" context={stage?.context ?? context} />
      <header className="documentsHero">
        <p>Inclusions and Selections</p>
        <h1>Approved Documents and Estimate Export</h1>
        <span>Generate approved selection schedules from the locked version and transfer validated selection costs into the Estimate Builder.</span>
      </header>
      {!hasProjectContext ? <section className="issuePanel">{PROJECT_REQUIRED_MESSAGE}</section> : null}
      {loading ? <section className="documentsCard">Loading documents and export...</section> : null}
      {message ? <section className="validNotice">{message}</section> : null}
      {stage ? (
        <>
          <DocumentsExportProjectSummary stage={stage} />
          <DocumentsExportStageActions
            canContinue={canContinue}
            onBack={() => void router.push(hrefForStage("approvals", stage.context))}
            onGenerate={() => void generateSelectionDocument(stage, outputType, "builder", undefined, documentsExportRepository).then((result) => reloadWithMessage(result.ok ? "Document generated." : result.issues.map((item) => item.message).join("; ")))}
            onPrint={() => window.print()}
            onValidate={() => setMessage(stage.mappingSummary.unmappedLines ? "Estimate mappings need attention." : "Estimate mappings are ready.")}
            onPreview={() => document.getElementById("estimate-export-preview")?.scrollIntoView({ behavior: "smooth" })}
            onExport={() => void executeEstimateExport(stage, "builder", undefined, documentsExportRepository).then((result) => reloadWithMessage(result.ok ? `Export ${result.value?.batch.status}.` : result.issues.map((item) => item.message).join("; ")))}
            onRetry={() => void retryFailedExportLines(stage, "builder", undefined, documentsExportRepository).then((result) => reloadWithMessage(result.ok ? "Failed lines retried." : result.issues.map((item) => item.message).join("; ")))}
            onHistory={() => document.getElementById("export-history")?.scrollIntoView({ behavior: "smooth" })}
            onContinue={() => void router.push({ pathname: "/inclusions-selections/procurement", query: { projectId: stage.context.projectId, organisationId: stage.context.organisationId, snapshotId: stage.selectedSnapshot?.id, snapshotVersion: stage.selectedSnapshot?.version } })}
          />
          <SnapshotVersionSelector stage={stage} onSelect={(version) => void loadStage({ snapshotVersion: version })} />
          <OutputTypeSelector value={outputType} onChange={setOutputType} />
          {preview}
          <GeneratedDocumentsPanel documents={stage.generatedDocuments} />
          <EstimateMappingSummary summary={stage.mappingSummary} />
          <EstimateMappingIssues issues={stage.mappingSummary.issues} />
          <EstimateMappingOverrideDialog lineId={selectedLineId ?? stage.mappingSummary.issues.find((item) => item.blocking)?.sourceSnapshotLineId} value={override} onChange={setOverride} onSave={() => {
            const lineId = selectedLineId ?? stage.mappingSummary.issues.find((item) => item.blocking)?.sourceSnapshotLineId;
            if (!lineId) return;
            void createMappingOverride(stage, lineId, { actorId: override.actorId ?? "builder", reason: override.reason ?? "", estimateStage: override.estimateStage, estimateRowMapping: override.estimateRowMapping, costCode: override.costCode, tradeMapping: override.tradeMapping, unit: override.unit, aggregationEligible: override.aggregationEligible }, documentsExportRepository).then((result) => reloadWithMessage(result.ok ? "Mapping override saved." : result.issues.map((item) => item.message).join("; ")));
          }} />
          <div id="estimate-export-preview"><EstimateExportPreview lines={stage.exportPreview} /></div>
          <ExportAggregationSummary aggregation={stage.aggregation} />
          <div id="export-history"><ExportHistoryPanel batches={stage.exportBatches} /></div>
          <ExportReconciliationPanel reconciliations={stage.reconciliations} />
        </>
      ) : null}
      <style jsx>{`
        .documentsExportPage { min-height: 100vh; background: #f6f7f9; color: #172033; padding: 28px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .documentsHero { max-width: 1180px; margin: 0 auto 18px; }
        .documentsHero p { margin: 0 0 6px; color: #657083; font-size: 13px; font-weight: 700; text-transform: uppercase; }
        .documentsHero h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
        .documentsHero span { display: block; max-width: 820px; color: #536072; line-height: 1.5; }
        :global(.documentsCard), :global(.documentsSummary), :global(.documentPreview), :global(.issuePanel), :global(.validNotice) { max-width: 1180px; margin: 0 auto 14px; background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 18px; }
        :global(.documentsSummary), :global(.metricGrid) { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        :global(.documentsSummary div), :global(.metricGrid div) { border: 1px solid #e6ecf3; border-radius: 6px; padding: 10px; background: #fbfcfe; min-width: 0; }
        :global(.documentsSummary span), :global(.metricGrid span) { display: block; color: #647082; font-size: 12px; }
        :global(.documentsSummary strong), :global(.metricGrid strong) { display: block; margin-top: 4px; overflow-wrap: anywhere; }
        :global(.documentsActions), :global(.outputGrid), :global(.formGrid) { max-width: 1180px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 10px; }
        :global(button), :global(input) { border: 1px solid #cfd8e3; border-radius: 6px; min-height: 38px; padding: 8px 10px; background: #fff; color: #172033; font: inherit; }
        :global(button) { cursor: pointer; font-weight: 700; }
        :global(button:disabled) { color: #94a0af; cursor: not-allowed; }
        :global(.primaryButton), :global(.selected) { background: #155e75; border-color: #155e75; color: #fff; }
        :global(.documentsRows), :global(.previewLines) { display: grid; gap: 8px; }
        :global(.documentsRow), :global(.previewLine) { display: grid; grid-template-columns: repeat(8, minmax(100px, 1fr)); gap: 8px; align-items: center; border: 1px solid #e6ecf3; border-radius: 6px; padding: 10px; overflow-wrap: anywhere; text-align: left; }
        :global(.previewLine) { grid-template-columns: 1.4fr repeat(7, minmax(90px, 1fr)); }
        :global(.documentPreview header), :global(.documentMeta) { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        :global(.documentPreview h2), :global(.documentsCard h2) { margin: 0 0 12px; font-size: 20px; letter-spacing: 0; }
        :global(.previewSection h3) { break-after: avoid; margin: 18px 0 8px; font-size: 16px; }
        :global(.issuePanel), :global(.blocked) { border-color: #fecaca; background: #fff7f7; color: #7f1d1d; }
        :global(.validNotice), :global(.ok) { border-color: #bbf7d0; background: #f0fdf4; color: #14532d; }
        @media print {
          .documentsHero, :global(.documentsActions), :global(.documentsCard) { display: none; }
          :global(.documentPreview) { border: 0; max-width: none; }
          :global(.previewSection) { break-inside: avoid; }
        }
        @media (max-width: 900px) {
          :global(.documentsSummary), :global(.metricGrid) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          :global(.documentsRow), :global(.previewLine) { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .documentsExportPage { padding: 18px; }
          .documentsHero h1 { font-size: 26px; }
          :global(.documentsSummary), :global(.metricGrid), :global(.documentsActions), :global(.outputGrid), :global(.formGrid), :global(.documentsRow), :global(.previewLine) { display: grid; grid-template-columns: 1fr; }
          :global(button), :global(input) { width: 100%; }
        }
      `}</style>
    </main>
  );
}
