import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ApprovalFingerprintPanel } from "../../src/modules/inclusions-selections/components/ApprovalFingerprintPanel";
import { ApprovalHistoryTimeline } from "../../src/modules/inclusions-selections/components/ApprovalHistoryTimeline";
import { ApprovalProjectSummary } from "../../src/modules/inclusions-selections/components/ApprovalProjectSummary";
import { ApprovalStageActions } from "../../src/modules/inclusions-selections/components/ApprovalStageActions";
import { ApprovalStatusBanner } from "../../src/modules/inclusions-selections/components/ApprovalStatusBanner";
import { ApprovalValidationSummary } from "../../src/modules/inclusions-selections/components/ApprovalValidationSummary";
import { BuilderApprovalActions } from "../../src/modules/inclusions-selections/components/BuilderApprovalActions";
import { BuilderApprovalPackage } from "../../src/modules/inclusions-selections/components/BuilderApprovalPackage";
import { ClientApprovalActions } from "../../src/modules/inclusions-selections/components/ClientApprovalActions";
import { ClientApprovalPackage } from "../../src/modules/inclusions-selections/components/ClientApprovalPackage";
import { ClientChangesRequestedPanel } from "../../src/modules/inclusions-selections/components/ClientChangesRequestedPanel";
import { CreateSnapshotPanel } from "../../src/modules/inclusions-selections/components/CreateSnapshotPanel";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { SnapshotComparisonPanel } from "../../src/modules/inclusions-selections/components/SnapshotComparisonPanel";
import { SnapshotReadinessChecklist } from "../../src/modules/inclusions-selections/components/SnapshotReadinessChecklist";
import { SnapshotVersionHistory } from "../../src/modules/inclusions-selections/components/SnapshotVersionHistory";
import { StaleApprovalWarning } from "../../src/modules/inclusions-selections/components/StaleApprovalWarning";
import { loadDemonstrationProject, resetDemonstrationProject } from "../../src/modules/inclusions-selections/demo/demoProject";
import { approvalStageRepository } from "../../src/modules/inclusions-selections/repositories/approvalStageRepository";
import { selectionReviewRepository } from "../../src/modules/inclusions-selections/repositories/selectionReviewRepository";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import type { DomainIssue } from "../../src/modules/inclusions-selections/validation/errors";
import {
  compareSelectionSnapshots,
  createLockedSelectionSnapshot,
  loadApprovalStage,
  prepareClientReview,
  recordApprovalStageStatus,
  recordBuilderApproval,
  recordClientApproval,
  recordClientChangesRequested,
  revokeBuilderApproval,
  revokeClientApproval,
  saveApprovalStage,
  startNewDraftRevision,
  type ApprovalInput,
  type ApprovalStage,
} from "../../src/modules/inclusions-selections/services/approvalStageService";

const baseInput: ApprovalInput = {
  approverName: "",
  approverRole: "",
  method: "in_app",
  declaration: "I approve the selections shown for this approval version.",
  comments: "",
  recordedBy: "builder",
};

