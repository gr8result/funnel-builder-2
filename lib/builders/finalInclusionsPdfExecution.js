import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  createFinalInclusionsDocumentVersion,
  finalInclusionsPdfMergePlan,
  isFinalInclusionsDocumentOutOfDate,
  normaliseProjectEstimateInclusionsDocument,
  renderFinalInclusionsScheduleHtml,
} from "./finalInclusionsSchedule.js";

const A4_WIDTH_PX = 1123;
const A4_HEIGHT_PX = 794;
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

export class FinalInclusionsPdfError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FinalInclusionsPdfError";
    this.code = code;
    this.details = details;
  }
}

export async function renderDynamicFinalInclusionsPdf(snapshot, {
  puppeteerLaunchOptions = {},
  html = "",
} = {}) {
  const sourceHtml = html || renderFinalInclusionsScheduleHtml(snapshot);
  if (!/^<!doctype html>/i.test(sourceHtml.trim())) {
    throw new FinalInclusionsPdfError("INVALID_HTML", "Final selections schedule could not be generated.", { reason: "HTML was empty or invalid." });
  }

  let browser;
  try {
    const { default: puppeteer } = await import("puppeteer");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      ...puppeteerLaunchOptions,
    });
    const page = await browser.newPage();
    const warnings = [];
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "image") {
        warnings.push(`Image failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`);
      }
    });
    page.on("pageerror", (error) => warnings.push(`Page error: ${error?.message || error}`));
    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, deviceScaleFactor: 1 });
    await page.setContent(sourceHtml, { waitUntil: ["load", "networkidle0"], timeout: 60000 });
    const brokenImages = await page.evaluate(() => (
      Array.from(document.images)
        .filter((image) => image.currentSrc && (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0))
        .map((image) => image.currentSrc)
    ));
    if (brokenImages.length) {
      warnings.push(...brokenImages.map((url) => `Broken image: ${url}`));
    }
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: "<div style=\"width:100%;font-family:Arial,sans-serif;font-size:8px;color:#64748b;padding:0 14mm;text-align:right;\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>",
      margin: { top: "0mm", right: "0mm", bottom: "10mm", left: "0mm" },
      timeout: 60000,
    });
    const bytes = Buffer.from(pdfBuffer);
    const validation = await validatePdfBytes(bytes);
    return { bytes, warnings, validation, html: sourceHtml };
  } catch (error) {
    if (error instanceof FinalInclusionsPdfError) throw error;
    throw new FinalInclusionsPdfError("RENDER_FAILED", "Final selections schedule could not be generated.", { reason: error?.message || String(error) });
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

export async function mergeFinalInclusionsPdfBinaries({
  masterPdfBytes,
  dynamicPdfBytes,
  closingPdfBytes,
  expectedPageCounts = {},
} = {}) {
  const master = await validatePdfBytes(masterPdfBytes, { label: "master", expectedPageCount: expectedPageCounts.master });
  const dynamic = await validatePdfBytes(dynamicPdfBytes, { label: "dynamic", expectedPageCount: expectedPageCounts.dynamic });
  const closing = closingPdfBytes ? await validatePdfBytes(closingPdfBytes, { label: "closing", expectedPageCount: expectedPageCounts.closing }) : { pageCount: 0, pages: [] };
  const output = await PDFDocument.create();
  const sources = [
    { label: "master", bytes: masterPdfBytes },
    { label: "dynamic", bytes: dynamicPdfBytes },
    ...(closingPdfBytes ? [{ label: "closing", bytes: closingPdfBytes }] : []),
  ];
  const diagnostics = [];

  for (const source of sources) {
    try {
      const pdf = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
      const copied = await output.copyPages(pdf, pdf.getPageIndices());
      copied.forEach((page) => {
        page.setSize(A4_LANDSCAPE.width, A4_LANDSCAPE.height);
        output.addPage(page);
      });
      diagnostics.push({ label: source.label, pageCount: copied.length });
    } catch (error) {
      throw new FinalInclusionsPdfError("MERGE_FAILED", "Final selections schedule could not be generated.", { source: source.label, reason: error?.message || String(error) });
    }
  }

  output.setTitle("Final Inclusions Schedule");
  output.setSubject("Client selections final inclusions schedule");
  output.setProducer("GR8 Builder Final Inclusions Generator");
  output.setCreationDate(new Date());
  output.setModificationDate(new Date());
  const mergedBytes = Buffer.from(await output.save());
  const expectedTotal = master.pageCount + dynamic.pageCount + closing.pageCount;
  const validation = await validatePdfBytes(mergedBytes, { label: "final", expectedPageCount: expectedTotal });
  return {
    bytes: mergedBytes,
    diagnostics,
    pageCounts: {
      master: master.pageCount,
      dynamic: dynamic.pageCount,
      closing: closing.pageCount,
      total: validation.pageCount,
    },
    pages: validation.pages,
    validation,
  };
}

export async function generateAndStoreFinalInclusionsPdf({
  snapshot,
  previousDocuments = [],
  masterPdfBytes,
  closingPdfBytes = null,
  storage,
  generatedAt = new Date().toISOString(),
  puppeteerLaunchOptions = {},
} = {}) {
  if (!snapshot?.selectionFingerprint) {
    throw new FinalInclusionsPdfError("MISSING_SNAPSHOT", "Final selections schedule could not be generated.", { reason: "Missing immutable selection snapshot." });
  }
  if (!masterPdfBytes) {
    throw new FinalInclusionsPdfError("MISSING_MASTER_PDF", "Final selections schedule could not be generated.", { reason: "Approved master PDF source was not provided." });
  }
  if (!closingPdfBytes) {
    throw new FinalInclusionsPdfError("MISSING_CLOSING_PDF", "Final selections schedule could not be generated.", { reason: "Approved closing PDF source was not provided." });
  }
  if (!storage?.savePdf || !storage?.registerDocument) {
    throw new FinalInclusionsPdfError("MISSING_STORAGE", "Final selections schedule could not be generated.", { reason: "Storage adapter is incomplete." });
  }

  const dynamic = await renderDynamicFinalInclusionsPdf(snapshot, { puppeteerLaunchOptions });
  const merged = await mergeFinalInclusionsPdfBinaries({
    masterPdfBytes,
    dynamicPdfBytes: dynamic.bytes,
    closingPdfBytes,
    expectedPageCounts: {
      master: snapshot.masterPdfRef?.pageCount || snapshot.masterTemplate?.pageCount,
      dynamic: dynamic.validation.pageCount,
    },
  });
  const fileHash = sha256(merged.bytes);
  let documentDraft;
  try {
    documentDraft = createFinalInclusionsDocumentVersion({
      snapshot: {
        ...snapshot,
        summary: {
          ...snapshot.summary,
          dynamicPageCount: dynamic.validation.pageCount,
          totalPageCount: merged.pageCounts.total,
        },
      },
      previousDocuments,
      generatedAt,
    });
  } catch (error) {
    throw new FinalInclusionsPdfError("SCHEDULE_NOT_READY", "Final selections schedule could not be generated.", { reason: error?.message || String(error), readiness: snapshot.readiness });
  }

  let stored;
  try {
    stored = await storage.savePdf({ document: documentDraft, bytes: merged.bytes, generatedAt });
  } catch (error) {
    throw new FinalInclusionsPdfError("STORAGE_UPLOAD_FAILED", "Final selections schedule could not be generated.", { reason: error?.message || String(error) });
  }

  const finalDocument = {
    ...documentDraft,
    ...stored,
    fileSizeBytes: merged.bytes.length,
    file_size_bytes: merged.bytes.length,
    fileHash,
    file_hash: fileHash,
    pageCount: merged.pageCounts.total,
    page_count: merged.pageCounts.total,
    status: documentDraft.status || "generated",
    metadata: {
      ...documentDraft.metadata,
      generatedAt,
      status: documentDraft.status || "generated",
      fileHash,
      fileSizeBytes: merged.bytes.length,
      pageCount: merged.pageCounts.total,
      dynamicPageCount: merged.pageCounts.dynamic,
      masterPageCount: merged.pageCounts.master,
      closingPageCount: merged.pageCounts.closing,
      pdfValidation: merged.validation,
      renderWarnings: dynamic.warnings,
      pdfMergePlan: finalInclusionsPdfMergePlan({
        masterPdf: { ...(snapshot.masterPdfRef || {}), pageCount: merged.pageCounts.master },
        dynamicPdf: { storagePath: stored.storagePath || stored.storage_path, pageCount: merged.pageCounts.dynamic },
        closingPdf: { ...(snapshot.closingPdfRef || {}), pageCount: merged.pageCounts.closing },
      }),
    },
  };

  try {
    const registered = await storage.registerDocument(finalDocument);
    return {
      document: { ...finalDocument, ...(registered || {}) },
      dynamic,
      merged,
      projectEstimateDocument: normaliseProjectEstimateInclusionsDocument({ ...finalDocument, ...(registered || {}) }),
      outOfDate: isFinalInclusionsDocumentOutOfDate(finalDocument, snapshot.selections),
    };
  } catch (error) {
    if (storage.markFailed) await storage.markFailed(finalDocument, error).catch(() => null);
    throw new FinalInclusionsPdfError("DOCUMENT_REGISTRATION_FAILED", "Final selections schedule could not be generated.", { reason: error?.message || String(error) });
  }
}

export async function generateAndStoreStandaloneFinalInclusionsPdf({
  snapshot,
  previousDocuments = [],
  storage,
  generatedAt = new Date().toISOString(),
  puppeteerLaunchOptions = {},
} = {}) {
  if (!snapshot?.selectionFingerprint) {
    throw new FinalInclusionsPdfError("MISSING_SNAPSHOT", "Final selections schedule could not be generated.", { reason: "Missing immutable selection snapshot." });
  }
  if (!storage?.savePdf || !storage?.registerDocument) {
    throw new FinalInclusionsPdfError("MISSING_STORAGE", "Final selections schedule could not be generated.", { reason: "Storage adapter is incomplete." });
  }

  const dynamic = await renderDynamicFinalInclusionsPdf(snapshot, { puppeteerLaunchOptions });
  let documentDraft;
  try {
    documentDraft = createFinalInclusionsDocumentVersion({
      snapshot: {
        ...snapshot,
        masterPdfRef: null,
        closingPdfRef: null,
        masterTemplate: { ...(snapshot.masterTemplate || {}), pageCount: 0 },
        summary: {
          ...(snapshot.summary || {}),
          masterPageCount: 0,
          closingPageCount: 0,
          dynamicPageCount: dynamic.validation.pageCount,
          totalPageCount: dynamic.validation.pageCount,
        },
      },
      previousDocuments,
      generatedAt,
    });
  } catch (error) {
    throw new FinalInclusionsPdfError("SCHEDULE_NOT_READY", "Final selections schedule could not be generated.", { reason: error?.message || String(error), readiness: snapshot.readiness });
  }

  const fileHash = sha256(dynamic.bytes);
  let stored;
  try {
    stored = await storage.savePdf({ document: documentDraft, bytes: dynamic.bytes, generatedAt });
  } catch (error) {
    throw new FinalInclusionsPdfError("STORAGE_UPLOAD_FAILED", "Final selections schedule could not be generated.", { reason: error?.message || String(error) });
  }

  const finalDocument = {
    ...documentDraft,
    ...stored,
    fileSizeBytes: dynamic.bytes.length,
    file_size_bytes: dynamic.bytes.length,
    fileHash,
    file_hash: fileHash,
    pageCount: dynamic.validation.pageCount,
    page_count: dynamic.validation.pageCount,
    status: documentDraft.status || "generated",
    metadata: {
      ...documentDraft.metadata,
      generatedAt,
      status: documentDraft.status || "generated",
      fileHash,
      fileSizeBytes: dynamic.bytes.length,
      pageCount: dynamic.validation.pageCount,
      dynamicPageCount: dynamic.validation.pageCount,
      masterPageCount: 0,
      closingPageCount: 0,
      standaloneClientSelectionsSchedule: true,
      pdfValidation: dynamic.validation,
      renderWarnings: dynamic.warnings,
      pdfMergePlan: finalInclusionsPdfMergePlan({
        masterPdf: false,
        dynamicPdf: { storagePath: stored.storagePath || stored.storage_path, pageCount: dynamic.validation.pageCount },
        closingPdf: false,
      }),
    },
  };

  try {
    const registered = await storage.registerDocument(finalDocument);
    return {
      document: { ...finalDocument, ...(registered || {}) },
      dynamic,
      merged: {
        pageCounts: { master: 0, dynamic: dynamic.validation.pageCount, closing: 0, total: dynamic.validation.pageCount },
        validation: dynamic.validation,
      },
      projectEstimateDocument: normaliseProjectEstimateInclusionsDocument({ ...finalDocument, ...(registered || {}) }),
      outOfDate: isFinalInclusionsDocumentOutOfDate(finalDocument, snapshot.selections),
    };
  } catch (error) {
    if (storage.markFailed) await storage.markFailed(finalDocument, error).catch(() => null);
    throw new FinalInclusionsPdfError("DOCUMENT_REGISTRATION_FAILED", "Final selections schedule could not be generated.", { reason: error?.message || String(error) });
  }
}

export function createLocalFinalInclusionsStorage({ rootDir, publicBasePath = "" } = {}) {
  if (!rootDir) throw new Error("rootDir is required for local final inclusions storage.");
  const documents = [];
  return {
    documents,
    async savePdf({ document, bytes }) {
      const storagePath = document.storagePath || document.storage_path;
      const localPath = path.join(rootDir, storagePath.replace(/^assets:/, "").replace(/[\\/]+/g, path.sep));
      await mkdir(path.dirname(localPath), { recursive: true });
      await writeFile(localPath, bytes);
      return {
        localPath,
        storagePath,
        storage_path: storagePath,
        publicUrl: publicBasePath ? `${publicBasePath.replace(/\/$/, "")}/${storagePath}` : localPath,
        public_url: publicBasePath ? `${publicBasePath.replace(/\/$/, "")}/${storagePath}` : localPath,
      };
    },
    async registerDocument(document) {
      const previousLatest = documents.filter((item) => item.projectId === document.projectId && item.metadata?.finalInclusionsSchedule);
      previousLatest.forEach((item) => {
        const immutable = item.metadata?.immutable === true || item.status === "issued" || item.status === "contract";
        if (item.id !== document.id && !immutable && ["generated", "active", "draft", "for_approval", "approved"].includes(item.status)) item.status = "outdated";
      });
      documents.push({ ...document, latest: true });
      documents.forEach((item) => {
        if (item.id !== document.id && item.projectId === document.projectId) item.latest = false;
      });
      return { id: document.id };
    },
    async markFailed(document, error) {
      documents.push({
        ...document,
        status: "failed",
        metadata: {
          ...(document.metadata || {}),
          status: "failed",
          failure: error?.message || String(error),
        },
      });
    },
    latestDocument() {
      return [...documents].reverse().find((document) => document.latest && !["failed", "outdated"].includes(document.status)) || null;
    },
  };
}

export async function validatePdfBytes(bytes, { expectedPageCount, label = "pdf" } = {}) {
  const buffer = Buffer.from(bytes || []);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new FinalInclusionsPdfError("INVALID_PDF_BYTES", "Final selections schedule could not be generated.", { label, reason: "Missing %PDF magic bytes." });
  }
  let pdf;
  try {
    pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch (error) {
    throw new FinalInclusionsPdfError("INVALID_PDF_PARSE", "Final selections schedule could not be generated.", { label, reason: error?.message || String(error) });
  }
  const pages = pdf.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = Number(page.getRotation?.().angle || 0);
    const rotated = Math.abs(rotation % 180) === 90;
    const displayWidth = rotated ? height : width;
    const displayHeight = rotated ? width : height;
    return {
      pageNumber: index + 1,
      width,
      height,
      rotation,
      orientation: displayWidth >= displayHeight ? "landscape" : "portrait",
    };
  });
  if (expectedPageCount && pages.length !== Number(expectedPageCount)) {
    throw new FinalInclusionsPdfError("PDF_PAGE_COUNT_MISMATCH", "Final selections schedule could not be generated.", {
      label,
      expectedPageCount: Number(expectedPageCount),
      actualPageCount: pages.length,
    });
  }
  return {
    valid: true,
    startsWithPdf: true,
    fileSizeBytes: buffer.length,
    pageCount: pages.length,
    title: pdf.getTitle() || "",
    subject: pdf.getSubject() || "",
    producer: pdf.getProducer() || "",
    pages,
  };
}

export async function readPdfFile(filePath, { expectedPageCount, label } = {}) {
  const bytes = await readFile(filePath);
  const validation = await validatePdfBytes(bytes, { expectedPageCount, label: label || path.basename(filePath) });
  return { bytes, validation, path: filePath };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}
