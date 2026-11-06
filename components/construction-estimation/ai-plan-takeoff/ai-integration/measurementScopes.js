// Measurement and refinement are each two bounded provider requests per page:
// geometry (walls, areas, pillars, eaves) and items (openings, rooms, fixtures,
// documented quantities). The client requests them one at a time; the server's
// unscoped compatibility path uses the same merge so both produce identical analyses.
export const MEASUREMENT_SCOPES = ['geometry', 'items'];

// A separate, single-purpose request: read only the room names labelled on a floor plan. It is
// never part of a full takeoff run and returns no walls, openings or areas, so it can be used on a
// takeoff that was traced by hand without adding anything to the canvas.
export const ROOMS_SCOPE = 'rooms';

export function mergeMeasurementScopes(geometry, items) {
  const prefix = (id) => id.startsWith('geometry:') ? id : `geometry:${id}`;
  return {
    ...geometry,
    walls: geometry.walls.map((item) => ({ ...item, detectionId: prefix(item.detectionId) })),
    pillars: geometry.pillars.map((item) => ({ ...item, detectionId: prefix(item.detectionId) })),
    eaves: geometry.eaves.map((item) => ({ ...item, detectionId: prefix(item.detectionId) })),
    buildingAreas: geometry.buildingAreas.map((item) => ({ ...item, detectionId: prefix(item.detectionId) })),
    roofMeasurements: (geometry.roofMeasurements || []).map((item) => ({ ...item, detectionId: prefix(item.detectionId) })),
    openings: items.openings.map((item) => ({ ...item, detectionId: item.detectionId.startsWith('items:') ? item.detectionId : `items:${item.detectionId}`, hostDetectionId: null })),
    rooms: items.rooms, fixtures: items.fixtures, documentedQuantities: items.documentedQuantities,
    review: [...new Set([...geometry.review, ...items.review])],
  };
}
