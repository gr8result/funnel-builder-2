import PricingCard, { pricingCardStyles } from "./PricingCard";

export default function PricingPlans({
  plans = [],
  mode = "marketing",
  currentPlanId = "",
  getDeltaLabel,
  getButtonLabel,
  onSelectPlan,
}) {
  return (
    <div style={pricingCardStyles.grid}>
      {plans.map((plan) => {
        const isCurrent = mode === "billing" && plan.id === currentPlanId;
        return (
          <PricingCard
            key={plan.id}
            plan={plan}
            mode={mode}
            isCurrent={isCurrent}
            deltaLabel={getDeltaLabel?.(plan) || ""}
            buttonLabel={getButtonLabel?.(plan) || (isCurrent ? "Current Plan" : "Select Plan")}
            onSelect={onSelectPlan}
          />
        );
      })}
    </div>
  );
}
