import { projectEstimatePageDefinitionFor } from "./ProjectEstimateRegistry";

export function ProjectEstimateEditor({ page, block, readonly, renderField, renderFallback }: any) {
  const definition = projectEstimatePageDefinitionFor(page?.page_type || page?.id);
  if (!definition) return renderFallback ? renderFallback() : null;
  return (
    <div>
      {definition.editorFields.map((field) => renderField ? renderField(field, block) : null)}
    </div>
  );
}

export default ProjectEstimateEditor;
