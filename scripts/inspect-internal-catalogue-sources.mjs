import {source} from './inspect-door-furniture-sources.mjs';
import fs from 'node:fs/promises';
export function remix(doc){const text=[...doc.scripts].find(s=>s.textContent.startsWith('window.__remixContext')).textContent;return JSON.parse(text.slice(text.indexOf('=')+1).split(';__remixContext')[0]).state.loaderData;}
export function portaData(doc){for(const s of doc.scripts){if(!s.textContent.startsWith('self.__next_f.push'))continue;const args=JSON.parse(s.textContent.slice('self.__next_f.push('.length,-1));if(typeof args[1]==='string'&&args[1].includes('"productData"'))return JSON.parse(args[1].slice(args[1].indexOf('[')))[3].productData;}return null;}
if(process.argv[1]?.endsWith('inspect-internal-catalogue-sources.mjs')){
 const a=await source('https://www.porta.com.au/products/mouldings/architraves-skirting');
 console.log([...new Set([...a.doc.scripts].map(s=>s.textContent).join(' ').match(/architraves-skirting[^\\"\s]+/g)||[])].slice(0,30));
 const d=await(await fetch('https://www.lockweb.com.au/rest/api/v1/product-listing.productgrid.branches.json/au/en/products/door-locks/locksets')).json();
 console.log(d.items.map(i=>({title:i.title,url:i.link.url})));
 const c=await source('https://www.corinthian.com.au/doors/category/internal/?view=grid');
 console.log([...c.doc.querySelectorAll('a[href]')].filter(a=>/page\//.test(a.href)).map(a=>a.href));
 console.log([...c.doc.scripts].filter(s=>s.src).map(s=>s.src).slice(-12));
 const imgs=[...c.doc.querySelectorAll('img')];console.log(imgs.slice(6,10).map(i=>({src:i.src,alt:i.alt,html:i.outerHTML.slice(0,700)})));
 await fs.writeFile('test-artifacts/corinthian-listing.html',c.html);
}
