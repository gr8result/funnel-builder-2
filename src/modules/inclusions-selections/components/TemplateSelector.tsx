import type { AreaTemplate } from "../templates/templateTypes";

type Props = {
  label: string;
  value?: string;
  areaTypeId?: string;
  templates: AreaTemplate[];
  onChange: (templateId: string) => void;
};

export function TemplateSelector({ label, value = "", areaTypeId, templates, onChange }: Props) {
  const options = templates.filter((template) => template.active && (!areaTypeId || template.areaTypeId === areaTypeId));
  return (
    <label className="fieldLabel">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Inherited standard template</option>
        {options.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
    </label>
  );
}
