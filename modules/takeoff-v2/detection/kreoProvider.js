import { TakeoffDetectionProvider } from "./provider.js";
import { createNormalisedOpening, createNormalisedSpace, createNormalisedWall } from "./normalisedGeometry.js";

export class KreoDetectionProvider extends TakeoffDetectionProvider {
  constructor({ apiKey = "", baseUrl = "https://takeoff.kreo.net/api/ai-search/v1/takeoff2D", fetchImpl = fetch } = {}) {
    super({
      id: "kreo-ai-search",
      label: "Kreo AI Search API",
      enabled: Boolean(apiKey),
      reason: apiKey ? "" : "Kreo API key is not configured.",
    });
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async detectWalls(context = {}) {
    return this.searchLinear(context, "wall");
  }

  async detectDoors(context = {}) {
    return this.searchLinear(context, "door");
  }

  async detectWindows(context = {}) {
    return this.searchLinear(context, "window");
  }

  async detectSpaces(context = {}) {
    return this.searchSpaces(context, "space");
  }

  async searchLinear(context, type) {
    if (!this.enabled) return providerUnavailable(this, `detect${capitalize(type)}s`);
    const result = await this.runSearch(context, type);
    const lines = Array.isArray(result.lines) ? result.lines : [];
    const walls = type === "wall"
      ? lines.map((line, index) => normaliseKreoWall(line, index)).filter(Boolean)
      : [];
    const openings = type === "wall"
      ? []
      : lines.map((line, index) => normaliseKreoOpening(line, type, index)).filter(Boolean);
    return {
      ok: true,
      provider: this.id,
      method: `detect${capitalize(type)}s`,
      status: "ready",
      walls,
      openings,
      spaces: [],
      raw: result,
    };
  }

  async searchSpaces(context, type) {
    if (!this.enabled) return providerUnavailable(this, "detectSpaces");
    const result = await this.runSearch(context, type);
    const spaces = (Array.isArray(result.contours) ? result.contours : [])
      .map((contour, index) => normaliseKreoSpace(contour, index))
      .filter(Boolean);
    return {
      ok: true,
      provider: this.id,
      method: "detectSpaces",
      status: "ready",
      walls: [],
      openings: [],
      spaces,
      raw: result,
    };
  }

  async runSearch() {
    throw new Error("KreoDetectionProvider requires the server upload/project/search orchestration before browser use.");
  }
}

export function normaliseKreoWall(line, index = 0) {
  return createNormalisedWall({
    id: `kreo-wall-${index + 1}`,
    type: line?.wallType || line?.type || "unknown",
    start: line?.p1,
    end: line?.p2,
    thicknessMm: Number.isFinite(Number(line?.thickness)) ? Number(line.thickness) * 1000 : null,
    source: "kreo-ai-search",
    confidence: line?.confidence ?? null,
    providerGeometry: line,
  });
}

export function normaliseKreoOpening(line, type, index = 0) {
  return createNormalisedOpening({
    id: `kreo-${type}-${index + 1}`,
    type,
    start: line?.p1,
    end: line?.p2,
    widthMm: Number.isFinite(Number(line?.length)) ? Number(line.length) * 1000 : null,
    source: "kreo-ai-search",
    confidence: line?.confidence ?? null,
    providerGeometry: line,
  });
}

export function normaliseKreoSpace(contour, index = 0) {
  const labels = Array.isArray(contour?.text) ? contour.text : [];
  return createNormalisedSpace({
    id: `kreo-space-${index + 1}`,
    name: labels.find((item) => !/m2|m²|sq/i.test(String(item))) || "",
    polygon: contour?.points || [],
    areaM2: contour?.area,
    source: "kreo-ai-search",
    confidence: contour?.confidence ?? null,
    providerGeometry: contour,
    metadata: { text: labels, perimeterM: contour?.perimeter ?? null },
  });
}

function providerUnavailable(provider, method) {
  return {
    ok: false,
    provider: provider.id,
    method,
    status: "unavailable",
    reason: provider.reason,
    walls: [],
    openings: [],
    spaces: [],
  };
}

function capitalize(value) {
  return String(value || "").slice(0, 1).toUpperCase() + String(value || "").slice(1);
}
