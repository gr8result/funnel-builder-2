import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export const SUPPORTED_RASTER_DPI = [300, 400, 600];
export const DEFAULT_RASTER_DPI = 400;

export function createPdfRasterTransform({ dpi = DEFAULT_RASTER_DPI, pageWidth, pageHeight }) {
  const scale = dpi / 72;
  const width = Math.round(pageWidth * scale);
  const height = Math.round(pageHeight * scale);
  return {
    dpi,
    scale,
    pageWidth,
    pageHeight,
    width,
    height,
    pdfToRaster(point) {
      return { x: point.x * scale, y: point.y * scale };
    },
    rasterToPdf(point) {
      return { x: point.x / scale, y: point.y / scale };
    },
  };
}

export async function rasterizePdfPage({ pdfPath, pageNumber = 1, dpi = DEFAULT_RASTER_DPI, maxPixels = 42000000 } = {}) {
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);
  if (!SUPPORTED_RASTER_DPI.includes(dpi)) throw new Error(`Unsupported DPI ${dpi}; expected one of ${SUPPORTED_RASTER_DPI.join(", ")}`);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const pdfPage = await pdf.getPage(pageNumber);
  const baseViewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
  const transform = createPdfRasterTransform({ dpi, pageWidth: baseViewport.width, pageHeight: baseViewport.height });
  if (transform.width * transform.height > maxPixels) {
    throw new Error(`Raster ${transform.width}x${transform.height} exceeds maxPixels=${maxPixels}`);
  }
  const viewport = pdfPage.getViewport({ scale: transform.scale, rotation: 0 });
  const canvas = createCanvas(transform.width, transform.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, transform.width, transform.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  const imageData = context.getImageData(0, 0, transform.width, transform.height);
  return {
    width: transform.width,
    height: transform.height,
    rgba: imageData.data,
    png: canvas.toBuffer("image/png"),
    transform,
  };
}

export function rgbaToGrayscale(rgba, width, height) {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return gray;
}

export function normalizeContrast(gray) {
  const hist = new Uint32Array(256);
  for (const value of gray) hist[value] += 1;
  const total = gray.length;
  const lowTarget = total * 0.01;
  const highTarget = total * 0.99;
  let running = 0;
  let low = 0;
  let high = 255;
  for (let i = 0; i < 256; i += 1) {
    running += hist[i];
    if (running >= lowTarget) {
      low = i;
      break;
    }
  }
  running = 0;
  for (let i = 0; i < 256; i += 1) {
    running += hist[i];
    if (running >= highTarget) {
      high = i;
      break;
    }
  }
  const span = Math.max(1, high - low);
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    out[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - low) / span) * 255)));
  }
  return { image: out, low, high };
}

export function adaptiveThreshold(gray, width, height, { radius = 18, bias = 18 } = {}) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let row = 0;
    for (let x = 1; x <= width; x += 1) {
      row += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + row;
    }
  }
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const a = y1 * (width + 1) + x1;
      const b = y1 * (width + 1) + (x2 + 1);
      const c = (y2 + 1) * (width + 1) + x1;
      const d = (y2 + 1) * (width + 1) + (x2 + 1);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const mean = (integral[d] - integral[b] - integral[c] + integral[a]) / area;
      mask[y * width + x] = gray[y * width + x] < mean - bias ? 1 : 0;
    }
  }
  return mask;
}

export function morphDilate(mask, width, height, radius = 1) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dy = -radius; dy <= radius && !on; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < width && mask[yy * width + xx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

export function morphErode(mask, width, height, radius = 1) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let dy = -radius; dy <= radius && on; dy += 1) {
        const yy = y + dy;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width || !mask[yy * width + xx]) {
            on = 0;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

export function morphClose(mask, width, height, radius = 1) {
  return morphErode(morphDilate(mask, width, height, radius), width, height, radius);
}

export function connectedComponents(mask, width, height, { minPixels = 1 } = {}) {
  const labels = new Int32Array(mask.length);
  const components = [];
  let nextLabel = 0;
  const queue = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || labels[i]) continue;
    nextLabel += 1;
    const component = { id: nextLabel, pixelCount: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    labels[i] = nextLabel;
    queue.length = 0;
    queue.push(i);
    for (let q = 0; q < queue.length; q += 1) {
      const idx = queue[q];
      const x = idx % width;
      const y = Math.floor(idx / width);
      component.pixelCount += 1;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || labels[next] || !mask[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        labels[next] = nextLabel;
        queue.push(next);
      }
    }
    if (component.pixelCount >= minPixels) components.push(component);
  }
  return { labels, components };
}

