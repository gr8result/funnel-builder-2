import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJobData, resolvePortableTakeoffImport, createPortableTakeoffExport, getEmbeddedPlanPages, hasRecoverablePlanPages } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';
import { AI_PLAN_TAKEOFF_EXTENSION } from '../lib/gr8FileTypes.js';

// Manually saving a takeoff writes a file to the user's own computer. The platform is not the
// permanent home for it, so the file has to be self-contained: it must reopen on another machine,
// in another browser, with this browser's storage empty. These checks run the component's real
// save helpers rather than a restatement of them.

const componentUrl = new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url);
const jsx = readFileSync(componentUrl, 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = jsx.indexOf(startMarker);
  assert.ok(start > 0, `Locate ${startMarker}`);
  const end = jsx.indexOf(endMarker, start);
  assert.ok(end > start, `Locate the end of ${startMarker}`);
  return jsx.slice(start, end);
}

// The real helpers, lifted from the component in one contiguous block.
const helpers = sliceBetween('  const buildPortableTakeoffPayload = async (name) => {', '  const showPlanPage = useCallback(');
assert.match(helpers, /materializeTakeoffPlanPages/, 'The payload builder materializes plan assets');
assert.match(helpers, /showSaveFilePicker/, 'Save uses the native save picker where available');
assert.match(helpers, /AbortError/, 'Cancellation is detected separately from failure');

// ---------------------------------------------------------------- fixture
const PLAN_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const ASSET_ID = 'asset-sheet-1';
const savedJob = () => createJobData({
  name: 'Local save job',
  currentPage: 1,
  totalPages: 1,
  rotation: 90,
  pixelsPerMm: 0.25,
  // Saved in memory by asset reference only; a file written from this as-is would be useless
  // on another computer.
  planPages: [{ pageNumber: 1, dataUrlAssetId: ASSET_ID, width: 100, height: 80, logicalWidth: 100, logicalHeight: 80, renderScale: 1 }],
  completedWallRuns: [{ id: 'w1', page: 1, category: 'exterior', nodes: [{ x: 0, y: 0 }, { x: 50, y: 0 }], lengthMm: 5000, thicknessMm: 230, exteriorType: 'Rendered Brick Veneer', alignment: 'outer', linedFaces: 2 }],
  completedEaves: [{ id: 'e1', page: 1, nodes: [{ x: 0, y: 0 }, { x: 30, y: 0 }], lengthMm: 3000, widthOption: '600', widthMm: 600, level: 'Ground Floor' }],
  completedAreas: [{ id: 'a1', page: 1, category: 'Tiles', nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], exclusions: [] }],
  completedFloorplans: [{ id: 'f1', page: 1, type: 'Footprint', label: 'Outer Footprint', nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }] }],
  completedMeasurements: [{ id: 'm1', page: 1, p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, offset: { x: 0, y: 0 } }],
  placedOpenings: [{ id: 'o1', page: 1, type: 'window', openingClass: 'Window', widthMm: 1200, heightMm: 1800, x: 5, y: 5 }],
  sheetLevels: { 1: 'Ground Floor' },
  projectInfo: { projectName: 'Local save job', clientName: 'Client', siteAddress: '1 Test St' },
  planFilename: 'plans.pdf',
  takeoffId: 'local-save-takeoff',
  revision: 3,
  scheduleState: {},
  platformProject: {},
});

// Stands in for the browser asset store: the id resolves to real image data.
const materializeTakeoffPlanPages = async (workbook) => {
  const job = workbook.aiPlanTakeoffJob;
  const pages = getEmbeddedPlanPages(job).map((page) => (
    page.dataUrl ? page : { ...page, dataUrl: PLAN_IMAGE }
  ));
  return { aiPlanTakeoffJob: { ...job, plan: { ...job.plan, pages }, planPages: pages } };
};

function buildEnvironment({ showSaveFilePicker, handle = null } = {}) {
  const written = [];
  const messages = [];
  const state = { jobFileHandle: 'unset', jobName: null, unsaved: 'unset', savedAt: null, sourceFileName: null };
  const downloads = [];
  const win = {};
  if (showSaveFilePicker) win.showSaveFilePicker = showSaveFilePicker;
  win.setTimeout = () => {};
  const env = {
    buildJobData: () => savedJob(),
    materializeTakeoffPlanPages,
    createPortableTakeoffExport,
    resolvePortableTakeoffImport,
    attachedProjectId: '',
    attachedProjectName: '',
    importedTakeoffFileName: '',
    planFilename: 'plans.pdf',
    sanitizeDownloadFileName: (name) => String(name).replace(/[^a-z0-9._-]+/gi, '_'),
    AI_PLAN_TAKEOFF_EXTENSION,
    AI_PLAN_TAKEOFF_FILE_DESCRIPTION: 'Gr8 Result AI Plan Takeoff',
    logTakeoffRefresh: () => {},
    createTakeoffObjectUrl: () => 'blob:stub',
    revokeTakeoffObjectUrl: () => {},
    Blob: class { constructor(parts) { this.parts = parts; } },
    document: { createElement: () => ({ click() { downloads.push(this.download); } }) },
    window: win,
    setJobFileHandle: (value) => { state.jobFileHandle = value; },
    setJobName: (value) => { state.jobName = value; },
    setImportedTakeoffFileName: (value) => { state.sourceFileName = value; },
    setHasUnsavedChanges: (value) => { state.unsaved = value; },
    setLastSuccessfulSaveAt: (value) => { state.savedAt = value; },
    stampSavedContentBaseline: () => {},
    takeoffContentChecksum: 'checksum',
    setPlatformSaveMessage: (value) => { messages.push(value); },
  };
  const api = new Function(...Object.keys(env),
    `${helpers}\nreturn { saveTakeoffToComputer, applyLocalSaveResult, buildPortableTakeoffPayload };`,
  )(...Object.values(env));
  return { api, written, messages, state, downloads, handle };
}

