import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Client Selections > Internal Paint Colours in the running app: choose the house colours from the
// Dulux colour selector, confirm, add a feature wall, override one room, save, reload, Review
// Schedule and the Quotation Builder's painting lines. Uses an isolated local job; cloud writes are
// blocked and existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-internal-paint-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/internal-paint-colours-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-internal-paint-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local internal paint colours regression';
// The project's rooms as AI Plan Takeoff records them: on the placed windows and doors, in the
// takeoff's own shorthand. There is no plan-analysis room list, as on a real job.
const TAKEOFF_ROOMS = [['other', 'Master Bedroom'], ['bed-2', 'Bed 2'], ['bed-4', 'Bed 4'], ['media-theatre', 'Media / Theatre'], ['other', 'Study'], ['family', 'Family'], ['alfresco', 'Alfresco']];
const ROOMS = ['Master Bedroom', 'Bedroom 2', 'Bedroom 4', 'Media Room', 'Study', 'Family'];
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PAINT', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PAINT', clientName:'Local test client', address:'Local test address'},
  aiPlanTakeoffJob:{placedOpenings:TAKEOFF_ROOMS.map(([roomKey, roomLabel], index) => ({id:`opening-${index}`, openingType:'window', roomKey, roomLabel, location:roomLabel}))}};
const fixture = path.join(out, 'local-paint-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;
const browser = await puppeteer.launch({
  executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless:true, protocolTimeout:180000, defaultViewport:{width:1920, height:1080},
});
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, steps:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:0};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const PAGE = selector('internal-paint-colour-specification');
const SELECTOR = selector('dulux-colour-selector');
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-category-paint-wall-finishes', 'internal-paint-colour-specification'].map(selector).join(', ');
const click = sel => page.$eval(sel, element => element.click());
async function screenshot(name) { await page.screenshot({path:path.join(out, `${name}.png`)}); report.screenshots.push(`${name}.png`); }

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

async function openPaintColours() {
  for (let guard = 0; guard < 8 && !await page.$(PAGE); guard++) {
    if (await page.$(selector('guided-client-selections-home'))) {
      await click(`${selector('guided-client-selections-home')} [data-category-key="interior"]`);
      await page.waitForSelector(selector('guided-interior-categories'));
    } else if (await page.$(selector('guided-category-paint-wall-finishes'))) {
      await page.$eval(selector('guided-requirement-interior-paint'), card => (card.querySelector('button') || card).click());
      await delay(800);
    } else if (await page.$(selector('guided-interior-categories'))) {
      await click(`${selector('guided-interior-categories')} [data-category-key="paint-wall-finishes"]`);
      await delay(800);
    } else {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await delay(800);
    }
  }
  await page.waitForSelector(PAGE);
}

// Opens the Dulux selector from `openButton`, searches, and selects the colour with that exact name.
async function chooseColour(openButton, search, exactName) {
  await click(openButton);
  await page.waitForSelector(SELECTOR);
  await page.type(selector('dulux-colour-search'), search);
  await page.waitForFunction((name) => [...document.querySelectorAll('[data-testid="dulux-colour-card"]')].some(card => card.dataset.colourName === name), {}, exactName);
  const chosen = await page.$eval(`${selector('dulux-colour-card')}[data-colour-name="${exactName}"]`, card => {
    const result = {id:card.dataset.colourId, name:card.dataset.colourName, code:card.dataset.colourCode, swatch:getComputedStyle(card.querySelector('.ipc-cardSwatch')).backgroundColor,
      swatchHeight:card.querySelector('.ipc-cardSwatch').offsetHeight, cardHeight:card.offsetHeight, text:card.innerText.replace(/\s+/g, ' ')};
    card.querySelector('[data-testid="dulux-colour-select"]').click();
    return result;
  });
  await page.waitForFunction(sel => !document.querySelector(sel), {}, SELECTOR);
  return chosen;
}
const surface = key => page.$eval(selector(`paint-surface-${key}`), card => ({code:card.dataset.colourCode, hex:card.dataset.colourHex, id:card.dataset.colourId, standard:card.dataset.standard,
  placeholder:card.querySelector('.ipc-swatch').classList.contains('empty'), hasReset:Boolean(card.querySelector('[data-testid="paint-ceiling-reset"]')), text:card.innerText.replace(/\s+/g, ' '),
  swatch:getComputedStyle(card.querySelector('.ipc-swatch')).backgroundColor, swatchHeight:card.querySelector('.ipc-swatch').offsetHeight}));
