// The sheet image as pixels for the linework engine. Unlike the copy sent to the plan reading, it
// is kept at (or near) the stored resolution: a 70 mm wall must stay several pixels wide.
export const LINEWORK_RASTER_MAX_SIDE = 4400;
// The engine's line and wall tests are tuned for about this many image pixels per millimetre of
// building (a 90 mm wall about 8 pixels wide). Pages are stored at whatever the screen's pixel
// ratio and zoom gave when the plan was loaded, so a calibrated sheet is brought to this
// resolution, up or down, and the same plan reads the same on any machine.
export const LINEWORK_PIXELS_PER_MM = 0.09;

// sheet: { logicalWidth, pixelsPerMm } of the calibrated sheet, when known.
export async function readPlanRaster(dataUrl, maxSide = LINEWORK_RASTER_MAX_SIDE, sheet = null) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error('The sheet has no stored plan image.');
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const limit = maxSide / Math.max(image.naturalWidth, image.naturalHeight);
  const stored = sheet?.logicalWidth > 0 && sheet?.pixelsPerMm > 0 ? sheet.pixelsPerMm * image.naturalWidth / sheet.logicalWidth : 0;
  const wanted = stored > 0 && Math.abs(stored / LINEWORK_PIXELS_PER_MM - 1) > 0.1 ? Math.max(0.35, Math.min(2.5, LINEWORK_PIXELS_PER_MM / stored)) : 1;
  const ratio = Math.min(wanted, limit);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const raster = context.getImageData(0, 0, canvas.width, canvas.height);
    // What the stored image itself resolves, before any enlargement: enlarging adds no detail.
    if (stored > 0) raster.storedPixelsPerMm = stored;
    return raster;
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
