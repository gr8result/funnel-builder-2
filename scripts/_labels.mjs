// Scratch: where the saved plan reading put each room name, against the measured spaces.
import fs from 'node:fs';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { mergeMeasurementScopes } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
const [jobFile, responses, benchDir] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8')).job;
const read = (name) => JSON.parse(fs.readFileSync(`${responses}/${name}`, 'utf8')).analysis;
for (const pageNumber of [2, 3]) {
  const page = job.plan.pages.find((item) => item.pageNumber === pageNumber);
  const inspection = Object.values(job.scheduleState?.aiInspections || {}).map((entry) => entry.analysis).find((item) => item.page === pageNumber);
  const rotation = inspection?.rotationToUpright || 0;
  const response = restoreAnalysisCoordinates(mergeMeasurementScopes(read(`refine-${pageNumber}-geometry.json`), read(`refine-${pageNumber}-items.json`)), rotation);
  const g = JSON.parse(fs.readFileSync(`${benchDir}/geometry-${pageNumber}.json`, 'utf8'));
  console.log(`== page ${pageNumber} rotation ${rotation} logical ${page.logicalWidth}x${page.logicalHeight}`);
  console.log(' labels: ' + response.rooms.map((room) => `${room.name}@${Math.round(room.x * page.logicalWidth)},${Math.round(room.y * page.logicalHeight)}`).join('  '));
  console.log(' spaces: ' + g.rooms.filter((room) => room.netAreaM2 > 1).map((room) => `${room.netAreaM2.toFixed(1)}${room.verified ? 'v' : 'p'}@${Math.round(room.centroid.x)},${Math.round(room.centroid.y)}[${Math.round(room.bounds.x)}-${Math.round(room.bounds.x2)},${Math.round(room.bounds.y)}-${Math.round(room.bounds.y2)}]`).join('  '));
}
