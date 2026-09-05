import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const out=`recovery/live-snapshot-inspection-${Date.now()}`;
fs.mkdirSync(out,{recursive:true});
const token=crypto.randomBytes(24).toString('hex');
const rows=[];
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');
 if(!req.url.startsWith('/'+token+'/'))return res.writeHead(403).end();
 let body='';for await(const chunk of req)body+=chunk;
 if(req.url.endsWith('/row')){const row=JSON.parse(body);rows.push(row);fs.appendFileSync(out+'/records.jsonl',body+'\n');console.log(row.key,JSON.stringify(row.candidates));}
 if(req.url.endsWith('/done')){fs.writeFileSync(out+'/inspection.json',JSON.stringify({completedAt:new Date().toISOString(),rows},null,2));console.log('DONE',out,rows.length);server.close();}
 if(req.url.endsWith('/error')){console.error(body);server.close();}
 res.end('ok');
});
server.listen(0,'127.0.0.1',()=>{
 const endpoint=`http://127.0.0.1:${server.address().port}/${token}`;
 const url='http://localhost:3000/takeoff-snapshot-inspection.html?bridge='+encodeURIComponent(endpoint)+(process.argv.includes('--keys-only')?'&keysOnly=1':'')+(process.argv.includes('--new-only')?'&newOnly=1':'');
 spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--profile-directory=Profile 6',url],{detached:true,stdio:'ignore'}).unref();
 console.log('Read-only inspection started',out);
});
