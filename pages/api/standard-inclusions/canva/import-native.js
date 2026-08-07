import { JSDOM } from "jsdom";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaDatabaseStatus, canvaFetch, canvaSetupError, loadCanvaConnection } from "../../../../lib/standard-inclusions/canvaConnect";
import { importPptxAsStandardDocumentPreview } from "../../../../lib/standard-inclusions/powerpointImport.js";

const FORMAT_PREFERENCE = ["pptx", "powerpoint", "presentation"];
const HIGH_FIDELITY_REQUIRED_MESSAGE = "Import failed visual validation.\n\nThe Canva layout could not be reproduced accurately.\nYour current Standard Inclusions template has not been changed.";

async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const designId = String(req.body?.designId || "");
    if (!designId) return res.status(400).json({ ok: false, code: "CANVA_DESIGN_REQUIRED", error: "Select a Canva design before importing a native template." });
    const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
    if (setupError) return res.status(501).json({ ok: false, code: setupError.code, error: setupError.message, missing: setupError.missing || [] });
    const connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id, requireFresh: true });
    if (!connection) return res.status(401).json({ ok: false, code: "CANVA_NOT_CONNECTED", error: "Connect Canva as an administrator before importing the system base template." });

    const design = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}`);
    const pages = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}/pages`).catch(() => ({ items: [] }));
    const formatsPayload = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}/export-formats`);
    const formats = formatsPayload?.formats || {};
    const availableFormats = Object.keys(formats).sort();
    const selectedFormat = selectNativeImportFormat(formats);
    const expectedPageCount = Array.isArray(pages?.items) && pages.items.length ? pages.items.length : 10;
    const audit = {
      availableFormats,
      selectedFormat,
      expectedPageCount,
      decision: selectedFormat
        ? "PPTX was selected because it can preserve editable text, images, shapes, coordinates and page order better than PDF."
        : "No structured editable export format was available. PDF can be used only as a visual reference, not as the final editable model.",
      pdfRole: formats.pdf ? "visual-reference-only" : "not-available",
    };
    if (!selectedFormat) {
      return res.status(422).json({
        ok: false,
        code: "CANVA_STRUCTURED_EXPORT_UNAVAILABLE",
        error: "This Canva design does not expose a PPTX export through Canva Connect, so it cannot be converted into a native editable Standard Inclusions template automatically.",
        audit,
      });
    }

    const exportJob = await startCanvaExport(connection, designId, selectedFormat);
    const exportUrl = await waitForCanvaExport(connection, exportJob);
    const buffer = await downloadExport(exportUrl);
    if (!isPptxZip(buffer)) {
      return res.status(502).json({ ok: false, code: "CANVA_PPTX_EXPORT_INVALID", error: "Canva returned a structured export, but it was not a valid PPTX package.", audit });
    }

    if (typeof globalThis.DOMParser === "undefined") {
      globalThis.DOMParser = new JSDOM("").window.DOMParser;
    }
    const title = design?.title || design?.design?.title || "Premier Inclusions Schedule";
    const imported = await importPptxAsStandardDocumentPreview({
      name: `${title}.pptx`,
      arrayBuffer: async () => buffer,
    }, { expectedSlideCount: expectedPageCount });
    const counts = countNativeObjects(imported.document);
    const validation = validateHighFidelityImport(imported, counts, audit);
    if (!validation.canPublish) {
      return res.status(422).json({
        ok: false,
        code: "CANVA_HIGH_FIDELITY_RENDER_REQUIRED",
        error: HIGH_FIDELITY_REQUIRED_MESSAGE,
        audit,
        import: imported,
        counts,
        sourceFormat: selectedFormat,
        validation,
      });
    }
    return res.status(200).json({
      ok: true,
      design,
      audit,
      import: imported,
      counts,
      sourceFormat: selectedFormat,
      validation,
    });
  } catch (error) {
    const code = error?.code || "CANVA_NATIVE_IMPORT_FAILED";
    const status = code === "CANVA_NATIVE_EXPORT_TIMEOUT" ? 504 : code === "CANVA_NATIVE_EXPORT_URL_EXPIRED" ? 502 : 500;
    return res.status(status).json({
      ok: false,
      code,
      error: error?.message || "Could not convert the Canva design into native Standard Inclusions pages.",
    });
  }
}

function validateHighFidelityImport(imported = {}, counts = {}, audit = {}) {
  const document = imported.document || {};
  const pages = Array.isArray(document.pages) ? document.pages : [];
  const pageResults = pages.map((page, index) => {
    const objects = Array.isArray(page.objects) ? page.objects : [];
    const hasVisualReference = Boolean(page.background?.imageRef);
    const widthMatches = Number(page.width || 0) === 794;
    const heightMatches = Number(page.height || 0) === 1123;
    return {
      pageNumber: index + 1,
      status: hasVisualReference && widthMatches && heightMatches ? "Needs review" : "Failed",
      hasVisualReference,
      thumbnailBlank: !hasVisualReference,
      width: Number(page.width || 0),
      height: Number(page.height || 0),
      editableTextCount: objects.filter((object) => object.type === "text").length,
      editableImageCount: objects.filter((object) => object.type === "image" || object.type === "logo").length,
      fixedVisualElementCount: hasVisualReference ? 1 : objects.filter((object) => object.data?.fixedVisual === true).length,
      missingFonts: document.metadata?.missingFonts || [],
      issues: [
        !hasVisualReference ? "High-fidelity rendered source page is missing." : "",
        !widthMatches || !heightMatches ? "Page dimensions do not match the required portrait source size." : "",
      ].filter(Boolean),
    };
  });
  const warningText = (imported.warnings || []).join("\n");
  const legacyConversion = /legacy object conversion|pptx-object-conversion/i.test(`${warningText}\n${document.metadata?.importMode || ""}`);
  const blankPreviewCount = pageResults.filter((page) => page.thumbnailBlank).length;
  const failedPageCount = pageResults.filter((page) => page.status === "Failed").length;
  return {
    mode: "high-fidelity-hybrid-import",
    canPublish: false,
    status: "Failed",
    message: HIGH_FIDELITY_REQUIRED_MESSAGE,
    reason: legacyConversion
      ? "High-fidelity slide rendering was not available, so the importer used the legacy object conversion. That path is blocked because it may not visually match the Canva/PPTX source."
      : "High-fidelity visual validation has not passed.",
    expectedPageCount: audit.expectedPageCount || pages.length,
    renderedPageCount: pageResults.filter((page) => page.hasVisualReference).length,
    blankPreviewCount,
    failedPageCount: Math.max(failedPageCount, blankPreviewCount),
    visualDifferenceTolerance: "not-evaluated",
    pages: pageResults,
    counts,
  };
}

function selectNativeImportFormat(formats = {}) {
  const keys = Object.keys(formats || {});
  return FORMAT_PREFERENCE.find((preferred) => keys.some((key) => key.toLowerCase() === preferred)) || "";
}

async function startCanvaExport(connection, designId, formatType) {
  const job = await canvaFetch(connection, "/exports", {
    method: "POST",
    body: JSON.stringify({ design_id: designId, format: { type: formatType } }),
  });
  const jobId = job?.job?.id || job?.id;
  if (!jobId) {
    const error = new Error("Canva did not return an export job ID for the native template export.");
    error.code = "CANVA_NATIVE_EXPORT_FAILED";
    throw error;
  }
  return job;
}

async function waitForCanvaExport(connection, exportJob) {
  const jobId = exportJob?.job?.id || exportJob?.id;
  let current = exportJob;
  let status = current?.job?.status || current?.status || "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    current = await canvaFetch(connection, `/exports/${encodeURIComponent(jobId)}`);
    status = current?.job?.status || current?.status || "";
    if (status === "success") {
      const urls = current?.job?.urls || current?.urls || [];
      const url = Array.isArray(urls) ? urls[0] : urls?.url;
      if (!url) throw new Error("Canva completed the export but did not return a download URL.");
      return url;
    }
    if (status === "failed") throw new Error(current?.job?.error?.message || "Canva native template export failed.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const error = new Error("Canva native template export timed out before the PPTX was ready.");
  error.code = "CANVA_NATIVE_EXPORT_TIMEOUT";
  throw error;
}

async function downloadExport(exportUrl) {
  const response = await fetch(exportUrl);
  if (!response.ok) {
    const error = new Error("Canva native export URL expired or could not be downloaded.");
    error.code = "CANVA_NATIVE_EXPORT_URL_EXPIRED";
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

function isPptxZip(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function countNativeObjects(document = {}) {
  const counts = { pages: 0, text: 0, image: 0, shape: 0, other: 0 };
  const pages = Array.isArray(document.pages) ? document.pages : [];
  counts.pages = pages.length;
  pages.forEach((page) => {
    (page.objects || []).forEach((object) => {
      if (object.type === "text") counts.text += 1;
      else if (object.type === "image" || object.type === "logo") counts.image += 1;
      else if (object.type === "shape") counts.shape += 1;
      else counts.other += 1;
    });
  });
  return counts;
}

export default withWorkspace(handler);
