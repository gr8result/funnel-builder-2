import type { RequirementWorkspaceRow } from "../services/selectionWorkspaceService";

export function StandardInclusionPanel({ row }: { row: RequirementWorkspaceRow }) {
  if (!row.standardInclusion) {
    return <div className="standardPanel"><strong>STANDARD INCLUSION</strong><p>No preset product has been assigned. Select a product or create a custom selection.</p></div>;
  }
  return (
    <div className="standardPanel">
      <strong>STANDARD INCLUSION</strong>
      <p>{row.standardInclusion.name}</p>
      <span>{[row.standardInclusion.brand, row.standardInclusion.model, row.standardInclusion.colour].filter(Boolean).join(" · ")}</span>
      <span>{row.standardInclusion.supplierId ?? "No supplier"} · {row.standardInclusion.active ? "Active" : "Unavailable"}</span>
    </div>
  );
}
