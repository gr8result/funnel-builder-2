import { TakeoffDetectionProvider, unavailableResult } from "./provider.js";

export const LOCAL_HEURISTIC_QUARANTINE_REASON =
  "The previous custom wall-detection heuristics are quarantined. Use manual tools now, or configure an external detection provider.";

export class LocalQuarantinedDetectionProvider extends TakeoffDetectionProvider {
  constructor() {
    super({
      id: "local-quarantined",
      label: "Local heuristic detector (quarantined)",
      enabled: false,
      reason: LOCAL_HEURISTIC_QUARANTINE_REASON,
    });
  }

  async detectWalls() {
    return unavailableResult(this, "detectWalls", LOCAL_HEURISTIC_QUARANTINE_REASON);
  }

  async detectDoors() {
    return unavailableResult(this, "detectDoors", LOCAL_HEURISTIC_QUARANTINE_REASON);
  }

  async detectWindows() {
    return unavailableResult(this, "detectWindows", LOCAL_HEURISTIC_QUARANTINE_REASON);
  }

  async detectSpaces() {
    return unavailableResult(this, "detectSpaces", LOCAL_HEURISTIC_QUARANTINE_REASON);
  }
}
