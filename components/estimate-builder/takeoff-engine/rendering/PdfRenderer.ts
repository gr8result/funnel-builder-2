import { dataUrlToArrayBuffer, loadPdfJs } from "../processing/PdfIngestionService";
import type { TakeoffDocument, TakeoffPage } from "../state/takeoffTypes";

const pdfCache = new Map<string, Promise<any>>();
const canvasRenderState = new WeakMap<HTMLCanvasElement, { task: any | null; latestRenderId: number }>();

export async function getPdfDocument(document: TakeoffDocument) {
  if (!document.originalPdfDataUrl) throw new Error("Original PDF is not available.");
  const key = document.fileHash || document.id;
  if (!pdfCache.has(key)) {
    pdfCache.set(key, loadPdfJs().then((pdfjsLib) => pdfjsLib.getDocument({ data: dataUrlToArrayBuffer(document.originalPdfDataUrl) }).promise));
  }
  return pdfCache.get(key);
}

export async function renderPdfPageToCanvas({
  canvas,
  document,
  page,
  outputScale = 1,
}: {
  canvas: HTMLCanvasElement;
  document: TakeoffDocument;
  page: TakeoffPage;
  outputScale?: number;
}) {
  const state = canvasRenderState.get(canvas) || { task: null, latestRenderId: 0 };
  state.task?.cancel?.();
  state.task = null;
  const renderId = state.latestRenderId + 1;
  state.latestRenderId = renderId;
  canvasRenderState.set(canvas, state);

  const pdf = await getPdfDocument(document);
  if (canvasRenderState.get(canvas)?.latestRenderId !== renderId) return null;
  const pdfPage = await pdf.getPage(page.pageNumber);
  if (canvasRenderState.get(canvas)?.latestRenderId !== renderId) return null;
  const viewport = pdfPage.getViewport({
    scale: outputScale,
    rotation: page.finalRotation,
  });
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas rendering is unavailable.");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(viewport.width / outputScale)}px`;
  canvas.style.height = `${Math.ceil(viewport.height / outputScale)}px`;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const task = pdfPage.render({ canvasContext: context, viewport });
  state.task = task;
  canvasRenderState.set(canvas, state);
  try {
    await task.promise;
  } catch (error: any) {
    if (error?.name !== "RenderingCancelledException") {
      throw error;
    }
  } finally {
    const latestState = canvasRenderState.get(canvas);
    if (latestState?.task === task) {
      latestState.task = null;
      canvasRenderState.set(canvas, latestState);
    }
  }
  if (canvasRenderState.get(canvas)?.latestRenderId !== renderId) return null;
  return viewport;
}

export async function renderPageThumbnail(document: TakeoffDocument, page: TakeoffPage) {
  const pdf = await getPdfDocument(document);
  const pdfPage = await pdf.getPage(page.pageNumber);
  const viewport = pdfPage.getViewport({ scale: 0.18, rotation: page.finalRotation });
  const canvas = window.document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "";
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}
