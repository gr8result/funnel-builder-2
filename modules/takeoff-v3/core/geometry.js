import { createEmptyGeometry, createPoint, createWallSegment, generateId } from "./types.js";

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointById(geometry, pointId) {
  return geometry.points.find((point) => point.id === pointId) || null;
}

export function wallPoints(geometry, wall) {
  return [pointById(geometry, wall.startPointId), pointById(geometry, wall.endPointId)];
}

export function addWallSegment(geometry, start, end, wallType = "exterior") {
  if (distance(start, end) <= 1e-9) return geometry;
  const startPoint = createPoint(start);
  const endPoint = createPoint(end);
  return {
    ...geometry,
    points: [...geometry.points, startPoint, endPoint],
    walls: [
      ...geometry.walls,
      createWallSegment({
        startPointId: startPoint.id,
        endPointId: endPoint.id,
        wallType,
        source: "manual",
        confirmed: false,
      }),
    ],
  };
}

export function appendWallPoint(geometry, previousPointId, point, wallType = "exterior") {
  const previous = pointById(geometry, previousPointId);
  if (!previous || distance(previous, point) <= 1e-9) return { geometry, pointId: previousPointId };
  const nextPoint = createPoint(point);
  return {
    geometry: {
      ...geometry,
      points: [...geometry.points, nextPoint],
      walls: [
        ...geometry.walls,
        createWallSegment({
          startPointId: previousPointId,
          endPointId: nextPoint.id,
          wallType,
          source: "manual",
          confirmed: false,
        }),
      ],
    },
    pointId: nextPoint.id,
  };
}

export function closeWallLoop(geometry, startPointId, endPointId, wallType = "exterior") {
  if (!startPointId || !endPointId || startPointId === endPointId) return geometry;
  if (geometry.walls.some((wall) => wall.startPointId === endPointId && wall.endPointId === startPointId)) return geometry;
  return {
    ...geometry,
    walls: [
      ...geometry.walls,
      createWallSegment({
        startPointId: endPointId,
        endPointId: startPointId,
        wallType,
        source: "manual",
        confirmed: false,
      }),
    ],
  };
}

export function movePoint(geometry, pointId, nextPoint) {
  return {
    ...geometry,
    points: geometry.points.map((point) => (point.id === pointId ? { ...point, x: nextPoint.x, y: nextPoint.y } : point)),
  };
}

export function deleteWall(geometry, wallId) {
  const walls = geometry.walls.filter((wall) => wall.id !== wallId);
  const used = new Set(walls.flatMap((wall) => [wall.startPointId, wall.endPointId]));
  return {
    ...geometry,
    walls,
    points: geometry.points.filter((point) => used.has(point.id)),
    openings: geometry.openings.filter((opening) => opening.wallSegmentId !== wallId),
  };
}

export function deletePoint(geometry, pointId) {
  const connectedWalls = geometry.walls.filter((wall) => wall.startPointId === pointId || wall.endPointId === pointId);
  const removedWallIds = new Set(connectedWalls.map((wall) => wall.id));
  const canHeal =
    connectedWalls.length === 2 &&
    connectedWalls[0].wallType === connectedWalls[1].wallType &&
    connectedWalls[0].source === connectedWalls[1].source;
  const healedWall = canHeal
    ? createWallSegment({
        startPointId: connectedWalls[0].startPointId === pointId ? connectedWalls[0].endPointId : connectedWalls[0].startPointId,
        endPointId: connectedWalls[1].startPointId === pointId ? connectedWalls[1].endPointId : connectedWalls[1].startPointId,
        wallType: connectedWalls[0].wallType,
        source: connectedWalls[0].source,
        confirmed: false,
      })
    : null;
  return {
    ...geometry,
    points: geometry.points.filter((point) => point.id !== pointId),
    walls: [
      ...geometry.walls.filter((wall) => wall.startPointId !== pointId && wall.endPointId !== pointId),
      ...(healedWall && healedWall.startPointId !== healedWall.endPointId ? [healedWall] : []),
    ],
    openings: geometry.openings.filter((opening) => !removedWallIds.has(opening.wallSegmentId)),
  };
}

