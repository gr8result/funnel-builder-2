import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AllowanceReview } from "../../src/modules/inclusions-selections/components/AllowanceReview";
import { BuilderInternalReview } from "../../src/modules/inclusions-selections/components/BuilderInternalReview";
import { CategoryReviewPanel } from "../../src/modules/inclusions-selections/components/CategoryReviewPanel";
import { ClientVariationPreview } from "../../src/modules/inclusions-selections/components/ClientVariationPreview";
import { CustomSelectionReview } from "../../src/modules/inclusions-selections/components/CustomSelectionReview";
import { NotApplicableReview } from "../../src/modules/inclusions-selections/components/NotApplicableReview";
import { ProductAvailabilityReview } from "../../src/modules/inclusions-selections/components/ProductAvailabilityReview";
import { ReviewIssuesRegister } from "../../src/modules/inclusions-selections/components/ReviewIssuesRegister";
import { ReviewProjectSummary } from "../../src/modules/inclusions-selections/components/ReviewProjectSummary";
import { ReviewStageActions } from "../../src/modules/inclusions-selections/components/ReviewStageActions";
import { ReviewStatusBanner } from "../../src/modules/inclusions-selections/components/ReviewStatusBanner";
import { ReviewValidationSummary } from "../../src/modules/inclusions-selections/components/ReviewValidationSummary";
import { ReviewViewSwitcher } from "../../src/modules/inclusions-selections/components/ReviewViewSwitcher";
import { RoomReviewPanel } from "../../src/modules/inclusions-selections/components/RoomReviewPanel";
import { VariationReviewTable } from "../../src/modules/inclusions-selections/components/VariationReviewTable";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import type { ReviewView } from "../../src/modules/inclusions-selections/repositories/selectionReviewRepository";
import {
  acknowledgeReviewWarning,
  buildBuilderInternalProjection,
  buildClientVariationProjection,
  calculateCategoryReview,
  calculateRoomReview,
  calculateVariationSummary,
  loadSelectionReview,
  markReadyForApproval,
  overrideAllowance,
  recalculateReviewPricing,
  saveSelectionReview,
  validateReviewReadiness,
  type SelectionReview,
} from "../../src/modules/inclusions-selections/services/selectionReviewService";
import type { DomainIssue } from "../../src/modules/inclusions-selections/validation/errors";

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function paramsFor(context: ProjectSelectionContext, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  params.set("organisationId", context.organisationId);
  params.set("projectId", context.projectId);
  if (context.projectName) params.set("projectName", context.projectName);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

export default function SelectionReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState<SelectionReview | null>(null);
  const [view, setView] = useState<ReviewView>("summary");
  const [issues, setIssues] = useState<DomainIssue[]>([]);
  const [severity, setSeverity] = useState("all");
  const [saving, setSaving] = useState(false);

  const context = useMemo<Partial<ProjectSelectionContext>>(() => ({
    organisationId: queryValue(router.query.organisationId) ?? queryValue(router.query.orgId),
    projectId: queryValue(router.query.projectId),
    projectName: queryValue(router.query.projectName),
    clientName: queryValue(router.query.clientName) ?? queryValue(router.query.client),
    siteAddress: queryValue(router.query.siteAddress),
    jobNumber: queryValue(router.query.jobNumber),
  }), [router.query]);

  useEffect(() => {
    if (!router.isReady || !context.organisationId || !context.projectId) return;
    let cancelled = false;
    loadSelectionReview(context as ProjectSelectionContext).then((loaded) => {
      if (cancelled) return;
      setReview(loaded);
      setView(loaded.reviewState.selectedView);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, context.organisationId, context.projectId]);

  function workspace(areaId?: string, requirementId?: string) {
    if (!review) return;
    router.push(`/inclusions-selections/workspace?${paramsFor(review.context, { areaId, requirementId })}`);
  }

  async function save(next = review) {
    if (!next) return;
    setSaving(true);
    const saved = await saveSelectionReview({ ...next, reviewState: { ...next.reviewState, selectedView: view } });
    setSaving(false);
    setReview(saved);
  }

  async function ready() {
    if (!review) return;
    const result = await markReadyForApproval(review);
    setIssues(result.issues);
    if (result.ok && result.value) setReview(result.value);
  }

  async function continueToApprovals() {
    if (!review) return;
    const validation = validateReviewReadiness(review);
    setIssues(validation.issues);
    if (!validation.ok || !review.reviewState.readyForApproval) return;
    await save(review);
    router.push(`/inclusions-selections/approvals?${paramsFor(review.context)}`);
  }

  async function acknowledge(issueId: string) {
    if (!review) return;
    const result = await acknowledgeReviewWarning(review, issueId, "Acknowledged during Stage 4 review.");
    setIssues(result.issues);
    if (result.ok && result.value) setReview(result.value);
  }

  async function allowanceOverride(requirementId: string) {
    if (!review) return;
    const line = review.lines.find((item) => item.requirement.id === requirementId);
    const result = await overrideAllowance(review, requirementId, line ? line.allowance.amount : 0, "Reviewed allowance during Stage 4.");
    setIssues(result.issues);
    if (result.ok && result.value) setReview(result.value);
  }

  if (router.isReady && (!context.organisationId || !context.projectId)) {
    return <main className="selectionReviewPage"><section className="requiredState"><h1>Review Selections and Variations</h1><p>Open an existing project before reviewing selections.</p></section><style jsx global>{reviewStyles}</style></main>;
  }

  if (!review) {
    return <main className="selectionReviewPage"><section className="requiredState"><h1>Review Selections and Variations</h1><p>Loading selection review.</p></section><style jsx global>{reviewStyles}</style></main>;
  }

  const rooms = calculateRoomReview(review);
  const categories = calculateCategoryReview(review);
  const variations = calculateVariationSummary(review);
  const clientProjection = buildClientVariationProjection(review);
  const builderProjection = buildBuilderInternalProjection(review);

  return (
    <main className="selectionReviewPage">
      <header className="reviewHeader">
        <div>
          <h1>Review Selections and Variations</h1>
          <p>Review all project selections, resolve incomplete items and confirm pricing before sending the schedule for client and builder approval.</p>
        </div>
        <button type="button" onClick={() => workspace()}>Edit in Selection Workspace</button>
      </header>
      <ReviewProjectSummary summary={review.summary} />
      <ReviewStatusBanner status={review.status} reasons={review.statusReasons} />
      <ReviewViewSwitcher value={view} onChange={setView} />
      {view === "summary" && <section className="reviewGrid"><ClientVariationPreview projection={clientProjection} /><BuilderInternalReview projection={builderProjection} /><NotApplicableReview lines={review.lines} onEdit={workspace} /><ProductAvailabilityReview lines={review.lines} onEdit={workspace} /><AllowanceReview lines={review.lines} onOverride={allowanceOverride} /></section>}
      {view === "room" && <RoomReviewPanel groups={rooms} onEdit={workspace} />}
      {view === "category" && <CategoryReviewPanel categories={categories} onEdit={workspace} />}
      {view === "variations" && <VariationReviewTable summary={variations} />}
      {view === "issues" && <ReviewIssuesRegister issues={review.issues} severity={severity} onSeverity={setSeverity} onEdit={workspace} onAcknowledge={acknowledge} />}
      {view === "custom" && <CustomSelectionReview lines={review.lines} onEdit={workspace} />}
      <ReviewValidationSummary issues={issues} />
      <ReviewStageActions
        saving={saving}
        ready={review.reviewState.readyForApproval}
        onSave={() => save()}
        onBack={() => workspace()}
        onRecalculate={async () => setReview(await recalculateReviewPricing(review))}
        onIssues={() => setView("issues")}
        onClientPreview={() => setView("summary")}
        onReady={ready}
        onContinue={continueToApprovals}
      />
      <p className="persistenceNote">Review state, issues, warning acknowledgements, allowance overrides and audit events use in-memory repositories until approved database adapters are added.</p>
      <style jsx global>{reviewStyles}</style>
    </main>
  );
}

const reviewStyles = `
  .selectionReviewPage { min-height: 100vh; background: #f6f7f9; color: #172033; padding: 28px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .reviewHeader, .reviewSummary, .reviewStatus, .reviewViewSwitcher, .reviewPanel, .reviewGrid, .reviewCard, .reviewActions, .persistenceNote, .issuePanel, .validNotice, .requiredState { max-width: 1320px; margin: 0 auto 16px; }
  .reviewHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
  h2, h3 { margin: 0; letter-spacing: 0; }
  p { line-height: 1.5; }
  .reviewHeader p, .reviewCard span, .reviewStatus span, .reviewSummary span, .persistenceNote { color: #5d687c; }
  .reviewSummary { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
  .reviewSummary div, .reviewStatus, .reviewCard, .issuePanel, .validNotice, .requiredState { background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; box-shadow: 0 1px 2px rgba(20,31,51,.04); }
  .reviewSummary div { padding: 12px; }
  .reviewSummary span { display: block; font-size: 12px; margin-bottom: 4px; }
  .reviewStatus, .reviewCard, .issuePanel, .validNotice, .requiredState { padding: 16px; }
  .status-ready_for_approval { border-color: #9fd9b7; background: #ecf8f1; }
  .reviewViewSwitcher, .reviewActions, .reviewMetrics { display: flex; gap: 8px; flex-wrap: wrap; }
  button, select { min-height: 36px; border-radius: 6px; border: 1px solid #cfd8e5; background: #fff; color: #172033; font: inherit; padding: 7px 12px; font-weight: 650; cursor: pointer; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primaryButton, .reviewViewSwitcher .selected { background: #1c4f91; border-color: #1c4f91; color: #fff; }
  .reviewGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .reviewGroup { display: grid; gap: 12px; margin-bottom: 18px; }
  .reviewCard { display: grid; gap: 12px; }
  .reviewCard header, .reviewHeader { display: flex; justify-content: space-between; gap: 12px; }
  .reviewMetrics span { border: 1px solid #e6edf5; border-radius: 6px; padding: 6px 8px; background: #fafcff; }
  .reviewRows { display: grid; gap: 8px; }
  .reviewRow { display: grid; grid-template-columns: 1.6fr repeat(6, minmax(90px, 1fr)); gap: 8px; align-items: center; width: 100%; text-align: left; border: 1px solid #e6edf5; border-radius: 8px; padding: 10px; background: #fbfcfe; }
  .issueCard { display: grid; gap: 7px; border: 1px solid #e6edf5; border-radius: 8px; padding: 10px; }
  .severity-blocking { border-color: #ffd1d1; background: #fff7f7; }
  .severity-warning { border-color: #ffe0a6; background: #fffaf0; }
  .issuePanel { border-color: #ffd1d1; color: #9b2c25; }
  .validNotice { border-color: #b7e2c6; color: #1d6d47; background: #e9f8ef; }
  .reviewActions { justify-content: flex-end; position: sticky; bottom: 0; background: rgba(246,247,249,.95); padding: 14px 0; }
  @media (max-width: 1100px) { .reviewSummary, .reviewGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .reviewRow { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 760px) { .selectionReviewPage { padding: 18px; } h1 { font-size: 28px; } .reviewHeader, .reviewCard header, .reviewActions { align-items: stretch; flex-direction: column; } .reviewSummary, .reviewGrid, .reviewRow { grid-template-columns: 1fr; } }
`;
