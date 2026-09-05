import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
const out=path.resolve('recovery',`main-restored-${Date.now()}`);
fs.mkdirSync(out,{recursive:true});
const token=crypto.randomBytes(24).toString('hex');
const raw=path.join(out,'job_03-09_123.raw.json');
const fd=fs.openSync(raw,'wx');
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');
 try {
  if(req.url===`/${token}/export`&&req.method==='POST'){for await(const chunk of req) fs.writeSync(fd,chunk); res.writeHead(204).end();}
  else if(req.url===`/${token}/complete`&&req.method==='POST'){fs.fsyncSync(fd); fs.closeSync(fd); console.log('EXPORTED',raw,fs.statSync(raw).size); res.end('ok');}
  else res.writeHead(404).end();
 }catch(e){console.error(e);res.writeHead(500).end(e.message);}
});
server.listen(0,'127.0.0.1',()=>{const url=`http://localhost:3000/recovered-takeoff.html?bridge=${encodeURIComponent(`http://127.0.0.1:${server.address().port}/${token}`)}`;fs.writeFileSync('recovery/active-main-recovery.json',JSON.stringify({out,raw,url,token,port:server.address().port}));console.log(url);});
