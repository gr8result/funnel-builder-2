import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";

export type InclusionsSelectionsStageId = "areas" | "templates" | "workspace" | "review" | "approvals" | "documents-export";

export type InclusionsSelectionsStage = {
  id: InclusionsSelectionsStageId;
  label: string;
  route: string;
};

export const INCLUSIONS_SELECTIONS_STAGES: InclusionsSelectionsStage[] = [
  { id: "areas", label: "Areas", route: "/inclusions-selections/areas" },
  { id: "templates", label: "Select Area", route: "/inclusions-selections/templates" },
  { id: "workspace", label: "Selections", route: "/inclusions-selections/workspace" },
  { id: "review", label: "Review", route: "/inclusions-selections/review" },
  { id: "approvals", label: "Approvals", route: "/inclusions-selections/approvals" },
  { id: "documents-export", label: "Documents & Export", route: "/inclusions-selections/documents-export" },
];

export const PROJECT_REQUIRED_MESSAGE = "Select, open or import a project before starting Inclusions & Selections.";

export function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function contextFromQuery(query: Record<string, string | string[] | undefined>): Partial<ProjectSelectionContext> {
  return {
    organisationId: queryValue(query.organisationId) ?? queryValue(query.orgId),
    projectId: queryValue(query.projectId),
    projectName: queryValue(query.projectName),
    clientName: queryValue(query.clientName) ?? queryValue(query.client),
    siteAddress: queryValue(query.siteAddress),
    jobNumber: queryValue(query.jobNumber),
  };
}

export function stageIndex(stageId: InclusionsSelectionsStageId): number {
  return INCLUSIONS_SELECTIONS_STAGES.findIndex((stage) => stage.id === stageId);
}

export function stageRoute(stageId: InclusionsSelectionsStageId): string {
  return INCLUSIONS_SELECTIONS_STAGES.find((stage) => stage.id === stageId)?.route ?? INCLUSIONS_SELECTIONS_STAGES[0].route;
}

export function queryForContext(context: Partial<ProjectSelectionContext>, extra: Record<string, string | number | undefined> = {}): Record<string, string> {
  const query: Record<string, string> = {};
  if (context.organisationId) query.organisationId = context.organisationId;
  if (context.projectId) query.projectId = context.projectId;
  if (context.projectName) query.projectName = context.projectName;
  if (context.clientName) query.client = context.clientName;
  if (context.siteAddress) query.siteAddress = context.siteAddress;
  if (context.jobNumber) query.jobNumber = context.jobNumber;
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query[key] = String(value);
  });
  return query;
}

export function hrefForStage(stageId: InclusionsSelectionsStageId, context: Partial<ProjectSelectionContext>, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams(queryForContext(context, extra));
  const queryString = params.toString();
  return `${stageRoute(stageId)}${queryString ? `?${queryString}` : ""}`;
}
