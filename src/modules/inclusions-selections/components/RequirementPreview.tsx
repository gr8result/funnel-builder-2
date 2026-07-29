import type { RequirementReconciliationResult } from "../services/templateStageService";

export function RequirementPreview({ preview }: { preview: RequirementReconciliationResult | null }) {
  if (!preview) return <section className="panel previewPanel"><h2>Requirement Preview</h2><p>Select Preview Effect or an area preview to see requirement changes.</p></section>;
  const totals = [
    ["Add", preview.added.length],
    ["Keep", preview.unchanged.length],
    ["Update", preview.updated.length],
    ["Removable", preview.removable.length],
    ["Protected", preview.protected.length],
  ];
  return (
    <section className="panel previewPanel" aria-live="polite">
      <div className="panelHead"><h2>Requirement Preview</h2></div>
      <div className="previewTotals">{totals.map(([label, count]) => <span key={label}>{label}: {count}</span>)}</div>
      <div className="previewList">
        {preview.preview.slice(0, 80).map((item) => (
          <div className={`previewItem action-${item.action}`} key={`${item.requirement.id}-${item.action}`}>
            <strong>{item.requirement.title}</strong>
            <span>{item.requirement.category} · {item.requirement.applicability ?? (item.requirement.required ? "required" : "optional")}</span>
            <em>{item.action}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
