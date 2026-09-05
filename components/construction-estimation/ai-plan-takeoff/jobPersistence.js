import { AI_PLAN_TAKEOFF_FILE_TYPE } from "../../../lib/gr8FileTypes.js";
import { materializeTakeoffPlanPages } from './planBlobStorage.js';

const DEFAULT_FLOOR_COVERING_COLOURS = {
  Tiles: { fill: 'rgba(76, 175, 80, 0.35)', stroke: '#2e7d32', text: '#1b5e20' },
  Hybrid: { fill: 'rgba(33, 150, 243, 0.35)', stroke: '#1565c0', text: '#0d47a1' },
  Carpets: { fill: 'rgba(255, 214, 0, 0.42)', stroke: '#f9a825', text: '#8a5a00' },
  'Polished Concrete': { fill: 'rgba(255, 152, 0, 0.35)', stroke: '#ef6c00', text: '#e65100' },
  'exposed Agg': { fill: 'rgba(233, 30, 99, 0.35)', stroke: '#c2185b', text: '#880e4f' }
};

function numericPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0
  };
}

function polygonAreaM2(nodes, pixelsPerMm) {
  if (!Array.isArray(nodes) || nodes.length < 3 || !pixelsPerMm) return 0;
  let areaPx = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const nextIndex = (index + 1) % nodes.length;
    areaPx += nodes[index].x * nodes[nextIndex].y - nodes[nextIndex].x * nodes[index].y;
  }
  return Math.abs(areaPx / 2) / (pixelsPerMm * pixelsPerMm) / 1000000;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'string' && value.startsWith('data:')) {
    return JSON.stringify(`[data-url:${value.length}:${value.slice(0, 64)}:${value.slice(-64)}]`);
  }
  return JSON.stringify(value ?? null);
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function checksumSource(job = {}) {
  return {
    rotation: job.rotation,
    pixelsPerMm: job.pixelsPerMm,
    plan: {
      type: job.plan?.type,
      totalPages: job.plan?.totalPages,
      pages: getEmbeddedPlanPages(job).map((page) => ({
        pageNumber: page.pageNumber,
        dataUrl: page.dataUrl,
        width: page.width,
        height: page.height,
        logicalWidth: page.logicalWidth,
        logicalHeight: page.logicalHeight,
        renderScale: page.renderScale,
        vectorSegments: Array.isArray(page.vectorSegments) ? page.vectorSegments.length : 0
      }))
    },
    completedWallRuns: job.completedWallRuns || [],
    placedOpenings: job.placedOpenings || [],
    completedAreas: job.completedAreas || [],
    completedFloorplans: job.completedFloorplans || [],
    completedMeasurements: job.completedMeasurements || [],
    completedEaves: job.completedEaves || []
  };
}

export function createTakeoffContentChecksum(job = {}) {
  return hashString(stableStringify(checksumSource(job)));
}

