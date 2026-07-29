import type { InclusionTier } from "./inclusionTierTypes";

export const STANDARD_INCLUSION_TIERS: InclusionTier[] = [
  { id: "tier_classic", code: "CLASSIC", name: "Classic", rank: 10, description: "Practical entry-level inclusions.", active: true },
  { id: "tier_premier", code: "PREMIER", name: "Premier", rank: 20, description: "The builder's normal standard inclusions.", active: true },
  { id: "tier_premium", code: "PREMIUM", name: "Premium", rank: 30, description: "Higher-specification finishes and products.", active: true },
  { id: "tier_custom", code: "CUSTOM", name: "Custom", rank: 40, description: "No preset product defaults. Requirements remain ready for manual configuration.", active: true },
];
