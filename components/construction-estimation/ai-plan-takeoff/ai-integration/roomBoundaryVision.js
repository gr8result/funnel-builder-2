// Refine semantic AI edges against long runs of ink. No seed flood-fill, and no
// topology invented across an unbounded space. Raster storage lives for one sheet.
export function refineRoomEdges(polygon, raster, logicalWidth, logicalHeight) {
  if (!raster || polygon.length < 3) return { polygon, edgeSupport: [] };
  const sx=raster.width/logicalWidth, sy=raster.height/logicalHeight;
  const ink=(x,y)=>{
    const ix=Math.round(x*sx),iy=Math.round(y*sy);
    if(ix<0||iy<0||ix>=raster.width||iy>=raster.height)return false;
    const i=(iy*raster.width+ix)*4;
    return raster.data[i]+raster.data[i+1]+raster.data[i+2]<420;
  };
  const radius=Math.min(logicalWidth,logicalHeight)*0.004;
  const edges=polygon.map((a,i)=>{
    const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if(!length)return {a,b,support:0};
    const nx=-dy/length,ny=dx/length;
    const steps=Math.max(12,Math.min(400,Math.ceil(length*Math.max(sx,sy))));
    let best={offset:0,support:0,score:-Infinity};
    for(let j=-8;j<=8;j++) {
      const offset=radius*j/8;let count=0;
      for(let k=1;k<steps;k++)if(ink(a.x+dx*k/steps+nx*offset,a.y+dy*k/steps+ny*offset))count++;
      const support=count/(steps-1),score=support-0.04*Math.abs(j)/8;
      if(score>best.score)best={offset,support,score};
    }
    const offset=best.support>=0.6?best.offset:0;
    return {a:{x:a.x+nx*offset,y:a.y+ny*offset},b:{x:b.x+nx*offset,y:b.y+ny*offset},support:best.support};
  });
  const refined=edges.map((edge,i)=>{
    const previous=edges[(i+edges.length-1)%edges.length];
    const a=previous.a,b=previous.b,c=edge.a,d=edge.b;
    const denominator=(b.x-a.x)*(d.y-c.y)-(b.y-a.y)*(d.x-c.x);
    if(Math.abs(denominator)<1e-8)return polygon[i];
    const t=((c.x-a.x)*(d.y-c.y)-(c.y-a.y)*(d.x-c.x))/denominator;
    const p={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
    return Math.hypot(p.x-polygon[i].x,p.y-polygon[i].y)<=radius*3?p:polygon[i];
  });
  return {polygon:refined,edgeSupport:edges.map(edge=>edge.support)};
}

export async function readRoomRaster(dataUrl) {
  const image=new Image();image.src=dataUrl;await image.decode();
  const ratio=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);
  try {const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return context.getImageData(0,0,canvas.width,canvas.height);}
  finally {canvas.width=1;canvas.height=1;image.src='';}
}