export function getTakeoffCounts(job = {}) {
  return {
    planPages: getEmbeddedPlanPages(job).length,
    renderablePlanPages: getEmbeddedPlanPages(job).filter((page) => typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:')).length,
    floorCoverings: Array.isArray(job.completedAreas) ? job.completedAreas.length : 0,
    floorplans: Array.isArray(job.completedFloorplans) ? job.completedFloorplans.length : 0,
    walls: Array.isArray(job.completedWallRuns) ? job.completedWallRuns.length : 0,
    openings: Array.isArray(job.placedOpenings) ? job.placedOpenings.length : 0,
    eaves: Array.isArray(job.completedEaves) ? job.completedEaves.length : 0,
    measurements: Array.isArray(job.completedMeasurements) ? job.completedMeasurements.length : 0
  };
}

export function takeoffCountsMatch(a = {}, b = {}) {
  return stableStringify(getTakeoffCounts(a)) === stableStringify(getTakeoffCounts(b));
}

function normaliseExclusion(exclusion, index, pixelsPerMm) {
  const nodes = Array.isArray(exclusion?.nodes) ? exclusion.nodes.map(numericPoint) : [];
  return {
    ...exclusion,
    id: exclusion?.id ?? `exclusion-${index + 1}`,
    nodes,
    areaM2: Number.isFinite(Number(exclusion?.areaM2)) ? Number(exclusion.areaM2) : polygonAreaM2(nodes, pixelsPerMm)
  };
}

export function normaliseFloorCoveringAreas(areas = [], pixelsPerMm = null) {
  if (!Array.isArray(areas)) return [];
  return areas
    .filter((area) => area && typeof area === 'object')
    .map((area, index) => {
      const category = area.category || area.floorCoveringCategory || area.type || 'Tiles';
      const colour = area.colour || area.color || area.displayColour || DEFAULT_FLOOR_COVERING_COLOURS[category] || DEFAULT_FLOOR_COVERING_COLOURS.Tiles;
      const nodes = Array.isArray(area.nodes) ? area.nodes.map(numericPoint) : [];
      const exclusions = Array.isArray(area.exclusions)
        ? area.exclusions.map((exclusion, exclusionIndex) => normaliseExclusion(exclusion, exclusionIndex, pixelsPerMm))
        : [];
      const grossAreaM2 = Number.isFinite(Number(area.grossAreaM2))
        ? Number(area.grossAreaM2)
        : Number.isFinite(Number(area.areaM2))
          ? Number(area.areaM2)
          : polygonAreaM2(nodes, pixelsPerMm);
      const exclusionAreaM2 = exclusions.reduce((sum, exclusion) => sum + (Number(exclusion.areaM2) || 0), 0);
      const netAreaM2 = Number.isFinite(Number(area.netAreaM2))
        ? Number(area.netAreaM2)
        : Math.max(0, grossAreaM2 - exclusionAreaM2);
      const page = Number(area.page ?? area.pageId ?? area.sheetId) || 1;

      return {
        ...area,
        id: area.id ?? `floor-covering-${page}-${index + 1}`,
        page,
        pageId: area.pageId ?? page,
        level: area.level || area.storey || area.storeyOrLevel || `Sheet ${page}`,
        category,
        customCategoryName: area.customCategoryName || (DEFAULT_FLOOR_COVERING_COLOURS[category] ? '' : category),
        nodes,
        exclusions,
        areaM2: netAreaM2,
        grossAreaM2,
        netAreaM2,
        colour,
        displayColour: area.displayColour || colour.fill || colour,
        label: area.label || `${category}: ${netAreaM2.toFixed(2)} m2`,
        notes: area.notes || '',
        createdAt: area.createdAt || new Date().toISOString(),
        updatedAt: area.updatedAt || area.createdAt || new Date().toISOString()
      };
    });
}

export function createJobData({
  name,
  currentPage,
  totalPages,
  rotation,
  pixelsPerMm,
  planPages,
  completedWallRuns,
  placedOpenings,
  completedAreas,
  completedFloorplans,
  completedMeasurements,
  completedEaves,
  projectInfo,
  planFilename,
  sourceFileName,
  takeoffId,
  associatedProjectId,
  associatedProjectName,
  openedWithoutAttaching,
  platformProject,
  scheduleState,
  baseRevision,
  revision
}) {
  const floorCoveringAreas = normaliseFloorCoveringAreas(completedAreas, pixelsPerMm);

  return {
    schemaVersion: 'ai-plan-takeoff.v1',
    gr8FileType: AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType,
    moduleType: AI_PLAN_TAKEOFF_FILE_TYPE.moduleType,
    version: '2.0',
    takeoffId: takeoffId || `takeoff-${Date.now()}`,
    jobName: name,
    takeoffName: name,
    associatedProjectId: associatedProjectId || platformProject?.projectId || '',
    associatedProjectName: associatedProjectName || platformProject?.projectName || projectInfo?.projectName || '',
    openedWithoutAttaching: Boolean(openedWithoutAttaching),
    sourceFileName: sourceFileName || planFilename || '',
    revision: Number(revision || 0),
    baseRevision: Number(baseRevision || revision || 0),
    updatedAt: new Date().toISOString(),
    currentPage,
    totalPages,
    rotation,
    pixelsPerMm,
    plan: {
      type: 'embedded-pages',
      totalPages: planPages?.length || totalPages || 0,
      pages: planPages || []
    },
    completedWallRuns: completedWallRuns || [],
    placedOpenings: placedOpenings || [],
    completedAreas: floorCoveringAreas,
    completedFloorplans: completedFloorplans || [],
    completedMeasurements: completedMeasurements || [],
    completedEaves: completedEaves || [],
    projectInfo: projectInfo || {},
    planFilename: planFilename || '',
    platformProject: platformProject || {},
    scheduleState: scheduleState || {}
  };
}

export function getEmbeddedPlanPages(jobData) {
  return jobData?.plan?.pages || jobData?.planPages || [];
}

export function resolveAiPlanTakeoffJobData(data) {
  const candidates = [
    data,
    data?.aiPlanTakeoffJob,
    data?.takeoffEngine?.aiPlanTakeoffJob,
    data?.workbook?.aiPlanTakeoffJob,
    data?.workbook?.takeoffEngine?.aiPlanTakeoffJob
  ].filter((job) => job && typeof job === 'object');

  return candidates
    .slice()
    .sort((a, b) => {
      const bPlan = hasRecoverablePlanPages(b) ? 1 : 0;
      const aPlan = hasRecoverablePlanPages(a) ? 1 : 0;
      if (bPlan !== aPlan) return bPlan - aPlan;
      const bAreas = Array.isArray(b.completedAreas) ? b.completedAreas.length : 0;
      const aAreas = Array.isArray(a.completedAreas) ? a.completedAreas.length : 0;
      if (bAreas !== aAreas) return bAreas - aAreas;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    })[0] || data;
}

export function createPortableTakeoffExport(job = {}, context = {}) {
  const takeoffJob = resolveAiPlanTakeoffJobData(job);
  const takeoffId = context.takeoffId || takeoffJob.takeoffId || takeoffJob.id || `takeoff-${Date.now()}`;
  const takeoffName = context.takeoffName || takeoffJob.takeoffName || takeoffJob.jobName || '';
  const associatedProjectId = context.projectId || takeoffJob.associatedProjectId || takeoffJob.projectId || takeoffJob.platformProject?.projectId || '';
  const associatedProjectName = context.projectName || takeoffJob.associatedProjectName || takeoffJob.platformProject?.projectName || takeoffJob.projectInfo?.projectName || '';
  const now = new Date().toISOString();
  const normalisedJob = {
    ...takeoffJob,
    takeoffId,
    takeoffName,
    jobName: takeoffJob.jobName || takeoffName,
    associatedProjectId,
    associatedProjectName,
    platformProject: {
      ...(takeoffJob.platformProject || {}),
      projectId: associatedProjectId,
      projectName: associatedProjectName
    },
    contentChecksum: takeoffJob.contentChecksum || createTakeoffContentChecksum(takeoffJob),
    takeoffCounts: takeoffJob.takeoffCounts || getTakeoffCounts(takeoffJob)
  };
  return {
    gr8FileType: AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType,
    moduleType: AI_PLAN_TAKEOFF_FILE_TYPE.moduleType,
    schemaVersion: 1,
    takeoffId,
    takeoffName,
    associatedProjectId,
    associatedProjectName,
    revision: Number(takeoffJob.revision || 1),
    createdAt: takeoffJob.createdAt || now,
    updatedAt: takeoffJob.updatedAt || now,
    exportedAt: now,
    plan: normalisedJob.plan || {},
    takeoffData: normalisedJob,
    takeoffJob: normalisedJob,
    fileType: 'gr8-ai-plan-takeoff',
    projectId: associatedProjectId,
    projectName: associatedProjectName,
    sourceFileName: context.sourceFileName || takeoffJob.sourceFileName || '',
  };
}

export function resolvePortableTakeoffImport(data) {
  const disallowedType = data?.gr8FileType && data.gr8FileType !== AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType;
  const takeoffJob = data?.gr8FileType === AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType
    ? resolveAiPlanTakeoffJobData(data.takeoffData || data.takeoffJob || data)
    : data?.fileType === 'gr8-ai-plan-takeoff'
    ? resolveAiPlanTakeoffJobData(data.takeoffJob)
    : resolveAiPlanTakeoffJobData(data);
  const pages = getEmbeddedPlanPages(takeoffJob);
  const counts = getTakeoffCounts(takeoffJob);
  const valid = Boolean(!disallowedType && takeoffJob && typeof takeoffJob === 'object' && pages.length > 0 && hasRecoverablePlanPages(takeoffJob));

  return {
    ok: valid,
    message: valid
      ? ''
      : disallowedType
        ? `This is a ${data.gr8FileType} file, not an AI Plan Takeoff file.`
        : 'Invalid, empty or damaged takeoff file. No recoverable embedded plan pages were found.',
    job: valid ? {
      ...takeoffJob,
      gr8FileType: AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType,
      moduleType: AI_PLAN_TAKEOFF_FILE_TYPE.moduleType,
      takeoffId: data?.takeoffId || takeoffJob.takeoffId || takeoffJob.id || `takeoff-${Date.now()}`,
      takeoffName: data?.takeoffName || takeoffJob.takeoffName || takeoffJob.jobName || '',
      associatedProjectId: data?.associatedProjectId || data?.projectId || takeoffJob.associatedProjectId || takeoffJob.projectId || takeoffJob.platformProject?.projectId || '',
      associatedProjectName: data?.associatedProjectName || data?.projectName || takeoffJob.associatedProjectName || takeoffJob.platformProject?.projectName || takeoffJob.projectInfo?.projectName || '',
      sourceFileName: data?.sourceFileName || takeoffJob.sourceFileName || ''
    } : null,
    summary: {
      takeoffId: data?.takeoffId || takeoffJob?.takeoffId || takeoffJob?.id || '',
      takeoffName: data?.takeoffName || takeoffJob?.takeoffName || takeoffJob?.jobName || '',
      projectName: data?.associatedProjectName || data?.projectName || takeoffJob?.associatedProjectName || takeoffJob?.projectInfo?.projectName || '',
      projectId: data?.associatedProjectId || data?.projectId || takeoffJob?.associatedProjectId || takeoffJob?.projectId || takeoffJob?.platformProject?.projectId || '',
      revision: Number(data?.revision ?? takeoffJob?.revision ?? 0),
      pageCount: pages.length,
      counts
    }
  };
}

const RECENT_TAKEOFF_JOBS_KEY = 'gr8:ai-plan-takeoff:recent-jobs';
const ESTIMATE_BUILDER_TEMPLATE_DB_NAME = 'estimate-builder-template-db';
const ESTIMATE_BUILDER_JOB_STORE_NAME = 'jobs';
const ESTIMATE_BUILDER_ACTIVE_JOB_KEY = 'active-job';

function openEstimateBuilderJobDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser context.'));
      return;
    }
    const request = window.indexedDB.open(ESTIMATE_BUILDER_TEMPLATE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ESTIMATE_BUILDER_JOB_STORE_NAME)) {
        db.createObjectStore(ESTIMATE_BUILDER_JOB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open Estimate Builder IndexedDB storage.'));
  });
}

