import type { AreaType } from "../area-types/areaTypeTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectLevel } from "../levels/projectLevelTypes";
import type { OrganisationId, ProjectId } from "../shared/ids";

export type ProjectSelectionContext = {
  organisationId: OrganisationId;
  projectId: ProjectId;
  projectName?: string;
  clientName?: string;
  siteAddress?: string;
  jobNumber?: string;
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

export class InMemoryProjectAreaRegisterRepository implements ProjectAreaRegisterRepository {
  private registers = new Map<string, ProjectAreaRegister>();

  async load(context: ProjectSelectionContext): Promise<ProjectAreaRegister | null> {
    const register = this.registers.get(registerKey(context.organisationId, context.projectId));
    if (!register || register.organisationId !== context.organisationId || register.projectId !== context.projectId) return null;
    return structuredClone(register);
  }

  async save(register: ProjectAreaRegister): Promise<ProjectAreaRegister> {
    if (!register.organisationId || !register.projectId) {
      throw new Error("Project area register requires organisationId and projectId.");
    }
    const saved = { ...structuredClone(register), updatedAt: new Date().toISOString() };
    this.registers.set(registerKey(saved.organisationId, saved.projectId), saved);
    return structuredClone(saved);
  }
}

export const projectAreaRegisterRepository = new InMemoryProjectAreaRegisterRepository();