export default function SelectionApprovalsPage() {
  const router = useRouter();
  const [stage, setStage] = useState<ApprovalStage | null>(null);
  const [clientInput, setClientInput] = useState<ApprovalInput>({ ...baseInput, recordedByRepresentative: true });
  const [builderInput, setBuilderInput] = useState<ApprovalInput>({ ...baseInput, approverRole: "Builder", declaration: "I approve the internal builder review for this selection version." });
  const [issues, setIssues] = useState<DomainIssue[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);
  const hasProjectContext = Boolean(context.organisationId && context.projectId);

  const loadStage = useCallback(async () => {
    if (!hasProjectContext) {
      setStage(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setIssues([]);
      setStage(await loadApprovalStage(context as ProjectSelectionContext));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval stage could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [context, hasProjectContext]);

  useEffect(() => {
    void loadStage();
  }, [loadStage]);

  const run = async (action: (current: ApprovalStage) => Promise<ApprovalStage | { ok: boolean; value?: ApprovalStage; issues: DomainIssue[] }>, success: string) => {
    if (!stage) return;
    try {
      setIssues([]);
      const result = await action(stage);
      if ("ok" in result) {
        if (!result.ok) {
          setIssues(result.issues);
          setMessage("Approval action needs attention.");
          return;
        }
        setStage(result.value ?? stage);
      } else {
        setStage(result);
      }
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval action failed. Please review the current project state and try again.");
    }
  };

  async function loadDemoApprovalState(approvalState: "pending" | "approved" | "reset") {
    const demoContext = approvalState === "reset"
      ? await resetDemonstrationProject()
      : await loadDemonstrationProject({ approvalState, reset: true });
    setMessage(approvalState === "approved" ? "Fully approved demonstration state loaded. This is not a legal digital signature." : "Pending approval demonstration state loaded.");
    await router.push(hrefForStage("approvals", demoContext));
  }

  const snapshots = stage ? [...stage.snapshots].sort((a, b) => b.version - a.version) : [];
  const comparison = snapshots.length >= 2 ? compareSelectionSnapshots(snapshots[1], snapshots[0]) : [];
  const locked = Boolean(snapshots[0]?.status === "locked" && snapshots[0].sourceFingerprint === stage?.currentFingerprint);

  return (
    <main className="approvalPage">
      <InclusionsSelectionsStageNav currentStage="approvals" context={stage?.context ?? context} />
      <header className="approvalHero">
        <div>
          <p>Inclusions and Selections</p>
          <h1>Approvals and Locked Selection Version</h1>
          <span>Review and approve the completed selections. Client and builder approvals must match the same reviewed version before the selections can be locked.</span>
        </div>
      </header>
      {!hasProjectContext ? <section className="issuePanel">{PROJECT_REQUIRED_MESSAGE}</section> : null}
      {loading ? <section className="approvalCard">Loading approvals...</section> : null}
      {message ? <section className="validNotice">{message}</section> : null}
      <ApprovalValidationSummary issues={issues} />
      <section className="demoApprovalPanel">
        <div>
          <strong>Development approval demos</strong>
          <p>These actions load Johnson Residence demonstration approval states only. They do not create legal digital signatures.</p>
        </div>
        <button type="button" onClick={() => void loadDemoApprovalState("pending")}>Load Pending Approval Demo</button>
        <button type="button" className="primaryButton" onClick={() => void loadDemoApprovalState("approved")}>Load Fully Approved Demo</button>
        <button type="button" onClick={() => void loadDemoApprovalState("reset")}>Reset Demo Approval State</button>
      </section>
      {stage ? (
        <>
          <ApprovalStatusBanner stage={stage} />
          <StaleApprovalWarning stage={stage} />
          <ApprovalProjectSummary stage={stage} />
          <ApprovalStageActions
            locked={locked}
            onSave={() => void run((current) => saveApprovalStage(current), "Approval state saved.")}
            onBack={() => void router.push(hrefForStage("review", stage.context))}
            onClient={() => document.getElementById("client-approval-package")?.scrollIntoView({ behavior: "smooth" })}
            onBuilder={() => document.getElementById("builder-approval-package")?.scrollIntoView({ behavior: "smooth" })}
            onChanges={() => void run((current) => recordClientChangesRequested(current, "Client requested changes.", undefined, { approval: approvalStageRepository, review: selectionReviewRepository }), "Changes requested and approvals invalidated.")}
            onSnapshot={() => void run((current) => createLockedSelectionSnapshot(current), "Locked selection snapshot created.")}
            onRevision={() => void run(async (current) => {
              await startNewDraftRevision(current);
              return loadApprovalStage(current.context);
            }, "New editable revision started.")}
            onContinue={() => void router.push(hrefForStage("documents-export", stage.context))}
          />
          <ApprovalFingerprintPanel stage={stage} />
          <SnapshotReadinessChecklist readiness={stage.readiness} />
          <div id="client-approval-package">
            <ClientApprovalPackage stage={stage} />
          </div>
          <ClientApprovalActions
            input={clientInput}
            onChange={setClientInput}
            onPrepare={() => void run((current) => prepareClientReview(current), "Client review prepared.")}
            onSent={() => void run((current) => recordApprovalStageStatus(current, "sent_for_review"), "Client review marked as sent.")}
            onReviewing={() => void run((current) => recordApprovalStageStatus(current, "client_reviewing"), "Client reviewing status recorded.")}
            onChanges={() => void run((current) => recordClientChangesRequested(current, "Client requested changes.", undefined, { approval: approvalStageRepository, review: selectionReviewRepository }), "Changes requested and approvals invalidated.")}
            onApprove={() => void run((current) => recordClientApproval(current, clientInput, approvalStageRepository), "Client approval recorded.")}
            onRevoke={() => void run((current) => revokeClientApproval(current, "Client approval revoked."), "Client approval revoked.")}
          />
          <ClientChangesRequestedPanel onReturn={() => void router.push(hrefForStage("workspace", stage.context))} />
          <div id="builder-approval-package">
            <BuilderApprovalPackage stage={stage} />
          </div>
          <BuilderApprovalActions input={builderInput} onChange={setBuilderInput} onApprove={() => void run((current) => recordBuilderApproval(current, builderInput, approvalStageRepository), "Builder approval recorded.")} onRevoke={() => void run((current) => revokeBuilderApproval(current, "Builder approval revoked."), "Builder approval revoked.")} />
          <CreateSnapshotPanel stage={stage} onCreate={() => void run((current) => createLockedSelectionSnapshot(current), "Locked selection snapshot created.")} />
          <SnapshotVersionHistory stage={stage} />
          {comparison.length ? <SnapshotComparisonPanel changes={comparison} /> : null}
          <ApprovalHistoryTimeline stage={stage} />
        </>
      ) : null}
      <style jsx>{`
        .approvalPage { min-height: 100vh; background: #f6f7f9; color: #172033; padding: 28px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .approvalHero { margin: 0 auto 18px; max-width: 1180px; }
        .approvalHero p { margin: 0 0 6px; color: #657083; font-size: 13px; font-weight: 700; text-transform: uppercase; }
        .approvalHero h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
        .approvalHero span { display: block; max-width: 840px; color: #536072; line-height: 1.5; }
        :global(.approvalCard), :global(.approvalStatus), :global(.approvalSummary), :global(.issuePanel), :global(.validNotice) { max-width: 1180px; margin: 0 auto 14px; background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 18px; }
        :global(.approvalCard h2) { margin: 0 0 12px; font-size: 20px; letter-spacing: 0; }
        :global(.approvalCard h3) { margin: 16px 0 8px; font-size: 16px; letter-spacing: 0; }
        :global(.approvalSummary) { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        :global(.approvalSummary div) { border: 1px solid #e6ecf3; border-radius: 6px; padding: 10px; background: #fbfcfe; min-width: 0; }
        :global(.approvalSummary span), :global(.approvalStatus span) { display: block; color: #647082; font-size: 12px; }
        :global(.approvalSummary strong), :global(.approvalStatus strong) { display: block; margin-top: 4px; overflow-wrap: anywhere; }
        :global(.approvalActions), :global(.approvalButtons), :global(.approvalFields) { max-width: 1180px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 10px; }
        .demoApprovalPanel { max-width: 1180px; margin: 0 auto 14px; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .demoApprovalPanel div { flex: 1 1 360px; }
        .demoApprovalPanel p { margin: 4px 0 0; color: #155e75; }
        :global(button), :global(input), :global(select) { border: 1px solid #cfd8e3; border-radius: 6px; min-height: 38px; padding: 8px 10px; background: #fff; color: #172033; font: inherit; }
        :global(button) { cursor: pointer; font-weight: 700; }
        :global(button:disabled) { color: #94a0af; cursor: not-allowed; }
        :global(.primaryButton) { background: #155e75; border-color: #155e75; color: #fff; }
        :global(.approvalRows) { display: grid; gap: 8px; }
        :global(.approvalRow) { display: grid; grid-template-columns: 1.4fr repeat(5, minmax(110px, 1fr)); gap: 8px; align-items: center; border: 1px solid #e6ecf3; border-radius: 6px; padding: 10px; overflow-wrap: anywhere; }
        :global(.historyTimeline) { display: grid; gap: 10px; }
        :global(.historyTimeline article) { border-left: 3px solid #155e75; padding-left: 12px; display: grid; gap: 4px; }
        :global(.issuePanel) { border-color: #fecaca; background: #fff7f7; color: #7f1d1d; }
        :global(.validNotice) { border-color: #bbf7d0; background: #f0fdf4; color: #14532d; }
        :global(.ok) { color: #166534; }
        :global(.blocked) { color: #991b1b; }
        @media (max-width: 760px) {
          .approvalPage { padding: 18px; }
          .approvalHero h1 { font-size: 26px; }
          :global(.approvalSummary) { grid-template-columns: 1fr; }
          :global(.approvalActions), :global(.approvalButtons), :global(.approvalFields) { display: grid; grid-template-columns: 1fr; }
          .demoApprovalPanel { display: grid; grid-template-columns: 1fr; }
          :global(.approvalRow) { grid-template-columns: 1fr; }
          :global(button), :global(input), :global(select) { width: 100%; }
        }
      `}</style>
    </main>
  );
}