const saved = () => page.waitForFunction(() => document.querySelector('[data-testid="paint-save-state"]')?.classList.contains('saved'), {timeout:90000});
const status = () => page.$eval(selector('paint-status'), element => element.innerText.trim());

async function storedJob() {
  return page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record?.workbook) return null;
      const book = record.workbook.clientSelectionsBook || {};
      const paintRow = (book.rooms || []).flatMap(room => room.rows || []).find(row => row.guidedSelection?.paintScheme) || null;
      const sections = Object.entries(record.workbook.quotation || {});
      return {revision:book.metadata?.selectionRevision || '', paintRow, quotationRowCount:sections.reduce((count, [, section]) => count + (section.rows || []).length, 0),
        painter:sections.filter(([name]) => /paint/i.test(name)).flatMap(([name, section]) => (section.rows || []).map(row => ({section:name, id:row.id, item:row.item, unit:row.unit, qty:row.qty ?? null, quantity:row.quantity ?? null,
          excelRate:row.excelRate ?? null, manualRate:row.manualRate ?? null, selectionSpec:row.selectionSpec || '', spec:row.paintColourSpecification || null})))};
    } finally { db.close(); }
  }, `job:${projectId}`);
}
async function storedWhen(predicate) {
  let record;
  for (let attempt = 0; attempt < 200; attempt++) { await delay(300); record = await storedJob(); if (record && predicate(record)) return record; }
  return record;
}
const rowNumbers = rows => rows.map(row => [row.section, row.id, row.item, row.unit, row.qty, row.quantity, row.excelRate, row.manualRate]);

