import type { ProjectScopedEntity, ScopedEntity } from "../shared/ids";
import type { ProjectScopedRepository, RepositoryScope, ScopedRepository } from "./repositoryInterfaces";

export class InMemoryScopedRepository<T extends ScopedEntity> implements ScopedRepository<T> {
  protected records = new Map<string, T>();

  async get(scope: RepositoryScope, id: string): Promise<T | null> {
    const record = this.records.get(id);
    return record && record.organisationId === scope.organisationId ? { ...record } : null;
  }

  async list(scope: RepositoryScope): Promise<T[]> {
    return [...this.records.values()]
      .filter((record) => record.organisationId === scope.organisationId)
      .map((record) => ({ ...record }));
  }

  async save(scope: RepositoryScope, entity: T): Promise<T> {
    if (entity.organisationId !== scope.organisationId) {
      throw new Error("Cannot save entity outside the repository organisation scope.");
    }
    this.records.set(entity.id, { ...entity });
    return { ...entity };
  }
}

export class InMemoryProjectScopedRepository<T extends ProjectScopedEntity>
  extends InMemoryScopedRepository<T>
  implements ProjectScopedRepository<T> {
  async listByProject(scope: Required<RepositoryScope>): Promise<T[]> {
    return [...this.records.values()]
      .filter((record) => record.organisationId === scope.organisationId && record.projectId === scope.projectId)
      .map((record) => ({ ...record }));
  }
}
