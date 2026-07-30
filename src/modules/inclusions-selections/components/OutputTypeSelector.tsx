import type { DocumentProjectionType } from "../repositories/documentsExportRepository";

export const outputTypes: Array<{ type: DocumentProjectionType; label: string }> = [
  { type: "client_selection_schedule", label: "Client Selection Schedule" },
  { type: "builder_internal_schedule", label: "Builder Internal Schedule" },
  { type: "site_supervisor_schedule", label: "Site Supervisor Schedule" },
  { type: "room_by_room_schedule", label: "Room-by-Room Schedule" },
  { type: "category_schedule", label: "Category Schedule" },
  { type: "trade_schedule", label: "Trade Schedule" },
  { type: "supplier_schedule", label: "Supplier Schedule" },
  { type: "variation_summary", label: "Variation Summary" },
  { type: "estimate_export_preview", label: "Estimate Export Preview" },
];

export function OutputTypeSelector({ value, onChange }: { value: DocumentProjectionType; onChange: (value: DocumentProjectionType) => void }) {
  return <section className="documentsCard"><h2>Output Type Selector</h2><div className="outputGrid">{outputTypes.map((item) => <button type="button" className={value === item.type ? "selected" : ""} key={item.type} onClick={() => onChange(item.type)}>{item.label}</button>)}</div></section>;
}
