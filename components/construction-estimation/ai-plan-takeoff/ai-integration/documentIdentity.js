// Identity of the actual canvas document, not its filename or current view. The
// active Takeoff retains rendered pages rather than the original PDF bytes.
const fingerprints = new WeakMap();

async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Document verification requires a secure browser context.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Identity of one rendered sheet. A cached page inspection is valid only while
// this fingerprint is unchanged, i.e. the same image at the same page number/size.
const pageFingerprints = new WeakMap();
export function fingerprintTakeoffPage(page) {
  if (typeof page?.dataUrl !== 'string' || !page.dataUrl.startsWith('data:')) return Promise.reject(new Error('Restore all plan images before analysis.'));
  if (!pageFingerprints.has(page)) {
    const result = (async () => `page-sha256:${await sha256(JSON.stringify({
      pageNumber: page.pageNumber, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, imageHash: await sha256(page.dataUrl),
    }))}`)();
    pageFingerprints.set(page, result);
    result.catch(() => pageFingerprints.delete(page));
  }
  return pageFingerprints.get(page);
}

export function fingerprintTakeoffDocument(pages) {
  if (!Array.isArray(pages) || !pages.length) return Promise.reject(new Error('Open a plan before importing AI detections.'));
  if (!fingerprints.has(pages)) {
    const result = (async () => {
      const manifest = [];
      for (const page of pages) {
        if (typeof page.dataUrl !== 'string' || !page.dataUrl.startsWith('data:')) {
          throw new Error('Restore all plan images before importing AI detections.');
        }
        manifest.push({
          pageNumber: page.pageNumber,
          logicalWidth: page.logicalWidth,
          logicalHeight: page.logicalHeight,
          imageHash: await sha256(page.dataUrl),
        });
      }
      return `canvas-sha256:${await sha256(JSON.stringify(manifest))}`;
    })();
    fingerprints.set(pages, result);
    result.catch(() => fingerprints.delete(pages));
  }
  return fingerprints.get(pages);
}
