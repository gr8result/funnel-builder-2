import type { RequirementCategory, RequirementDefinition } from "../requirements/requirementTypes";
import { STANDARD_REQUIREMENT_CATEGORIES } from "../requirements/standardRequirementCategories";

type Props = {
  title: string;
  definitions: RequirementDefinition[];
  draftTitle: string;
  draftCategory: RequirementCategory;
  onDraftTitle: (value: string) => void;
  onDraftCategory: (value: RequirementCategory) => void;
  onAdd: () => void;
  onRemove: (definitionId: string) => void;
  onMove: (definitionId: string, direction: -1 | 1) => void;
  onApplicability: (definitionId: string, applicability: RequirementDefinition["applicability"]) => void;
  onSave: () => void;
};

export function CustomTemplateEditor(props: Props) {
  return (
    <section className="panel customTemplatePanel">
      <h2>{props.title}</h2>
      <div className="customAddRow">
        <input value={props.draftTitle} onChange={(event) => props.onDraftTitle(event.target.value)} placeholder="Requirement name" />
        <select value={props.draftCategory} onChange={(event) => props.onDraftCategory(event.target.value as RequirementCategory)}>
          {STANDARD_REQUIREMENT_CATEGORIES.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
        <button type="button" onClick={props.onAdd}>Add Requirement</button>
      </div>
      <div className="customRequirementList">
        {props.definitions.map((definition) => (
          <div className="customRequirementRow" key={definition.id}>
            <strong>{definition.title}</strong>
            <span>{definition.category}</span>
            <select value={definition.applicability ?? "required"} onChange={(event) => props.onApplicability(definition.id, event.target.value as RequirementDefinition["applicability"])}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="conditional">Conditional</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
            <button type="button" onClick={() => props.onMove(definition.id, -1)}>Up</button>
            <button type="button" onClick={() => props.onMove(definition.id, 1)}>Down</button>
            <button type="button" onClick={() => props.onRemove(definition.id)}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" className="primaryButton" onClick={props.onSave}>Save Custom Template</button>
    </section>
  );
}
