import type { ProjectReviewSummary } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function ReviewProjectSummary({ summary }: { summary: ProjectReviewSummary }) {
  const items = [
    ["Project", summary.projectName],
    ["Tier", summary.projectTierId ?? "Not set"],
    ["Areas", summary.totalAreas],
    ["Requirements", summary.totalRequirements],
    ["Complete", summary.completedRequirements],
    ["Incomplete Required", summary.incompleteRequiredRequirements],
    ["Optional Pending", summary.optionalPendingRequirements],
    ["Not Applicable", summary.notApplicableRequirements],
    ["Needs Attention", summary.needsAttentionRequirements],
    ["Missing Prices", summary.missingPriceSelections],
    ["Provisional", summary.provisionalPriceSelections],
    ["Custom", summary.customSelections],
    ["Unavailable", summary.unavailableProducts],
    ["Allowance", currency.format(summary.totalIncludedAllowance.amount)],
    ["Selected", currency.format(summary.totalSelectedValue.amount)],
    ["Credits", currency.format(summary.totalCredits.amount)],
    ["Upgrades", currency.format(summary.totalUpgrades.amount)],
    ["Net Variation", currency.format(summary.netDraftVariation.amount)],
    ["GST", currency.format(summary.gstAmount.amount)],
    ["Saved", summary.lastSavedStatus],
    ["Ready", summary.readyForApproval ? "Ready for Approval" : "Not ready"],
  ];
  return <section className="reviewSummary">{items.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}
