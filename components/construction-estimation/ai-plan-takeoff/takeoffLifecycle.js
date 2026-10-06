// Keep lifecycle bookkeeping outside React state: effect replay must never become
// a command to discard drawing state. The existing component ref is a stable owner,
// including when this helper itself is hot-updated, without changing the mounted
// component's hooks or the existing ref.current value.
const LIFECYCLE_KEY = Symbol.for('gr8.ai-plan-takeoff.lifecycle');

export function logTakeoffRefreshDiagnostic(event, details = {}) {
  if (typeof window === 'undefined') return;
  const entry = { event, timeOrigin: window.performance?.timeOrigin, at: Date.now(), ...details };
  const events = window.__gr8TakeoffRefreshDiagnostics || [];
  events.push(entry);
  if (events.length > 200) events.splice(0, events.length - 200);
  window.__gr8TakeoffRefreshDiagnostics = events;
  console.debug('TAKEOFF_REFRESH_DIAGNOSTIC', entry);
}

// Plan-load tracing. Opening a job runs asset reference -> asset read -> materialized page ->
// decoded image, and a break anywhere in that chain produces the same blank canvas. Record each
// step so the failing link is identifiable from the console instead of inferred.
export function logTakeoffPlanLoad(event, details = {}) {
  if (typeof window === 'undefined') return;
  const entry = { event, at: Date.now(), ...details };
  const events = window.__gr8TakeoffPlanLoadDiagnostics || [];
  events.push(entry);
  if (events.length > 200) events.splice(0, events.length - 200);
  window.__gr8TakeoffPlanLoadDiagnostics = events;
  console.debug('TAKEOFF_PLAN_LOAD', entry);
}

// Describe a job's plan references without copying the image payloads into the log.
export function describePlanPageReferences(pages = []) {
  return pages.map((page) => ({
    pageNumber: page?.pageNumber,
    assetId: page?.dataUrlAssetId || null,
    hasEmbeddedImage: typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:'),
  }));
}

export function createTakeoffObjectUrl(blob, purpose, log = logTakeoffRefreshDiagnostic) {
  const url = URL.createObjectURL(blob);
  log('object-url-created', { purpose, url });
  return url;
}

export function revokeTakeoffObjectUrl(url, purpose, log = logTakeoffRefreshDiagnostic) {
  URL.revokeObjectURL(url);
  log('object-url-revoked', { purpose, url });
}

export function getPlanDisplayIdentity(pages, pageNumber, pdfDoc = null) {
  const page = pages.find((item) => item.pageNumber === pageNumber) || pages[pageNumber - 1];
  return { pageNumber, asset: page?.dataUrlAssetId || page?.dataUrl || pdfDoc || null };
}

export function getTakeoffLifecycle(owner, { pages, pageNumber, pdfDoc, image, openRequest, openedTakeoffId }) {
  if (owner[LIFECYCLE_KEY]) return owner[LIFECYCLE_KEY];
  const page = pages.find((item) => item.pageNumber === pageNumber) || pages[pageNumber - 1];
  const lifecycle = {
    instanceId: `takeoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attachment: 0,
    hydrationVersion: 0,
    displayedPlanRef: { current: image ? getPlanDisplayIdentity(pages, pageNumber, pdfDoc) : null },
    // Adopt an already-open workspace when this guard first arrives via Fast Refresh.
    handledOpenTakeoffRequestRef: { current: openedTakeoffId && openRequest?.jobData
      ? (openRequest.requestId ?? openRequest) : null },
    imageRequest: image && page?.dataUrl ? { source: page.dataUrl, pageNumber, promise: Promise.resolve(image) } : null,
    lastPage: undefined,
    lastEavePoints: null,
    log(event, details = {}) {
      logTakeoffRefreshDiagnostic(event, { instanceId: lifecycle.instanceId, ...details });
    },
  };
  owner[LIFECYCLE_KEY] = lifecycle;
  return lifecycle;
}

// Hydration, the display effect and image recovery can request the same page in
// one render. Decode it once and prevent a slower previous page winning the race.
export function loadTakeoffPlanImage(lifecycle, page, pageNumber, loadImage, applyImage) {
  if (!page?.dataUrl) {
    lifecycle.imageRequest = null;
    applyImage(null, []);
    return Promise.resolve();
  }
  const current = lifecycle.imageRequest;
  if (current?.source === page.dataUrl && current.pageNumber === pageNumber) return current.promise;
  const request = { source: page.dataUrl, pageNumber, promise: null };
  lifecycle.imageRequest = request;
  lifecycle.log('plan-asset-load-start', { page: pageNumber });
  request.promise = Promise.resolve().then(() => loadImage(page.dataUrl)).then((image) => {
    if (lifecycle.imageRequest !== request) {
      lifecycle.log('plan-asset-load-superseded', { page: pageNumber });
      return;
    }
    applyImage(image, page.vectorSegments || []);
    lifecycle.log('plan-asset-load-end', { page: pageNumber });
    return image;
  }).catch((error) => {
    if (lifecycle.imageRequest === request) lifecycle.imageRequest = null;
    lifecycle.log('plan-asset-load-error', { page: pageNumber });
    throw error;
  });
  return request.promise;
}