function makeHandle(name, { permission = 'granted', onWrite } = {}) {
  const chunks = [];
  return {
    name,
    chunks,
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    createWritable: async () => ({
      write: async (data) => { if (onWrite) onWrite(data); chunks.push(data); },
      close: async () => {},
      abort: async () => {},
    }),
  };
}

// 1. Save As invokes the native save workflow and writes a materialized, self-contained file.
{
  const picked = makeHandle(`Local save job${AI_PLAN_TAKEOFF_EXTENSION}`);
  let pickerOptions = null;
  const env = buildEnvironment({ showSaveFilePicker: async (options) => { pickerOptions = options; return picked; } });
  const result = await env.api.saveTakeoffToComputer('Local save job', { handle: null });
  assert.equal(result.status, 'saved', 'Save As wrote to the chosen location');
  assert.ok(pickerOptions, 'Save As opened the computer\'s native save dialog');
  assert.equal(pickerOptions.suggestedName, `Local_save_job${AI_PLAN_TAKEOFF_EXTENSION}`);
  assert.deepEqual(pickerOptions.types[0].accept, { 'application/json': [AI_PLAN_TAKEOFF_EXTENSION] }, 'The picker offers the takeoff extension');
  assert.equal(picked.chunks.length, 1, 'Exactly one payload reached the file');

  const parsed = JSON.parse(picked.chunks[0]);
  // 2. The written file carries the plan image, not the asset id it was held by in memory.
  const pages = getEmbeddedPlanPages(parsed.takeoffData);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].dataUrl, PLAN_IMAGE, 'The plan image is embedded in the saved file');
  assert.ok(hasRecoverablePlanPages(parsed.takeoffData), 'The saved file has recoverable plan pages');

  // 3. It reopens with browser storage empty: no asset store, no IndexedDB, nothing local.
  const reopened = resolvePortableTakeoffImport(JSON.parse(picked.chunks[0]));
  assert.equal(reopened.ok, true, 'The saved file reopens on its own');
  assert.equal(reopened.job.pixelsPerMm, 0.25, 'Calibration survives the round trip');
  assert.equal(reopened.job.rotation, 90, 'Rotation survives the round trip');
  assert.equal(reopened.job.currentPage, 1);
  assert.equal(reopened.job.completedWallRuns[0].exteriorType, 'Rendered Brick Veneer', 'Classifications survive');
  assert.equal(reopened.job.completedWallRuns[0].lengthMm, 5000, 'Wall lengths survive');
  assert.equal(reopened.job.completedEaves[0].lengthMm, 3000, 'Eaves survive');
  assert.equal(reopened.job.completedAreas.length, 1, 'Floorcoverings survive');
  assert.equal(reopened.job.completedFloorplans[0].label, 'Outer Footprint', 'Floor areas survive');
  assert.equal(reopened.job.completedMeasurements.length, 1, 'Measurements survive');
  assert.equal(reopened.job.placedOpenings[0].widthMm, 1200, 'Openings survive');
  assert.deepEqual(reopened.job.sheetLevels, { 1: 'Ground Floor' }, 'Sheet level assignments survive');
  assert.equal(reopened.job.projectInfo.siteAddress, '1 Test St', 'Job metadata survives');

  // Reporting only happens after the bytes landed.
  env.api.applyLocalSaveResult(result, 'Local save job');
  assert.equal(env.state.unsaved, false);
  assert.equal(env.state.jobFileHandle, picked, 'The handle is kept for a later Save');
  assert.match(env.messages.at(-1), /Saved to .*\.gr8takeoff on this computer\./);
}

