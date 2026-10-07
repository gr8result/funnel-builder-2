import fs from 'node:fs/promises';
import {source} from './inspect-door-furniture-sources.mjs';
const dir='data/product-library/source-evidence/lockwood-internal';
const rose=JSON.parse(await fs.readFile(`${dir}/rose-door-furniture.json`)).items;
const general=JSON.parse(await fs.readFile(`${dir}/general-hardware.json`)).items;
const selected=[...rose.filter(p=>/velocity|vivid|1360.*Knob 20/i.test(p.title)),...general.filter(p=>/flush pulls/i.test(p.title)&&!/construct/i.test(p.title)),{title:'Velocity accessories',link:{url:'https://www.lockweb.com.au/au/en/products/door-handles-levers-and-knobs/lockwood-turn-and-cylinder-accessories/lockwood-velocity-small-rose-turn-and-cylinder-accessories'}}];
const records=[];
for(let i=0;i<selected.length;i+=4)await Promise.all(selected.slice(i,i+4).map(async p=>{
 const {doc}=await source(p.link.url);const sections=[...doc.querySelectorAll('gw-group-accordion[content]')].flatMap(el=>JSON.parse(Buffer.from(el.getAttribute('content'),'base64').toString()).sections||[]);
 const images=[...doc.querySelectorAll('.image-gallery__thumbnail')].map(el=>({url:el.querySelector('img')?.src,label:el.getAttribute('data-image-tag-title')}));
 const record={...p,sections,images,text:doc.querySelector('main')?.textContent.replace(/\s+/g,' ')};doc.defaultView.close();records.push(record);
 console.log(p.title,sections.find(s=>s.title==='Ordering')?.column1?.table?.tableItems?.length||0,images.length);
}));
await fs.writeFile(`${dir}/product-details.json`,JSON.stringify(records,null,2));
