export class TakeoffDetectionProvider {
  constructor({ id, label, enabled = false, reason = "" } = {}) {
    this.id = id || "unknown";
    this.label = label || this.id;
    this.enabled = Boolean(enabled);
    this.reason = reason;
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      enabled: this.enabled,
      reason: this.reason,
    };
  }

  async detectWalls() {
    return unavailableResult(this, "detectWalls");
  }

  async detectDoors() {
    return unavailableResult(this, "detectDoors");
  }

  async detectWindows() {
    return unavailableResult(this, "detectWindows");
  }

  async detectSpaces() {
    return unavailableResult(this, "detectSpaces");
  }
}

export function unavailableResult(provider, method, reason = provider?.reason) {
  return {
    ok: false,
    provider: provider?.id || "unknown",
    method,
    status: "unavailable",
    reason: reason || "Detection provider is not configured.",
    walls: [],
    openings: [],
    spaces: [],
    diagnostics: null,
  };
}

export function emptyDetectionResult(provider, method, extras = {}) {
  return {
    ok: true,
    provider: provider?.id || "unknown",
    method,
    status: "ready",
    walls: [],
    openings: [],
    spaces: [],
    diagnostics: null,
    ...extras,
  };
}
