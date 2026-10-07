import fs from 'node:fs';import puppeteer from 'puppeteer';
const b=await puppeteer.connect({browserWSEndpoint:fs.readFileSync('test-artifacts/lockwood-sync-live/browser-endpoint.txt','utf8').trim()});
const page=(await b.pages()).find(p=>p.url().includes('localhost'));
if(process.argv.includes('--close'))await b.close();else{console.log((await page.evaluate(()=>document.body.innerText)).slice(-7000));await b.disconnect();}
