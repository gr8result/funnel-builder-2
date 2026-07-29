import type { ProjectSelection } from "../selections/selectionTypes";

export function RequirementPricingSummary({ selection }: { selection?: ProjectSelection }) {
  const currency = selection?.selectedPrice?.currency ?? selection?.allowance?.currency ?? "AUD";
  const fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency });
  const variation = selection?.variation?.amount ?? 0;
  const state = !selection?.selectedPrice ? "Price missing" : variation > 0 ? "Upgrade" : variation < 0 ? "Credit" : "No change";
  return (
    <div className="pricingSummary">
      <span>Allowance {fmt.format(selection?.allowance?.amount ?? 0)}</span>
      <span>Selected {selection?.selectedPrice ? fmt.format(selection.selectedPrice.amount) : "Missing"}</span>
      <strong>{state}: {fmt.format(variation)}</strong>
    </div>
  );
}
