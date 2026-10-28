// Which linework candidates (no evidence) correspond to a hand-placed opening?
import fs from 'node:fs'; import JSZip from 'jszip';
const [dir, jobPath] = process.argv.slice(2);
const archive = await JSZip.loadAsync(fs.readFileSync(jobPath)); const takeoff = JSON.parse(await archive.file('takeoff.json').async('text'));
const job = takeoff.aiPlanTakeoffJob || takeoff.takeoff?.aiPlanTakeoffJob; const ppm = job.pixelsPerMm;
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
for (const page of [2, 3]) {
  const g = JSON.parse(fs.readFileSync(`${dir}/geometry-${page}.json`, 'utf8'));
  const manual = job.placedOpenings.filter((o) => !isAi(o) && Number(o.page) === page);
  const wallById = new Map(g.walls.map((w) => [w.id, w]));
  const pairs = manual.flatMap((m, mi) => g.openings.map((c, ci) => ({ mi, ci, d: Math.hypot(c.x - m.x, c.y - m.y) / ppm }))).filter((p) => p.d < 700).sort((a, b) => a.d - b.d);
  const um = new Set(), uc = new Map();
  for (const p of pairs) { if (um.has(p.mi) || uc.has(p.ci)) continue; um.add(p.mi); uc.set(p.ci, p); }
  console.log(`\n== page ${page}: ${g.openings.length} candidates, ${manual.length} hand-placed`);
  const rows = g.openings.map((c, ci) => { const p = uc.get(ci); const m = p ? manual[p.mi] : null; const host = wallById.get(c.hostWallId);
    return `${c.kind.padEnd(11)} ${c.axis} w${String(c.widthMm).padStart(5)} host ${host ? host.category.slice(0, 3) + ' t' + host.measuredThicknessMm : '-'.padEnd(8)} hostT ${c.hostThicknessMm} ${c.basis || ''} ${c.confirmed ? 'CONF' : '    '} -> ${m ? `${m.itemTag} (${Math.round(p.d)}mm, w${m.widthMm})` : 'NO MATCH'}  @${Math.round(c.x)},${Math.round(c.y)}`; });
  rows.sort(); for (const r of rows) console.log(r);
  console.log('unmatched hand-placed:', manual.filter((m, i) => !um.has(i)).map((m) => `${m.itemTag} w${m.widthMm} @${Math.round(m.x)},${Math.round(m.y)}`).join('; '));
}
