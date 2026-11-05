// Compact, clipped cross-hatching identifies a filled pier, not an empty
// linear wall. Preserve the original strokes and reject only its short rim pairs.
export function crossHatchedPiers(straight, pixelsPerMm) {
  const groups=new Map(), tolerance=3*pixelsPerMm;
  for(const s of straight){
    const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy)/pixelsPerMm;
    if(s.path===undefined || s.paint!=='stroke' || s.dashed || s.color!=='#000000'
      || length<25 || length>1300 || Math.abs(dx)<.35*Math.hypot(dx,dy) || Math.abs(dy)<.35*Math.hypot(dx,dy))continue;
    if(!groups.has(s.path))groups.set(s.path,[]);groups.get(s.path).push(s);
  }
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const point=(s,i)=>({x:s['x'+i],y:s['y'+i]});
  const boxes=[];
  for(const strokes of groups.values()){
    if(strokes.length<8)continue;
    const parent=strokes.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
    for(let i=0;i<strokes.length;i++)for(let j=i+1;j<strokes.length;j++){
      const a=strokes[i],b=strokes[j];
      if((a.x2-a.x1)*(a.y2-a.y1)*(b.x2-b.x1)*(b.y2-b.y1)>=0)continue;
      const p=point(a,1),q=point(a,2),r=point(b,1),s=point(b,2);
      if(cross(p,q,r)*cross(p,q,s)<=0&&cross(r,s,p)*cross(r,s,q)<=0)parent[find(i)]=find(j);
    }
    const clusters=new Map();strokes.forEach((s,i)=>{const key=find(i);if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(s);});
    for(const cluster of clusters.values()){
      const positive=cluster.filter(s=>(s.x2-s.x1)*(s.y2-s.y1)>0).length;
      if(positive<4 || cluster.length-positive<4)continue;
      const points=cluster.flatMap(s=>[point(s,1),point(s,2)]);
      const x0=Math.min(...points.map(p=>p.x)),x1=Math.max(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y)),y1=Math.max(...points.map(p=>p.y));
      const width=(x1-x0)/pixelsPerMm,height=(y1-y0)/pixelsPerMm;
      if(Math.min(width,height)<200 || Math.max(width,height)>900 || Math.max(width,height)/Math.min(width,height)>2)continue;
      const reach=Math.max(tolerance,...cluster.map(s=>(s.widthPx||0)/2+pixelsPerMm));
      if(points.some(p=>Math.min(Math.abs(p.x-x0),Math.abs(p.x-x1),Math.abs(p.y-y0),Math.abs(p.y-y1))>reach))continue;
      const sides=[p=>Math.abs(p.x-x0),p=>Math.abs(p.x-x1),p=>Math.abs(p.y-y0),p=>Math.abs(p.y-y1)];
      if(sides.some(distance=>points.filter(p=>distance(p)<=reach).length<2))continue;
      boxes.push({x0,x1,y0,y1});
    }
  }
  return boxes;
}

export function pairIsPierRim(candidate, piers, pixelsPerMm) {
  const horizontal=Math.abs(Math.sin(candidate.angle))<.001,vertical=Math.abs(Math.cos(candidate.angle))<.001;
  if(!horizontal&&!vertical)return false;
  const tolerance=3*pixelsPerMm,thickness=candidate.thicknessMm*pixelsPerMm;
  return piers.some(box=>{
    const lo=horizontal?box.x0:box.y0,hi=horizontal?box.x1:box.y1;
    const edges=horizontal?[box.y0,box.y1]:[-box.x1,-box.x0];
    if(candidate.lo<lo-thickness-tolerance || candidate.hi>hi+thickness+tolerance)return false;
    // A genuine wall can run past a pier. A drawn face continuing beyond
    // the filled body may belong to that wall; do not reclassify it as a rim.
    // Only the face drawn on the pier's edge decides: a wall running past the pier carries that face on
    // beyond it, while a line that merely passes alongside (a robe or shelf edge) does not make the
    // pier edge a wall face.
    const continuation=150*pixelsPerMm;
    const onEdge=candidate.faces.filter(face=>edges.some(edge=>Math.abs(face.c-edge)<=tolerance));
    const deciding=onEdge.length?onEdge:candidate.faces;
    const continuesBefore=deciding.some(face=>face.pieces.some(p=>p.lo<=lo-continuation && p.hi>=lo-tolerance));
    const continuesAfter=deciding.some(face=>face.pieces.some(p=>p.hi>=hi+continuation && p.lo<=hi+tolerance));
    if(continuesBefore||continuesAfter)return false;
    return edges.some(edge=>Math.min(Math.abs(candidate.c0-edge),Math.abs(candidate.c1-edge))<=tolerance
      && (candidate.c1<=edge+tolerance || candidate.c0>=edge-tolerance));
  });
}
