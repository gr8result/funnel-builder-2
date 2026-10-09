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
