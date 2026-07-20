import type { DetectedRoom, DetectedWall, ProcessedPage } from "../state/takeoffTypes";

export interface RoomDetector {
  detect(page: ProcessedPage, walls: DetectedWall[]): Promise<DetectedRoom[]>;
}

export const noopRoomDetector: RoomDetector = { async detect() { return []; } };
