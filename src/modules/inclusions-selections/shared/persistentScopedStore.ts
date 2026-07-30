const STORAGE_PREFIX = "gr8:inclusions-selections";

function storage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function projectStorageKey(bucket: string, organisationId: string, projectId: string): string {
  return `${STORAGE_PREFIX}:${bucket}:${organisationId}:${projectId}`;
}

export function organisationStorageKey(bucket: string, organisationId: string): string {
  return `${STORAGE_PREFIX}:${bucket}:${organisationId}`;
}

export function loadPersistedValue<T>(key: string): T | null {
  const localStorage = storage();
  if (!localStorage) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function savePersistedValue<T>(key: string, value: T): void {
  const localStorage = storage();
  if (!localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is only a temporary browser draft layer for this module.
  }
}

export function removePersistedValue(key: string): void {
  const localStorage = storage();
  if (!localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Local storage is only a temporary browser draft layer for this module.
  }
}