function loadRecentTakeoffJobsRaw() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_TAKEOFF_JOBS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentTakeoffJobs(records = []) {
  if (typeof window === 'undefined') return [];
  const next = Array.isArray(records)
    ? records.filter(isValidRecentTakeoffJob).sort((a, b) => String(b.lastSuccessfullySavedAt).localeCompare(String(a.lastSuccessfullySavedAt))).slice(0, 8)
    : [];
  try {
    window.localStorage.setItem(RECENT_TAKEOFF_JOBS_KEY, JSON.stringify(next));
  } catch {
    window.localStorage.removeItem(RECENT_TAKEOFF_JOBS_KEY);
    if (next.length) window.localStorage.setItem(RECENT_TAKEOFF_JOBS_KEY, JSON.stringify([next[0]]));
  }
  return next;
}

function storedJobRecordLooksUsable(record = {}) {
  const key = String(record?.key || '').trim();
  return record?.type === 'job'
    && record?.workbook
    && key
    && key !== ESTIMATE_BUILDER_ACTIVE_JOB_KEY
    && !key.includes(':snapshot:');
}

function storedTakeoffSummary(record = {}) {
  const takeoffJob = resolveAiPlanTakeoffJobData(record?.workbook || {});
  const counts = getTakeoffCounts(takeoffJob || {});
  const projectId = String(
    takeoffJob?.associatedProjectId
    || takeoffJob?.projectId
    || takeoffJob?.platformProject?.projectId
    || record?.workbook?.registeredJob?.jobId
    || record?.workbook?.projectId
    || record?.workbook?.commercialProjectId
    || ''
  ).trim();
  return {
    databaseName: ESTIMATE_BUILDER_TEMPLATE_DB_NAME,
    objectStore: ESTIMATE_BUILDER_JOB_STORE_NAME,
    key: String(record?.key || '').trim(),
    sizeBytes: record.byteSize ?? null,
    savedAt: String(record?.savedAt || takeoffJob?.updatedAt || '').trim(),
    takeoffId: String(takeoffJob?.takeoffId || takeoffJob?.id || '').trim(),
    displayName: String(takeoffJob?.takeoffName || takeoffJob?.jobName || '').trim(),
    associatedProjectId: projectId,
    associatedProjectName: String(takeoffJob?.associatedProjectName || takeoffJob?.platformProject?.projectName || takeoffJob?.projectInfo?.projectName || '').trim(),
    contentChecksum: String(takeoffJob?.contentChecksum || '').trim(),
    revision: Number(takeoffJob?.revision || 0),
    pixelsPerMm: Number(takeoffJob?.pixelsPerMm || 0),
    planPageCount: counts.planPages,
    renderablePlanPages: counts.renderablePlanPages,
    overlayCount: counts.floorCoverings + counts.floorplans + counts.walls + counts.openings + counts.eaves + counts.measurements,
    sourceFileName: String(takeoffJob?.sourceFileName || '').trim(),
    counts,
  };
}

