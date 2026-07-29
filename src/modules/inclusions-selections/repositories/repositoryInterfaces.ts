import type { ProjectScopedEntity, ScopedEntity } from "../shared/ids";

export type RepositoryScope = {
  organisationId: string;
  projectId?: string;
};

export interface ScopedRepository<T extends ScopedEntity> {
  get(scope: RepositoryScope, id: string): Promise<T | null>;
  list(scope: RepositoryScope): Promise<T[]>;
  save(scope: RepositoryScope, entity: T): Promise<T>;
}

export interface ProjectScopedRepository<T extends ProjectScopedEntity> extends ScopedRepository<T> {
  listByProject(scope: Required<RepositoryScope>): Promise<T[]>;
}
