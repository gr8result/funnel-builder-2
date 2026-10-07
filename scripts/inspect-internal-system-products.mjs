import fs from 'node:fs/promises';import {source} from './inspect-door-furniture-sources.mjs';
const results=[];
for(const url of ['https://flexistorage.com.au/wardrobe/walk-in-wardrobe/','https://flexistorage.com.au/wardrobe/400mm-wardrobe/','https://stairlock.com.au/products/easy-mdf/','https://stairlock.com.au/products/custom-staircases/','https://stairlock.com.au/products/american-oak/']){
const {doc}=await source(url);const main=doc.querySelector('main')||doc.body;results.push({url,title:doc.title,text:main.textContent.replace(/\s+/g,' ').slice(0,22000),links:[...main.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim(),url:a.href})),images:[...main.querySelectorAll('img')].map(i=>({url:i.getAttribute('data-src')||i.src,alt:i.alt}))});doc.defaultView.close();console.log(url);}
await fs.writeFile('data/product-library/source-evidence/internal-finishing/system-source-inventory.json',JSON.stringify(results,null,2));