export function insertPointIntoWall(geometry, wallId, point) {
  const wall = geometry.walls.find((candidate) => candidate.id === wallId);
  if (!wall) return { geometry, pointId: null };
  const inserted = createPoint({ ...point, id: generateId("pt") });
  const replacementA = createWallSegment({ ...wall, id: generateId("wall"), endPointId: inserted.id, confirmed: false });
  const replacementB = createWallSegment({ ...wall, id: generateId("wall"), startPointId: inserted.id, confirmed: false });
  return {
    geometry: {
      ...geometry,
      points: [...geometry.points, inserted],
      walls: geometry.walls.flatMap((candidate) => (candidate.id === wallId ? [replacementA, replacementB] : [candidate])),
      openings: geometry.openings.filter((opening) => opening.wallSegmentId !== wallId),
    },
    pointId: inserted.id,
  };
}

export function orderedExteriorPoints(geometry) {
  const exteriorWalls = geometry.walls.filter((wall) => wall.wallType === "exterior");
  if (!exteriorWalls.length) return [];
  const orderedIds = [exteriorWalls[0].startPointId, exteriorWalls[0].endPointId];
  const remaining = exteriorWalls.slice(1);
  while (remaining.length) {
    const lastId = orderedIds[orderedIds.length - 1];
    const index = remaining.findIndex((wall) => wall.startPointId === lastId || wall.endPointId === lastId);
    if (index === -1) return [];
    const [wall] = remaining.splice(index, 1);
    orderedIds.push(wall.startPointId === lastId ? wall.endPointId : wall.startPointId);
  }
  if (orderedIds[0] !== orderedIds[orderedIds.length - 1]) return [];
  return orderedIds.slice(0, -1).map((id) => pointById(geometry, id)).filter(Boolean);
}

export function polygonAreaDocUnits2(points = []) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function polygonPerimeter(points = []) {
  if (points.length < 2) return 0;
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

function orientation(a, b, c) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);
}

export function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (Math.sign(o1) !== Math.sign(o2) && Math.sign(o3) !== Math.sign(o4)) return true;
  if (Math.abs(o1) < 1e-9 && onSegment(a, c, b)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(a, d, b)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(c, a, d)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(c, b, d)) return true;
  return false;
}

export function isSimplePolygon(points = []) {
  if (points.length < 3) return false;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = j === i || j === i + 1 || (i === 0 && j === points.length - 1);
      if (adjacent) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return true;
}

export function validateExteriorLoop(geometry) {
  const exteriorWalls = geometry.walls.filter((wall) => wall.wallType === "exterior");
  if (exteriorWalls.length < 3) return { valid: false, reason: "Minimum 3 exterior segments required." };
  const ordered = orderedExteriorPoints(geometry);
  if (ordered.length < 3) return { valid: false, reason: "Exterior loop is not closed." };
  if (exteriorWalls.some((wall) => {
    const [a, b] = wallPoints(geometry, wall);
    return !a || !b || distance(a, b) <= 1e-9;
  })) return { valid: false, reason: "Exterior loop contains a zero-length wall." };
  if (!isSimplePolygon(ordered)) return { valid: false, reason: "Exterior loop crosses itself." };
  return { valid: true, reason: "", orderedPoints: ordered };
}

export function calculateExteriorSummary(geometry, calibration) {
  const validation = validateExteriorLoop(geometry);
  const mmPerDocumentUnit = calibration?.mmPerDocumentUnit;
  if (!validation.valid || !(mmPerDocumentUnit > 0)) {
    return { valid: false, perimeterMm: 0, areaM2: 0, reason: validation.reason || "Scale is not set." };
  }
  return {
    valid: true,
    perimeterMm: polygonPerimeter(validation.orderedPoints) * mmPerDocumentUnit,
    areaM2: (polygonAreaDocUnits2(validation.orderedPoints) * mmPerDocumentUnit * mmPerDocumentUnit) / 1_000_000,
    reason: "",
  };
}

export function cloneGeometry(geometry) {
  return JSON.parse(JSON.stringify(geometry || createEmptyGeometry()));
}
