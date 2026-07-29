import type { AreaGroupId, OrganisationId } from "../shared/ids";

export type AreaGroupKind = "internal" | "external" | "service" | "whole_project";

export type AreaGroup = {
  id: AreaGroupId;
  organisationId?: OrganisationId;
  code: string;
  name: string;
  kind: AreaGroupKind;
  displayOrder: number;
  active: boolean;
};
