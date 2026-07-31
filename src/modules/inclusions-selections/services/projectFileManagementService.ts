import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { projectAreaRegisterRepository } from "../repositories/projectAreaRegisterRepository";
import { approvalStageRepository } from "../repositories/approvalStageRepository";
import { selectionReviewRepository } from "../repositories/selectionReviewRepository";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { templateStageRepository } from "../repositories/templateStageRepository";
import { loadProjectAreaRegister, saveProjectAreaRegister } from "./projectAreaRegisterService";
import { loadSelectionWorkspace, saveWorkspaceDraft } from "./selectionWorkspaceService";
import { loadSelectionReview, saveSelectionReview } from "./selectionReviewService";
import { loadTemplateStage, saveBuilderTemplate, saveTemplateStage } from "./templateStageService";
import { loadApprovalStage, saveApprovalStage } from "./approvalStageService";
import { makeScopedId } from "../shared/ids";
import { loadPersistedValue, organisationStorageKey, savePersistedValue } from "../shared/persistentScopedStore";
import { hrefForStage, queryForContext, type InclusionsSelectionsStageId } from "../routing/stageNavigation";

export type SelectionsSaveStatus = "saved" | "unsaved" | "saving" | "save_failed" | "read_only" | "locked_version";

export type ProjectFileSummary = ProjectSelectionContext & {
  currentStage: InclusionsSelectionsStageId;
  lastModified?: string;
  recentlyOpenedAt?: string;
  status: "active" | "archived";
};

export type SaveAsOptions = {
  projectAreas: boolean;
  templatesAndTiers: boolean;
  productSelections: boolean;
  pricingAndAllowances: boolean;
  notesAndAttachments: boolean;
  reviewState: boolean;
};

export type PortableSelectionsFile = {
  schema: "gr8.selections.project";
  schemaVersion: 1;
  exportedAt: string;
  sourceApplication: "gr8-result";
  organisationReference: string;
  projectSummary: ProjectSelectionContext;
  areasAndLevels: Awaited<ReturnType<typeof loadProjectAreaRegister>>;
  templatesAndTiers: Awaited<ReturnType<typeof loadTemplateStage>>;
  workspace: Awaited<ReturnType<typeof loadSelectionWorkspace>>;
  review: Awaited<ReturnType<typeof loadSelectionReview>>;
  approvals: Awaited<ReturnType<typeof loadApprovalStage>>;
  checksums: { project: string };
};

const PROJECT_INDEX_BUCKET = "project-file-index";
const ACTIVE_PROJECT_BUCKET = "active-project-context";
const memoryProjectIndex = new Map<string, ProjectFileSummary[]>();

function now(): string {
  return new Date().toISOString();
}

function indexKey(organisationId: string): string {
  return organisationStorageKey(PROJECT_INDEX_BUCKET, organisationId);
}

