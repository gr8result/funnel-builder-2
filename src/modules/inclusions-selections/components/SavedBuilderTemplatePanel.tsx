import type { SavedBuilderTemplate } from "../templates/savedBuilderTemplateTypes";

type Props = {
  templates: SavedBuilderTemplate[];
  draftName: string;
  onDraftName: (value: string) => void;
  onSaveCurrent: () => void;
  onApply: (template: SavedBuilderTemplate) => void;
  onRename: (template: SavedBuilderTemplate) => void;
  onDuplicate: (template: SavedBuilderTemplate) => void;
  onArchive: (template: SavedBuilderTemplate) => void;
};

export function SavedBuilderTemplatePanel(props: Props) {
  return (
    <section className="panel savedTemplatePanel">
      <div className="panelHead">
        <h2>Saved Builder Templates</h2>
      </div>
      <div className="customAddRow">
        <input value={props.draftName} onChange={(event) => props.onDraftName(event.target.value)} placeholder="Template name" />
        <button type="button" onClick={props.onSaveCurrent}>Save Current</button>
      </div>
      {props.templates.length === 0 ? <p>No saved builder templates yet.</p> : props.templates.map((template) => (
        <article className="savedTemplateItem" key={template.id}>
          <div>
            <strong>{template.name}</strong>
            <p>{template.description || `${template.includedAreaTypeIds.length} area types · version ${template.version}`}</p>
          </div>
          <div className="rowActions">
            <button type="button" onClick={() => props.onApply(template)}>Apply</button>
            <button type="button" onClick={() => props.onRename(template)}>Rename</button>
            <button type="button" onClick={() => props.onDuplicate(template)}>Duplicate</button>
            <button type="button" onClick={() => props.onArchive(template)}>Archive</button>
          </div>
        </article>
      ))}
    </section>
  );
}
