import fs from 'node:fs/promises';
const root='data/product-library/source-evidence/internal-finishing/';
const heroes=JSON.parse(await fs.readFile(root+'corinthian-model-heroes.json'));
const media=JSON.parse(await fs.readFile(root+'corinthian-media.json'));
const norm=s=>decodeURIComponent(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const stem=s=>norm(s.split('/').pop().replace(/(?:[-_ ](?:angled|angle|with[-_ ]frame|wframe|front|frame|4k)).*/i,''));
const results=heroes.map(h=>{
 const key=stem(h.hero);
 const candidates=media.filter(m=>!/(angled|angle|insitu)/i.test(m.title)&&stem(m.url)===key).sort((a,b)=>(/frame|front/i.test(b.title)?10:0)-(/frame|front/i.test(a.title)?10:0)+(a.width/a.height-b.width/b.height));
 return {...h,key,candidates:candidates.map(m=>({id:m.id,title:m.title,url:m.url,ratio:m.width/m.height}))};
});
await fs.writeFile(root+'corinthian-front-candidates.json',JSON.stringify(results,null,2));
console.log(results.filter(r=>!r.candidates.length).map(r=>({model:r.model,key:r.key,hero:r.hero})));
console.log('Matched',results.filter(r=>r.candidates.length).length,'of',results.length);
