import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
export const cacheDir = path.resolve('data/product-library/source-evidence/entry-door-furniture');
export async function source(url) {
  await fs.mkdir(cacheDir, {recursive:true});
  const file = path.join(cacheDir, createHash('sha256').update(url).digest('hex').slice(0,20)+'.json');
  let record;
  try { record = JSON.parse(await fs.readFile(file,'utf8')); }
  catch { const response = await fetch(url, {signal:AbortSignal.timeout(45000)}); if(!response.ok) throw Error(`${response.status} ${url}`); record={url:response.url, checkedAt:new Date().toISOString(),html:await response.text()}; await fs.writeFile(file,JSON.stringify(record)); }
  const doc = new JSDOM(record.html,{url:record.url,virtualConsole:new VirtualConsole()}).window.document;
  return { ...record, doc };
}
if(process.argv[1]?.endsWith('inspect-door-furniture-sources.mjs')) for(const url of process.argv.slice(2)) {
  try { const {doc}=await source(url); const main=doc.querySelector('main')||doc.body;
    console.log(JSON.stringify({url,title:doc.title,links:[...main.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim().replace(/\s+/g,' ').slice(0,90),url:a.href})).filter(a=>/product|entrance|lock|handle/i.test(a.url)),text:main.textContent.replace(/\s+/g,' ').slice(-14000),images:[...main.querySelectorAll('img')].slice(0,15).map(i=>({src:i.src,alt:i.alt})),scripts:[...doc.scripts].map(s=>s.src).filter(Boolean)},null,2));
  }catch(e){ console.log(url,e.message); }
}
