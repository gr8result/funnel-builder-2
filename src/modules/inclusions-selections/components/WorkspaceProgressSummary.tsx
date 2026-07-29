import type { SelectionWorkspaceState } from "../services/selectionWorkspaceService";
import { getSelectionProgress } from "../services/selectionWorkspaceService";
import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";

export function WorkspaceProgressSummary({ state }: { state: SelectionWorkspaceState }) {
  const progress = getSelectionProgress(state);
  const tier = STANDARD_INCLUSION_TIERS.find((item) => item.id === state.templateStage.configuration.projectDefault.tierId);
  const fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: progress.currency || "AUD" });
  return (
    <section className="workspaceSummary" aria-label="Project progress summary">
      <div><span>Project</span><strong>{state.context.projectName || state.context.projectId}</strong></div>
      <div><span>Project tier</span><strong>{tier?.name ?? "Not set"}</strong></div>
      <div><span>ProjectAreas</span><strong>{progress.totalAreas}</strong></div>
      <div><span>Requirements</span><strong>{progress.totalRequirements}</strong></div>
      <div><span>Complete</span><strong>{progress.completedRequirements}</strong></div>
      <div><span>Incomplete</span><strong>{progress.incompleteRequirements}</strong></div>
      <div><span>Optional</span><strong>{progress.optionalRequirements}</strong></div>
      <div><span>Not Applicable</span><strong>{progress.notApplicableRequirements}</strong></div>
      <div><span>Needs Attention</span><strong>{progress.needsAttentionRequirements}</strong></div>
      <div><span>Draft variation</span><strong>{fmt.format(progress.netVariation)}</strong></div>
      <div><span>Last saved</span><strong>{state.draftState.savedStatus.replace(/_/g, " ")}</strong></div>
    </section>
  );
}
