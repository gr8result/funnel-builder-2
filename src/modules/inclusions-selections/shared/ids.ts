export type OrganisationId = string;
export type ProjectId = string;
export type AreaGroupId = string;
export type AreaTypeId = string;
export type ProjectLevelId = string;
export type ProjectAreaId = string;
export type TemplateId = string;
export type RequirementId = string;
export type RequirementDefinitionId = string;
export type InclusionTierId = string;
export type ProductReferenceId = string;
export type ProductVariantId = string;
export type SupplierId = string;
export type SelectionId = string;
export type ApprovalId = string;
export type SnapshotId = string;
export type AuditEntryId = string;

export type ScopedEntity = {
  id: string;
  organisationId: OrganisationId;
};

export type ProjectScopedEntity = ScopedEntity & {
  projectId: ProjectId;
};

export function makeScopedId(prefix: string, parts: Array<string | number | undefined | null>): string {
  return [prefix, ...parts.filter((part) => part !== undefined && part !== null && String(part).length > 0)]
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("_");
}
