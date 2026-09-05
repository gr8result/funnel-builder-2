import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

export async function recordSafeModeMemory(browser, page, directory) {
  const cdp = await browser.target().createCDPSession();
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const ids = processInfo.map(process => Number(process.id)).filter(Number.isFinite);
    let processOutput;
    try { processOutput = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }); }
    catch (error) { if (!error.stdout?.trim()) throw error; processOutput = error.stdout; }
    const parsed = JSON.parse(processOutput);
    const memory = Array.isArray(parsed) ? parsed : [parsed];
    samples.push({ time: new Date().toISOString(), processes: memory, page: await page.metrics(), status: await page.$eval('[role=status]', el => el.textContent) });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const peakWorkingSetBytes = Math.max(...samples.map(sample => sample.processes.reduce((n, process) => n + process.WorkingSet64, 0)));
  const report = { samples, peakWorkingSetBytes, caveat: 'Sum of isolated Chrome process working sets includes shared pages and browser/native allocations. Opening safe mode reads only keys and scalar metadata.' };
  fs.writeFileSync(path.join(directory, 'chrome-memory.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ samples: samples.length, peakWorkingSetBytes, lastStatus: samples.at(-1).status }));
  return report;
}
