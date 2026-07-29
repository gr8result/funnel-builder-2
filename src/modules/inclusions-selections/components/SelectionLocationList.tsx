import type { SelectionLocation } from "../selections/selectionLocationTypes";

export function SelectionLocationList({ locations }: { locations: SelectionLocation[] }) {
  if (locations.length === 0) return <p className="muted">No selection locations yet.</p>;
  return (
    <details className="locationList">
      <summary>Applied to {locations.length} locations</summary>
      {locations.map((location) => <div key={location.id}>{location.label} - quantity {location.quantity} {location.unit}</div>)}
    </details>
  );
}
