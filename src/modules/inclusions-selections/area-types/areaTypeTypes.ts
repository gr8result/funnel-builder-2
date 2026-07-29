import type { AreaGroupId, AreaTypeId, OrganisationId } from "../shared/ids";

export type AreaTypeTrait = "internal" | "external" | "wet_area" | "private" | "service" | "trafficable";

export type AreaType = {
  id: AreaTypeId;
  organisationId?: OrganisationId;
  groupId: AreaGroupId;
  code: string;
  name: string;
  traits: AreaTypeTrait[];
  displayOrder: number;
  active: boolean;
};
