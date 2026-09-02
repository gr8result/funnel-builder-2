// PDF text extraction for takeoff diagnostics.
//
// Coordinates are kept in the same unrotated PDF point space as vector
// extraction. Text boxes are deliberately approximate: they are a rejection /
// down-weight signal for structural graph cleanup, not user-facing geometry.

export function extractTextBoxesFromTextContent(textContent = {}, { pageWidth = 0, pageHeight = 0 } = {}) {
  const items = Array.isArray(textContent.items) ? textContent.items : [];
  return items
    .map((item, index) => {
      const text = String(item.str || "").trim();
      if (!text) return null;
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const [a, b, c, d, e, f] = transform;
      const fontSize = Math.max(Math.hypot(a, b), Math.hypot(c, d), Number(item.height) || 0, 1);
      const width = Math.max(Number(item.width) || text.length * fontSize * 0.45, fontSize * 0.5);
      const height = Math.max(Number(item.height) || fontSize, fontSize);
      const rotation = Math.atan2(b, a) * 180 / Math.PI;
      const x = e;
      const y = pageHeight > 0 ? Math.max(0, Math.min(pageHeight, f - height)) : f - height;
      return {
        id: `txt-${index + 1}`,
        text,
        bbox: {
          x,
          y,
          width,
          height: height * 1.15,
        },
        rotation,
        fontSize,
      };
    })
    .filter(Boolean);
}

export async function extractPdfTextBoxes(pdfDocument, pageNumber, { pageWidth = 0, pageHeight = 0 } = {}) {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return extractTextBoxesFromTextContent(textContent, { pageWidth, pageHeight });
}