export function removeThinIsolatedStrokes(mask, width, height, { minPixels = 16, minThickness = 3 } = {}) {
  const { components } = connectedComponents(mask, width, height, { minPixels: 1 });
  const out = new Uint8Array(mask.length);
  const removedComponents = [];
  const keep = new Set();
  components.forEach((component) => {
    const bw = component.maxX - component.minX + 1;
    const bh = component.maxY - component.minY + 1;
    const thin = Math.min(bw, bh) < minThickness;
    if (component.pixelCount < minPixels || thin) removedComponents.push(component.id);
    else keep.add(component.id);
  });
  const { labels } = connectedComponents(mask, width, height, { minPixels: 1 });
  for (let i = 0; i < mask.length; i += 1) out[i] = keep.has(labels[i]) ? 1 : 0;
  return { mask: out, removedComponents };
}

export function bridgeShortGaps(mask, width, height, { maxGap = 10, minRun = 8 } = {}) {
  const out = new Uint8Array(mask);
  const bridged = [];
  const tryBridge = (startIdx, gapPixels) => {
    gapPixels.forEach((idx) => { out[idx] = 1; });
    bridged.push({ pixels: gapPixels.length, startIndex: startIdx });
  };
  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      while (x < width && out[y * width + x]) x += 1;
      const gapStart = x;
      while (x < width && !out[y * width + x]) x += 1;
      const gapEnd = x - 1;
      const gap = gapEnd - gapStart + 1;
      if (gap > 0 && gap <= maxGap) {
        const left = Math.max(0, gapStart - minRun);
        const right = Math.min(width - 1, gapEnd + minRun);
        let leftRun = 0;
        let rightRun = 0;
        for (let xx = gapStart - 1; xx >= left && out[y * width + xx]; xx -= 1) leftRun += 1;
        for (let xx = gapEnd + 1; xx <= right && out[y * width + xx]; xx += 1) rightRun += 1;
        if (leftRun >= minRun && rightRun >= minRun) {
          tryBridge(y * width + gapStart, Array.from({ length: gap }, (_, i) => y * width + gapStart + i));
        }
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let y = 0;
    while (y < height) {
      while (y < height && out[y * width + x]) y += 1;
      const gapStart = y;
      while (y < height && !out[y * width + x]) y += 1;
      const gapEnd = y - 1;
      const gap = gapEnd - gapStart + 1;
      if (gap > 0 && gap <= maxGap) {
        let topRun = 0;
        let bottomRun = 0;
        for (let yy = gapStart - 1; yy >= Math.max(0, gapStart - minRun) && out[yy * width + x]; yy -= 1) topRun += 1;
        for (let yy = gapEnd + 1; yy <= Math.min(height - 1, gapEnd + minRun) && out[yy * width + x]; yy += 1) bottomRun += 1;
        if (topRun >= minRun && bottomRun >= minRun) {
          tryBridge(gapStart * width + x, Array.from({ length: gap }, (_, i) => (gapStart + i) * width + x));
        }
      }
    }
  }
  return { mask: out, bridged };
}

export function selectPrimaryBuildingComponent(mask, width, height) {
  const { labels, components } = connectedComponents(mask, width, height, { minPixels: 20 });
  const pageArea = width * height;
  const scored = components.map((component) => {
    const bw = component.maxX - component.minX + 1;
    const bh = component.maxY - component.minY + 1;
    const area = bw * bh;
    const centerX = (component.minX + component.maxX) / 2;
    const centerY = (component.minY + component.maxY) / 2;
    const pageFrame = bw > width * 0.82 && bh > height * 0.82;
    const titleBlockPenalty = component.minY > height * 0.78 && bw > width * 0.25 ? 0.1 : 1;
    const notePenalty = component.minX < width * 0.18 && area < pageArea * 0.08 ? 0.25 : 1;
    const centrality = 1 - Math.min(0.8, Math.hypot(centerX - width / 2, centerY - height / 2) / Math.hypot(width / 2, height / 2));
    const structuralArea = component.pixelCount / Math.max(area, 1);
    const score = pageFrame ? 0 : component.pixelCount * Math.sqrt(Math.max(area, 1)) * (0.5 + centrality) * titleBlockPenalty * notePenalty * (0.4 + structuralArea);
    return { ...component, width: bw, height: bh, score };
  }).sort((a, b) => b.score - a.score);
  const selected = scored[0] || null;
  const selectedMask = new Uint8Array(mask.length);
  if (selected) {
    for (let i = 0; i < labels.length; i += 1) selectedMask[i] = labels[i] === selected.id ? 1 : 0;
  }
  return { selected, components: scored, labels, mask: selectedMask };
}

