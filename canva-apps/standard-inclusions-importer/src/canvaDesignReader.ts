import { openDesign, requestExport } from "@canva/design";
import type { CanvaImportedElement, CanvaImportedPage, CanvaImportManifest } from "./types";

export async function readCurrentCanvaDesign(onProgress: (message: string) => void): Promise<CanvaImportManifest> {
  const pages: CanvaImportedPage[] = [];
  let designName = "Current Canva design";
  let designId = "current-design";

  await openDesign({ type: "all_pages" } as never, async (session: any) => {
    const pageRefs = Array.isArray(session.pageRefs) ? session.pageRefs : [];
    onProgress(`Pages detected: ${pageRefs.length}`);
    for (let index = 0; index < pageRefs.length; index += 1) {
      const pageRef = pageRefs[index];
      onProgress(`Reading page ${index + 1} of ${pageRefs.length}...`);
      const pageResult = await session.openPage(pageRef);
      const page = pageResult.page;
      if (page.type !== "absolute") {
        throw new Error(`Page ${index + 1} is not an absolute Canva page and cannot be imported as a native template.`);
      }
      designName = session.design?.title || session.design?.name || designName;
      designId = session.design?.id || session.designId || designId;
      pages.push({
        sourcePageId: String(page.id || pageRef.id || `page-${index + 1}`),
        pageIndex: index + 1,
        width: Number(page.width || page.dimensions?.width || 0),
        height: Number(page.height || page.dimensions?.height || 0),
        background: serialiseFill(page.background),
        elements: readElementList(page.elements, String(page.id || pageRef.id || `page-${index + 1}`)),
      });
    }
  });

  return {
    schemaVersion: 1,
    source: "canva-app-design-editing-api",
    designId,
    designName,
    exportedAt: new Date().toISOString(),
    pageSize: pages[0] ? { width: pages[0].width, height: pages[0].height } : undefined,
    pages,
  };
}

export async function exportCanvaPageReferences(onProgress: (message: string) => void) {
  onProgress("Exporting Canva page references...");
  const png = await requestExport({
    acceptedFileTypes: [{ type: "png", zipped: "never" }],
  } as never);
  const pdf = await requestExport({
    acceptedFileTypes: [{ type: "pdf_standard" }],
  } as never);
  return { png, pdf, pageAssets: exportedPageAssets(png) };
}

export function applyRenderedPageAssets(manifest: CanvaImportManifest, exportResult: any): CanvaImportManifest {
  const assets = Array.isArray(exportResult?.pageAssets) ? exportResult.pageAssets : exportedPageAssets(exportResult?.png || exportResult);
  return {
    ...manifest,
    pages: manifest.pages.map((page, index) => ({
      ...page,
      renderedPageAsset: assets[index] ? {
        ...assets[index],
        sourceElementId: pageRenderSourceId(page.sourcePageId, page.pageIndex),
      } : page.renderedPageAsset,
    })),
  };
}

function pageRenderSourceId(sourcePageId: string, pageIndex: number) {
  return `__canva_page_render_${sourcePageId || pageIndex}`;
}

function exportedPageAssets(exportResult: any) {
  const candidates = [
    exportResult?.pages,
    exportResult?.assets,
    exportResult?.files,
    exportResult?.urls,
    exportResult?.exportBlobs,
    exportResult?.blobs,
    exportResult?.result?.pages,
    exportResult?.result?.files,
    exportResult?.result?.urls,
  ].find((item) => Array.isArray(item)) || [];
  return candidates.map((item: any, index: number) => {
    const url = typeof item === "string" ? item : item?.url || item?.href || item?.downloadUrl || item?.publicUrl || "";
    const base64 = item?.base64 || item?.dataUrl || "";
    return {
      sourceElementId: `__canva_page_render_${index + 1}`,
      fileName: item?.fileName || item?.filename || `canva-page-${String(index + 1).padStart(2, "0")}.png`,
      mimeType: item?.mimeType || item?.type || "image/png",
      publicUrl: url,
      base64,
    };
  }).filter((item: any) => item.publicUrl || item.base64);
}

function readElementList(list: any, pageId: string, groupPath: string[] = []): CanvaImportedElement[] {
  const items = typeof list?.toArray === "function" ? list.toArray() : Array.isArray(list) ? list : [];
  return items.map((element: any, index: number) => readElement(element, pageId, index, groupPath));
}

function readElement(element: any, pageId: string, zIndex: number, groupPath: string[]): CanvaImportedElement {
  const sourceElementId = String(element.id || element.ref || `${pageId}-element-${zIndex}`);
  const base = {
    sourceElementId,
    pageId,
    type: String(element.type || "unsupported"),
    name: element.name || "",
    x: Number(element.left ?? element.x ?? 0),
    y: Number(element.top ?? element.y ?? 0),
    width: Number(element.width || 1),
    height: Number(element.height || 1),
    rotation: Number(element.rotation || 0),
    opacity: Number(1 - Number(element.transparency || 0)) || 1,
    zIndex,
    locked: Boolean(element.locked),
    groupPath,
  };
  if (element.type === "text") {
    const text = readPlaintext(element);
    return {
      ...base,
      type: "text",
      text,
      richTextRuns: readRichTextRuns(element, text),
      textAlign: readTextAlign(element),
      lineHeight: element.text?.lineHeight || element.lineHeight,
    };
  }
  if (element.type === "group") {
    return {
      ...base,
      type: "group",
      children: readElementList(element.contents || element.elements, pageId, [...groupPath, sourceElementId]),
    };
  }
  if (element.type === "rect") {
    const fill = serialiseFill(element.fill);
    return {
      ...base,
      type: fill?.media ? "image" : "rectangle",
      fill: fill?.color || "",
      stroke: serialiseStroke(element.stroke)?.color || "",
      strokeWidth: serialiseStroke(element.stroke)?.weight || 0,
      fit: fill?.media ? "cover" : undefined,
      crop: fill?.media || undefined,
    };
  }
  if (element.type === "shape") {
    return {
      ...base,
      type: "shape",
      fill: serialiseFill(element.fill)?.color || "",
      stroke: serialiseStroke(element.stroke)?.color || "",
      strokeWidth: serialiseStroke(element.stroke)?.weight || 0,
    };
  }
  return { ...base, unsupported: true };
}

function readPlaintext(element: any) {
  try {
    return element.text?.readPlaintext?.() || element.text?.plaintext || "";
  } catch {
    return "";
  }
}

function readRichTextRuns(element: any, text: string) {
  try {
    const formatting = element.text?.readFormatting?.() || [];
    if (Array.isArray(formatting) && formatting.length) return formatting;
  } catch {}
  return [{
    start: 0,
    end: text.length,
    fontFamily: element.text?.fontFamily,
    fontRef: element.text?.fontRef,
    fontSize: element.text?.fontSize,
    fontWeight: element.text?.fontWeight,
    fontStyle: element.text?.fontStyle,
    textDecoration: element.text?.decoration,
    colour: element.text?.color,
    letterSpacing: element.text?.letterSpacing,
  }];
}

function readTextAlign(element: any) {
  return element.text?.textAlign || element.textAlign || "left";
}

function serialiseFill(fill: any) {
  if (!fill) return null;
  return {
    color: fill.colorContainer?.ref?.color || fill.colorContainer?.color || fill.color || "",
    media: fill.media || fill.image || fill.video || null,
    rawType: fill.type || "",
  };
}

function serialiseStroke(stroke: any) {
  if (!stroke) return null;
  return {
    color: stroke.color || stroke.colorContainer?.ref?.color || "",
    weight: Number(stroke.weight || stroke.width || 0),
  };
}
