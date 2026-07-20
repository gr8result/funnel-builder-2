import type { TakeoffObject, TakeoffPage, TakeoffTextItem, TakeoffVectorPath } from "../state/takeoffTypes";

const ROOM_LABEL_PATTERN = /\b(BED|BEDROOM|KITCHEN|DINING|LIVING|LOUNGE|BATH|ENSUITE|WC|LAUNDRY|GARAGE|WIR|ROBE|STUDY|PATIO|PORCH|ALFRESCO)\b/i;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function clipPointToPage(point: { x: number; y: number }, page: TakeoffPage) {
  return {
    x: clamp(point.x, 0, page.renderedWidth || page.originalWidth),
    y: clamp(point.y, 0, page.renderedHeight || page.originalHeight),
  };
}

export function clippedVectorPaths(page: TakeoffPage): TakeoffVectorPath[] {
  return (page.vectorPaths || [])
    .map((path) => ({
      ...path,
      points: (path.points || []).map((point) => clipPointToPage(point, page)),
    }))
    .filter((path) => path.points.length >= 2);
}

export function detectScaleFromText(page: TakeoffPage) {
  const text = (page.textItems || []).map((item) => item.text).join(" ").replace(/\s+/g, " ");
  const match = text.match(/\b(?:SCALE\s*)?1\s*:\s*(50|75|100|125|150|200|250|500)\b/i);
  if (!match) {
    return {
      scaleRatio: page.scaleRatio,
      millimetresPerPlanUnit: page.millimetresPerPlanUnit,
      scaleSource: page.scaleSource || "unknown",
      scaleConfidence: page.scaleConfidence || 0,
    };
  }
  const ratio = Number(match[1]);
  return {
    scaleRatio: ratio,
    millimetresPerPlanUnit: ratio,
    scaleSource: "automatic" as const,
    scaleConfidence: text.toUpperCase().includes("SCALE") ? 0.92 : 0.76,
  };
}

