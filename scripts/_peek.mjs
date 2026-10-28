// Scratch: summarise a saved takeoff / job file (read-only).
import fs from 'node:fs'; import JSZip from 'jszip';
for (const file of process.argv.slice(2)) {
  try {
    let job;
    if (/\.gr8job$/i.test(file)) { const zip = await JSZip.loadAsync(fs.readFileSync(file)); const t = JSON.parse(await zip.file('takeoff.json').async('text')); job = t.aiPlanTakeoffJob || t.takeoff?.aiPlanTakeoffJob || t; }
    else { const j = JSON.parse(fs.readFileSync(file, 'utf8')); job = j.job || j.aiPlanTakeoffJob || j; }
    const isAi = (i) => i?.source === 'ai' || String(i?.id || '').startsWith('ai:');
    const pages = job.plan?.pages || [];
    console.log(`\n${file.split('/').slice(-2).join('/')}\n  name: ${job.jobName || job.takeoffName} | plan: ${job.planFilename} | pages ${pages.length} (${pages.map((p) => `${p.pageNumber}:${p.width || '?'}x${p.height || '?'}${p.dataUrl?.startsWith('data:') ? '' : ' no-image'}`).join(', ')})`);
    console.log(`  ppm ${job.pixelsPerMm} | levels ${JSON.stringify(job.sheetLevels)} | manual walls ${(job.completedWallRuns || []).filter((i) => !isAi(i)).length} (by page ${JSON.stringify((job.completedWallRuns || []).filter((i) => !isAi(i)).reduce((m, w) => ({ ...m, [w.page]: (m[w.page] || 0) + 1 }), {}))}) | manual openings ${(job.placedOpenings || []).filter((i) => !isAi(i)).length} | floorplans ${(job.completedFloorplans || []).filter((i) => !isAi(i)).map((a) => a.type + ':' + (a.label || '')).join(', ')} | areas ${(job.completedAreas || []).length} | updated ${job.updatedAt}`);
  } catch (error) { console.log(`\n${file}: ${error.message.slice(0, 120)}`); }
}
