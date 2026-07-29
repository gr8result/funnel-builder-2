import type { AreaGroupId, AreaTypeId, InclusionTierId, OrganisationId, TemplateId } from "../shared/ids";
import type { TemplateAssignment } from "./templateAssignmentTypes";

export type SavedBuilderTemplateStatus = "active" | "archived";

export type SavedBuilderTemplate = {
  id: string;
  organisationId: OrganisationId;
  name: string;
  description?: string;
  includedAreaTypeIds: AreaTypeId[];
  defaultAreaTemplateIds: Array<{ areaTypeId: AreaTypeId; templateId: TemplateId }>;
  defaultTierId: InclusionTierId;
  groupOverrides: Array<TemplateAssignment & { groupId: AreaGroupId }>;
  areaTypeOverrides: Array<TemplateAssignment & { areaTypeId: AreaTypeId }>;
  areaOverrideRules: TemplateAssignment[];
  status: SavedBuilderTemplateStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};
