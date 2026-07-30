import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";
import type { SavedBuilderTemplate } from "../templates/savedBuilderTemplateTypes";
import type { TemplateStageConfiguration } from "../templates/templateAssignmentTypes";
import { loadPersistedValue, organisationStorageKey, projectStorageKey, savePersistedValue } from "../shared/persistentScopedStore";

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

function configurationStorageKey(context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): string {
  return projectStorageKey("template-configuration", context.organisationId, context.projectId);
}

function requirementsStorageKey(context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): string {
  return projectStorageKey("project-requirements", context.organisationId, context.projectId);
}

function savedTemplatesStorageKey(organisationId: string): string {
  return organisationStorageKey("saved-builder-templates", organisationId);
}

export class InMemoryTemplateStageRepository implements TemplateStageRepository {
  private configurations = new Map<string, TemplateStageConfiguration>();
  private requirements = new Map<string, ProjectRequirement[]>();
  private savedTemplates = new Map<string, SavedBuilderTemplate>();

  async loadConfiguration(context: ProjectSelectionContext): Promise<TemplateStageConfiguration | null> {
    const key = projectKey(context.organisationId, context.projectId);
    const configuration = this.configurations.get(key) ?? loadPersistedValue<TemplateStageConfiguration>(configurationStorageKey(context));
    if (configuration) this.configurations.set(key, structuredClone(configuration));
    return configuration ? structuredClone(configuration) : null;
  }

  async saveConfiguration(configuration: TemplateStageConfiguration): Promise<TemplateStageConfiguration> {
    const saved = { ...structuredClone(configuration), updatedAt: new Date().toISOString() };
    this.configurations.set(projectKey(saved.organisationId, saved.projectId), saved);
    savePersistedValue(configurationStorageKey(saved), saved);
    return structuredClone(saved);
  }

  async listRequirements(context: ProjectSelectionContext): Promise<ProjectRequirement[]> {
    const key = projectKey(context.organisationId, context.projectId);
    const requirements = this.requirements.get(key) ?? loadPersistedValue<ProjectRequirement[]>(requirementsStorageKey(context)) ?? [];
    this.requirements.set(key, structuredClone(requirements));
    return structuredClone(requirements);
  }

  async saveRequirements(context: ProjectSelectionContext, requirements: ProjectRequirement[]): Promise<ProjectRequirement[]> {
    const scoped = requirements.filter((requirement) => requirement.organisationId === context.organisationId && requirement.projectId === context.projectId);
    this.requirements.set(projectKey(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(requirementsStorageKey(context), scoped);
    return structuredClone(scoped);
  }

  async listSavedBuilderTemplates(context: Pick<ProjectSelectionContext, "organisationId">): Promise<SavedBuilderTemplate[]> {
    const persisted = loadPersistedValue<SavedBuilderTemplate[]>(savedTemplatesStorageKey(context.organisationId));
    if (persisted) persisted.forEach((template) => this.savedTemplates.set(template.id, structuredClone(template)));
    return [...this.savedTemplates.values()]
      .filter((template) => template.organisationId === context.organisationId)
      .map((template) => structuredClone(template));
  }

  async saveBuilderTemplate(template: SavedBuilderTemplate): Promise<SavedBuilderTemplate> {
    this.savedTemplates.set(template.id, structuredClone(template));
    const templates = [...this.savedTemplates.values()].filter((item) => item.organisationId === template.organisationId);
    savePersistedValue(savedTemplatesStorageKey(template.organisationId), templates);
    return structuredClone(template);
  }
}

export const templateStageRepository = new InMemoryTemplateStageRepository();
