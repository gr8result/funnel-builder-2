// Builds (and caches, per pdf.js document+page) the shared plan-geometry
// index: vector extraction first, raster fallback only when vector
// extraction finds too few usable segments (a scanned/rasterized PDF).
// Geometry is rotation-independent (base document coordinates), so it's
// cached per page, not per rotation — matching the app's existing
// usePdfDocument.js caching pattern, but keyed by the document object itself
// (a WeakMap) since pdf.js document proxies don't carry the app's own
// PlanDocument id.

import { extractVectorSegments } from "./planVectorExtraction.js";
import { extractRasterSegments } from "./planRasterFallback.js";
import { buildPlanGeometryIndex } from "./planGeometryIndex.js";

const MIN_VECTOR_SEGMENTS = 3;
const documentCache = new WeakMap(); // pdfDocument -> Map<pageNumber, Promise<geometry>>

async function renderOffscreenForRaster(pdfDocument, pageNumber) {
  const { createPageRenderer } = await import("../viewer/PdfViewport.js");
  const canvas = document.createElement("canvas");
  const renderer = createPageRenderer(canvas);
  const { viewport } = await renderer.render({ pdfDocument, pageNumber, rotation: 0, scale: 2 });
  return { canvas, viewport };
}

export async function getPlanGeometry(pdfDocument, pageNumber) {
  if (!documentCache.has(pdfDocument)) documentCache.set(pdfDocument, new Map());
  const perPage = documentCache.get(pdfDocument);
  if (perPage.has(pageNumber)) return perPage.get(pageNumber);

  const promise = (async () => {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1, rotation: 0 });
    const vectorSegments = await extractVectorSegments(pdfDocument, pageNumber, {
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    });

    if (vectorSegments.length >= MIN_VECTOR_SEGMENTS) {
      return {
        ...buildPlanGeometryIndex(vectorSegments, {
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          pageId: `pdf-page-${pageNumber}`,
          rotation: 0,
          source: "pdf-vector",
        }),
        source: "vector",
        segmentCount: vectorSegments.length,
      };
    }

    try {
      const { canvas, viewport: renderedViewport } = await renderOffscreenForRaster(pdfDocument, pageNumber);
      const rasterSegments = extractRasterSegments({ canvas, viewport: renderedViewport });
      return {
        ...buildPlanGeometryIndex(rasterSegments, {
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          pageId: `pdf-page-${pageNumber}`,
          rotation: 0,
          source: "raster",
        }),
        source: "raster",
        segmentCount: rasterSegments.length,
      };
    } catch {
      // Raster rendering failed for any reason — still return whatever the
      // (possibly sparse) vector pass found, rather than nothing at all.
      return {
        ...buildPlanGeometryIndex(vectorSegments, {
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          pageId: `pdf-page-${pageNumber}`,
          rotation: 0,
          source: "pdf-vector",
        }),
        source: "vector",
        segmentCount: vectorSegments.length,
      };
    }
  })();

  perPage.set(pageNumber, promise);
  return promise;
}

export function invalidatePlanGeometry(pdfDocument, pageNumber) {
  const perPage = documentCache.get(pdfDocument);
  if (!perPage) return;
  if (pageNumber == null) perPage.clear();
  else perPage.delete(pageNumber);
}
