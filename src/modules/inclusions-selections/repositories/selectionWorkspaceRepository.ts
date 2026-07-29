import type { ProjectSelection } from "../selections/selectionTypes";
import type { SelectionLocation } from "../selections/selectionLocationTypes";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";

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

export class InMemorySelectionWorkspaceRepository implements SelectionWorkspaceRepository {
  private selections = new Map<string, ProjectSelection[]>();
  private locations = new Map<string, SelectionLocation[]>();
  private notes = new Map<string, RequirementNote[]>();
  private attachments = new Map<string, RequirementAttachmentReference[]>();
  private draftStates = new Map<string, WorkspaceDraftState>();

  async listSelections(context: ProjectSelectionContext): Promise<ProjectSelection[]> {
    return structuredClone(this.selections.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveSelections(context: ProjectSelectionContext, selections: ProjectSelection[]): Promise<ProjectSelection[]> {
    const scoped = selections.filter((selection) => selection.organisationId === context.organisationId && selection.projectId === context.projectId);
    this.selections.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listLocations(context: ProjectSelectionContext): Promise<SelectionLocation[]> {
    return structuredClone(this.locations.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveLocations(context: ProjectSelectionContext, locations: SelectionLocation[]): Promise<SelectionLocation[]> {
    const scoped = locations.filter((location) => location.organisationId === context.organisationId && location.projectId === context.projectId);
    this.locations.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listRequirementNotes(context: ProjectSelectionContext): Promise<RequirementNote[]> {
    return structuredClone(this.notes.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveRequirementNotes(context: ProjectSelectionContext, notes: RequirementNote[]): Promise<RequirementNote[]> {
    const scoped = notes.filter((note) => note.organisationId === context.organisationId && note.projectId === context.projectId);
    this.notes.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listAttachments(context: ProjectSelectionContext): Promise<RequirementAttachmentReference[]> {
    return structuredClone(this.attachments.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveAttachments(context: ProjectSelectionContext, attachments: RequirementAttachmentReference[]): Promise<RequirementAttachmentReference[]> {
    const scoped = attachments.filter((attachment) => attachment.organisationId === context.organisationId && attachment.projectId === context.projectId);
    this.attachments.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async loadDraftState(context: ProjectSelectionContext): Promise<WorkspaceDraftState | null> {
    return structuredClone(this.draftStates.get(key(context.organisationId, context.projectId)) ?? null);
  }

  async saveDraftState(state: WorkspaceDraftState): Promise<WorkspaceDraftState> {
    const saved = { ...structuredClone(state), savedStatus: "saved" as const, updatedAt: new Date().toISOString() };
    this.draftStates.set(key(saved.organisationId, saved.projectId), saved);
    return structuredClone(saved);
  }
}

export const selectionWorkspaceRepository = new InMemorySelectionWorkspaceRepository();
