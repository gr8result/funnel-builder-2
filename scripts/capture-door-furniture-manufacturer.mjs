import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer';
import {cacheDir} from './inspect-door-furniture-sources.mjs';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try { for(const url of process.argv.slice(2)) {
  const page=await browser.newPage();const responses=[];
  page.on('response',async r=>{if(/json/.test(r.headers()['content-type']||'')){try {responses.push({url:r.url(),data:await r.json()});}catch{}}});
  await page.goto(url,{waitUntil:'networkidle2',timeout:90000});await new Promise(r=>setTimeout(r,5000));
  const record={url,checkedAt:new Date().toISOString(),html:await page.content()};
  await fs.mkdir(cacheDir,{recursive:true});const id=createHash('sha256').update(url).digest('hex').slice(0,20);
  await fs.writeFile(`${cacheDir}/${id}.json`,JSON.stringify(record));
  await fs.writeFile(`${cacheDir}/${id}.responses.json`,JSON.stringify(responses));
  console.log(url,await page.title(),responses.map(r=>r.url));await page.close();
}}finally{await browser.close();}
