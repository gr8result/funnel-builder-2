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
    currentPage: job.currentPage,
    totalPages: job.totalPages,
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
    completedEaves: job.completedEaves || [],
    projectInfo: job.projectInfo || {},
    platformProject: job.platformProject || {},
    scheduleState: job.scheduleState || {}
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
  platformProject,
  scheduleState,
  baseRevision,
  revision
}) {
  const floorCoveringAreas = normaliseFloorCoveringAreas(completedAreas, pixelsPerMm);

  return {
    schemaVersion: 'ai-plan-takeoff.v1',
    version: '2.0',
    jobName: name,
    takeoffName: name,
    sourceFileName: planFilename || '',
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
  return {
    fileType: 'gr8-ai-plan-takeoff',
    schemaVersion: takeoffJob.schemaVersion || 'ai-plan-takeoff.v1',
    exportedAt: new Date().toISOString(),
    projectId: context.projectId || takeoffJob.projectId || takeoffJob.platformProject?.projectId || '',
    projectName: context.projectName || takeoffJob.platformProject?.projectName || takeoffJob.projectInfo?.projectName || takeoffJob.jobName || '',
    takeoffName: context.takeoffName || takeoffJob.takeoffName || takeoffJob.jobName || '',
    sourceFileName: context.sourceFileName || takeoffJob.sourceFileName || '',
    revision: Number(takeoffJob.revision || 0),
    takeoffJob: {
      ...takeoffJob,
      contentChecksum: takeoffJob.contentChecksum || createTakeoffContentChecksum(takeoffJob),
      takeoffCounts: takeoffJob.takeoffCounts || getTakeoffCounts(takeoffJob)
    }
  };
}

export function resolvePortableTakeoffImport(data) {
  const takeoffJob = data?.fileType === 'gr8-ai-plan-takeoff'
    ? resolveAiPlanTakeoffJobData(data.takeoffJob)
    : resolveAiPlanTakeoffJobData(data);
  const pages = getEmbeddedPlanPages(takeoffJob);
  const counts = getTakeoffCounts(takeoffJob);
  const valid = Boolean(takeoffJob && typeof takeoffJob === 'object' && pages.length > 0 && hasRecoverablePlanPages(takeoffJob));

  return {
    ok: valid,
    message: valid ? '' : 'Invalid or incompatible takeoff file. No recoverable embedded plan pages were found.',
    job: valid ? {
      ...takeoffJob,
      sourceFileName: data?.sourceFileName || takeoffJob.sourceFileName || ''
    } : null,
    summary: {
      takeoffName: takeoffJob?.takeoffName || takeoffJob?.jobName || data?.takeoffName || '',
      projectName: data?.projectName || takeoffJob?.projectInfo?.projectName || '',
      projectId: data?.projectId || takeoffJob?.projectId || takeoffJob?.platformProject?.projectId || '',
      revision: Number(data?.revision ?? takeoffJob?.revision ?? 0),
      pageCount: pages.length,
      counts
    }
  };
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

  if (previousRevision > incomingBaseRevision) {
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

export function verifyAiPlanTakeoffSavedJob(submittedJob = {}, savedJob = {}) {
  const submittedChecksum = submittedJob.contentChecksum || createTakeoffContentChecksum(submittedJob);
  const savedChecksum = savedJob.contentChecksum || createTakeoffContentChecksum(savedJob);
  const revisionMatches = Number(submittedJob.revision || 0) === Number(savedJob.revision || 0);
  const checksumMatches = submittedChecksum === savedChecksum;
  const countsMatch = takeoffCountsMatch(submittedJob, savedJob);
  return {
    ok: revisionMatches && checksumMatches && countsMatch,
    revisionMatches,
    checksumMatches,
    countsMatch,
    submittedChecksum,
    savedChecksum,
    submittedCounts: getTakeoffCounts(submittedJob),
    savedCounts: getTakeoffCounts(savedJob),
    revision: savedJob.revision || 0,
    updatedAt: savedJob.updatedAt || ''
  };
}