export async function listIndexedDbTakeoffRecords() {
  const db = await openEstimateBuilderJobDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATE_BUILDER_JOB_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ESTIMATE_BUILDER_JOB_STORE_NAME);
    const rows = []; // Metadata only; never retain jobs or revision payloads.
    const request = store.openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(rows); return; }
      const key = String(cursor.key);
      if (!key.startsWith('job:') || key.includes(':snapshot:')) { cursor.continue(); return; }
      const read = store.get(cursor.key);
      read.onsuccess = () => {
        if (storedJobRecordLooksUsable(read.result)) {
          const summary = storedTakeoffSummary(read.result);
          if (summary.takeoffId && summary.planPageCount > 0) rows.push({ summary });
        }
        cursor.continue();
      };
      read.onerror = () => reject(read.error);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

function matchingRecentTakeoffCandidates(recentRecord = {}, rows = []) {
  const requestedTakeoffId = String(recentRecord?.takeoffId || '').trim();
  const requestedProjectId = String(recentRecord?.associatedPlatformProjectId || recentRecord?.projectId || '').trim();
  const requestedStorageKey = String(recentRecord?.storageRecordKey || recentRecord?.jobStorageKey || '').trim();
  const requestedChecksum = String(recentRecord?.contentChecksum || '').trim();
  const requestedPages = Number(recentRecord?.planPageCount || 0);

  let candidates = Array.isArray(rows) ? rows.slice() : [];
  if (requestedStorageKey) {
    const exactKeyMatches = candidates.filter((entry) => entry.summary.key === requestedStorageKey);
    if (exactKeyMatches.length) return exactKeyMatches;
  }
  candidates = candidates.filter((entry) => entry.summary.takeoffId === requestedTakeoffId);
  if (requestedProjectId) {
    const projectMatches = candidates.filter((entry) => entry.summary.associatedProjectId === requestedProjectId);
    if (projectMatches.length) candidates = projectMatches;
  }
  if (requestedChecksum) {
    const checksumMatches = candidates.filter((entry) => entry.summary.contentChecksum === requestedChecksum);
    if (checksumMatches.length) candidates = checksumMatches;
  }
  if (requestedPages > 0) {
    const pageMatches = candidates.filter((entry) => entry.summary.renderablePlanPages === requestedPages);
    if (pageMatches.length) candidates = pageMatches;
  }
  return candidates.sort((a, b) => String(b.summary.savedAt || '').localeCompare(String(a.summary.savedAt || '')));
}

