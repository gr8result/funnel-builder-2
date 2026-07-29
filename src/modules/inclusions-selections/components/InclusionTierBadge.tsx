import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";

export function InclusionTierBadge({ tierId }: { tierId?: string }) {
  const tier = STANDARD_INCLUSION_TIERS.find((item) => item.id === tierId);
  return <span className={`tierBadge tier-${tier?.code?.toLowerCase() ?? "missing"}`}>{tier?.name ?? "No tier"}</span>;
}
