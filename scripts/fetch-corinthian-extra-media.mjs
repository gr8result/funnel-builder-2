import fs from 'node:fs/promises';
const file='data/product-library/source-evidence/internal-finishing/corinthian-media.json';const all=JSON.parse(await fs.readFile(file));
for(const term of ['Preston','RMDF','Flush']){for(let page=1;;page++){const r=await fetch(`https://www.corinthian.com.au/wp-json/wp/v2/media?search=${term}&per_page=100&page=${page}`);const d=await r.json();if(!Array.isArray(d))throw Error(JSON.stringify(d));all.push(...d.map(m=>({id:m.id,title:m.title.rendered,url:m.source_url,width:m.media_details.width,height:m.media_details.height,sizes:m.media_details.sizes})));if(page>=Number(r.headers.get('x-wp-totalpages')||1))break;}console.log(term);}
await fs.writeFile(file,JSON.stringify([...new Map(all.map(m=>[m.id,m])).values()],null,2));

