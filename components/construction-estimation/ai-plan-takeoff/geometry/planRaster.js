// The sheet image as pixels for the linework engine. Unlike the copy sent to the plan reading, it
// is kept at (or near) the stored resolution: a 70 mm wall must stay several pixels wide.
export const LINEWORK_RASTER_MAX_SIDE = 4400;

export async function readPlanRaster(dataUrl, maxSide = LINEWORK_RASTER_MAX_SIDE) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error('The sheet has no stored plan image.');
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    // Release the temporary raster; the stored plan image is untouched.
    canvas.width = 1; canvas.height = 1; image.src = '';
  }
}

// One region of the sheet as its own enlarged image for the plan reading. `region` is in the
// sheet's logical units; the image is the region and nothing else, so a point at fraction (x, y)
// of the image is the sheet point (region.x + x * region.width, region.y + y * region.height).
export async function cropPlanRegion(dataUrl, sheet, region, targetSide = 1800) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error('The sheet has no stored plan image.');
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const sx = image.naturalWidth / sheet.logicalWidth, sy = image.naturalHeight / sheet.logicalHeight;
  const source = { x: region.x * sx, y: region.y * sy, width: region.width * sx, height: region.height * sy };
  const scale = Math.min(4, targetSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  try {
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
    return { imageDataUrl: canvas.toDataURL('image/jpeg', 0.92), imageWidth: canvas.width, imageHeight: canvas.height, imageRotation: 0 };
  } finally { canvas.width = 1; canvas.height = 1; image.src = ''; }
}
