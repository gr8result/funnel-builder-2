import fs from 'node:fs';import puppeteer from 'puppeteer';
const root='test-artifacts/internal-finishing-sync-live/';const browser=await puppeteer.connect({browserWSEndpoint:fs.readFileSync(root+'browser-endpoint.txt','utf8'),protocolTimeout:30000});
const pages=await browser.pages();const page=pages.find(p=>p.url().includes('localhost:3000'));
console.log(await page.evaluate(()=>({url:location.href,text:document.body.innerText.slice(-14000),selects:[...document.querySelectorAll('[aria-label="Internal product brand"]')].map(e=>e.innerText)})));await page.screenshot({path:root+'current.png'});await browser.disconnect();
