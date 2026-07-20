import type { ScaleResult, TakeoffTextItem } from "../state/takeoffTypes";

export interface ScaleDetector {
  detect(page: { textItems?: TakeoffTextItem[] }): Promise<ScaleResult>;
}

export const textScaleDetector: ScaleDetector = {
  async detect(page) {
    const text = (page.textItems || []).map((item) => item.text).join(" ");
    const match = text.match(/\b1\s*:\s*(\d{2,4})\b/i);
    const scaleRatio = match ? Number(match[1]) : null;
    return {
      scaleRatio,
      millimetresPerPlanUnit: scaleRatio,
      confidence: scaleRatio ? 0.78 : 0,
    };
  },
};
