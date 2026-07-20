import type { DetectedOpening, DetectedWall, ProcessedPage } from "../state/takeoffTypes";

export interface OpeningDetector {
  detect(page: ProcessedPage, walls: DetectedWall[]): Promise<DetectedOpening[]>;
}

export const noopDoorDetector: OpeningDetector = { async detect() { return []; } };
