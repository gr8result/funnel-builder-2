import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('recovery/active-main-recovery.json'));
const server=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');
let body='';for await(const chunk of req)body+=chunk;
fs.writeFileSync(config.out+'/direct-indexeddb-check.json',body);console.log(body);res.end('ok');server.close();
});
server.listen(0,'127.0.0.1',()=>{
const url='http://localhost:3000/recovered-takeoff-check.html?bridge='+encodeURIComponent('http://127.0.0.1:'+server.address().port);
spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--profile-directory=Profile 6',url],{detached:true,stdio:'ignore'}).unref();
});