export function verifyIndexedDbTakeoffRecord(entry = {}, options = {}) {
  const summary = entry?.summary || {};
  const counts = summary.counts || {};
  const expectedPlanPages = Number(options.expectedPlanPages || summary.planPageCount || 0);
  const expectedTakeoffId = String(options.expectedTakeoffId || summary.takeoffId || '').trim();
  const expectedProjectId = String(options.expectedProjectId || summary.associatedProjectId || '').trim();
  const problems = [];

  if (!expectedTakeoffId || expectedTakeoffId !== String(summary.takeoffId || '').trim()) {
    problems.push(`takeoffId mismatch (${expectedTakeoffId || 'missing'} vs ${summary.takeoffId || 'missing'})`);
  }
  if (expectedProjectId && expectedProjectId !== String(summary.associatedProjectId || '').trim()) {
    problems.push(`projectId mismatch (${expectedProjectId} vs ${summary.associatedProjectId || 'missing'})`);
  }
  if (!summary.key) problems.push('IndexedDB record key missing');
  if (!summary.renderablePlanPages) problems.push('no recoverable embedded plan pages found');
  if (expectedPlanPages > 0 && summary.renderablePlanPages !== expectedPlanPages) {
    problems.push(`expected ${expectedPlanPages} renderable plan pages, found ${summary.renderablePlanPages}`);
  }
  if (!Number(summary.pixelsPerMm || 0)) problems.push('calibration missing (pixelsPerMm is empty)');
  if (!Number(counts.floorCoverings || 0) && !Number(counts.floorplans || 0) && !Number(counts.walls || 0) && !Number(counts.openings || 0) && !Number(counts.eaves || 0) && !Number(counts.measurements || 0)) {
    problems.push('no takeoff overlays found in the stored record');
  }

  return {
    ok: problems.length === 0,
    problems,
    summary,
  };
}

