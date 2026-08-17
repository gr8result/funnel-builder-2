import { LocalQuarantinedDetectionProvider } from "./localQuarantinedProvider.js";

export function createTakeoffDetectionProvider() {
  return new LocalQuarantinedDetectionProvider();
}

export { TakeoffDetectionProvider } from "./provider.js";
export { KreoDetectionProvider, normaliseKreoOpening, normaliseKreoSpace, normaliseKreoWall } from "./kreoProvider.js";
export { normalisedWallsToExteriorCandidate, normalisedWallsToWallGraph } from "./gr8Geometry.js";
export { LOCAL_HEURISTIC_QUARANTINE_REASON } from "./localQuarantinedProvider.js";
export {
  SEMANTIC_WALL_CLASSES,
  WallSegmentationProvider,
  FixtureWallSegmentationProvider,
  ModelReadyWallSegmentationProvider,
  createEmptyMask,
  normaliseSegmentationResult,
  segmentFloorPlanWithFallback,
} from "./semanticSegmentation.js";
export { preprocessFloorPlanImage, detectTextDimensionSuppressionMask } from "./wallPreprocessing.js";
export { vectoriseSemanticWallMasks, vectoriseWallMask, vectoriseOpeningMask } from "./wallMaskVectorisation.js";
export {
  applyOpeningGapContinuity,
  buildSemanticWallGraph,
  reconstructExteriorEnvelope,
  semanticPipelineFromMasks,
} from "./semanticWallGraph.js";
