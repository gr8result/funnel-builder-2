import type { InclusionTier } from "./inclusionTierTypes";

export const STANDARD_INCLUSION_TIERS: InclusionTier[] = [
  { id: "tier_foundation", code: "FOUNDATION", name: "Foundation", rank: 10, active: true },
  { id: "tier_classic", code: "CLASSIC", name: "Classic", rank: 20, active: true },
  { id: "tier_premium", code: "PREMIUM", name: "Premium", rank: 30, active: true },
  { id: "tier_signature", code: "SIGNATURE", name: "Signature", rank: 40, active: true },
];
