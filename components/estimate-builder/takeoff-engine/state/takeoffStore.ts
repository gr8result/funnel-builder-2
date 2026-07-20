import { getFinalRotation, rotatedDimensions } from "../rendering/CoordinateTransform";
import type { PlanRotation, TakeoffDocument, TakeoffPage, ViewportState } from "./takeoffTypes";

export function getActivePage(document: TakeoffDocument): TakeoffPage | null {
  return document.pages.find((page) => page.id === document.activePageId) || document.pages[0] || null;
}

export function updatePage(document: TakeoffDocument, pageId: string, updater: (page: TakeoffPage) => TakeoffPage): TakeoffDocument {
  return {
    ...document,
    pages: document.pages.map((page) => page.id === pageId ? updater(page) : page),
    activePageId: document.pages.some((page) => page.id === document.activePageId) ? document.activePageId : document.pages[0]?.id || null,
    updatedAt: new Date().toISOString(),
  };
}

export function selectPage(document: TakeoffDocument, pageId: string): TakeoffDocument {
  return {
    ...document,
    activePageId: document.pages.some((page) => page.id === pageId) ? pageId : document.activePageId,
    updatedAt: new Date().toISOString(),
  };
}

export function setPageViewport(document: TakeoffDocument, pageId: string, viewport: ViewportState): TakeoffDocument {
  return updatePage(document, pageId, (page) => ({ ...page, viewport }));
}

export function setManualPageRotation(document: TakeoffDocument, pageId: string, rotation: PlanRotation): TakeoffDocument {
  return updatePage(document, pageId, (page) => {
    const finalRotation = getFinalRotation({ ...page, orientationMode: "manual", manualRotation: rotation });
    const rendered = rotatedDimensions(page.originalWidth, page.originalHeight, finalRotation);
    return {
      ...page,
      manualRotation: rotation,
      finalRotation,
      orientationMode: "manual",
      renderedWidth: rendered.width,
      renderedHeight: rendered.height,
    };
  });
}

export function resetAutomaticPageRotation(document: TakeoffDocument, pageId: string): TakeoffDocument {
  return updatePage(document, pageId, (page) => {
    const finalRotation = getFinalRotation({ ...page, orientationMode: "automatic", manualRotation: null });
    const rendered = rotatedDimensions(page.originalWidth, page.originalHeight, finalRotation);
    return {
      ...page,
      manualRotation: null,
      finalRotation,
      orientationMode: "automatic",
      renderedWidth: rendered.width,
      renderedHeight: rendered.height,
    };
  });
}

export function confirmCurrentOrientation(document: TakeoffDocument, pageId: string): TakeoffDocument {
  const page = document.pages.find((item) => item.id === pageId);
  if (!page) return document;
  return setManualPageRotation(document, pageId, page.finalRotation);
}
