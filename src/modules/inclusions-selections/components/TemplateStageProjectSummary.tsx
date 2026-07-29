import type { TemplateStageState } from "../services/templateStageService";
import { canContinueToTemplates } from "../services/projectAreaRegisterService";
import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";

export function TemplateStageProjectSummary({ state, requiringAttention }: { state: TemplateStageState; requiringAttention: number }) {
  const tier = STANDARD_INCLUSION_TIERS.find((item) => item.id === state.configuration.projectDefault.tierId);
  const configured = state.areaRegister.areas.length - requiringAttention;
  return (
    <section className="summaryBar templateSummary" aria-label="Project summary">
      <div><span>Project</span><strong>{state.context.projectName || state.context.projectId}</strong></div>
      <div><span>Client</span><strong>{state.context.clientName || "Not recorded"}</strong></div>
      <div><span>Site</span><strong>{state.context.siteAddress || "Not recorded"}</strong></div>
      <div><span>Project ID</span><strong>{state.context.projectId}</strong></div>
      <div><span>ProjectAreas</span><strong>{state.areaRegister.areas.length}</strong></div>
      <div><span>ProjectLevels</span><strong>{state.areaRegister.levels.filter((level) => level.active).length}</strong></div>
      <div><span>Whole-project tier</span><strong>{tier?.name ?? "Not set"}</strong></div>
      <div><span>Configured</span><strong>{configured} ready / {requiringAttention} attention</strong></div>
    </section>
  );
}
