import { useState } from "react";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { TemplateStageState } from "../services/templateStageService";
import { previewRequirementGeneration, resolveEffectiveTemplateAssignment } from "../services/templateStageService";
import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { AreaTypeTemplateRow } from "./AreaTypeTemplateRow";
import { ProjectAreaTemplateCard } from "./ProjectAreaTemplateCard";
import { InclusionTierBadge } from "./InclusionTierBadge";

type Props = {
  state: TemplateStageState;
  groupId: string;
  areas: ProjectArea[];
  onGroupTier: (tierId: string) => void;
  onGroupTemplate: (templateId: string) => void;
  onTypeTier: (areaTypeId: string, tierId: string) => void;
  onTypeTemplate: (areaTypeId: string, templateId: string) => void;
  onAreaTier: (areaId: string, tierId: string) => void;
  onAreaTemplate: (areaId: string, templateId: string) => void;
  onAreaCustom: (areaId: string) => void;
  onPreview: (scope: "area_group" | "area_type" | "project_area", id: string) => void;
  onGenerate: (areaId: string) => void;
  onReset: (scope: "area_group" | "area_type" | "project_area", id: string) => void;
};

export function AreaGroupTemplateSection(props: Props) {
  const [expanded, setExpanded] = useState(true);
  const group = STANDARD_AREA_GROUPS.find((item) => item.id === props.groupId);
  const firstEffective = props.areas[0] ? resolveEffectiveTemplateAssignment(props.state, props.areas[0]) : null;
  const preview = previewRequirementGeneration(props.state, "area_group", props.groupId);
  const typeGroups = props.areas.reduce<Record<string, ProjectArea[]>>((acc, area) => {
    acc[area.areaTypeId] = [...(acc[area.areaTypeId] ?? []), area];
    return acc;
  }, {});
  const complete = props.areas.filter((area) => props.state.requirements.some((requirement) => requirement.areaId === area.id)).length;
  const attention = props.areas.length - complete + preview.added.length + preview.updated.length + preview.removable.length;
  return (
    <section className="panel groupSection">
      <div className="groupHeader">
        <button type="button" className="expandButton" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide" : "Show"}</button>
        <div>
          <h2>{group?.name ?? props.groupId}</h2>
          <p>{props.areas.length} project areas · {complete} complete · {attention} requiring attention</p>
        </div>
        <InclusionTierBadge tierId={firstEffective?.tierId} />
        <select value={firstEffective?.tierId ?? ""} onChange={(event) => props.onGroupTier(event.target.value)} aria-label={`Apply tier to ${group?.name ?? props.groupId}`}>
          <option value="">Inherited tier</option>
          <option value="tier_classic">Classic</option>
          <option value="tier_premier">Premier</option>
          <option value="tier_premium">Premium</option>
          <option value="tier_custom">Custom</option>
        </select>
        <div className="rowActions">
          <button type="button" onClick={() => props.onPreview("area_group", props.groupId)}>Preview</button>
          <button type="button" onClick={() => props.onReset("area_group", props.groupId)}>Reset</button>
        </div>
      </div>
      {expanded ? (
        <div className="groupBody">
          <div className="areaTypeList">
            {Object.entries(typeGroups).map(([areaTypeId, areas]) => (
              <AreaTypeTemplateRow
                key={areaTypeId}
                state={props.state}
                areaTypeId={areaTypeId}
                areas={areas}
                onTemplate={(templateId) => props.onTypeTemplate(areaTypeId, templateId)}
                onTier={(tierId) => props.onTypeTier(areaTypeId, tierId)}
                onPreview={() => props.onPreview("area_type", areaTypeId)}
                onReset={() => props.onReset("area_type", areaTypeId)}
              />
            ))}
          </div>
          <div className="projectAreaCards">
            {props.areas.map((area) => (
              <ProjectAreaTemplateCard
                key={area.id}
                state={props.state}
                area={area}
                onTemplate={(templateId) => props.onAreaTemplate(area.id, templateId)}
                onTier={(tierId) => props.onAreaTier(area.id, tierId)}
                onCustom={() => props.onAreaCustom(area.id)}
                onPreview={() => props.onPreview("project_area", area.id)}
                onGenerate={() => props.onGenerate(area.id)}
                onReset={() => props.onReset("project_area", area.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
