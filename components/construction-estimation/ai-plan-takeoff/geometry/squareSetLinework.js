// Square-set text identifies the assembly, not its width. Measure two capped
// jambs with solid paired hosts and matching dashed header lines between them.
export function squareSetAssemblies(segments, textItems, pixelsPerMm, options) {
  const labels=(textItems||[]).filter(t=>/\b(?:SQ\.?|SQUARE)\s*SET\b/i.test(t.text||'')&&Number.isFinite(t.x)&&Number.isFinite(t.y));
  const result={openings:[],headerStrokes:new Set(),hosts:[]};
  if(!labels.length)return result;
  const tolerance=options.frameCapToleranceMm*pixelsPerMm;
  const lines=segments.filter(s=>!s.curve&&!s.dashed&&s.paint==='stroke'&&s.color==='#000000');
  for(const axis of ['x','y']){
    const other=axis==='x'?'y':'x';
    const along=s=>[s[axis+'1'],s[axis+'2']].sort((a,b)=>a-b);
    const across=s=>[s[other+'1'],s[other+'2']].sort((a,b)=>a-b);
    const caps=lines.filter(s=>Math.abs(s[axis+'1']-s[axis+'2'])<3*pixelsPerMm
      && Math.abs(s[other+'1']-s[other+'2'])/pixelsPerMm>=options.minThicknessMm
      && Math.abs(s[other+'1']-s[other+'2'])/pixelsPerMm<=options.maxThicknessMm);
    const rails=lines.filter(s=>Math.abs(s[other+'1']-s[other+'2'])<3*pixelsPerMm);
    for(let i=0;i<caps.length;i++)for(let j=i+1;j<caps.length;j++){
      const first=caps[i],second=caps[j],lo=Math.min(first[axis+'1'],second[axis+'1']),hi=Math.max(first[axis+'1'],second[axis+'1']);
      const [c0,c1]=across(first),[d0,d1]=across(second),width=(hi-lo)/pixelsPerMm;
      if(width<options.openingMinMm||width>options.openingMaxMm||Math.abs(c0-d0)>3*pixelsPerMm||Math.abs(c1-d1)>3*pixelsPerMm)continue;
      const label=labels.find(t=>{
        const x=t.x+Math.max(0,t.width||0)/2,y=t.y-Math.max(0,t.height||0)/2;
        const s=axis==='x'?x:y,c=axis==='x'?y:x;
        return s>=lo-tolerance&&s<=hi+tolerance&&Math.abs(c-(c0+c1)/2)<=options.windowLabelReachMm*pixelsPerMm;
      });
      if(!label)continue;
      const at=c=>rails.filter(s=>Math.abs(s[other+'1']-c)<=3*pixelsPerMm);
      const left=[c0,c1].map(c=>at(c).filter(s=>Math.abs(along(s)[1]-lo)<=3*pixelsPerMm&&(along(s)[1]-along(s)[0])/pixelsPerMm>=options.minOverlapMm).sort((a,b)=>along(a)[0]-along(b)[0])[0]);
      const right=[c0,c1].map(c=>at(c).filter(s=>Math.abs(along(s)[0]-hi)<=3*pixelsPerMm&&(along(s)[1]-along(s)[0])/pixelsPerMm>=options.minOverlapMm).sort((a,b)=>along(b)[1]-along(a)[1])[0]);
      if([...left,...right].some(s=>!s))continue;
      // An uninterrupted drawn face contradicts an open jamb-to-jamb span.
      if([c0,c1].some(c=>at(c).some(s=>along(s)[0]<=lo+3*pixelsPerMm&&along(s)[1]>=hi-3*pixelsPerMm)))continue;
      const headers=[c0,c1].map(c=>at(c).filter(s=>{
        const [a,b]=along(s),length=(b-a)/pixelsPerMm;
        return a>=lo-tolerance&&b<=hi+tolerance&&length>=20&&length<=250;
      }).sort((a,b)=>along(a)[0]-along(b)[0]));
      if(headers.some(row=>row.length<3)||headers[0].length!==headers[1].length)continue;
      const samePattern=headers[0].every((s,k)=>along(s).every((v,n)=>Math.abs(v-along(headers[1][k])[n])<=options.mergeGapMm*pixelsPerMm));
      if(!samePattern)continue;
      const dashed=headers.every(row=>{
        if(Math.abs(along(row[0])[0]-lo)>tolerance||Math.abs(along(row.at(-1))[1]-hi)>tolerance)return false;
        const spans=row.map(along),lengths=spans.map(([a,b])=>b-a),gaps=spans.slice(1).map(([a],k)=>a-spans[k][1]);
        return gaps.every(g=>g>3*pixelsPerMm&&g<=250*pixelsPerMm)
          && Math.max(...lengths)-Math.min(...lengths)<=options.mergeGapMm*pixelsPerMm
          && Math.max(...gaps)-Math.min(...gaps)<=options.mergeGapMm*pixelsPerMm;
      });
      if(!dashed)continue;
      const angle=axis==='x'?0:Math.PI/2;
      const normal0=axis==='x'?c0:-c1,normal1=axis==='x'?c1:-c0;
      const opening={angle,lo,hi,c0:normal0,c1:normal1,c:(normal0+normal1)/2,label:label.text};
      if(result.openings.some(o=>o.angle===angle&&Math.abs(o.lo-lo)<=tolerance&&Math.abs(o.hi-hi)<=tolerance))continue;
      result.openings.push(opening);
      headers.flat().forEach(s=>result.headerStrokes.add(s));
      result.hosts.push({...opening,lo:Math.max(...left.map(s=>along(s)[0])),hi:lo},
        {...opening,lo:hi,hi:Math.min(...right.map(s=>along(s)[1]))});
    }
  }
  return result;
}

export function isSquareSetHost(candidate, assemblies, pixelsPerMm) {
  const tolerance=3*pixelsPerMm;
  return assemblies.hosts.some(h=>Math.abs(h.angle-candidate.angle)<.001&&Math.abs(h.c0-candidate.c0)<=tolerance&&Math.abs(h.c1-candidate.c1)<=tolerance
    && Math.abs(h.lo-candidate.lo)<=tolerance&&Math.abs(h.hi-candidate.hi)<=tolerance);
}
