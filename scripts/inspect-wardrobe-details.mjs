import fs from 'node:fs/promises';import {source} from './inspect-door-furniture-sources.mjs';
const root='data/product-library/source-evidence/internal-finishing/';
const inv=JSON.parse(await fs.readFile(root+'system-source-inventory.json'));
const urls=[...new Set(inv.slice(0,2).flatMap(x=>x.links.filter(l=>l.url.includes('/products/')).map(l=>l.url)))];urls.push('https://flexistorage.com.au/shop-by-look-wardrobes/');
const records=[];for(const url of urls){let doc;try{({doc}=await source(url));}catch(e){console.log(e.message);continue;}const main=doc.querySelector('main')||doc.body;records.push({url,title:doc.title,text:main.textContent.replace(/\s+/g,' '),images:[...main.querySelectorAll('img')].map(i=>({url:i.getAttribute('data-src')||i.src,alt:i.alt})),links:[...main.querySelectorAll('a[href]')].map(a=>({url:a.href,text:a.textContent.trim()}))});doc.defaultView.close();console.log(url);}
await fs.writeFile(root+'wardrobe-product-details.json',JSON.stringify(records,null,2));