// 4. Save writes back to an existing writable handle without opening a picker.
{
  let pickerCalls = 0;
  const existing = makeHandle(`Existing job${AI_PLAN_TAKEOFF_EXTENSION}`);
  const env = buildEnvironment({ showSaveFilePicker: async () => { pickerCalls += 1; return makeHandle('other'); } });
  const result = await env.api.saveTakeoffToComputer('Existing job', { handle: existing });
  assert.equal(result.status, 'saved');
  assert.equal(pickerCalls, 0, 'Save reuses the open file and never asks for a new location');
  assert.equal(result.handle, existing);
  assert.equal(existing.chunks.length, 1, 'The same file received the update');
  assert.ok(hasRecoverablePlanPages(JSON.parse(existing.chunks[0]).takeoffData));
}

// 5. Save with no usable handle falls back to Save As. A lapsed permission counts as no handle.
{
  let pickerCalls = 0;
  const picked = makeHandle(`Picked${AI_PLAN_TAKEOFF_EXTENSION}`);
  const env = buildEnvironment({ showSaveFilePicker: async () => { pickerCalls += 1; return picked; } });
  const none = await env.api.saveTakeoffToComputer('No handle', { handle: null });
  assert.equal(none.status, 'saved');
  assert.equal(pickerCalls, 1, 'No handle means ask for a location');

  const denied = makeHandle('denied', { permission: 'denied' });
  const lapsed = await env.api.saveTakeoffToComputer('Lapsed', { handle: denied });
  assert.equal(lapsed.status, 'saved');
  assert.equal(pickerCalls, 2, 'A handle without write permission also asks for a location');
  assert.equal(denied.chunks.length, 0, 'Nothing was written through the denied handle');
}

// 6. A browser with no File System Access API falls back to a download.
{
  const env = buildEnvironment({ showSaveFilePicker: null });
  const result = await env.api.saveTakeoffToComputer('Legacy browser', { handle: null });
  assert.equal(result.status, 'downloaded');
  assert.deepEqual(env.downloads, [`Legacy_browser${AI_PLAN_TAKEOFF_EXTENSION}`], 'The browser downloaded the takeoff file');
  env.api.applyLocalSaveResult(result, 'Legacy browser');
  assert.match(env.messages.at(-1), /downloaded by the browser/, 'The message says where it actually went');
  assert.equal(env.state.unsaved, false);
}

// 7. Cancelling the save dialog is not a save and must not report one.
{
  const env = buildEnvironment({
    showSaveFilePicker: async () => { const error = new Error('The user aborted a request.'); error.name = 'AbortError'; throw error; },
  });
  const result = await env.api.saveTakeoffToComputer('Cancelled job', { handle: null });
  assert.equal(result.status, 'cancelled', 'Cancellation is its own outcome, not a failure and not a save');
  assert.equal(env.state.unsaved, 'unset', 'Cancelling leaves the unsaved-changes flag untouched');
  assert.equal(env.state.jobFileHandle, 'unset', 'Cancelling does not adopt a file handle');
  assert.deepEqual(env.messages, [], 'Cancelling reports no save message of its own');
  assert.deepEqual(env.downloads, [], 'Cancelling downloads nothing');
}

// 8. A payload that would not reopen is never written, and never reported as saved.
{
  const env = buildEnvironment({ showSaveFilePicker: async () => makeHandle('unreachable') });
  const broken = new Function(...Object.keys({}), 'return null;');
  await assert.rejects(
    async () => {
      const api = buildEnvironment({ showSaveFilePicker: async () => makeHandle('unreachable') }).api;
      // A job whose plan cannot be materialized must fail verification before anything is written.
      const failing = new Function('buildJobData', 'materializeTakeoffPlanPages', 'createPortableTakeoffExport',
        'resolvePortableTakeoffImport', 'attachedProjectId', 'attachedProjectName', 'importedTakeoffFileName',
        'planFilename', `${sliceBetween('  const buildPortableTakeoffPayload = async (name) => {', '  // A handle kept from an earlier open')}\nreturn buildPortableTakeoffPayload;`,
      )(() => createJobData({ name: 'No plan', planPages: [], completedWallRuns: [] }), async (wb) => wb,
        createPortableTakeoffExport, resolvePortableTakeoffImport, '', '', '', '');
      await failing('No plan');
      void api; void broken;
    },
    /could not be verified/,
    'A file that would not reopen is refused before any write',
  );
}

console.log('Local takeoff file save checks passed:');
console.log(`  Save As            native save picker, suggested *${AI_PLAN_TAKEOFF_EXTENSION}, one write`);
console.log('  portable payload   plan asset id materialized into embedded image data before writing');
console.log('  reopen             file reopens with no browser storage; calibration, rotation, walls,');
console.log('                     eaves, areas, floorplans, measurements, openings, sheet levels intact');
console.log('  Save               reuses the open file handle, no picker');
console.log('  Save fallback      no handle, or lapsed permission, becomes Save As');
console.log('  no FS Access API   falls back to a browser download and says so');
console.log('  cancelled          no write, no handle, no success message');
console.log('  unverifiable       refused before any write');
