import type { DetectedWall, ProcessedPage } from "../state/takeoffTypes";

export interface WallDetector {
  detect(page: ProcessedPage): Promise<DetectedWall[]>;
}

export const noopWallDetector: WallDetector = { async detect() { return []; } };