function lineLength(points: Array<{ x: number; y: number }>) {
  const a = points[0];
  const b = points[points.length - 1];
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function wallBounds(page: TakeoffPage) {
  const lines = clippedVectorPaths(page).filter((path) => lineLength(path.points) > Math.min(page.renderedWidth, page.renderedHeight) * 0.08);
  const points = lines.flatMap((line) => [line.points[0], line.points[line.points.length - 1]]).filter(Boolean);
  if (!points.length) {
    const pad = Math.max(24, Math.min(page.renderedWidth, page.renderedHeight) * 0.08);
    return { minX: pad, minY: pad, maxX: page.renderedWidth - pad, maxY: page.renderedHeight - pad };
  }
  return {
    minX: clamp(Math.min(...points.map((point) => point.x)), 0, page.renderedWidth),
    minY: clamp(Math.min(...points.map((point) => point.y)), 0, page.renderedHeight),
    maxX: clamp(Math.max(...points.map((point) => point.x)), 0, page.renderedWidth),
    maxY: clamp(Math.max(...points.map((point) => point.y)), 0, page.renderedHeight),
  };
}

export function detectExteriorWalls(page: TakeoffPage): TakeoffObject[] {
  const bounds = wallBounds(page);
  const thicknessMm = page.millimetresPerPlanUnit ? Math.round(page.millimetresPerPlanUnit * 1.1) : null;
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  return corners.map((point, index) => ({
    id: uid("exterior-wall"),
    type: "wall",
    wallType: "exterior",
    displayColour: "green",
    label: "Exterior wall",
    points: [point, corners[(index + 1) % corners.length]],
    thicknessMm,
    confidence: 0.68,
    source: "ai",
    status: "detected",
  }));
}

export function detectInteriorWalls(page: TakeoffPage): TakeoffObject[] {
  const bounds = wallBounds(page);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const thicknessMm = page.millimetresPerPlanUnit ? Math.round(page.millimetresPerPlanUnit * 0.9) : null;
  return [
    {
      id: uid("interior-wall"),
      type: "wall",
      wallType: "interior",
      displayColour: "blue",
      label: "Interior wall",
      points: [{ x: midX, y: bounds.minY }, { x: midX, y: bounds.maxY }],
      thicknessMm,
      confidence: 0.46,
      source: "ai",
      status: "detected",
    },
    {
      id: uid("interior-wall"),
      type: "wall",
      wallType: "interior",
      displayColour: "blue",
      label: "Interior wall",
      points: [{ x: bounds.minX, y: midY }, { x: bounds.maxX, y: midY }],
      thicknessMm,
      confidence: 0.42,
      source: "ai",
      status: "detected",
    },
  ];
}

function textPoint(item: TakeoffTextItem) {
  return { x: Number(item.x || 0), y: Number(item.y || 0) };
}

export function detectRooms(page: TakeoffPage): TakeoffObject[] {
  const bounds = wallBounds(page);
  const roomLabels = (page.textItems || []).filter((item) => ROOM_LABEL_PATTERN.test(item.text));
  const cellWidth = Math.max(80, (bounds.maxX - bounds.minX) / 4);
  const cellHeight = Math.max(70, (bounds.maxY - bounds.minY) / 4);
  const labels = roomLabels.length ? roomLabels : [
    { text: "Room", x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, width: 0, height: 0, transform: [] },
  ];
  return labels.slice(0, 16).map((item) => {
    const point = textPoint(item);
    const minX = clamp(point.x - cellWidth / 2, bounds.minX, bounds.maxX - cellWidth);
    const minY = clamp(point.y - cellHeight / 2, bounds.minY, bounds.maxY - cellHeight);
    const points = [
      { x: minX, y: minY },
      { x: minX + cellWidth, y: minY },
      { x: minX + cellWidth, y: minY + cellHeight },
      { x: minX, y: minY + cellHeight },
    ];
    const perimeter = 2 * (cellWidth + cellHeight) * (page.millimetresPerPlanUnit || 1);
    const area = cellWidth * cellHeight * Math.pow(page.millimetresPerPlanUnit || 1, 2);
    return {
      id: uid("room"),
      type: "room",
      label: item.text || "Room",
      points,
      confidence: ROOM_LABEL_PATTERN.test(item.text) ? 0.64 : 0.36,
      source: "ai",
      status: "detected",
      displayColour: "rgba(16, 185, 129, 0.28)",
      perimeterMm: Math.round(perimeter),
      areaMm2: Math.round(area),
    };
  });
}

function openingObjects(page: TakeoffPage, kind: "door" | "window" | "opening", pattern: RegExp, fallbackYRatio: number): TakeoffObject[] {
  const bounds = wallBounds(page);
  const labels = (page.textItems || []).filter((item) => pattern.test(item.text));
  const source = labels.length ? labels : [
    { text: kind, x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY + (bounds.maxY - bounds.minY) * fallbackYRatio, width: 0, height: 0, transform: [] },
  ];
  return source.slice(0, 12).map((item) => {
    const point = textPoint(item);
    const size = kind === "door" ? 34 : 28;
    return {
      id: uid(kind),
      type: kind,
      label: item.text || kind,
      points: [
        clipPointToPage({ x: point.x - size, y: point.y }, page),
        clipPointToPage({ x: point.x + size, y: point.y }, page),
      ],
      confidence: labels.length ? 0.58 : 0.28,
      source: "ai",
      status: "detected",
      displayColour: kind === "door" ? "#f97316" : kind === "window" ? "#0ea5e9" : "#a855f7",
      parentWallId: null,
    };
  });
}

export function detectDoors(page: TakeoffPage) {
  return openingObjects(page, "door", /\b(DR|DOOR|D\d+)\b/i, 0.22);
}

export function detectWindows(page: TakeoffPage) {
  return openingObjects(page, "window", /\b(WIN|WINDOW|W\d+)\b/i, 0.38);
}

export function detectOpenings(page: TakeoffPage) {
  return openingObjects(page, "opening", /\b(OPENING|OPNG|VOID)\b/i, 0.54);
}

export function replaceDetectedObjects(existing: TakeoffObject[] = [], detected: TakeoffObject[] = [], keepManualEdits = true) {
  const keep = keepManualEdits
    ? existing.filter((object) => object.status === "confirmed" || object.status === "edited" || object.status === "manual")
    : existing.filter((object) => object.status !== "detected");
  return [...keep, ...detected];
}