export async function resolveRecentTakeoffIndexedDbRecord(recentRecord = {}) {
  const takeoffId = String(recentRecord?.takeoffId || '').trim();
  if (!takeoffId) {
    return {
      ok: false,
      message: 'Recent takeoff entry is missing takeoffId.',
      technicalError: 'Recent takeoff entry could not be resolved because takeoffId is empty.',
      candidates: [],
    };
  }
  const rows = await listIndexedDbTakeoffRecords();
  const candidates = matchingRecentTakeoffCandidates(recentRecord, rows);
  if (!candidates.length) {
    return {
      ok: false,
      message: 'Saved takeoff record not found in IndexedDB.',
      technicalError: `No IndexedDB record matched takeoffId=${takeoffId}, projectId=${String(recentRecord?.associatedPlatformProjectId || '').trim() || '(blank)'}, checksum=${String(recentRecord?.contentChecksum || '').trim() || '(blank)'}.`,
      candidates: rows.map((entry) => entry.summary),
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      message: 'More than one IndexedDB record matches this recent takeoff entry.',
      technicalError: `Ambiguous IndexedDB resolution for takeoffId=${takeoffId}. Matching keys: ${candidates.map((entry) => entry.summary.key).join(', ')}`,
      candidates: candidates.map((entry) => entry.summary),
    };
  }
  const db = await openEstimateBuilderJobDb();
  let record;
  try {
    record = await new Promise((resolve, reject) => {
      const request = db.transaction(ESTIMATE_BUILDER_JOB_STORE_NAME, 'readonly').objectStore(ESTIMATE_BUILDER_JOB_STORE_NAME).get(candidates[0].summary.key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
  if (record?.workbook) record = { ...record, workbook: await materializeTakeoffPlanPages(record.workbook) };
  return {
    ok: Boolean(record),
    record,
    takeoffJob: resolveAiPlanTakeoffJobData(record?.workbook || {}),
    summary: record ? storedTakeoffSummary(record) : candidates[0].summary,
    candidates: candidates.map((entry) => entry.summary),
  };
}

function takeoffBackupDownloadName(name = '') {
  const safe = String(name || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').replace(/\//g, '-').slice(0, 120);
  return safe || `takeoff-backup-${Date.now()}`;
}

function downloadBlob(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob.size;
}

export async function downloadRecentTakeoffBackup(recentRecord = {}, options = {}) {
  const resolved = await resolveRecentTakeoffIndexedDbRecord(recentRecord);
  if (!resolved.ok) return resolved;
  const portable = createPortableTakeoffExport(resolved.takeoffJob, {
    takeoffId: resolved.summary.takeoffId,
    takeoffName: resolved.summary.displayName,
    projectId: resolved.summary.associatedProjectId,
    projectName: resolved.summary.associatedProjectName,
    sourceFileName: resolved.summary.sourceFileName,
  });
  const fileName = `${takeoffBackupDownloadName(options.fileName || resolved.summary.displayName).replace(/\//g, '-')}.gr8takeoff`;
  const sizeBytes = downloadBlob(fileName, JSON.stringify(portable, null, 2), 'application/json');
  return {
    ok: true,
    fileName,
    sizeBytes,
    summary: resolved.summary,
  };
}

export async function downloadRecentTakeoffRawIndexedDbRecord(recentRecord = {}, options = {}) {
  const resolved = await resolveRecentTakeoffIndexedDbRecord(recentRecord);
  if (!resolved.ok) return resolved;
  const fileName = `${takeoffBackupDownloadName(options.fileName || resolved.summary.displayName)}.indexeddb-record.json`;
  const rawJson = JSON.stringify(resolved.record, null, 2);
  const sizeBytes = downloadBlob(fileName, rawJson, 'application/json');
  return {
    ok: true,
    fileName,
    sizeBytes,
    summary: resolved.summary,
  };
}

export async function reconcileDuplicateRecentTakeoffJobs() {
  const recent = loadRecentTakeoffJobsRaw();
  if (!recent.length) return { recentJobs: [], removed: [], diagnostics: [] };
  const diagnostics = await Promise.all(recent.map(async (item) => {
    const resolved = await resolveRecentTakeoffIndexedDbRecord(item).catch((error) => ({
      ok: false,
      message: error?.message || 'IndexedDB resolution failed.',
      technicalError: error?.message || 'IndexedDB resolution failed.',
      candidates: [],
    }));
    return { item, resolved };
  }));
  const bySignature = new Map();
  const removed = [];
  diagnostics.forEach(({ item, resolved }) => {
    const signature = resolved?.ok
      ? [resolved.summary.takeoffId, resolved.summary.associatedProjectId, resolved.summary.contentChecksum].join('|')
      : [item.takeoffId, item.associatedPlatformProjectId || '', item.contentChecksum || item.displayName || ''].join('|');
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, item);
      return;
    }
    const currentSavedAt = String(item.lastSuccessfullySavedAt || '');
    const existingSavedAt = String(existing.lastSuccessfullySavedAt || '');
    if (currentSavedAt > existingSavedAt) {
      removed.push(existing);
      bySignature.set(signature, item);
    } else {
      removed.push(item);
    }
  });
  const recentJobs = saveRecentTakeoffJobs(Array.from(bySignature.values()));
  return { recentJobs, removed, diagnostics };
}

function isArchivedRecoveryTakeoffRecord(record = {}) {
  const haystack = [
    record.displayName,
    record.takeoffName,
    record.associatedPlatformProjectName,
    record.sourceFileName,
    record.jobData?.takeoffName,
    record.jobData?.jobName,
    record.jobData?.sourceFileName,
    record.jobData?.plan?.filename
  ].filter(Boolean).join(' ').toLowerCase();
  return [
    'recovery',
    'recovered',
    'mountain creek',
    'unrelated-mountain-creek',
    'johnson (11)',
    'archived-failed-johnson-recovery'
  ].some((needle) => haystack.includes(needle));
}

function isValidRecentTakeoffJob(record = {}) {
  return record?.moduleType === AI_PLAN_TAKEOFF_FILE_TYPE.moduleType
    && String(record.takeoffId || '').trim()
    && String(record.displayName || record.takeoffName || '').trim()
    && Number(record.planPageCount || 0) > 0
    && String(record.lastSuccessfullySavedAt || '').trim()
    && !isArchivedRecoveryTakeoffRecord(record);
}

export function loadRecentTakeoffJobs() {
  return saveRecentTakeoffJobs(loadRecentTakeoffJobsRaw());
}

export function rememberRecentTakeoffJob(job = {}) {
  if (typeof window === 'undefined') return [];
  const pages = getEmbeddedPlanPages(job);
  if (!pages.length || !hasRecoverablePlanPages(job)) return loadRecentTakeoffJobs();
  const savedAt = job.updatedAt || new Date().toISOString();
  const record = {
    moduleType: AI_PLAN_TAKEOFF_FILE_TYPE.moduleType,
    takeoffId: job.takeoffId || job.id || `takeoff-${Date.now()}`,
    displayName: job.takeoffName || job.jobName || 'Untitled takeoff',
    associatedPlatformProjectId: job.associatedProjectId || job.projectId || job.platformProject?.projectId || '',
    associatedPlatformProjectName: job.associatedProjectName || job.platformProject?.projectName || job.projectInfo?.projectName || '',
    storageRecordKey: job.storageRecordKey || job.key || '',
    contentChecksum: job.contentChecksum || createTakeoffContentChecksum(job),
    sourceFileName: job.sourceFileName || '',
    planPageCount: pages.length,
    revision: Number(job.revision || 0),
    lastSuccessfullySavedAt: savedAt,
    counts: getTakeoffCounts(job)
  };
  const existing = loadRecentTakeoffJobs().filter((item) => item.takeoffId !== record.takeoffId);
  return saveRecentTakeoffJobs([record, ...existing]);
}

export function getSavedFloorCoveringAreas(jobData, pixelsPerMm = null) {
  return normaliseFloorCoveringAreas(jobData?.completedAreas || [], pixelsPerMm ?? jobData?.pixelsPerMm ?? null);
}

export function hasRecoverablePlanPages(jobData) {
  return getEmbeddedPlanPages(jobData).some((page) => (
    typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:')
  ));
}

export function mergeAiPlanTakeoffJobForSave(previousJob = null, incomingJob = {}) {
  const previous = previousJob && typeof previousJob === 'object' ? previousJob : {};
  const incoming = incomingJob && typeof incomingJob === 'object' ? incomingJob : {};
  const incomingPages = getEmbeddedPlanPages(incoming);
  const previousPages = getEmbeddedPlanPages(previous);
  const hasIncomingPlan = incomingPages.some((page) => typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:'));
  const durablePages = hasIncomingPlan ? incomingPages : previousPages;
  const merged = {
    ...previous,
    ...incoming,
    plan: {
      ...(previous.plan || {}),
      ...(incoming.plan || {}),
      type: incoming.plan?.type || previous.plan?.type || 'embedded-pages',
      totalPages: durablePages.length || incoming.plan?.totalPages || previous.plan?.totalPages || incoming.totalPages || previous.totalPages || 0,
      pages: durablePages
    },
    planPages: incoming.planPages || previous.planPages,
    totalPages: incoming.totalPages || durablePages.length || previous.totalPages || 1,
    completedWallRuns: Array.isArray(incoming.completedWallRuns) ? incoming.completedWallRuns : (previous.completedWallRuns || []),
    placedOpenings: Array.isArray(incoming.placedOpenings) ? incoming.placedOpenings : (previous.placedOpenings || []),
    completedAreas: getSavedFloorCoveringAreas(
      Array.isArray(incoming.completedAreas) ? incoming : previous,
      incoming.pixelsPerMm ?? previous.pixelsPerMm ?? null
    ),
    completedFloorplans: Array.isArray(incoming.completedFloorplans) ? incoming.completedFloorplans : (previous.completedFloorplans || []),
    completedMeasurements: Array.isArray(incoming.completedMeasurements) ? incoming.completedMeasurements : (previous.completedMeasurements || []),
    completedEaves: Array.isArray(incoming.completedEaves) ? incoming.completedEaves : (previous.completedEaves || []),
    scheduleState: {
      ...(previous.scheduleState || {}),
      ...(incoming.scheduleState || {})
    }
  };

  if (!merged.planPages) delete merged.planPages;
  return merged;
}

export function prepareAiPlanTakeoffJobForSave(previousJob = null, incomingJob = {}, projectId = '') {
  const previous = previousJob && typeof previousJob === 'object' ? previousJob : {};
  const incoming = incomingJob && typeof incomingJob === 'object' ? incomingJob : {};
  const previousRevision = Number(previous.revision || 0);
  const incomingBaseRevision = Number(incoming.baseRevision ?? incoming.revision ?? previousRevision);
  const previousTakeoffId = String(previous.takeoffId || previous.id || '').trim();
  const incomingTakeoffId = String(incoming.takeoffId || incoming.id || '').trim();
  const sameTakeoff = previousTakeoffId && incomingTakeoffId && previousTakeoffId === incomingTakeoffId;
  const canMergeStaleSameTakeoff = sameTakeoff && hasRecoverablePlanPages(incoming);

  if (previousRevision > incomingBaseRevision && !canMergeStaleSameTakeoff) {
    return {
      ok: false,
      conflict: true,
      message: `Save conflict - current revision is ${previousRevision}, attempted base revision was ${incomingBaseRevision}.`,
      currentRevision: previousRevision
    };
  }

  const updatedAt = new Date().toISOString();
  const merged = mergeAiPlanTakeoffJobForSave(previous, incoming);
  const nextJob = {
    ...merged,
    schemaVersion: 'ai-plan-takeoff.v1',
    revision: previousRevision + 1,
    baseRevision: previousRevision,
    updatedAt,
    projectId: projectId || incoming.projectId || incoming.platformProject?.projectId || previous.projectId || previous.platformProject?.projectId || '',
    takeoffName: incoming.takeoffName || previous.takeoffName || incoming.jobName || previous.jobName || '',
    sourceFileName: incoming.sourceFileName || previous.sourceFileName || '',
    platformProject: {
      ...(previous.platformProject || {}),
      ...(incoming.platformProject || {}),
      projectId: projectId || incoming.platformProject?.projectId || previous.platformProject?.projectId || ''
    }
  };
  nextJob.contentChecksum = createTakeoffContentChecksum(nextJob);
  nextJob.takeoffCounts = getTakeoffCounts(nextJob);

  return { ok: true, job: nextJob, revision: nextJob.revision, checksum: nextJob.contentChecksum, counts: nextJob.takeoffCounts };
}

export function verifyAiPlanTakeoffSavedJob(submittedJob = {}, savedJob = {}, options = {}) {
  const expectedPlanPages = Number(options.expectedPlanPages ?? 5);
  const submittedChecksum = submittedJob.contentChecksum || createTakeoffContentChecksum(submittedJob);
  const savedChecksum = savedJob.contentChecksum || createTakeoffContentChecksum(savedJob);
  const revisionMatches = Number(submittedJob.revision || 0) === Number(savedJob.revision || 0);
  const checksumMatches = submittedChecksum === savedChecksum;
  const countsMatch = takeoffCountsMatch(submittedJob, savedJob);
  const submittedCounts = getTakeoffCounts(submittedJob);
  const savedCounts = getTakeoffCounts(savedJob);
  const planPageCountMatches = expectedPlanPages > 0
    ? submittedCounts.planPages === expectedPlanPages
      && submittedCounts.renderablePlanPages === expectedPlanPages
      && savedCounts.planPages === expectedPlanPages
      && savedCounts.renderablePlanPages === expectedPlanPages
    : submittedCounts.planPages === savedCounts.planPages
      && submittedCounts.renderablePlanPages === savedCounts.renderablePlanPages;
  return {
    ok: revisionMatches && checksumMatches && countsMatch && planPageCountMatches,
    revisionMatches,
    checksumMatches,
    countsMatch,
    planPageCountMatches,
    expectedPlanPages,
    submittedChecksum,
    savedChecksum,
    submittedCounts,
    savedCounts,
    revision: savedJob.revision || 0,
    updatedAt: savedJob.updatedAt || ''
  };
}
