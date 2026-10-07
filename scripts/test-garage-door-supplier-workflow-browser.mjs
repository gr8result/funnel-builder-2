// Run: node --import ./scripts/register-json-loader.mjs scripts/test-garage-door-supplier-workflow-browser.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

const baseUrl = process.env.GARAGE_DOOR_TEST_BASE_URL || 'http://localhost:3000';
const projectId = 'garage-door-supplier-verification-20260909';
const outputDir = path.resolve('artifacts/test-artifacts/garage-door-supplier-workflow');
fs.mkdirSync(outputDir, { recursive: true });
const workbook = {
  ...createEstimateBuilderWorkbookDefaults(),
  templateType: 'job', page: 'clientSelections', projectId,
  commercialProjectId: projectId, registeredJobId: projectId,
  registeredJob: { jobId: projectId, jobName: 'Garage Door Supplier Verification', jobNumber: 'GD-TEST', clientName: 'Test client', siteAddress: 'Test address' },
  jobFileMeta: { projectId, jobName: 'Garage Door Supplier Verification', jobNumber: 'GD-TEST', clientName: 'Test client', address: 'Test address' },
};
delete workbook.aiPlanTakeoffJob;
delete workbook.takeoffEngine;
const fixturePath = path.join(outputDir, 'synthetic-garage-door-job.json');
fs.writeFileSync(fixturePath, JSON.stringify({ projectId, jobName: 'Garage Door Supplier Verification', workbook }));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(supabaseUrl && anonKey && serviceKey, 'Authenticated browser verification requires local Supabase configuration.');
// generateLink creates an authentication token without sending an email.
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
assert(auth.session?.access_token, 'Authentication must return a usable session.');

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, protocolTimeout: 300000,
  defaultViewport: { width: 1500, height: 1100 },
});
fs.writeFileSync(path.join(outputDir, 'browser-endpoint.txt'), browser.wsEndpoint());
const errors = [], steps = [], previewRequests = [];
let page;
const pause = (ms = 650) => new Promise(resolve => setTimeout(resolve, ms));
try {
  page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`, session: auth.session,
  });

  async function click(text, selector = 'button', exact = true) {
    await page.waitForFunction(({ text, selector, exact }) => [...document.querySelectorAll(selector)].some(button => !button.disabled && (exact ? button.innerText.trim() === text : button.innerText.includes(text))), {}, { text, selector, exact });
    await page.evaluate(({ text, selector, exact }) => [...document.querySelectorAll(selector)].find(button => !button.disabled && (exact ? button.innerText.trim() === text : button.innerText.includes(text))).click(), { text, selector, exact });
    await pause();
  }
  async function shot(name, detail = {}) {
    steps.push({ name, url: page.url(), ...detail });
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
    console.log(name);
  }
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  console.log('Authenticated estimate builder loaded');
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(fixturePath);
  await pause(2200);
  console.log('Synthetic job uploaded');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const labels = await page.$$eval('button', buttons => buttons.map(button => button.innerText.trim()));
    if (labels.includes('Discard Changes')) await click('Discard Changes');
    if (labels.includes('Open Job')) await click('Open Job');
    if (labels.includes('Open Job File')) await click('Open Job File');
    await pause(750);
  }
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&projectId=${projectId}&selectionArea=exterior&selectionRequirement=garage-door`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  console.log('Synthetic garage selection route loaded');
  await page.waitForSelector('[data-testid="guided-garage-door-workflow"]');
  await pause(1200);
  const workflowText = await page.$eval('[data-testid="guided-garage-door-workflow"]', element => element.innerText);
  await shot('01-supplier', { workflowText });
  if (process.argv.includes('--probe')) {
    fs.writeFileSync(path.join(outputDir, 'probe.json'), JSON.stringify({ passed: true, steps, errors }, null, 2));
  } else {
    throw new Error('Full updated workflow assertions are being prepared. Use --probe for initial runtime inspection.');
  }
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: false }).catch(() => {});
    fs.writeFileSync(path.join(outputDir, 'failure.txt'), await page.evaluate(() => document.body.innerText).catch(() => ''));
  }
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ passed: false, error: error.message, steps, errors, previewRequests }, null, 2));
  throw error;
} finally {
  await browser.close();
}
