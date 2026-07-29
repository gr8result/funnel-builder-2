import type { ProjectArea } from "../areas/projectAreaTypes";
import type { TemplateStageState } from "../services/templateStageService";
import { resolveEffectiveTemplateAssignment } from "../services/templateStageService";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import { TemplateSelector } from "./TemplateSelector";
import { InclusionTierBadge } from "./InclusionTierBadge";

type Props = {
  state: TemplateStageState;
  areaTypeId: string;
  areas: ProjectArea[];
  onTemplate: (templateId: string) => void;
  onTier: (tierId: string) => void;
  onPreview: () => void;
  onReset: () => void;
};

export function AreaTypeTemplateRow({ state, areaTypeId, areas, onTemplate, onTier, onPreview, onReset }: Props) {
  const areaType = STANDARD_AREA_TYPES.find((item) => item.id === areaTypeId);
  const firstEffective = areas[0] ? resolveEffectiveTemplateAssignment(state, areas[0]) : null;
  return (
    <div className="areaTypeRow">
      <div>
        <strong>All {areaType?.name ?? areaTypeId}</strong>
        <span>{areas.length} ProjectAreas</span>
      </div>
      <TemplateSelector label="Template" value={firstEffective?.templateId} areaTypeId={areaTypeId} templates={state.templates} onChange={onTemplate} />
      <label className="fieldLabel compact">
        <span>Tier</span>
        <select value={firstEffective?.tierId ?? ""} onChange={(event) => onTier(event.target.value)}>
          <option value="">Inherited</option>
          <option value="tier_classic">Classic</option>
          <option value="tier_premier">Premier</option>
          <option value="tier_premium">Premium</option>
          <option value="tier_custom">Custom</option>
        </select>
      </label>
      <InclusionTierBadge tierId={firstEffective?.tierId} />
      <div className="rowActions">
        <button type="button" onClick={onPreview}>Preview</button>
        <button type="button" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
