import type { AreaTypeId, OrganisationId, TemplateId } from "../shared/ids";
import type { RequirementDefinition } from "../requirements/requirementTypes";

export type AreaTemplate = {
  id: TemplateId;
  organisationId?: OrganisationId;
  areaTypeId: AreaTypeId;
  name: string;
  version: number;
  active: boolean;
  requirementDefinitions: RequirementDefinition[];
};
