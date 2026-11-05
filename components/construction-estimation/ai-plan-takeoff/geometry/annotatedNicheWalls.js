// An explicitly dimensioned niche may add an inset line inside a real wall.
// Establish the full outer faces and their measured junctions before allowing
// that annotation to disambiguate competing face pairs.
export function annotatedNicheWalls({ linesByDirection, straight, candidates, accepted, textItems, mmPx, options }) {
  const results = [];
  const labels = (textItems || []).map(label => ({ label,
    dimensions: String(label.text || '').match(/\b(\d{3,4})\s*[x?]\s*(\d{3,4})\s+niche\b/i) })).filter(item => item.dimensions);
  const tolerance = 3 * mmPx;
  for (const [angle, lines] of linesByDirection) {
    const u = { x: Math.cos(angle), y: Math.sin(angle) }, n = { x: -u.y, y: u.x };
    const point = (s,c) => ({ x:u.x*s+n.x*c,y:u.y*s+n.y*c });
    const caps = straight.map(line => ({ a:line.x1*u.x+line.y1*u.y,b:line.x2*u.x+line.y2*u.y,
      lo:Math.min(line.x1*n.x+line.y1*n.y,line.x2*n.x+line.y2*n.y),
      hi:Math.max(line.x1*n.x+line.y1*n.y,line.x2*n.x+line.y2*n.y) })).filter(line=>Math.abs(line.a-line.b)<=tolerance);
    for (const inner of lines) {
      const length=(inner.hi-inner.lo)/mmPx;
      if (!labels.some(({label,dimensions}) => dimensions.slice(1).some(value=>Math.abs(Number(value)-length)<=Math.max(20,length*.015))
        && Math.abs(label.x*n.x+label.y*n.y-inner.c)<=options.maxThicknessMm*mmPx
        && label.x*u.x+label.y*u.y>=inner.lo-options.maxThicknessMm*mmPx
        && label.x*u.x+label.y*u.y<=inner.hi+options.maxThicknessMm*mmPx)) continue;
      for (const back of lines) {
        const offset=inner.c-back.c, side=Math.sign(offset);
        if (Math.abs(offset)<options.minThicknessMm*mmPx || Math.abs(offset)>options.maxThicknessMm*mmPx) continue;
        // Use the original enclosing stroke: collinear annotation extensions
        // must not move the wall's real capped end.
        const backRun = back.pieces.filter(piece => piece.lo < inner.lo-options.maxThicknessMm*mmPx
          && piece.hi > inner.hi+options.maxThicknessMm*mmPx)
          .sort((a,b)=>(a.hi-a.lo)-(b.hi-b.lo))[0];
        if (!backRun) continue;
        const outerLines=lines.filter(face=>side*(face.c-inner.c)>tolerance
          && side*(face.c-back.c)<=options.maxThicknessMm*mmPx);
        for (const outer of outerLines) {
          const pieces=candidates.filter(wall=>wall.angle===angle && wall.faces.includes(back)
            && wall.faces.some(face=>Math.abs(face.c-outer.c)<=tolerance));
          if (!pieces.length) continue;
          const intervals=pieces.map(wall=>[wall.lo,wall.hi]).sort((a,b)=>a[0]-b[0]);
          if (Math.abs(intervals[0][0]-backRun.lo)>tolerance || Math.abs(intervals.at(-1)[1]-backRun.hi)>tolerance) continue;
          let complete=true, end=intervals[0][1];
          for(const interval of intervals.slice(1)) {
            if(interval[0]>end+tolerance) {
              // The only interruption allowed is a measured perpendicular wall:
              // its two actual faces must account for both sides of the gap.
              const joined=accepted.some(wall=>{
                if(Math.abs(Math.cos(wall.angle-angle))>.01)return false;
                const faces=wall.faces.map(face=>{
                  const au={x:Math.cos(wall.angle),y:Math.sin(wall.angle)},an={x:-au.y,y:au.x};
                  const p={x:au.x*face.lo+an.x*face.c,y:au.y*face.lo+an.y*face.c};
                  const q={x:au.x*face.hi+an.x*face.c,y:au.y*face.hi+an.y*face.c};
                  return {s:p.x*u.x+p.y*u.y,c0:Math.min(p.x*n.x+p.y*n.y,q.x*n.x+q.y*n.y),c1:Math.max(p.x*n.x+p.y*n.y,q.x*n.x+q.y*n.y)};
                });
                return [end,interval[0]].every(at=>faces.some(face=>Math.abs(face.s-at)<=tolerance
                  && Math.min(Math.abs(face.c0-outer.c),Math.abs(face.c1-outer.c))<=tolerance));
              });
              if(!joined){complete=false;break;}
            }
            end=Math.max(end,interval[1]);
          }
          if(!complete)continue;
          const capped=at=>caps.some(cap=>Math.abs(cap.a-at)<=tolerance&&Math.abs(cap.b-at)<=tolerance
            && cap.lo<=Math.min(back.c,outer.c)+tolerance&&cap.hi>=Math.max(back.c,outer.c)-tolerance);
          const anchored=at=>accepted.some(wall=>{
            if(Math.abs(Math.cos(wall.angle-angle))>.01)return false;
            const p=point(at,back.c), au={x:Math.cos(wall.angle),y:Math.sin(wall.angle)},an={x:-au.y,y:au.x};
            return wall.faces.some(face=>Math.abs(p.x*an.x+p.y*an.y-face.c)<=tolerance
              && p.x*au.x+p.y*au.y>=face.lo-tolerance&&p.x*au.x+p.y*au.y<=face.hi+tolerance);
          });
          if(!((capped(backRun.lo)&&anchored(backRun.hi))||(capped(backRun.hi)&&anchored(backRun.lo))))continue;
          if(results.some(result=>result.back===back))continue;
          results.push({back,inner,walls:pieces});
        }
      }
    }
  }
  return results;
}
