// Deterministic adapter input, deliberately not canonical canvas objects.
export function createAiTakeoffDevelopmentFixture(context, page) {
  const wall = (detectionId, category, nodes) => ({
    detectionId, kind: 'wall', page, confidence: 0.95,
    coordinates: { space: 'normalized' }, nodes,
    category, thicknessMm: category === 'exterior' ? 230 : 70,
    alignment: 'outer', exteriorType: category === 'exterior' ? 'Face Brick Veneer' : '',
    linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null,
  });
  return {
    jobId: context.jobId, takeoffId: context.takeoffId, documentHash: context.documentHash,
    runId: `phase1-fixture-page-${page}`, modelVersion: 'development-fixture-v1',
    detections: [
      wall('exterior-1', 'exterior', [{ x: 0.20, y: 0.25 }, { x: 0.55, y: 0.25 }]),
      wall('exterior-2', 'exterior', [{ x: 0.55, y: 0.25 }, { x: 0.55, y: 0.65 }]),
      wall('interior-1', 'interior', [{ x: 0.30, y: 0.45 }, { x: 0.45, y: 0.45 }]),
      {
        detectionId: 'window-1', kind: 'opening', page, confidence: 0.9,
        coordinates: { space: 'normalized' }, x: 0.38, y: 0.25,
        type: 'window', openingClass: 'Window', subType: 'standard',
        widthMm: 1200, heightMm: 1800, hostDetectionId: 'exterior-1',
      },
    ],
  };
}
