import type { AreaType } from "../area-types/areaTypeTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectLevel } from "../levels/projectLevelTypes";
import type { OrganisationId, ProjectId } from "../shared/ids";
import { loadPersistedValue, projectStorageKey, removePersistedValue, savePersistedValue } from "../shared/persistentScopedStore";

export type ProjectSelectionContext = {
  organisationId: OrganisationId;
  projectId: ProjectId;
  projectName?: string;
  clientName?: string;
  siteAddress?: string;
  jobNumber?: string;
  builder?: string;
  estimator?: string;
};

export type AreaTypeSelectionState = {
  areaTypeId: string;
  quantity: number;
};

export type ProjectAreaRegister = ProjectSelectionContext & {
  levels: ProjectLevel[];
  areas: ProjectArea[];
  customAreaTypes: AreaType[];
  selections: AreaTypeSelectionState[];
  updatedAt: string;
};

export type ProjectAreaRegisterRepository = {
  load(context: ProjectSelectionContext): Promise<ProjectAreaRegister | null>;
  save(register: ProjectAreaRegister): Promise<ProjectAreaRegister>;
};

function registerKey(organisationId: OrganisationId, projectId: ProjectId): string {
  return `${organisationId}:${projectId}`;
}

function persistedRegisterKey(organisationId: OrganisationId, projectId: ProjectId): string {
  return projectStorageKey("area-register", organisationId, projectId);
}

export class InMemoryProjectAreaRegisterRepository implements ProjectAreaRegisterRepository {
  private registers = new Map<string, ProjectAreaRegister>();

  async load(context: ProjectSelectionContext): Promise<ProjectAreaRegister | null> {
    const key = registerKey(context.organisationId, context.projectId);
    const register = this.registers.get(key) ?? loadPersistedValue<ProjectAreaRegister>(persistedRegisterKey(context.organisationId, context.projectId));
    if (!register || register.organisationId !== context.organisationId || register.projectId !== context.projectId) return null;
    this.registers.set(key, structuredClone(register));
    return structuredClone(register);
  }

  async save(register: ProjectAreaRegister): Promise<ProjectAreaRegister> {
    if (!register.organisationId || !register.projectId) {
      throw new Error("Project area register requires organisationId and projectId.");
    }
    const saved = { ...structuredClone(register), updatedAt: new Date().toISOString() };
    this.registers.set(registerKey(saved.organisationId, saved.projectId), saved);
    savePersistedValue(persistedRegisterKey(saved.organisationId, saved.projectId), saved);
    return structuredClone(saved);
  }

  resetProject(context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): void {
    this.registers.delete(registerKey(context.organisationId, context.projectId));
    removePersistedValue(persistedRegisterKey(context.organisationId, context.projectId));
  }
}

export const projectAreaRegisterRepository = new InMemoryProjectAreaRegisterRepository();
