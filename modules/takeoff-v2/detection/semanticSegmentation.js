import { TakeoffDetectionProvider, unavailableResult } from "./provider.js";

export const SEMANTIC_WALL_CLASSES = [
  "background",
  "exterior_wall",
  "interior_wall",
  "door",
  "window_opening",
];

export function createEmptyMask(width = 0, height = 0, fill = 0) {
  return {
    width,
    height,
    data: new Float32Array(Math.max(0, width * height)).fill(fill),
  };
}

export function normaliseSegmentationResult(input = {}, { width = 0, height = 0, provider = "unknown" } = {}) {
  const masks = input.masks || input;
  const normalised = {
    ok: input.ok !== false,
    provider: input.provider || provider,
    method: "segmentFloorPlan",
    status: input.status || "ready",
    masks: {
      exteriorWallMask: maskOrEmpty(masks.exteriorWallMask, width, height),
      interiorWallMask: maskOrEmpty(masks.interiorWallMask, width, height),
      doorMask: maskOrEmpty(masks.doorMask, width, height),
      windowMask: maskOrEmpty(masks.windowMask, width, height),
      suppressionMask: masks.suppressionMask ? maskOrEmpty(masks.suppressionMask, width, height) : null,
    },
    confidence: confidenceToNumber(input.confidence, 0),
    diagnostics: input.diagnostics || null,
  };
  return normalised;
}

export class WallSegmentationProvider extends TakeoffDetectionProvider {
  async segmentFloorPlan() {
    return unavailableResult(this, "segmentFloorPlan", this.reason || "Wall segmentation provider is not configured.");
  }
}

export class FixtureWallSegmentationProvider extends WallSegmentationProvider {
  constructor({ masks, confidence = 0.92, id = "fixture-semantic-wall-segmentation" } = {}) {
    super({ id, label: "Fixture semantic wall segmentation", enabled: true });
    this.masks = masks || {};
    this.confidence = confidence;
  }

  async segmentFloorPlan({ image } = {}) {
    return normaliseSegmentationResult({
      provider: this.id,
      masks: this.masks,
      confidence: this.confidence,
      diagnostics: { source: "fixture", imageWidth: image?.width || this.masks.exteriorWallMask?.width || 0, imageHeight: image?.height || this.masks.exteriorWallMask?.height || 0 },
    }, {
      width: image?.width || this.masks.exteriorWallMask?.width || 0,
      height: image?.height || this.masks.exteriorWallMask?.height || 0,
      provider: this.id,
    });
  }
}

export class ModelReadyWallSegmentationProvider extends WallSegmentationProvider {
  constructor({ id = "model-ready-wall-segmentation", label = "Model-ready wall segmentation", modelPath = "", runtime = "" } = {}) {
    super({ id, label, enabled: false, reason: "Segmentation model runtime is not configured." });
    this.modelPath = modelPath;
    this.runtime = runtime;
  }

  getStatus() {
    return {
      ...super.getStatus(),
      modelPath: this.modelPath,
      runtime: this.runtime,
      supportedRuntimes: ["python", "onnx", "pytorch"],
    };
  }
}

export async function segmentFloorPlanWithFallback({ provider, image, fallbackMasks = null } = {}) {
  if (provider?.enabled && typeof provider.segmentFloorPlan === "function") {
    const result = await provider.segmentFloorPlan({ image });
    if (result?.ok !== false) return normaliseSegmentationResult(result, { width: image?.width || 0, height: image?.height || 0, provider: provider.id });
  }
  if (fallbackMasks) {
    return normaliseSegmentationResult({
      provider: "fallback-masks",
      masks: fallbackMasks,
      confidence: 0.45,
      diagnostics: { fallback: true },
    }, { width: image?.width || fallbackMasks.exteriorWallMask?.width || 0, height: image?.height || fallbackMasks.exteriorWallMask?.height || 0 });
  }
  return {
    ok: false,
    provider: provider?.id || "none",
    method: "segmentFloorPlan",
    status: "unavailable",
    reason: "No semantic wall segmentation provider or fallback mask is available.",
    masks: null,
    confidence: 0,
    diagnostics: { fallback: false },
  };
}

function maskOrEmpty(mask, width, height) {
  if (mask?.data && mask.width > 0 && mask.height > 0) return mask;
  return createEmptyMask(width, height);
}

function confidenceToNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(0, Math.min(1, number));
  return fallback;
}
