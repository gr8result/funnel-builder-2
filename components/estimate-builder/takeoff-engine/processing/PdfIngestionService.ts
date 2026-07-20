import { getFinalRotation, normalizeRotation, rotatedDimensions } from "../rendering/CoordinateTransform";
import type { TakeoffDocument, TakeoffPage, TakeoffTextItem } from "../state/takeoffTypes";
import { detectOrientation } from "./OrientationDetector";
import { textScaleDetector } from "./ScaleDetector";
import { extractVectorPaths } from "./VectorExtractor";

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export async function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") throw new Error("PDF.js requires a browser.");
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${PDFJS_URL}"]`) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        if ((window as any).pdfjsLib) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfjsLib;
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function arrayBufferToDataUrl(arrayBuffer: ArrayBuffer, mimeType = "application/pdf") {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${mimeType};base64,${window.btoa(binary)}`;
}

export function dataUrlToArrayBuffer(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export async function calculateArrayBufferHash(arrayBuffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer.slice(0));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function renderThumbnail(pdfPage: any, rotation: number) {
  const viewport = pdfPage.getViewport({ scale: 0.18, rotation });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "";
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function extractTextItems(pdfPage: any): Promise<TakeoffTextItem[]> {
  const textContent = await pdfPage.getTextContent();
  return (textContent.items || []).map((item: any) => ({
    text: String(item.str || ""),
    x: Number(item.transform?.[4] || 0),
    y: Number(item.transform?.[5] || 0),
    width: Number(item.width || 0),
    height: Number(item.height || 0),
    transform: Array.isArray(item.transform) ? item.transform.map(Number) : [],
  }));
}

export async function ingestPdfFile(file: File, onProgress?: (update: { status: string; detail?: string; pageNumber?: number; pageCount?: number }) => void): Promise<TakeoffDocument> {
  onProgress?.({ status: "reading", detail: file.name });
  const data = await readFileAsArrayBuffer(file);
  const fileHash = await calculateArrayBufferHash(data);
  const originalPdfDataUrl = arrayBufferToDataUrl(data, file.type || "application/pdf");
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  const documentId = `takeoff-document-${fileHash}`;
  const pages: TakeoffPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.({ status: "orienting", detail: "Analysing page orientation", pageNumber, pageCount: pdf.numPages });
    const pdfPage = await pdf.getPage(pageNumber);
    const baseViewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
    const textItems = await extractTextItems(pdfPage);
    const vectorPaths = await extractVectorPaths(pdfPage);
    const pdfRotation = normalizeRotation(pdfPage.rotate || 0);
    const orientation = await detectOrientation({
      pdfRotation,
      textItems,
      vectorPaths,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height,
    });
    const draftPage = {
      orientationMode: "automatic" as const,
      manualRotation: null,
      detectedRotation: orientation.rotation,
    };
    const finalRotation = getFinalRotation(draftPage as TakeoffPage);
    const rendered = rotatedDimensions(baseViewport.width, baseViewport.height, finalRotation);
    const scale = await textScaleDetector.detect({ textItems });
    const thumbnailDataUrl = await renderThumbnail(pdfPage, finalRotation);
    pages.push({
      id: `${documentId}-page-${pageNumber}`,
      documentId,
      pageNumber,
      sourceFileName: file.name,
      originalWidth: baseViewport.width,
      originalHeight: baseViewport.height,
      renderedWidth: rendered.width,
      renderedHeight: rendered.height,
      pdfRotation,
      detectedRotation: orientation.rotation,
      manualRotation: null,
      finalRotation,
      orientationMode: "automatic",
      orientationConfidence: orientation.confidence,
      scaleRatio: null,
      scaleStatus: "unknown",
      knownDistanceMm: null,
      measuredPlanDistance: null,
      millimetresPerPlanUnit: null,
      scaleSource: "unknown",
      scaleConfidence: scale.confidence,
      calibrationLine: null,
      showCalibrationLine: false,
      aiDetectionRun: false,
      processingStatus: "ready",
      thumbnailDataUrl,
      textItems,
      vectorPaths,
      objects: [],
    });
  }

  const now = new Date().toISOString();
  return {
    version: 3,
    id: documentId,
    name: file.name,
    fileName: file.name,
    fileHash,
    originalPdfDataUrl,
    pageCount: pages.length,
    pages,
    activePageId: pages[0]?.id || null,
    createdAt: now,
    updatedAt: now,
  };
}
