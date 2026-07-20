export type PlanRotation = 0 | 90 | 180 | 270;

export type ProcessingStatus =
  | "queued"
  | "reading"
  | "orienting"
  | "extracting"
  | "ready"
  | "failed";

export type OrientationMode = "automatic" | "manual";

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface TakeoffPage {
  id: string;
  documentId: string;
  pageNumber: number;
  sourceFileName: string;
  originalWidth: number;
  originalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  pdfRotation: PlanRotation;
  detectedRotation: PlanRotation;
  manualRotation: PlanRotation | null;
  finalRotation: PlanRotation;
  orientationMode: OrientationMode;
  orientationConfidence: number;
  scaleRatio: number | null;
  scaleStatus?: "unknown" | "pending" | "confirmed";
  knownDistanceMm?: number | null;
  measuredPlanDistance?: number | null;
  millimetresPerPlanUnit: number | null;
  scaleSource?: "automatic" | "manual" | "unknown";
  scaleConfidence?: number;
  calibrationLine?: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  showCalibrationLine?: boolean;
  aiDetectionRun?: boolean;
  processingStatus: ProcessingStatus;
  thumbnailDataUrl: string;
  textItems: TakeoffTextItem[];
  vectorPaths: TakeoffVectorPath[];
  objects?: TakeoffObject[];
  error?: string;
  viewport?: ViewportState;
}

export interface TakeoffTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
}

export interface TakeoffVectorPath {
  id: string;
  type: "line" | "rect" | "path";
  points: Array<{ x: number; y: number }>;
}

export interface TakeoffDocument {
  version: number;
  id: string;
  name: string;
  fileName: string;
  fileHash: string;
  originalPdfDataUrl: string;
  pageCount: number;
  pages: TakeoffPage[];
  activePageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedPage extends TakeoffPage {
  pdfPage?: unknown;
}

export interface OrientationResult {
  rotation: PlanRotation;
  confidence: number;
  signals: Record<string, number | string | boolean>;
}

export interface ScaleResult {
  scaleRatio: number | null;
  millimetresPerPlanUnit: number | null;
  confidence: number;
}

export interface DetectedWall {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  confidence: number;
}

export interface DetectedRoom {
  id: string;
  label: string;
  points: Array<{ x: number; y: number }>;
  confidence: number;
}

export interface DetectedOpening {
  id: string;
  type: "door" | "window" | "opening";
  position: { x: number; y: number };
  confidence: number;
}

export type TakeoffObjectType =
  | "measurement"
  | "polyline"
  | "wall"
  | "room"
  | "door"
  | "window"
  | "opening"
  | "column";

export type TakeoffObjectStatus = "detected" | "confirmed" | "rejected" | "edited" | "manual";

export interface TakeoffObject {
  id: string;
  type: TakeoffObjectType;
  wallType?: "exterior" | "interior";
  displayColour?: string;
  label?: string;
  points: Array<{ x: number; y: number }>;
  thicknessMm?: number | null;
  confidence: number;
  source: "ai" | "manual" | "scale" | "measurement";
  status: TakeoffObjectStatus;
  parentWallId?: string | null;
  areaMm2?: number | null;
  perimeterMm?: number | null;
  lengthMm?: number | null;
  metadata?: Record<string, unknown>;
}
