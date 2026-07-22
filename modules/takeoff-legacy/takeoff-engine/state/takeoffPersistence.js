import { TAKEOFF_ENGINE_VERSION, createRasterPage, createTakeoffDocument } from "../core/types.js";

export const TAKEOFF_ENGINE_STORAGE_KEY = "takeoff-engine-test-state";

export function serializeTakeoffState(state) {
  return JSON.stringify({
    version: TAKEOFF_ENGINE_VERSION,
    savedAt: new Date().toISOString(),
    document: state,
  });
}

export function hydrateTakeoffState(serialized) {
  if (!serialized) {
    return createTakeoffDocument();
  }

  const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  const document = parsed.document || parsed;
  const pages = Array.isArray(document.pages) ? document.pages.map((page) => createRasterPage(page)) : [];
  const activePageExists = pages.some((page) => page.id === document.activePageId);

  return createTakeoffDocument({
    ...document,
    pages,
    activePageId: activePageExists ? document.activePageId : pages[0]?.id || null,
  });
}

export function hydrateTakeoffStateFromWorkbook(workbookState, workbook = {}) {
  if (workbookState) {
    return hydrateTakeoffState(workbookState);
  }

  return createTakeoffDocument({
    id: `takeoff-${workbook?.openedFileName || workbook?.id || "workbook"}`,
    name: workbook?.openedFileName || workbook?.projectName || "Workbook takeoff",
    pages: [],
    activePageId: null,
  });
}

export function createPersistenceRecord(state) {
  return {
    engine: "takeoff-engine",
    version: TAKEOFF_ENGINE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

export function createTakeoffCacheSnapshot(workbookState) {
  return serializeTakeoffState(hydrateTakeoffStateFromWorkbook(workbookState));
}

export function getTakeoffPersistenceDiagnostics({
  workbookState,
  reducerState,
  reactState,
  localStorageState,
  indexedDBState,
} = {}) {
  const pageCount = (state) => Array.isArray(state?.pages) ? state.pages.length : 0;
  return {
    workbookPages: pageCount(workbookState),
    reducerPages: pageCount(reducerState),
    localStoragePages: pageCount(localStorageState),
    indexedDBPages: pageCount(indexedDBState),
    reactPages: pageCount(reactState),
  };
}

export function saveTakeoffStateToStorage(storage, state, key = TAKEOFF_ENGINE_STORAGE_KEY) {
  if (!storage?.setItem) {
    throw new Error("A storage object with setItem is required.");
  }

  const serialized = serializeTakeoffState(state || createTakeoffDocument());
  storage.setItem(key, serialized);
  return serialized;
}

export function loadTakeoffStateFromStorage(storage, key = TAKEOFF_ENGINE_STORAGE_KEY) {
  if (!storage?.getItem) {
    return createTakeoffDocument();
  }

  const serialized = storage.getItem(key);
  return hydrateTakeoffState(serialized);
}

export function clearTakeoffStateFromStorage(storage, key = TAKEOFF_ENGINE_STORAGE_KEY) {
  if (storage?.removeItem) {
    storage.removeItem(key);
  }
}
