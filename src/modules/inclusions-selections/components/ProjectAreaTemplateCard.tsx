import type { ProjectArea } from "../areas/projectAreaTypes";
import type { TemplateStageState } from "../services/templateStageService";
import { previewRequirementGeneration, resolveEffectiveTemplateAssignment } from "../services/templateStageService";
import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import { InclusionTierBadge } from "./InclusionTierBadge";
import { InheritanceSourceLabel } from "./InheritanceSourceLabel";
import { TemplateSelector } from "./TemplateSelector";

type Props = {
  state: TemplateStageState;
  area: ProjectArea;
  onTemplate: (templateId: string) => void;
  onTier: (tierId: string) => void;
  onCustom: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  onReset: () => void;
};

export function ProjectAreaTemplateCard({ state, area, onTemplate, onTier, onCustom, onPreview, onGenerate, onReset }: Props) {
  const effective = resolveEffectiveTemplateAssignment(state, area);
  const areaType = STANDARD_AREA_TYPES.find((item) => item.id === area.areaTypeId);
  const group = STANDARD_AREA_GROUPS.find((item) => item.id === area.groupId);
  const level = state.areaRegister.levels.find((item) => item.id === area.levelId);
  const requirementCount = state.requirements.filter((requirement) => requirement.areaId === area.id).length;
  const preview = previewRequirementGeneration(state, "project_area", area.id);
  const status = effective.mode === "custom" && preview.added.length === 0 && requirementCount === 0
    ? "Custom Template Empty"
    : !effective.templateId
      ? "Missing Template"
      : preview.added.length || preview.updated.length || preview.removable.length
        ? "Requirements Need Reconciliation"
        : requirementCount > 0
          ? "Ready"
          : effective.sourceLabel;
  return (
    <article className="areaTemplateCard">
      <div className="areaCardHeader">
        <div>
          <h4>{area.name}</h4>
          <p>{areaType?.name ?? area.areaTypeId} · {group?.name ?? area.groupId} · {level?.name ?? "Unassigned"}</p>
        </div>
        <span className="statusPill">{status}</span>
      </div>
      <div className="areaControls">
        <TemplateSelector label="AreaTemplate" value={effective.templateId} areaTypeId={area.areaTypeId} templates={state.templates} onChange={onTemplate} />
        <label className="fieldLabel">
          <span>InclusionTier</span>
          <select value={effective.tierId ?? ""} onChange={(event) => onTier(event.target.value)}>
            <option value="">Inherit tier</option>
            <option value="tier_classic">Classic</option>
            <option value="tier_premier">Premier</option>
            <option value="tier_premium">Premium</option>
            <option value="tier_custom">Custom</option>
          </select>
        </label>
      </div>
      <div className="areaMeta">
        <InclusionTierBadge tierId={effective.tierId} />
        <InheritanceSourceLabel label={effective.sourceLabel} />
        <span>{requirementCount} requirements</span>
      </div>
      <div className="rowActions">
        <button type="button" onClick={onCustom}>Custom</button>
        <button type="button" onClick={onPreview}>Preview</button>
        <button type="button" onClick={onGenerate}>Generate</button>
        <button type="button" onClick={onReset}>Reset</button>
      </div>
    </article>
  );
}