export function contourFromMask(mask, width, height) {
  const pointKey = (p) => `${p.x}:${p.y}`;
  const edgeKey = (a, b) => `${pointKey(a)}>${pointKey(b)}`;
  const edges = [];
  const isOn = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOn(x, y)) continue;
      if (!isOn(x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (!isOn(x + 1, y)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (!isOn(x, y + 1)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (!isOn(x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
    }
  }
  const starts = new Map();
  edges.forEach((edge) => {
    const key = pointKey(edge.a);
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(edge);
  });
  const used = new Set();
  const loops = [];
  edges.forEach((edge) => {
    const firstKey = edgeKey(edge.a, edge.b);
    if (used.has(firstKey)) return;
    const loop = [edge.a];
    let current = edge;
    used.add(firstKey);
    for (let guard = 0; guard < edges.length + 4; guard += 1) {
      loop.push(current.b);
      if (pointKey(current.b) === pointKey(loop[0])) break;
      const next = (starts.get(pointKey(current.b)) || []).find((candidate) => !used.has(edgeKey(candidate.a, candidate.b)));
      if (!next) break;
      current = next;
      used.add(edgeKey(current.a, current.b));
    }
    if (loop.length >= 5 && pointKey(loop[0]) === pointKey(loop[loop.length - 1])) {
      loop.pop();
      loops.push(simplifyCollinear(loop));
    }
  });
  return loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0] || [];
}

export function simplifyCollinear(points = [], tolerance = 0.75) {
  const out = [];
  points.forEach((point) => {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - point.x) <= tolerance && Math.abs(prev.y - point.y) <= tolerance) return;
    out.push(point);
    while (out.length >= 3) {
      const a = out[out.length - 3];
      const b = out[out.length - 2];
      const c = out[out.length - 1];
      const collinearX = Math.abs(a.x - b.x) <= tolerance && Math.abs(b.x - c.x) <= tolerance;
      const collinearY = Math.abs(a.y - b.y) <= tolerance && Math.abs(b.y - c.y) <= tolerance;
      if (!collinearX && !collinearY) break;
      out.splice(out.length - 2, 1);
    }
  });
  return out;
}

export function polygonArea(points = []) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export function selfIntersectionCount(points = []) {
  const intersects = (a, b, c, d) => {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 1e-9) return false;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
  };
  let count = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i) continue;
      if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) count += 1;
    }
  }
  return count;
}

function distancePointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function snapContourToVectorGeometry(points = [], vectorSegments = [], { maxDistance = 6, angleTolerance = 8 } = {}) {
  const snapped = points.map((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const horizontal = Math.abs(prev.y - point.y) < Math.abs(prev.x - point.x) || Math.abs(next.y - point.y) < Math.abs(next.x - point.x);
    const compatible = vectorSegments
      .filter((segment) => {
        if (!segment?.a || !segment?.b) return false;
        const dx = segment.b.x - segment.a.x;
        const dy = segment.b.y - segment.a.y;
        const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
        const axisAngle = horizontal ? 0 : 90;
        const delta = Math.min(Math.abs(angle - axisAngle), Math.abs(angle - axisAngle - 180), Math.abs(angle - axisAngle + 180));
        return delta <= angleTolerance;
      })
      .map((segment) => ({ segment, distance: distancePointToSegment(point, segment.a, segment.b) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!compatible || compatible.distance > maxDistance) return { ...point, snapped: false };
    const segment = compatible.segment;
    if (Math.abs(segment.a.x - segment.b.x) < Math.abs(segment.a.y - segment.b.y)) return { x: (segment.a.x + segment.b.x) / 2, y: point.y, snapped: true };
    return { x: point.x, y: (segment.a.y + segment.b.y) / 2, snapped: true };
  });
  return {
    points: snapped.map(({ x, y }) => ({ x, y })),
    snappedCount: snapped.filter((point) => point.snapped).length,
    snapPercentage: snapped.length ? snapped.filter((point) => point.snapped).length / snapped.length : 0,
  };
}

export async function writeMaskPng(mask, width, height, outputPath) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let i = 0; i < mask.length; i += 1) {
    const value = mask[i] ? 0 : 255;
    const p = i * 4;
    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
}

export async function runHybridRasterPrototype({ pdfPath, pageNumber = 1, dpi = DEFAULT_RASTER_DPI, vectorSegments = [], outputDir = "tmp/takeoff-hybrid-raster" } = {}) {
  const started = Date.now();
  fs.mkdirSync(outputDir, { recursive: true });
  const raster = await rasterizePdfPage({ pdfPath, pageNumber, dpi });
  const originalPath = path.join(outputDir, "01-original-rendered-plan.png");
  fs.writeFileSync(originalPath, raster.png);
  const gray = rgbaToGrayscale(raster.rgba, raster.width, raster.height);
  const normalized = normalizeContrast(gray);
  const threshold = adaptiveThreshold(normalized.image, raster.width, raster.height, {
    radius: Math.max(12, Math.round(raster.transform.scale * 4)),
    bias: 14,
  });
  const cleaned = removeThinIsolatedStrokes(threshold, raster.width, raster.height, {
    minPixels: Math.round(raster.transform.scale * 4),
    minThickness: Math.max(2, Math.round(raster.transform.scale * 0.6)),
  });
  const closed = morphClose(cleaned.mask, raster.width, raster.height, Math.max(1, Math.round(raster.transform.scale * 0.4)));
  const bridged = bridgeShortGaps(closed, raster.width, raster.height, {
    maxGap: Math.max(4, Math.round(raster.transform.scale * 2.5)),
    minRun: Math.max(8, Math.round(raster.transform.scale * 3)),
  });
  const building = selectPrimaryBuildingComponent(bridged.mask, raster.width, raster.height);
  const rawContour = contourFromMask(building.mask, raster.width, raster.height);
  const simplifiedContour = simplifyCollinear(rawContour, 1);
  const pdfContour = simplifiedContour.map((point) => raster.transform.rasterToPdf(point));
  const snapped = snapContourToVectorGeometry(pdfContour, vectorSegments, { maxDistance: 8 });
  const structuralPixels = bridged.mask.reduce((sum, value) => sum + value, 0);
  const selfIntersections = selfIntersectionCount(snapped.points);

  const wallMaskPath = path.join(outputDir, "02-wall-mask.png");
  const buildingMaskPath = path.join(outputDir, "03-detected-building-mass.png");
  await writeMaskPng(bridged.mask, raster.width, raster.height, wallMaskPath);
  await writeMaskPng(building.mask, raster.width, raster.height, buildingMaskPath);

  const overlayPaths = await writeContourOverlays({
    outputDir,
    originalPath,
    width: raster.width,
    height: raster.height,
    rawContour,
    simplifiedContour,
    pdfContour,
    snappedContour: snapped.points,
    transform: raster.transform,
  });

  return {
    diagnostics: {
      rasterDpi: dpi,
      imageWidth: raster.width,
      imageHeight: raster.height,
      structuralPixels,
      structuralComponents: building.components.length,
      selectedBuildingComponent: building.selected,
      rawContourPointCount: rawContour.length,
      simplifiedContourPointCount: simplifiedContour.length,
      vectorSnapPercentage: snapped.snapPercentage,
      unsupportedContourPercentage: 1 - snapped.snapPercentage,
      gapsBridged: bridged.bridged.length,
      selfIntersections,
      runtimeMs: Date.now() - started,
    },
    transform: raster.transform,
    paths: {
      original: originalPath,
      wallMask: wallMaskPath,
      buildingMass: buildingMaskPath,
      ...overlayPaths,
    },
    rawContour,
    simplifiedContour,
    pdfContour,
    snappedContour: snapped.points,
  };
}

async function writeContourOverlays({ outputDir, originalPath, width, height, rawContour, simplifiedContour, pdfContour, snappedContour, transform }) {
  const original = await loadImage(originalPath);
  const drawOverlay = (title, points, color) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.drawImage(original, 0, 0, width, height);
    context.globalAlpha = 0.95;
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    if (points.length) context.closePath();
    context.stroke();
    context.globalAlpha = 1;
    context.font = "700 28px Arial";
    context.lineWidth = 5;
    context.strokeStyle = "white";
    context.strokeText(title, 24, 36);
    context.fillStyle = "#0f172a";
    context.fillText(title, 24, 36);
    return canvas.toBuffer("image/png");
  };
  const pdfToRasterPoints = (points) => points.map((point) => transform.pdfToRaster(point));
  const outputs = [
    ["04-raw-raster-exterior-contour", drawOverlay("Raw raster exterior contour", rawContour, "#2563eb")],
    ["05-contour-mapped-onto-original-pdf", drawOverlay("Contour mapped to PDF coordinates", pdfToRasterPoints(pdfContour), "#7c3aed")],
    ["06-vector-snapped-final-contour", drawOverlay("Vector-snapped final contour", pdfToRasterPoints(snappedContour), "#16a34a")],
  ];
  for (const [name, content] of outputs) {
    const pngPath = path.join(outputDir, `${name}.png`);
    fs.writeFileSync(pngPath, content);
  }
  return {
    rawRasterContour: path.join(outputDir, "04-raw-raster-exterior-contour.png"),
    mappedContour: path.join(outputDir, "05-contour-mapped-onto-original-pdf.png"),
    vectorSnappedContour: path.join(outputDir, "06-vector-snapped-final-contour.png"),
  };
}
