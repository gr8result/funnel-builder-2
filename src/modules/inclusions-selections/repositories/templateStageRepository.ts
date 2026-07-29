import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";
import type { SavedBuilderTemplate } from "../templates/savedBuilderTemplateTypes";
import type { TemplateStageConfiguration } from "../templates/templateAssignmentTypes";

export type TemplateStageRepository = {
  loadConfiguration(context: ProjectSelectionContext): Promise<TemplateStageConfiguration | null>;
  saveConfiguration(configuration: TemplateStageConfiguration): Promise<TemplateStageConfiguration>;
  listRequirements(context: ProjectSelectionContext): Promise<ProjectRequirement[]>;
  saveRequirements(context: ProjectSelectionContext, requirements: ProjectRequirement[]): Promise<ProjectRequirement[]>;
  listSavedBuilderTemplates(context: Pick<ProjectSelectionContext, "organisationId">): Promise<SavedBuilderTemplate[]>;
  saveBuilderTemplate(template: SavedBuilderTemplate): Promise<SavedBuilderTemplate>;
};

function projectKey(organisationId: string, projectId: string): string {
  return `${organisationId}:${projectId}`;
}

export class InMemoryTemplateStageRepository implements TemplateStageRepository {
  private configurations = new Map<string, TemplateStageConfiguration>();
  private requirements = new Map<string, ProjectRequirement[]>();
  private savedTemplates = new Map<string, SavedBuilderTemplate>();

  async loadConfiguration(context: ProjectSelectionContext): Promise<TemplateStageConfiguration | null> {
    const configuration = this.configurations.get(projectKey(context.organisationId, context.projectId));
    return configuration ? structuredClone(configuration) : null;
  }

  async saveConfiguration(configuration: TemplateStageConfiguration): Promise<TemplateStageConfiguration> {
    const saved = { ...structuredClone(configuration), updatedAt: new Date().toISOString() };
    this.configurations.set(projectKey(saved.organisationId, saved.projectId), saved);
    return structuredClone(saved);
  }

  async listRequirements(context: ProjectSelectionContext): Promise<ProjectRequirement[]> {
    return structuredClone(this.requirements.get(projectKey(context.organisationId, context.projectId)) ?? []);
  }

  async saveRequirements(context: ProjectSelectionContext, requirements: ProjectRequirement[]): Promise<ProjectRequirement[]> {
    const scoped = requirements.filter((requirement) => requirement.organisationId === context.organisationId && requirement.projectId === context.projectId);
    this.requirements.set(projectKey(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listSavedBuilderTemplates(context: Pick<ProjectSelectionContext, "organisationId">): Promise<SavedBuilderTemplate[]> {
    return [...this.savedTemplates.values()]
      .filter((template) => template.organisationId === context.organisationId)
      .map((template) => structuredClone(template));
  }

  async saveBuilderTemplate(template: SavedBuilderTemplate): Promise<SavedBuilderTemplate> {
    this.savedTemplates.set(template.id, structuredClone(template));
    return structuredClone(template);
  }
}

export const templateStageRepository = new InMemoryTemplateStageRepository();
