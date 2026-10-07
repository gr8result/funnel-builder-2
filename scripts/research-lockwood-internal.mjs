import fs from 'node:fs/promises';
import {source} from './inspect-door-furniture-sources.mjs';
const base='https://www.lockweb.com.au';
const out='data/product-library/source-evidence/lockwood-internal';
await fs.mkdir(out,{recursive:true});
if(process.argv[2]) {
 const {doc,html}=await source(process.argv[2]);
 console.log(doc.body.textContent.replace(/\s+/g,' ').slice(-24000));
 console.log([...doc.querySelectorAll('gw-group-accordion[content]')].map(el=>Buffer.from(el.getAttribute('content'),'base64').toString()).join('\n'));doc.defaultView.close();
} else {
 for(const branch of ['door-handles-levers-and-knobs/rose-door-furniture','door-handles-levers-and-knobs/push-pull-furniture','door-locks','general-hardware']) {
 const url=`${base}/rest/api/v1/product-listing.productgrid.branches.json/au/en/products/${branch}`;
 const {html,doc}=await source(url);doc.defaultView.close();const data=JSON.parse(html);
 await fs.writeFile(`${out}/${branch.split('/').at(-1)}.json`,JSON.stringify(data,null,2));
 console.log(branch, data.items?.length, data.items?.map(i=>({name:i.title,url:i.link.url})).filter(i=>!/1360|1370|Artefact|Louvre|dead|digital|padlock|window|electr|panic|exit|cylinder|night/i.test(i.name)));
 }
}
