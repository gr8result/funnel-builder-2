import type { TakeoffDocument } from "../state/takeoffTypes";

export function hydrateTakeoffDocument(raw: unknown, fallbackName = "Workbook takeoff"): TakeoffDocument {
  const input = raw && typeof raw === "object" ? raw as Partial<TakeoffDocument> : {};
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const needsTakeoffCleanup = Number(input.version || 0) < 3;
  return {
    version: 3,
    id: input.id || `takeoff-${fallbackName}`,
    name: input.name || fallbackName,
    fileName: input.fileName || input.name || "",
    fileHash: input.fileHash || "",
    originalPdfDataUrl: input.originalPdfDataUrl || "",
    pageCount: Number(input.pageCount ?? pages.length),
    pages: pages.map((page: any) => ({
      ...page,
      objects: sanitizeObjects(page, needsTakeoffCleanup),
      vectorPaths: Array.isArray(page.vectorPaths) ? page.vectorPaths : [],
      textItems: Array.isArray(page.textItems) ? page.textItems : [],
      scaleSource: page.scaleSource || (page.scaleRatio ? "automatic" : "unknown"),
      scaleConfidence: Number(page.scaleConfidence || 0),
      scaleStatus: page.scaleStatus === "confirmed" && Number(page.millimetresPerPlanUnit) > 0 ? "confirmed" : "unknown",
      knownDistanceMm: page.scaleStatus === "confirmed" ? Number(page.knownDistanceMm || 0) || null : null,
      measuredPlanDistance: page.scaleStatus === "confirmed" ? Number(page.measuredPlanDistance || 0) || null : null,
      millimetresPerPlanUnit: page.scaleStatus === "confirmed" ? Number(page.millimetresPerPlanUnit || 0) || null : null,
      calibrationLine: page.scaleStatus === "confirmed" && page.showCalibrationLine ? page.calibrationLine || null : null,
      showCalibrationLine: Boolean(page.showCalibrationLine),
      aiDetectionRun: Boolean(page.aiDetectionRun && page.scaleStatus === "confirmed"),
    })) as TakeoffDocument["pages"],
    activePageId: pages.some((page) => page.id === input.activePageId) ? input.activePageId || null : pages[0]?.id || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function sanitizeObjects(page: any, forceCleanup: boolean) {
  const objects = Array.isArray(page.objects) ? page.objects : [];
  if (!forceCleanup && page.aiDetectionRun && page.scaleStatus === "confirmed") return objects;
  return objects.filter((object: any) => {
    if (!object || typeof object !== "object") return false;
    if (object.source === "ai" || object.source === "debug" || object.source === "vector") return false;
    if (object.type === "debug" || object.type === "rawVector" || object.metadata?.debug) return false;
    if (object.source === "scale" && page.scaleStatus !== "confirmed") return false;
    return ["manual", "confirmed", "edited"].includes(object.status) || object.source === "manual" || object.source === "measurement";
  });
}

export function saveTakeoffDocument(sheet: any, document: TakeoffDocument) {
  sheet?.updateTakeoffEngineState?.({
    ...document,
    updatedAt: new Date().toISOString(),
  });
}
