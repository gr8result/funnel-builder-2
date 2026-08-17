import { createEmptyMask } from "./semanticSegmentation.js";

export function preprocessFloorPlanImage(image = {}, {
  threshold = null,
  suppressTextAndDimensions = true,
  borderMarginRatio = 0.01,
} = {}) {
  const gray = toGrayscale(image);
  const contrast = normalizeContrast(gray);
  const cutoff = threshold ?? otsuThreshold(contrast.data);
  const binary = thresholdMask(contrast, cutoff);
  const borderSuppressionMask = detectBorderMask(binary, borderMarginRatio);
  const textDimensionSuppressionMask = suppressTextAndDimensions ? detectTextDimensionSuppressionMask(binary) : createEmptyMask(binary.width, binary.height);
  const suppressionMask = orMasks(borderSuppressionMask, textDimensionSuppressionMask);
  const detectionMask = applySuppression(binary, suppressionMask);
  return {
    width: binary.width,
    height: binary.height,
    grayscale: gray,
    contrast,
    binaryMask: binary,
    suppressionMask,
    detectionMask,
    diagnostics: {
      threshold: cutoff,
      suppressionPixels: countMask(suppressionMask),
      foregroundPixels: countMask(binary),
    },
  };
}

export function toGrayscale(image = {}) {
  const width = image.width || 0;
  const height = image.height || 0;
  const source = image.data || [];
  const data = new Float32Array(width * height);
  const channels = source.length >= width * height * 4 ? 4 : 1;
  for (let i = 0; i < width * height; i += 1) {
    if (channels === 4) {
      const offset = i * 4;
      data[i] = 0.299 * source[offset] + 0.587 * source[offset + 1] + 0.114 * source[offset + 2];
    } else {
      data[i] = Number(source[i]) || 0;
    }
  }
  return { width, height, data };
}

export function normalizeContrast(gray = {}) {
  const data = gray.data || [];
  let min = Infinity;
  let max = -Infinity;
  for (const value of data) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const span = Math.max(1, max - min);
  const normalised = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 1) normalised[i] = ((data[i] - min) / span) * 255;
  return { width: gray.width || 0, height: gray.height || 0, data: normalised };
}

export function thresholdMask(gray = {}, threshold = 180) {
  const data = new Float32Array((gray.width || 0) * (gray.height || 0));
  for (let i = 0; i < data.length; i += 1) data[i] = gray.data[i] < threshold ? 1 : 0;
  return { width: gray.width || 0, height: gray.height || 0, data };
}

export function detectTextDimensionSuppressionMask(mask = {}) {
  const result = createEmptyMask(mask.width, mask.height);
  const components = connectedComponents(mask, { minPixels: 1 });
  components.forEach((component) => {
    const w = component.maxX - component.minX + 1;
    const h = component.maxY - component.minY + 1;
    const aspect = w / Math.max(1, h);
    const fill = component.count / Math.max(1, w * h);
    const likelyText = component.count <= 90 && w <= 40 && h <= 24 && fill >= 0.08;
    const likelyDimensionTick = (w <= 3 && h >= 8 && h <= 45) || (h <= 3 && w >= 8 && w <= 45);
    const likelyLeader = component.count <= 80 && (aspect > 8 || aspect < 0.125);
    if (likelyText || likelyDimensionTick || likelyLeader) fillComponent(result, component, 1);
  });
  return result;
}

export function detectBorderMask(mask = {}, marginRatio = 0.01) {
  const result = createEmptyMask(mask.width, mask.height);
  const marginX = Math.max(1, Math.round(mask.width * marginRatio));
  const marginY = Math.max(1, Math.round(mask.height * marginRatio));
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (x < marginX || y < marginY || x >= mask.width - marginX || y >= mask.height - marginY) {
        result.data[y * mask.width + x] = mask.data[y * mask.width + x] ? 1 : 0;
      }
    }
  }
  return result;
}

export function connectedComponents(mask = {}, { minPixels = 1 } = {}) {
  const width = mask.width || 0;
  const height = mask.height || 0;
  const visited = new Uint8Array(width * height);
  const components = [];
  const queue = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || !mask.data[start]) continue;
      const component = { pixels: [], minX: x, maxX: x, minY: y, maxY: y, count: 0 };
      visited[start] = 1;
      queue.push([x, y]);
      while (queue.length) {
        const [cx, cy] = queue.pop();
        component.pixels.push([cx, cy]);
        component.count += 1;
        component.minX = Math.min(component.minX, cx);
        component.maxX = Math.max(component.maxX, cx);
        component.minY = Math.min(component.minY, cy);
        component.maxY = Math.max(component.maxY, cy);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
          const index = ny * width + nx;
          if (visited[index] || !mask.data[index]) return;
          visited[index] = 1;
          queue.push([nx, ny]);
        });
      }
      if (component.count >= minPixels) components.push(component);
    }
  }
  return components;
}

export function orMasks(a, b) {
  const width = a?.width || b?.width || 0;
  const height = a?.height || b?.height || 0;
  const result = createEmptyMask(width, height);
  for (let i = 0; i < result.data.length; i += 1) result.data[i] = (a?.data?.[i] || b?.data?.[i]) ? 1 : 0;
  return result;
}

export function applySuppression(mask, suppressionMask) {
  const result = createEmptyMask(mask.width, mask.height);
  for (let i = 0; i < result.data.length; i += 1) result.data[i] = mask.data[i] && !suppressionMask.data[i] ? 1 : 0;
  return result;
}

function fillComponent(mask, component, value) {
  component.pixels.forEach(([x, y]) => {
    mask.data[y * mask.width + x] = value;
  });
}

function countMask(mask) {
  let count = 0;
  for (const value of mask.data || []) if (value) count += 1;
  return count;
}

function otsuThreshold(data = []) {
  const hist = new Array(256).fill(0);
  for (const value of data) hist[Math.max(0, Math.min(255, Math.round(value)))] += 1;
  const total = data.length || 1;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVariance = -1;
  let threshold = 180;
  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }
  return threshold;
}