function activeKey(organisationId: string): string {
  return organisationStorageKey(ACTIVE_PROJECT_BUCKET, organisationId);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requiredContext(context: Partial<ProjectSelectionContext>): ProjectSelectionContext {
  if (!context.organisationId || !context.projectId) throw new Error("Open an existing project before using file management.");
  return context as ProjectSelectionContext;
}

function checksum(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(31, hash) + text.charCodeAt(index) | 0;
  return Math.abs(hash).toString(16);
}

export function projectDashboardHref(context: Partial<ProjectSelectionContext>): string {
  const params = new URLSearchParams(queryForContext(context));
  return `/modules/estimate-builder${params.toString() ? `?${params.toString()}` : ""}`;
}

export function registerProjectOpen(context: ProjectSelectionContext, currentStage: InclusionsSelectionsStageId): ProjectFileSummary {
  const projects = loadProjectFileMenu(context.organisationId);
  const summary: ProjectFileSummary = {
    ...context,
    currentStage,
    lastModified: projects.find((item) => item.projectId === context.projectId)?.lastModified ?? now(),
    recentlyOpenedAt: now(),
    status: projects.find((item) => item.projectId === context.projectId)?.status ?? "active",
  };
  const next = [summary, ...projects.filter((item) => item.projectId !== context.projectId)];
  memoryProjectIndex.set(context.organisationId, next);
  savePersistedValue(indexKey(context.organisationId), next);
  savePersistedValue(activeKey(context.organisationId), summary);
  return summary;
}

export function loadProjectFileMenu(organisationId?: string): ProjectFileSummary[] {
  if (!organisationId) return [];
  return (memoryProjectIndex.get(organisationId) ?? loadPersistedValue<ProjectFileSummary[]>(indexKey(organisationId)) ?? [])
    .sort((a, b) => String(b.recentlyOpenedAt ?? b.lastModified ?? "").localeCompare(String(a.recentlyOpenedAt ?? a.lastModified ?? "")));
}

export async function openSelectionsProject(project: ProjectFileSummary): Promise<ProjectSelectionContext> {
  const context = requiredContext(project);
  await Promise.all([
    loadProjectAreaRegister(context),
    loadTemplateStage(context),
    loadSelectionWorkspace(context),
    loadSelectionReview(context),
    loadApprovalStage(context),
  ]);
  registerProjectOpen(context, project.currentStage ?? "areas");
  return context;
}

export async function saveSelectionsProject(contextInput: Partial<ProjectSelectionContext>, stage: InclusionsSelectionsStageId): Promise<{ status: SelectionsSaveStatus; savedAt: string }> {
  const context = requiredContext(contextInput);
  if (stage === "areas") {
    const result = await saveProjectAreaRegister(await loadProjectAreaRegister(context), projectAreaRegisterRepository);
    if (!result.ok) throw new Error(result.issues.map((item) => item.message).join("; "));
  } else if (stage === "templates") {
    const result = await saveTemplateStage(await loadTemplateStage(context), templateStageRepository);
    if (!result.ok) throw new Error(result.issues.map((item) => item.message).join("; "));
  } else if (stage === "workspace") {
    const result = await saveWorkspaceDraft(await loadSelectionWorkspace(context), selectionWorkspaceRepository);
    if (!result.ok) throw new Error(result.issues.map((item) => item.message).join("; "));
  } else if (stage === "review") {
    await saveSelectionReview(await loadSelectionReview(context), selectionReviewRepository);
  } else if (stage === "approvals") {
    await saveApprovalStage(await loadApprovalStage(context), approvalStageRepository);
  }
  const summary = registerProjectOpen({ ...context }, stage);
  summary.lastModified = now();
  const next = [summary, ...loadProjectFileMenu(context.organisationId).filter((item) => item.projectId !== context.projectId)];
  memoryProjectIndex.set(context.organisationId, next);
  savePersistedValue(indexKey(context.organisationId), next);
  return { status: "saved", savedAt: summary.lastModified };
}

export async function saveSelectionsProjectAs(sourceInput: Partial<ProjectSelectionContext>, target: ProjectSelectionContext, options: SaveAsOptions): Promise<ProjectSelectionContext> {
  const source = requiredContext(sourceInput);
  if (source.organisationId !== target.organisationId) throw new Error("Save As must stay inside the current organisation.");
  const existing = loadProjectFileMenu(target.organisationId).find((project) => project.jobNumber && target.jobNumber && project.jobNumber === target.jobNumber && project.projectId !== source.projectId);
  if (existing) throw new Error("A project with this job number already exists.");
  const sourceRegister = await loadProjectAreaRegister(source);
  const sourceTemplate = await loadTemplateStage(source);
  const sourceWorkspace = await loadSelectionWorkspace(source);
  const sourceReview = await loadSelectionReview(source);

  if (options.projectAreas) {
    await projectAreaRegisterRepository.save({
      ...clone(sourceRegister),
      ...target,
      levels: sourceRegister.levels.map((level) => ({ ...level, id: makeScopedId("project_level", [target.projectId, level.name]), organisationId: target.organisationId, projectId: target.projectId })),
      areas: sourceRegister.areas.map((area, index) => ({ ...area, id: makeScopedId("project_area", [target.organisationId, target.projectId, area.name, index]), organisationId: target.organisationId, projectId: target.projectId })),
      customAreaTypes: sourceRegister.customAreaTypes.map((type) => ({ ...type, id: makeScopedId("area_type", [target.organisationId, target.projectId, type.name]), organisationId: target.organisationId })),
      updatedAt: now(),
    });
  }
  if (options.templatesAndTiers) {
    await templateStageRepository.saveConfiguration({ ...clone(sourceTemplate.configuration), id: makeScopedId("template_stage", [target.organisationId, target.projectId]), organisationId: target.organisationId, projectId: target.projectId, updatedAt: now() });
    await templateStageRepository.saveRequirements(target, sourceTemplate.requirements.map((requirement, index) => ({ ...requirement, id: makeScopedId("requirement", [target.projectId, requirement.title, index]), organisationId: target.organisationId, projectId: target.projectId })));
  }
  if (options.productSelections) {
    await selectionWorkspaceRepository.saveSelections(target, sourceWorkspace.selections.map((selection, index) => ({ ...selection, id: makeScopedId("selection", [target.projectId, index]), organisationId: target.organisationId, projectId: target.projectId })));
    await selectionWorkspaceRepository.saveLocations(target, sourceWorkspace.locations.map((location, index) => ({ ...location, id: makeScopedId("selection_location", [target.projectId, index]), organisationId: target.organisationId, projectId: target.projectId })));
  }
  if (options.notesAndAttachments) {
    await selectionWorkspaceRepository.saveRequirementNotes(target, sourceWorkspace.notes.map((note, index) => ({ ...note, id: makeScopedId("requirement_note", [target.projectId, index]), organisationId: target.organisationId, projectId: target.projectId })));
    await selectionWorkspaceRepository.saveAttachments(target, sourceWorkspace.attachments.map((attachment, index) => ({ ...attachment, id: makeScopedId("requirement_attachment", [target.projectId, index]), organisationId: target.organisationId, projectId: target.projectId })));
  }
  if (options.reviewState) {
    await selectionReviewRepository.saveReviewState({ ...sourceReview.reviewState, organisationId: target.organisationId, projectId: target.projectId, savedStatus: "saved", updatedAt: now() });
    await selectionReviewRepository.saveIssues(target, sourceReview.issues.map((item, index) => ({ ...item, id: makeScopedId("review_issue", [target.projectId, index]), organisationId: target.organisationId, projectId: target.projectId })));
  }
  registerProjectOpen(target, "areas");
  return target;
}

export async function saveSelectionsBuilderTemplate(contextInput: Partial<ProjectSelectionContext>, name?: string): Promise<string> {
  const context = requiredContext(contextInput);
  const state = await loadTemplateStage(context);
  const saved = await saveBuilderTemplate(state, name || `${context.projectName ?? context.projectId} Builder Template`);
  return saved.id;
}

export async function exportSelectionsProjectFile(contextInput: Partial<ProjectSelectionContext>): Promise<{ fileName: string; file: PortableSelectionsFile }> {
  const context = requiredContext(contextInput);
  const file: PortableSelectionsFile = {
    schema: "gr8.selections.project",
    schemaVersion: 1,
    exportedAt: now(),
    sourceApplication: "gr8-result",
    organisationReference: context.organisationId,
    projectSummary: context,
    areasAndLevels: await loadProjectAreaRegister(context),
    templatesAndTiers: await loadTemplateStage(context),
    workspace: await loadSelectionWorkspace(context),
    review: await loadSelectionReview(context),
    approvals: await loadApprovalStage(context),
    checksums: { project: "" },
  };
  file.checksums.project = checksum({ ...file, checksums: undefined });
  const safeName = `${context.projectName ?? context.projectId}-${context.jobNumber ?? "selections"}-selections-v1`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return { fileName: `${safeName}.gr8selections.json`, file };
}

export function previewSelectionsProjectImport(input: unknown, organisationId: string): { ok: true; file: PortableSelectionsFile; warnings: string[] } | { ok: false; error: string } {
  const file = input as PortableSelectionsFile;
  if (!file || file.schema !== "gr8.selections.project") return { ok: false, error: "Unsupported selections file." };
  if (file.schemaVersion !== 1) return { ok: false, error: "Unsupported selections file schema version." };
  if (!file.projectSummary?.projectId || !file.projectSummary?.organisationId) return { ok: false, error: "Selections file is missing project identity." };
  if (file.organisationReference !== organisationId) return { ok: false, error: "Cross-organisation imports require authorised import support." };
  const expected = checksum({ ...file, checksums: undefined });
  if (file.checksums?.project !== expected) return { ok: false, error: "Selections file checksum does not match." };
  const duplicate = loadProjectFileMenu(organisationId).some((project) => project.projectId === file.projectSummary.projectId || (project.jobNumber && file.projectSummary.jobNumber && project.jobNumber === file.projectSummary.jobNumber));
  return { ok: true, file, warnings: duplicate ? ["Duplicate project or job number detected. Import as New Project or confirm an explicit update preview."] : [] };
}

export async function importSelectionsProjectFile(file: PortableSelectionsFile, target: ProjectSelectionContext): Promise<ProjectSelectionContext> {
  const preview = previewSelectionsProjectImport(file, target.organisationId);
  if (preview.ok === false) throw new Error(preview.error);
  await projectAreaRegisterRepository.save({
    ...clone(file.areasAndLevels),
    ...target,
    levels: file.areasAndLevels.levels.map((level) => ({ ...level, organisationId: target.organisationId, projectId: target.projectId })),
    areas: file.areasAndLevels.areas.map((area) => ({ ...area, organisationId: target.organisationId, projectId: target.projectId })),
    customAreaTypes: file.areasAndLevels.customAreaTypes.map((type) => ({ ...type, organisationId: target.organisationId })),
    updatedAt: now(),
  });
  await templateStageRepository.saveConfiguration({ ...clone(file.templatesAndTiers.configuration), organisationId: target.organisationId, projectId: target.projectId, updatedAt: now() });
  await templateStageRepository.saveRequirements(target, file.templatesAndTiers.requirements.map((requirement) => ({ ...requirement, organisationId: target.organisationId, projectId: target.projectId })));
  await selectionWorkspaceRepository.saveSelections(target, file.workspace.selections.map((selection) => ({ ...selection, organisationId: target.organisationId, projectId: target.projectId })));
  await selectionWorkspaceRepository.saveLocations(target, file.workspace.locations.map((location) => ({ ...location, organisationId: target.organisationId, projectId: target.projectId })));
  await selectionWorkspaceRepository.saveRequirementNotes(target, file.workspace.notes.map((note) => ({ ...note, organisationId: target.organisationId, projectId: target.projectId })));
  await selectionWorkspaceRepository.saveAttachments(target, file.workspace.attachments.map((attachment) => ({ ...attachment, organisationId: target.organisationId, projectId: target.projectId })));
  await selectionReviewRepository.saveReviewState({ ...file.review.reviewState, organisationId: target.organisationId, projectId: target.projectId, savedStatus: "saved", updatedAt: now() });
  return target;
}

export function closeSelectionsProject(context: Partial<ProjectSelectionContext>): string {
  if (context.organisationId) savePersistedValue(activeKey(context.organisationId), null);
  return projectDashboardHref(context);
}

export function routeForProject(project: ProjectSelectionContext, stage: InclusionsSelectionsStageId = "areas"): string {
  return hrefForStage(stage, project);
}
