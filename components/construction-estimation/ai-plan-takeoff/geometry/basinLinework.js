// A basin symbol has an outer closed rim and an inset rim interrupted by a tap.
// Identify its CAD path, never a surrounding wall or the whole vanity outline.
export function basinRimPaths(segments, pixelsPerMm) {
  const found = new Set();
  if (!(pixelsPerMm > 0)) return found;
  const tolerance = 3 * pixelsPerMm;
  const straight = segments.filter(s => !s.curve && s.paint === 'stroke' && !s.dashed
    && (Math.abs(s.x1-s.x2)<tolerance || Math.abs(s.y1-s.y2)<tolerance));
  const groups = new Map();
  for (const s of straight) {
    if (s.path === undefined) continue;
    if (!groups.has(s.path)) groups.set(s.path, []);
    groups.get(s.path).push(s);
  }
  const bounds = strokes => ({x0:Math.min(...strokes.flatMap(s=>[s.x1,s.x2])),x1:Math.max(...strokes.flatMap(s=>[s.x1,s.x2])),
    y0:Math.min(...strokes.flatMap(s=>[s.y1,s.y2])),y1:Math.max(...strokes.flatMap(s=>[s.y1,s.y2]))});
  const sides = box => [
    {axis:'x',c:box.y0,lo:box.x0,hi:box.x1}, {axis:'x',c:box.y1,lo:box.x0,hi:box.x1},
    {axis:'y',c:box.x0,lo:box.y0,hi:box.y1}, {axis:'y',c:box.x1,lo:box.y0,hi:box.y1}];
  const along = (s, side) => side.axis==='x' ? [s.x1,s.x2] : [s.y1,s.y2];
  const across = (s, side) => side.axis==='x' ? [s.y1,s.y2] : [s.x1,s.x2];
  const onSide = (s, side) => across(s,side).every(v=>Math.abs(v-side.c)<=tolerance)
    && Math.min(...along(s,side))>=side.lo-tolerance && Math.max(...along(s,side))<=side.hi+tolerance;
  const fullSide = (strokes, side) => strokes.some(s=>onSide(s,side)
    && Math.abs(Math.min(...along(s,side))-side.lo)<=tolerance && Math.abs(Math.max(...along(s,side))-side.hi)<=tolerance);
  for (const [path, outer] of groups) {
    if (outer.length!==4 || new Set(outer.map(s=>s.subpath)).size!==1) continue;
    const box=bounds(outer), size=[box.x1-box.x0,box.y1-box.y0].map(v=>v/pixelsPerMm);
    if (Math.min(...size)<250 || Math.max(...size)>1200 || Math.min(...size)>1000 || !sides(box).every(side=>fullSide(outer,side))) continue;
    for (const [innerPath, inner] of groups) {
      if (innerPath===path || inner.length!==4) continue;
      const inset=bounds(inner), margins=[inset.x0-box.x0,box.x1-inset.x1,inset.y0-box.y0,box.y1-inset.y1].map(v=>v/pixelsPerMm);
      if (margins.some(v=>v<15 || v>100)) continue;
      const edges=sides(inset), complete=edges.filter(side=>fullSide(inner,side));
      if (complete.length!==3) continue;
      const interrupted=edges.find(side=>!complete.includes(side));
      if (!inner.every(s=>edges.some(side=>onSide(s,side)))) continue;
      const pieces=straight.filter(s=>onSide(s,interrupted)).map(s=>along(s,interrupted).sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);
      let end=interrupted.lo;const gaps=[];
      for (const [lo,hi] of pieces) { if(lo>end+tolerance)gaps.push([end,lo]);end=Math.max(end,hi); }
      if(end<interrupted.hi-tolerance)gaps.push([end,interrupted.hi]);
      if(gaps.length!==1)continue;
      const [a,b]=gaps[0], gapMm=(b-a)/pixelsPerMm;
      if(a<=interrupted.lo+tolerance || b>=interrupted.hi-tolerance || gapMm<8 || gapMm>30)continue;
      const tapAt = point => straight.some(s=>along(s,interrupted).every(v=>Math.abs(v-point)<=tolerance)
        && Math.min(...across(s,interrupted))<interrupted.c-tolerance && Math.max(...across(s,interrupted))>interrupted.c+tolerance
        && Math.abs(across(s,interrupted)[1]-across(s,interrupted)[0])/pixelsPerMm>=20
        && Math.abs(across(s,interrupted)[1]-across(s,interrupted)[0])/pixelsPerMm<=150);
      if(tapAt(a)&&tapAt(b)){found.add(path);break;}
    }
  }
  return found;
}

export function pairUsesBasinRim(candidate, paths) {
  const length=candidate.hi-candidate.lo;
  return candidate.faces.some(face=>{
    const basin=[],other=[];
    for(const p of face.pieces){const lo=Math.max(p.lo,candidate.lo),hi=Math.min(p.hi,candidate.hi);if(hi>lo)(paths.has(p.segment.path)?basin:other).push([lo,hi]);}
    const coverage=pieces=>{let end=-Infinity,total=0;for(const [lo,hi] of pieces.sort((a,b)=>a[0]-b[0])){total+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}return total;};
    return coverage(basin)>=.95*length && coverage(other)<=.05*length;
  });
}
