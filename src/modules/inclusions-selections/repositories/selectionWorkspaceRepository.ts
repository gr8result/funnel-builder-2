import type { ProjectSelection } from "../selections/selectionTypes";
import type { SelectionLocation } from "../selections/selectionLocationTypes";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";
import { loadPersistedValue, projectStorageKey, removePersistedValue, savePersistedValue } from "../shared/persistentScopedStore";

export type RequirementNote = {
  id: string;
  organisationId: string;
  projectId: string;
  requirementId: string;
  kind: "internal" | "client_visible" | "supplier" | "installation" | "override_reason" | "not_applicable_reason";
  text: string;
  createdAt: string;
};

export type RequirementAttachmentReference = {
  id: string;
  organisationId: string;
  projectId: string;
  requirementId: string;
  kind: "product_image" | "specification_pdf" | "colour_sample" | "supplier_quote" | "drawing" | "manual_selection_image";
  label: string;
  url?: string;
};

export type WorkspaceDraftState = {
  organisationId: string;
  projectId: string;
  selectedView: "room" | "category";
  selectedAreaId?: string;
  selectedCategory?: string;
  savedStatus: "saved" | "saving" | "unsaved" | "save_failed";
  updatedAt: string;
};

export type SelectionWorkspaceRepository = {
  listSelections(context: ProjectSelectionContext): Promise<ProjectSelection[]>;
  saveSelections(context: ProjectSelectionContext, selections: ProjectSelection[]): Promise<ProjectSelection[]>;
  listLocations(context: ProjectSelectionContext): Promise<SelectionLocation[]>;
  saveLocations(context: ProjectSelectionContext, locations: SelectionLocation[]): Promise<SelectionLocation[]>;
  listRequirementNotes(context: ProjectSelectionContext): Promise<RequirementNote[]>;
  saveRequirementNotes(context: ProjectSelectionContext, notes: RequirementNote[]): Promise<RequirementNote[]>;
  listAttachments(context: ProjectSelectionContext): Promise<RequirementAttachmentReference[]>;
  saveAttachments(context: ProjectSelectionContext, attachments: RequirementAttachmentReference[]): Promise<RequirementAttachmentReference[]>;
  loadDraftState(context: ProjectSelectionContext): Promise<WorkspaceDraftState | null>;
  saveDraftState(state: WorkspaceDraftState): Promise<WorkspaceDraftState>;
};

function key(organisationId: string, projectId: string): string {
  return `${organisationId}:${projectId}`;
}

function storageKey(bucket: string, context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): string {
  return projectStorageKey(bucket, context.organisationId, context.projectId);
}

export class InMemorySelectionWorkspaceRepository implements SelectionWorkspaceRepository {
  private selections = new Map<string, ProjectSelection[]>();
  private locations = new Map<string, SelectionLocation[]>();
  private notes = new Map<string, RequirementNote[]>();
  private attachments = new Map<string, RequirementAttachmentReference[]>();
  private draftStates = new Map<string, WorkspaceDraftState>();

  async listSelections(context: ProjectSelectionContext): Promise<ProjectSelection[]> {
    const scoped = this.selections.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<ProjectSelection[]>(storageKey("workspace-selections", context)) ?? [];
    this.selections.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async saveSelections(context: ProjectSelectionContext, selections: ProjectSelection[]): Promise<ProjectSelection[]> {
    const scoped = selections.filter((selection) => selection.organisationId === context.organisationId && selection.projectId === context.projectId);
    this.selections.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("workspace-selections", context), scoped);
    return structuredClone(scoped);
  }

  async listLocations(context: ProjectSelectionContext): Promise<SelectionLocation[]> {
    const scoped = this.locations.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<SelectionLocation[]>(storageKey("workspace-locations", context)) ?? [];
    this.locations.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async saveLocations(context: ProjectSelectionContext, locations: SelectionLocation[]): Promise<SelectionLocation[]> {
    const scoped = locations.filter((location) => location.organisationId === context.organisationId && location.projectId === context.projectId);
    this.locations.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("workspace-locations", context), scoped);
    return structuredClone(scoped);
  }

  async listRequirementNotes(context: ProjectSelectionContext): Promise<RequirementNote[]> {
    const scoped = this.notes.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<RequirementNote[]>(storageKey("workspace-notes", context)) ?? [];
    this.notes.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async saveRequirementNotes(context: ProjectSelectionContext, notes: RequirementNote[]): Promise<RequirementNote[]> {
    const scoped = notes.filter((note) => note.organisationId === context.organisationId && note.projectId === context.projectId);
    this.notes.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("workspace-notes", context), scoped);
    return structuredClone(scoped);
  }

  async listAttachments(context: ProjectSelectionContext): Promise<RequirementAttachmentReference[]> {
    const scoped = this.attachments.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<RequirementAttachmentReference[]>(storageKey("workspace-attachments", context)) ?? [];
    this.attachments.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async saveAttachments(context: ProjectSelectionContext, attachments: RequirementAttachmentReference[]): Promise<RequirementAttachmentReference[]> {
    const scoped = attachments.filter((attachment) => attachment.organisationId === context.organisationId && attachment.projectId === context.projectId);
    this.attachments.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("workspace-attachments", context), scoped);
    return structuredClone(scoped);
  }

  async loadDraftState(context: ProjectSelectionContext): Promise<WorkspaceDraftState | null> {
    const draftState = this.draftStates.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<WorkspaceDraftState>(storageKey("workspace-draft", context));
    if (draftState) this.draftStates.set(key(context.organisationId, context.projectId), structuredClone(draftState));
    return structuredClone(draftState ?? null);
  }

  async saveDraftState(state: WorkspaceDraftState): Promise<WorkspaceDraftState> {
    const saved = { ...structuredClone(state), savedStatus: "saved" as const, updatedAt: new Date().toISOString() };
    this.draftStates.set(key(saved.organisationId, saved.projectId), saved);
    savePersistedValue(storageKey("workspace-draft", saved), saved);
    return structuredClone(saved);
  }

  resetProject(context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): void {
    const scopedKey = key(context.organisationId, context.projectId);
    this.selections.delete(scopedKey);
    this.locations.delete(scopedKey);
    this.notes.delete(scopedKey);
    this.attachments.delete(scopedKey);
    this.draftStates.delete(scopedKey);
    ["workspace-selections", "workspace-locations", "workspace-notes", "workspace-attachments", "workspace-draft"].forEach((bucket) => {
      removePersistedValue(storageKey(bucket, context));
    });
  }
}

export const selectionWorkspaceRepository = new InMemorySelectionWorkspaceRepository();