try {
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); }
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  const original = await storedWhen(record => record.painter.length > 0);
  assert(original?.painter.length, 'the job has painting lines in the Quotation Builder');

  // 1 - open Internal Paint Colours: a real page, no placeholder
  await openPaintColours();
  const landing = await page.$eval(PAGE, element => ({text:element.innerText, width:element.offsetWidth,
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  assert(!/will be added here next|coming next/i.test(landing.text), 'no placeholder message');
  for (const heading of ['Internal Paint Colours', 'House colour scheme', 'Main Wall Colour', 'Trims & Internal Doors', 'Ceilings', 'Feature walls', 'Room overrides']) assert(landing.text.toLowerCase().includes(heading.toLowerCase()), heading);
  assert(landing.width > 900, 'the page uses the workspace width');
  assert.deepEqual(landing.smallText, [], 'no text under 16px');
  // A fresh project: ceilings are already the standard Dulux Ceiling White, and that counts.
  const standardCeiling = await surface('ceilings');
  assert(/Dulux Ceiling White/.test(standardCeiling.text) && /Finish: Flat/.test(standardCeiling.text) && !/Not selected/.test(standardCeiling.text), standardCeiling.text);
  assert.equal(standardCeiling.standard, 'standard'); assert.equal(standardCeiling.id, 'dulux-ceiling-white'); assert(/ Standard /.test(`${standardCeiling.text} `), 'tagged Standard');
  assert.equal(standardCeiling.placeholder, false, 'a real swatch, not the striped placeholder'); assert.equal(standardCeiling.swatch, 'rgb(255, 255, 255)');
  assert.equal(standardCeiling.hasReset, false, 'nothing to reset while it is the standard');
  assert.equal(await status(), '1 of 3 colours chosen');
  assert(await page.$eval(selector('paint-confirm'), button => button.disabled), 'cannot confirm before colours are chosen');
  await screenshot('01-landing');
  report.steps.open = {status:'1 of 3 colours chosen', ceilings:standardCeiling.text};

  // 2-5 - Main Walls: search Natural White, select the Dulux colour, swatch appears
  await click(selector('paint-choose-walls'));
  await page.waitForSelector(SELECTOR);
  const selectorView = await page.$eval(SELECTOR, element => ({groups:[...element.querySelectorAll('.ipc-groups button')].map(button => button.innerText.replace(/\s+/g, ' ').trim()),
    cards:element.querySelectorAll('[data-testid="dulux-colour-card"]').length, disclaimer:element.querySelector('[data-testid="dulux-colour-disclaimer"]').innerText,
    images:element.querySelectorAll('img').length}));
  assert(selectorView.groups.length >= 9 && selectorView.groups.some(label => /^Whites/.test(label)) && selectorView.groups.some(label => /^Greys/.test(label)) && selectorView.groups.some(label => /^Dark \/ Charcoal/.test(label)), `colour families: ${selectorView.groups.join(', ')}`);
  assert(selectorView.cards > 0, 'colours are shown before searching');
  assert.equal(selectorView.images, 0, 'colour cards are swatches, not product images');
  assert.equal(selectorView.disclaimer, 'Colours shown on screen are indicative only. Confirm final colours using an approved physical colour sample before ordering or application.');
  await click(selector('dulux-colour-group-blues'));
  const blues = await page.$$eval(selector('dulux-colour-card'), cards => cards.length);
  assert(blues > 0, 'browse by colour family');
  await click(selector('dulux-colour-group-popular'));
  await delay(300);
  await screenshot('02-colour-selector');
  await page.keyboard.press('Escape');
  await page.waitForFunction(sel => !document.querySelector(sel), {}, SELECTOR);
  const walls = await chooseColour(selector('paint-choose-walls'), 'Natural White', 'Natural White™');
  assert.equal(walls.code, 'SW1F4'); assert(/Dulux/.test(walls.text) && /Colour code SW1F4/.test(walls.text));
  assert(walls.swatchHeight / walls.cardHeight > 0.4, 'the colour occupies most of the card');
  await saved();
  const wallCard = await surface('walls');
  assert.equal(wallCard.code, 'SW1F4'); assert.equal(wallCard.swatch, walls.swatch, 'the selected colour is shown on the main page');
  assert(/Dulux Natural White/.test(wallCard.text) && /Colour code: SW1F4/.test(wallCard.text) && /Finish: Low Sheen/.test(wallCard.text), wallCard.text);
  assert(wallCard.swatchHeight >= 140, 'large swatch');
  assert.equal(await status(), '2 of 3 colours chosen');
  report.steps.mainWalls = {selected:walls, card:wallCard.text};

  // 6-8 - Trims / internal doors and ceilings
  const trims = await chooseColour(selector('paint-choose-trims'), 'Vivid White', 'Vivid White™');
  await saved();
  assert.equal(trims.code, 'SW1G1');
  assert.equal(await status(), 'Ready to confirm', 'with the standard ceiling, walls and trims are all the client has to choose');
  const storedStandard = await storedWhen(record => record.paintRow?.guidedSelection?.paintScheme?.defaults?.trims?.colourCode === 'SW1G1');
  assert.equal(storedStandard.paintRow.guidedSelection.paintScheme.defaults.ceilings.colourName, 'Ceiling White', 'the standard ceiling is saved with the scheme');
  assert.equal(storedStandard.paintRow.guidedSelection.paintScheme.defaults.ceilings.standard, true);
  // Change the ceiling: client override, with a way back.
  const ceilings = await chooseColour(selector('paint-choose-ceilings'), 'sw1e1', 'Lexicon® Quarter');
  assert.equal(ceilings.code, 'SW1E1', 'search by Dulux colour code');
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.standard === 'override', {}, selector('paint-surface-ceilings'));
  const overriddenCeiling = await surface('ceilings');
  assert(/Dulux Lexicon® Quarter/.test(overriddenCeiling.text) && /Finish: Flat/.test(overriddenCeiling.text) && /Client override/.test(overriddenCeiling.text) && overriddenCeiling.hasReset, overriddenCeiling.text);
  // Reset to standard.
  await click(selector('paint-ceiling-reset'));
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.standard === 'standard', {}, selector('paint-surface-ceilings'));
  const resetCeiling = await surface('ceilings');
  assert(/Dulux Ceiling White/.test(resetCeiling.text) && !resetCeiling.hasReset && resetCeiling.id === 'dulux-ceiling-white', resetCeiling.text);
  assert.equal((await surface('walls')).code, 'SW1F4', 'reset changes the ceiling only');
  const storedReset = await storedWhen(record => record.paintRow?.guidedSelection?.paintScheme?.defaults?.ceilings?.colourName === 'Ceiling White' && record.paintRow.guidedSelection.paintScheme.updatedAt > storedStandard.paintRow.guidedSelection.paintScheme.updatedAt);
  assert.equal(storedReset.paintRow.guidedSelection.paintScheme.defaults.ceilings.standard, true, 'the reset is what is stored');
  assert.equal(Number(storedReset.paintRow.upgradeCost || 0), 0, 'changing a ceiling colour is not a variation');
  report.steps.ceilingOverride = {override:overriddenCeiling.text, reset:resetCeiling.text};
  // The rest of the workflow runs with a client-chosen ceiling.
  await chooseColour(selector('paint-choose-ceilings'), 'Lexicon Quarter', 'Lexicon® Quarter');
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.standard === 'override', {}, selector('paint-surface-ceilings'));
  await saved();
  assert.equal(await status(), 'Ready to confirm');
  report.steps.trimsAndCeilings = {trims, ceilings};

  // 9 - confirm: complete with no feature walls and no overrides
  await click(selector('paint-confirm'));
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.complete === 'true', {}, PAGE);
  await saved();
  assert.equal(await status(), '✓ Complete');
  const confirmed = await storedWhen(record => record.paintRow?.guidedSelection?.paintScheme?.confirmed === true);
  assert.equal(confirmed.paintRow.guidedSelection.paintScheme.featureWalls.length, 0);
  assert.equal(confirmed.paintRow.status, 'selected'); assert.equal(Number(confirmed.paintRow.upgradeCost || 0), 0, 'a colour is not a variation');
  await screenshot('03-scheme-confirmed');
  report.steps.confirmed = {status:'Complete', variation:confirmed.paintRow.upgradeCost};

  // 10-12 - feature wall in the Master Bedroom; the house default does not move
  await click(selector('paint-add-feature-wall'));
  await page.waitForSelector(selector('paint-feature-modal'));
  const roomOptions = await page.$$eval(`${selector('paint-feature-room')} option`, options => options.map(option => option.value));
  for (const room of ROOMS) assert(roomOptions.includes(room), `project room offered: ${room}`);
  assert.deepEqual(roomOptions.filter(room => /^(external|external walls|roof|windows|electrical|lighting|paint|alfresco|bed 4|media \/ theatre)$/i.test(room)), [], `only internal rooms, by their display names: ${roomOptions.join(', ')}`);
  report.steps.rooms = roomOptions;
  await page.select(selector('paint-feature-room'), 'Master Bedroom');
  await page.type(selector('paint-feature-wall-name'), 'Bedhead Wall');
  const feature = await chooseColour(selector('paint-feature-choose'), 'Domino', 'Domino');
  await click(selector('paint-feature-save'));
  await page.waitForFunction(sel => !document.querySelector(sel), {}, selector('paint-feature-modal'));
  await saved();
  const featureRow = await page.$eval(selector('paint-feature-wall'), element => element.innerText.replace(/\s+/g, ' '));
  assert(/Master Bedroom - Bedhead Wall/.test(featureRow) && /Dulux Domino \(SG6G8\)/.test(featureRow), featureRow);
  assert.equal((await surface('walls')).code, 'SW1F4', 'house wall colour unchanged by the feature wall');
  assert.equal(await status(), '✓ Complete');
  report.steps.featureWall = {feature, row:featureRow};

  // 13 - override the Media Room wall colour only
  await click(selector('paint-manage-overrides'));
  await page.waitForSelector(selector('paint-overrides-modal'));
  const roomList = await page.$$eval(selector('paint-room'), rows => rows.map(row => ({room:row.dataset.location, text:row.innerText.replace(/\s+/g, ' ')})));
  assert.deepEqual(roomList.map(row => row.room), roomOptions, 'the same project rooms'); assert(roomList.every(row => /Using house default/.test(row.text)));
  await click(`${selector('paint-room')}[data-location="Media Room"] ${selector('paint-room-override')}`);
  const override = await chooseColour(`${selector('paint-room')}[data-location="Media Room"] ${selector('paint-room-choose-walls')}`, 'Tranquil Retreat', 'Tranquil Retreat');
  await saved();
  const roomsAfter = await page.$$eval(selector('paint-room'), rows => rows.map(row => ({room:row.dataset.location, overridden:row.dataset.overridden, text:row.innerText.replace(/\s+/g, ' ')})));
  assert.deepEqual(roomsAfter.filter(row => row.overridden === 'true').map(row => row.room), ['Media Room'], 'only the Media Room changes');
  const mediaRoom = roomsAfter.find(row => row.room === 'Media Room').text;
  assert(/Walls Dulux Tranquil Retreat/.test(mediaRoom) && /Trims & doors House default: Dulux Vivid White/.test(mediaRoom) && /Ceilings House default: Dulux Lexicon/.test(mediaRoom), mediaRoom);
  await screenshot('04-room-override');
  await page.keyboard.press('Escape');
  await page.waitForFunction(sel => !document.querySelector(sel), {}, selector('paint-overrides-modal'));
  assert.equal((await surface('walls')).code, 'SW1F4'); assert.equal(await status(), '✓ Complete');
  await (await page.$(PAGE)).screenshot({path:path.join(out, '05-complete-scheme.png')}); report.screenshots.push('05-complete-scheme.png');
  report.steps.override = {override, mediaRoom};

  // 16 - Quotation Builder: painting lines keep their quantities and rates and carry the colours
  const stored = await storedWhen(record => (record.paintRow?.guidedSelection?.paintScheme?.overrides || []).length === 1 && record.painter.some(row => row.spec?.roomOverrides?.length));
  assert.equal(stored.quotationRowCount, original.quotationRowCount, 'no quotation row was added');
  assert.deepEqual(rowNumbers(stored.painter), rowNumbers(original.painter), 'painting quantities and rates are unchanged');
  const interior = stored.painter.filter(row => row.spec);
  assert(interior.length > 0 && interior.every(row => /interior/i.test(row.item)), `colours are attached to the interior painting lines: ${interior.map(row => row.item).join(', ')}`);
  assert.equal(interior[0].selectionSpec, 'Walls: Dulux Natural White™ (SW1F4) - Low Sheen; Trims & doors: Dulux Vivid White™ (SW1G1) - Semi Gloss; Ceilings: Dulux Lexicon® Quarter (SW1E1) - Flat');
  assert.deepEqual(interior[0].spec.roomOverrides, [{location:'Media Room', surface:'walls', text:'Dulux Tranquil Retreat (SN4G1)'}]);
  assert.deepEqual(interior[0].spec.featureWalls, [{location:'Master Bedroom', wall:'Bedhead Wall', text:'Dulux Domino (SG6G8)'}]);
  assert(stored.painter.filter(row => /exterior|eaves|patio|deck/i.test(row.item)).every(row => !row.spec && !row.selectionSpec), 'external painting lines carry no internal colours');
  report.steps.quotation = {linkedRows:interior.map(row => `${row.item}: ${row.selectionSpec}`), rowsAdded:stored.quotationRowCount - original.quotationRowCount};

  // 14 - reload the browser: everything persists
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector(`${GUIDED_SCREENS}, ${selector('open-local-job-file-input')}`);
  await delay(4000);
  if (!await page.$(GUIDED_SCREENS)) await loadLocalJob(fixture);
  await openPaintColours();
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.complete === 'true', {}, PAGE);
  assert.equal((await surface('walls')).code, 'SW1F4'); assert.equal((await surface('trims')).code, 'SW1G1'); assert.equal((await surface('ceilings')).code, 'SW1E1');
  assert.equal((await surface('ceilings')).standard, 'override', 'the client override persists as an override');
  assert(/Master Bedroom - Bedhead Wall/.test(await page.$eval(selector('paint-feature-wall'), element => element.innerText)));
  assert(/Media Room/.test(await page.$eval(selector('paint-override-summary'), element => element.innerText)) );
  assert.equal(await status(), '✓ Complete');
  await screenshot('06-after-reload');
  report.steps.reload = {persisted:true};

  // 15 - Review Schedule
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Review Schedule')?.click());
  await page.waitForFunction(() => /Internal Paint Colours/i.test(document.body.innerText) && /Bedhead Wall/.test(document.body.innerText), {timeout:60000});
  const schedule = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  for (const expected of ['Main Walls', 'Dulux Natural White', 'Trims & Internal Doors', 'Dulux Vivid White', 'Ceilings', 'Dulux Lexicon', 'Media Room - Walls', 'Dulux Tranquil Retreat', 'Feature wall - Master Bedroom - Bedhead Wall', 'Dulux Domino', 'Low Sheen', 'Flat']) assert(schedule.includes(expected), `Review Schedule shows ${expected}`);
  await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, strong, span')].find(node => node.children.length === 0 && /^internal paint colours$/i.test(node.innerText.trim()))?.scrollIntoView({block:'start'}));
  await delay(600);
  await screenshot('07-review-schedule');
  report.steps.schedule = {shown:true};

  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  if (page) await screenshot('failed').catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
