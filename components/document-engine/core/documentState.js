import { createId } from "./objectEngine.js";
import { createA4Page } from "./pageEngine.js";
import { clearSelection } from "./selectionEngine.js";

export const DOCUMENT_ENGINE_SCHEMA_VERSION = 1;

export function createDocument(props = {}) {
  const pages = (props.pages && props.pages.length ? props.pages : [createA4Page({ name: "Page 1" })]).map(createA4Page);
  return {
    id: props.id || createId("doc"),
    schemaVersion: DOCUMENT_ENGINE_SCHEMA_VERSION,
    name: props.name || "Untitled Document",
    pages,
    activePageId: props.activePageId || pages[0]?.id || null,
    selection: props.selection || clearSelection(),
    metadata: { ...(props.metadata || {}) },
  };
}

export function getActivePage(document) {
  return document?.pages?.find((page) => page.id === document.activePageId) || null;
}

export function updatePage(document, pageId, updater) {
  const current = createDocument(document);
  return {
    ...current,
    pages: current.pages.map((page) => {
      if (page.id !== pageId) return page;
      return createA4Page(typeof updater === "function" ? updater(page) : { ...page, ...updater });
    }),
  };
}

export function setActivePage(document, pageId) {
  const current = createDocument(document);
  const exists = current.pages.some((page) => page.id === pageId);
  return {
    ...current,
    activePageId: exists ? pageId : current.pages[0]?.id || null,
  };
}

export function serializeDocument(document) {
  const current = createDocument(document);
  return {
    id: current.id,
    schemaVersion: current.schemaVersion,
    name: current.name,
    pages: current.pages.map((page) => ({
      id: page.id,
      name: page.name,
      width: page.width,
      height: page.height,
      unit: page.unit,
      background: page.background,
      objects: page.objects,
    })),
    activePageId: current.activePageId,
    metadata: current.metadata,
  };
}

export function hydrateDocument(savedDocument) {
  if (!savedDocument || typeof savedDocument !== "object") return createDocument();
  return createDocument(savedDocument);
}
