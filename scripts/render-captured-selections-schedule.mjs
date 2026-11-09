import fs from 'node:fs';
import { createProjectInclusionsSnapshot } from '../lib/builders/finalInclusionsSchedule.js';
import { generateAndStoreStandaloneFinalInclusionsPdf } from '../lib/builders/finalInclusionsPdfExecution.js';

// Offline: render a captured "Generate PDF" request (from accept-client-selections-real-pdf.mjs) with the
// server's PDF code. No network, no database.
//   node scripts/render-captured-selections-schedule.mjs <captured-generate-request.json> <out.pdf> [builderProfile.json]
const [requestPath, outPath, profilePath] = process.argv.slice(2);
const body = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
const details = body.projectDetails || {};
const project = { id: body.projectId || 'captured', workspace_id: 'captured', project_name: details.projectName, client_name: details.clientName, site_address: details.siteAddress, job_number: details.jobNumber, builder_name: details.builderName, metadata: {} };
const builderProfile = profilePath ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : (body.builderProfile || {});
const snapshot = createProjectInclusionsSnapshot({ project, workspaceId: 'captured', selections: [], session: { id: '', project_id: project.id, snapshot_id: '', status: 'ready' },
  estimateSnapshot: { id: '' }, generatedBy: 'offline-render', documentStatus: body.documentStatus || 'draft', previousDocuments: [], cover: body.previewSchedule.cover || {}, schedulePages: body.previewSchedule.pages, scheduleOutstandingDecisions: body.previewSchedule.outstandingDecisions || [], scheduleVariationSummary: body.previewSchedule.variationSummary || null,
  builderProfile, preparedBy: 'offline', reviewedBy: '', approval: {}, contractReference: '', revisionReason: '',
  masterTemplate: { id: 'client-selections-schedule', version: 'standalone', pageCount: 0 }, masterPdfRef: null, closingPdfRef: null });
let bytes = null;
const result = await generateAndStoreStandaloneFinalInclusionsPdf({ snapshot, previousDocuments: [], generatedAt: new Date().toISOString(),
  puppeteerLaunchOptions: { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  storage: { savePdf: async ({ bytes: data }) => { bytes = Buffer.from(data); return { storage_path: 'local' }; }, registerDocument: async (document) => document } });
fs.writeFileSync(outPath, bytes);
console.log(JSON.stringify({ bytes: bytes.length, pages: result.merged?.pageCounts, warnings: result.dynamic?.warnings }));
