import type { InclusionTierId, OrganisationId } from "../shared/ids";

export type InclusionTier = {
  id: InclusionTierId;
  organisationId?: OrganisationId;
  code: string;
  name: string;
  rank: number;
  description?: string;
  active: boolean;
};
