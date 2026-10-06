// Additional evidence for the AI reader. These fields travel with the existing
// embedded page; the manual canvas still uses its existing image and vectors.
export async function readPdfAnalysisEvidence(page, viewport) {
  try {
    const content = await page.getTextContent();
    return {
      pdfUnits: true,
      textItems: content.items.filter((item) => typeof item.str === 'string' && item.str.trim()).map((item) => {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return { text: item.str, x, y, width: item.width, height: item.height };
      }),
    };
  } catch {
    // Failure to extract optional text must never break the existing PDF upload.
    return { pdfUnits: true, textItems: [] };
  }
}

export async function prepareAnalysisPage(page, imageRotation = 0) {
  if (![0, 90, 180, 270].includes(imageRotation)) throw new Error('Unsupported analysis image rotation.');
  if (!page?.dataUrl?.startsWith('data:')) throw new Error(`Sheet ${page?.pageNumber || '?'} has no restored plan image.`);
  const image = new Image();
  image.src = page.dataUrl;
  await image.decode();
  const ratio = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.width = imageRotation % 180 ? height : width;
  canvas.height = imageRotation % 180 ? width : height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(imageRotation * Math.PI / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  const imageWidth = canvas.width;
  const imageHeight = canvas.height;
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  // Release the temporary raster; the original stored plan remains untouched.
  canvas.width = 1;
  canvas.height = 1;
  let textBudget = 89998;
  const textItems = [];
  for (const item of (page.textItems || []).slice(0, 3000)) {
    if (textBudget <= 0) break;
    const text = String(item.text || '').slice(0, Math.min(1500, textBudget));
    const record = imageRotation ? { text } : { text, ...Object.fromEntries(['x', 'y', 'width', 'height'].filter((key) => Number.isFinite(item[key])).map((key) => [key, item[key]])) };
    const size = JSON.stringify(record).length + 1;
    if (size > textBudget) break;
    textBudget -= size;
    textItems.push(record);
  }
  return {
    pageNumber: page.pageNumber,
    logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight,
    pdfUnits: page.pdfUnits === true, imageRotation, imageWidth, imageHeight,
    imageDataUrl,
    textItems,
  };
}

// A separate visual check exposes approximate AI coordinates against the real
// drawing. The original unmarked image is always also sent as the source of truth.
export async function prepareGeometryReviewImage(page, analysis) {
  const image = new Image();
  image.src = page.imageDataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  context.font = '12px sans-serif';
  const point = (node) => ({ x: node.x * canvas.width, y: node.y * canvas.height });
  const label = (text, x, y, color) => {
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.fillRect(x + 3, y - 14, context.measureText(text).width + 6, 15);
    context.fillStyle = color;
    context.fillText(text, x + 6, y - 2);
  };
  for (const [key, color] of [['walls', '#e11d48'], ['buildingAreas', '#0284c7']]) {
    for (const item of analysis[key] || []) {
      if (!item.nodes?.length) continue;
      context.strokeStyle = color;
      context.lineWidth = key === 'walls' ? 3 : 2;
      context.beginPath();
      item.nodes.forEach((node, index) => { const p = point(node); if (index) context.lineTo(p.x, p.y); else context.moveTo(p.x, p.y); });
      if (key === 'buildingAreas') context.closePath();
      context.stroke();
      item.nodes.forEach((node, index) => {
        const p = point(node);
        context.fillStyle = color;
        context.fillRect(p.x - 3, p.y - 3, 6, 6);
        label(`${item.detectionId}:${index} [${Math.round(p.x)},${Math.round(p.y)}]`, p.x, p.y, color);
      });
    }
  }
  for (const item of analysis.openings || []) {
    const p = point(item);
    context.strokeStyle = '#7c3aed';
    context.beginPath(); context.arc(p.x, p.y, 8, 0, Math.PI * 2); context.stroke();
    label(`${item.detectionId} [${Math.round(p.x)},${Math.round(p.y)}]`, p.x, p.y, '#7c3aed');
  }
  const result = canvas.toDataURL('image/jpeg', 0.9);
  canvas.width = 1; canvas.height = 1;
  return result;
}

// Inverse of the temporary full-page rotation, before Phase 1 sees any geometry.
export function restoreAnalysisCoordinates(analysis, rotation = 0) {
  const point = ({ x, y, ...other }) => ({ ...other, ...(rotation === 90 ? { x: y, y: 1 - x }
    : rotation === 180 ? { x: 1 - x, y: 1 - y }
      : rotation === 270 ? { x: 1 - y, y: x } : { x, y }) });
  const item = (value) => ({
    ...value,
    ...(Array.isArray(value.nodes) ? { nodes: value.nodes.map(point) } : {}),
    ...(Number.isFinite(value.x) && Number.isFinite(value.y) ? point(value) : {}),
  });
  return {
    ...analysis,
    ...Object.fromEntries(['walls', 'openings', 'buildingAreas', 'pillars', 'eaves', 'rooms', 'fixtures'].map((key) => [key, (analysis[key] || []).map(item)])),
  };
}
