import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {readyCabinetrySelection} from './cabinetry-room-fixture.mjs';

// Client Selections > Electrical in the running app: the room-by-room quantity schedule over the
// project's own rooms, Save / Next Room, the Quotation Builder rows it writes (stable ids), reload,
// and Lighting & Ceiling Fans as the separate product module. Uses an isolated local job; cloud
// writes are blocked and existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-electrical-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/electrical-schedule-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-electrical-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local electrical schedule regression';
// Rooms as AI Plan Takeoff records them: on the placed windows and doors, in its own shorthand.
// There is no Living room on these plans. As on the real job, the takeoff calls the butler's pantry
// "Pantry" while the cabinetry locations call it "Butler's Pantry".
const TAKEOFF_ROOMS = [['kitchen', 'Kitchen'], ['laundry', 'Laundry'], ['pantry', 'Pantry'], ['bed-1', 'Bed 1'], ['bed-4', 'Bed 4'], ['media-theatre', 'Media / Theatre'], ['other', 'Study'], ['family', 'Family'], ['alfresco', 'Alfresco']];
const NOT_ROOMS = /^(external walls|roof|windows|electrical|lighting|flooring|paint|external|bed 4|media \/ theatre|living|main bathroom|bedroom 2|bedroom 3)$/i;
const RATE_SECTION = 'ELECTRICAL (84)';
const quotation = {...defaults.quotation};
if (!(quotation[RATE_SECTION]?.rows || []).some(row => row.item === 'DOUBLE POWER POINT')) {
  quotation[RATE_SECTION] = {rows:[{id:'quote-1208', item:'SINGLE POWER POINT', unit:'ITEM', excelRate:'$45.00', manualRate:'', quantity:''}, {id:'quote-1209', item:'DOUBLE POWER POINT', unit:'ITEM', excelRate:'$50.00', manualRate:'', quantity:''}]};
}
const book = {documentType:'luxury_selections_book', rooms:[{id:'room-kitchen', name:'Kitchen', rows:[{id:'row-cabinetry', item:'Cabinetry', guidedRequirementKey:'cabinetry', selectedProduct:'Cabinetry specification',
  guidedSelection:{requirementKey:'cabinetry', requirementLabel:'Cabinetry', cabinetrySelection:readyCabinetrySelection(["Butler's Pantry"])}}]}]};
const workbook = {...defaults, clientSelectionsBook:book, selectionsBook:book, quotation, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-ELEC', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-ELEC', clientName:'Local test client', address:'Local test address'},
  aiPlanTakeoffJob:{placedOpenings:TAKEOFF_ROOMS.map(([roomKey, roomLabel], index) => ({id:`opening-${index}`, openingType:'window', roomKey, roomLabel, location:roomLabel}))}};
const fixture = path.join(out, 'local-electrical-job.json');
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
const OVERVIEW = selector('electrical-schedule');
const EDITOR = selector('electrical-room-editor');
const HOME = selector('guided-client-selections-home');
const INTERIOR = selector('guided-interior-categories');
const GUIDED_SCREENS = [HOME, INTERIOR, selector('guided-exterior-categories'), OVERVIEW, EDITOR].join(', ');
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

async function openInterior() {
  for (let guard = 0; guard < 8 && !await page.$(INTERIOR); guard++) {
    if (await page.$(HOME)) await click(`${HOME} [data-category-key="interior"]`);
    else if (await page.$(EDITOR)) await click(selector('electrical-all-rooms'));
    else if (await page.$(OVERVIEW)) await click(selector('electrical-back'));
    else if (await page.$(selector('guided-plumbing-fixture-products'))) await page.$eval('.plumbingProductsHeader > button', button => button.click());
    else if (await page.$('.categoryHubBack')) await click('.categoryHubBack');
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
    await delay(800);
  }
  await page.waitForSelector(INTERIOR);
}
async function openElectrical() {
  if (await page.$(EDITOR)) await click(selector('electrical-all-rooms'));
  if (!await page.$(OVERVIEW)) { await openInterior(); await click(`${INTERIOR} [data-category-key="electrical-technology"]`); }
  await page.waitForSelector(OVERVIEW);
}
const roomCards = () => page.$$eval(selector('electrical-room'), cards => cards.map(card => ({room:card.dataset.room, state:card.dataset.state, text:card.innerText.replace(/\s+/g, ' ')})));
const progress = () => page.$eval(selector('electrical-progress'), element => element.innerText.trim());
const saved = () => page.waitForFunction(() => document.querySelector('[data-testid="electrical-save-state"]')?.classList.contains('saved'), {timeout:90000});
const editorRoom = () => page.$eval(selector('electrical-room-name'), element => element.innerText.trim());
async function editRoom(room) {
  await openElectrical();
  await click(`${selector('electrical-room')}[data-room="${room}"] ${selector('electrical-room-edit')}`);
  await page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, room);
}
const quantity = key => page.$eval(selector(`electrical-qty-${key}`), input => Number(input.value));
async function setQuantity(key, target) {
  for (let guard = 0; guard < 120 && await quantity(key) !== target; guard++) await click(selector(`electrical-qty-${key}-${await quantity(key) < target ? 'plus' : 'minus'}`));
  assert.equal(await quantity(key), target);
}

async function storedJob() {
  return page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record?.workbook) return null;
      const book = record.workbook.clientSelectionsBook || {};
      const row = (book.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.electricalSchedule) || null;
      const sections = Object.entries(record.workbook.quotation || {});
      const pick = item => ({id:item.id, item:item.item, location:item.location || '', quantity:item.quantity ?? null, qty:item.qty ?? null, excelRate:item.excelRate ?? null, manualRate:item.manualRate ?? null, rateSourceRowId:item.rateSourceRowId || '', source:item.source || ''});
      return {schedule:row?.guidedSelection?.electricalSchedule || null, rowMoney:row ? [row.allowanceAmount, row.selectedCost, row.upgradeCost] : null,
        scheduleRows:sections.flatMap(([, section]) => (section.rows || []).filter(item => item.source === 'client-selections-electrical-schedule')).map(pick),
        scheduleSections:sections.filter(([, section]) => (section.rows || []).some(item => item.source === 'client-selections-electrical-schedule')).map(([name]) => name),
        rateRows:sections.filter(([name]) => /^ELECTRICAL \(/.test(name)).flatMap(([, section]) => (section.rows || []).map(pick)),
        procurementItems:(record.workbook.procurement?.items || []).length};
    } finally { db.close(); }
  }, `job:${projectId}`);
}
async function storedWhen(predicate) {
  let record;
  for (let attempt = 0; attempt < 200; attempt++) { await delay(300); record = await storedJob(); if (record && predicate(record)) return record; }
  return record;
}
// The Double Powerpoint quotation line for a room (its id is built from the stable room id).
const scheduleRow = (record, room) => record?.scheduleRows.find(row => row.location === room && /^Double Powerpoint/.test(row.item)) || null;
const MANAGER = selector('project-room-manager');
const managerRoom = room => `${selector('room-manager-room')}[data-room="${room}"]`;
const managerRooms = () => page.$$eval(selector('room-manager-room'), rows => rows.map(row => ({room:row.dataset.room, source:row.dataset.source, id:row.dataset.roomId})));
async function openManager() { await openElectrical(); if (!await page.$(MANAGER)) await click(selector('electrical-manage-rooms')); await page.waitForSelector(MANAGER); }
// The same manager, opened from the main Client Selections (Interior) page.
async function openMainManager() { await openInterior(); await click(selector('manage-project-rooms')); await page.waitForSelector(MANAGER); }
const managerSaved = text => page.waitForFunction(expected => { const node = document.querySelector('[data-testid="room-manager-message"]'); return node?.classList.contains('saved') && node.innerText.includes(expected); }, {timeout:90000}, text);
async function closeManager() { await click(selector('room-manager-close')); await page.waitForFunction(sel => !document.querySelector(sel), {}, MANAGER); }

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
  const original = await storedWhen(record => record.rateRows.length > 0);
  assert(original?.rateRows.some(row => row.item === 'DOUBLE POWER POINT'), 'the job has a Double Power Point rate in the Quotation Builder');
  const doubleRate = original.rateRows.find(row => row.item === 'DOUBLE POWER POINT');

  // 1 - Manage Rooms is on the main Client Selections screens; the Interior card: "Electrical", a room count, no product range
  if (await page.$(HOME)) assert(await page.$(`${HOME} ${selector('manage-project-rooms')}`), 'Manage rooms is on the Client Selections home screen');
  await openInterior();
  const roomsBar = await page.$eval(`${INTERIOR} ${selector('project-rooms-bar')}`, element => ({text:element.innerText.replace(/\s+/g, ' '), index:[...element.parentElement.children].indexOf(element), fontSize:parseFloat(getComputedStyle(element.querySelector('button')).fontSize)}));
  assert(/Project rooms 10 rooms: Kitchen/.test(roomsBar.text) && /Manage rooms/i.test(roomsBar.text) && roomsBar.index <= 1 && roomsBar.fontSize >= 16, `Manage rooms sits at the top of Interior: ${JSON.stringify(roomsBar)}`);
  report.steps.mainManageRooms = roomsBar.text;
  const card = await page.$eval(`${INTERIOR} [data-category-key="electrical-technology"]`, element => element.innerText.replace(/\s+/g, ' '));
  assert(/Electrical/.test(card) && !/Technology/.test(card) && /0 of \d+ rooms complete/i.test(card) && !/Range not yet imported|Product Library/i.test(card), card);
  const lightingCard = await page.$eval(`${INTERIOR} [data-category-key="lighting-fans"]`, element => element.innerText.replace(/\s+/g, ' '));
  assert(/Lighting & Ceiling Fans/.test(lightingCard), lightingCard);
  await screenshot('01-interior-cards');

  // 2 - the room list: the project's own rooms, no product cards
  await openElectrical();
  const landing = await page.$eval(OVERVIEW, element => ({text:element.innerText, images:element.querySelectorAll('img').length, productCards:element.querySelectorAll('article').length,
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  const rooms = (await roomCards()).map(item => item.room);
  report.steps.rooms = rooms;
  for (const room of ['Kitchen', 'Laundry', "Butler's Pantry", 'Pantry', 'Bedroom 1', 'Bedroom 4', 'Media Room', 'Study', 'Family', 'Alfresco']) assert(rooms.includes(room), `project room listed: ${room}`);
  assert.equal(rooms.length, 10, `only rooms the project has - no Selections Book template rooms: ${rooms.join(', ')}`);
  assert.deepEqual(rooms.filter(room => NOT_ROOMS.test(room)), [], `only real rooms, by their display names: ${rooms.join(', ')}`);
  assert.equal(new Set(rooms).size, rooms.length, 'no room twice');
  assert.equal(await progress(), `0 of ${rooms.length} rooms complete`);
  assert(!/Power Outlets|Switches & Dimmers|Smart Home|Security \/ Intercom|No verified products|Product Library|Clipsal|\$/i.test(landing.text), 'no product categories, catalogue messages or prices');
  assert.equal(landing.images + landing.productCards, 0, 'no product cards or product images');
  assert.deepEqual(landing.smallText, [], 'no text under 16px');
  assert(!/downlight|smoke alarm|external light/i.test(landing.text), 'light fittings and alarms are not listed under Electrical');
  await screenshot('02-room-list');

  // 3 - Kitchen: Double Powerpoints = 6, Save / Next Room moves to the next room
  await editRoom('Kitchen');
  const editor = await page.$eval(EDITOR, element => ({text:element.innerText, points:[...element.querySelectorAll('[data-testid^="electrical-point-"]')].map(node => node.dataset.testid.replace('electrical-point-', '')),
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  for (const key of ['double-gpo', 'single-gpo', 'tv', 'data', 'fridge', 'dishwasher', 'microwave', 'rangehood', 'oven', 'cooktop']) assert(editor.points.includes(key), `Kitchen offers ${key}`);
  assert(!/\$|brand|finish|range/i.test(editor.text.replace(/rangehood/gi, '')), 'quantities only: no brand, finish, range or price');
  assert.deepEqual(editor.smallText, [], 'no text under 16px in the room editor');
  await setQuantity('double-gpo', 6);
  await page.type(selector('electrical-notes'), 'Two above the island bench');
  await screenshot('03-kitchen');
  const afterKitchen = rooms[rooms.indexOf('Kitchen') + 1];
  await click(selector('electrical-save-next'));
  await page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, afterKitchen);
  await saved();
  let stored = await storedWhen(record => scheduleRow(record, 'Kitchen')?.quantity === 6);
  const kitchenRow = scheduleRow(stored, 'Kitchen');
  assert.deepEqual([kitchenRow.item, kitchenRow.location, kitchenRow.quantity, kitchenRow.rateSourceRowId, kitchenRow.excelRate], ['Double Powerpoint - Kitchen', 'Kitchen', 6, doubleRate.id, doubleRate.manualRate || doubleRate.excelRate]);
  assert.deepEqual(stored.scheduleSections, ['ELECTRICAL - CLIENT SELECTIONS']);
  assert.deepEqual(stored.rowMoney.map(value => Number(value || 0)), [0, 0, 0], 'Client Selections holds no price for the schedule');
  report.steps.kitchen = {quoteRow:kitchenRow, nextRoom:afterKitchen};

  // 4 - Bedroom 1 = 4, then 5: the same quotation line
  await editRoom('Bedroom 1');
  await setQuantity('double-gpo', 4);
  await click(selector('electrical-save-next'));
  await saved();
  stored = await storedWhen(record => scheduleRow(record, 'Bedroom 1')?.quantity === 4);
  assert.equal(scheduleRow(stored, 'Bedroom 1')?.quantity, 4);
  const bedroomRowId = scheduleRow(stored, 'Bedroom 1').id;
  await editRoom('Bedroom 1');
  assert.equal(await quantity('double-gpo'), 4);
  await setQuantity('double-gpo', 5);
  await click(selector('electrical-save-next'));
  await saved();
  stored = await storedWhen(record => scheduleRow(record, 'Bedroom 1')?.quantity === 5);
  const bedroomRows = stored.scheduleRows.filter(row => row.location === 'Bedroom 1');
  assert.deepEqual(bedroomRows.map(row => [row.id, row.quantity]), [[bedroomRowId, 5]], 'the existing quote line is updated, not duplicated');
  assert.equal(stored.scheduleRows.length, 2);
  assert.deepEqual(stored.rateRows, original.rateRows, "the estimate's own electrical rows are unchanged");
  assert.equal(stored.procurementItems, original.procurementItems, 'no procurement products are created');
  report.steps.bedroom1 = {quoteRows:bedroomRows};

  // 5 - a room that needs nothing still completes
  await editRoom('Study');
  assert(/No additional electrical changes/.test(await page.$eval(selector('electrical-use-standard'), button => button.innerText)));
  await click(selector('electrical-use-standard'));
  await saved();
  await openElectrical();
  const cards = await roomCards();
  const cardFor = room => cards.find(item => item.room === room);
  assert.equal(cardFor('Kitchen').state, 'complete'); assert(/6 powerpoints/.test(cardFor('Kitchen').text) && /Two above the island bench/.test(cardFor('Kitchen').text), cardFor('Kitchen').text);
  assert.equal(cardFor('Bedroom 1').state, 'complete'); assert(/5 powerpoints/.test(cardFor('Bedroom 1').text));
  assert.equal(cardFor('Study').state, 'complete'); assert(/No additional electrical changes/.test(cardFor('Study').text));
  assert.equal(cardFor('Media Room').state, 'not_started');
  assert.equal(await progress(), `3 of ${rooms.length} rooms complete`);
  await screenshot('04-rooms-in-progress');
  report.steps.completion = {progress:await progress()};

  // 6 - MANAGE ROOMS: the project's one room list, corrected from the Electrical screen
  await openManager();
  const managed = await managerRooms();
  assert.deepEqual(managed.map(item => item.room), rooms, 'Manage Rooms shows the same project rooms');
  assert.equal(managed.find(item => item.room === 'Pantry').source, 'takeoff');
  const managerText = await page.$eval(MANAGER, element => ({text:element.innerText,
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  assert(/Source: AI Takeoff/.test(managerText.text)); assert.deepEqual(managerText.smallText, [], 'no text under 16px in Manage Rooms');
  await screenshot('05-manage-rooms');
  // ADD: a room the takeoff missed
  await click(selector('room-add'));
  await page.type(selector('room-add-name'), 'Rumpus');
  await page.type(selector('room-add-level'), 'Ground Floor');
  await page.select(selector('room-add-type'), 'rumpus');
  await click(selector('room-add-save'));
  await managerSaved('Rumpus added');
  assert.equal((await managerRooms()).find(item => item.room === 'Rumpus').source, 'manual');
  // RENAME: Bedroom 1 -> Master Bedroom keeps its id, its quantities and its quotation line
  const bedroomId = managed.find(item => item.room === 'Bedroom 1').id;
  await click(`${managerRoom('Bedroom 1')} ${selector('room-rename')}`);
  await page.$eval(selector('room-rename-input'), input => input.select());
  await page.type(selector('room-rename-input'), 'Master Bedroom');
  await click(selector('room-rename-save'));
  await managerSaved('renamed to Master Bedroom');
  assert.equal((await managerRooms()).find(item => item.room === 'Master Bedroom').id, bedroomId, 'the room id survives the rename');
  stored = await storedWhen(record => scheduleRow(record, 'Master Bedroom')?.quantity === 5);
  assert.deepEqual([scheduleRow(stored, 'Master Bedroom')?.id, scheduleRow(stored, 'Bedroom 1')], [bedroomRowId, null], 'the same quotation line follows the renamed room');
  await closeManager();
  let afterRename = await roomCards();
  assert(/5 powerpoints/.test(afterRename.find(item => item.room === 'Master Bedroom').text) && afterRename.find(item => item.room === 'Master Bedroom').state === 'complete');
  assert(!afterRename.some(item => item.room === 'Bedroom 1') && afterRename.some(item => item.room === 'Rumpus'));
  assert.equal(await progress(), `3 of ${rooms.length + 1} rooms complete`);
  // Points entered against the takeoff's "Pantry" before it is corrected
  await editRoom('Pantry');
  await setQuantity('double-gpo', 2);
  await click(selector('electrical-save-next'));
  await saved();
  stored = await storedWhen(record => scheduleRow(record, 'Pantry')?.quantity === 2);
  // REMOVE with data attached: a warning, and Cancel leaves everything. Opened from the MAIN page this time:
  // it is the same manager on the same project room list.
  await openMainManager();
  assert.deepEqual((await managerRooms()).map(item => item.room), (await managerRooms()).map(item => item.room).filter((room, index, list) => list.indexOf(room) === index));
  assert((await managerRooms()).some(item => item.room === 'Master Bedroom') && (await managerRooms()).some(item => item.room === 'Rumpus'), 'the changes made from Electrical are here too');
  await click(`${managerRoom('Pantry')} ${selector('room-remove')}`);
  const warning = await page.$eval(selector('room-remove-confirm'), element => ({hasData:element.dataset.hasData, text:element.innerText.replace(/\s+/g, ' ')}));
  assert.equal(warning.hasData, 'true'); assert(/Pantry has project data attached/.test(warning.text) && /Electrical/.test(warning.text) && /Takeoff/.test(warning.text), warning.text);
  await screenshot('06-remove-warning');
  await click(selector('room-remove-cancel'));
  assert((await managerRooms()).some(item => item.room === 'Pantry'));
  // MERGE: Pantry is the Butler's Pantry. The manager offers it ready-made; the user decides.
  const suggestion = await page.$eval(`${managerRoom('Pantry')} ${selector('room-merge-suggestion')}`, element => element.innerText.replace(/\s+/g, ' '));
  assert(/Looks like the same room as Butler's Pantry\. Merge into Butler's Pantry/.test(suggestion), suggestion);
  assert.equal(await page.$(`${managerRoom("Butler's Pantry")} ${selector('room-merge-suggestion')}`), null, 'the suggestion points one way: into the fuller name');
  const butlersId = (await managerRooms()).find(item => item.room === "Butler's Pantry").id;
  await click(`${managerRoom('Pantry')} ${selector('room-merge-suggested')}`);
  await page.waitForSelector(selector('room-merge-target'));
  assert.equal(await page.$eval(selector('room-merge-target'), select => select.value), butlersId, "Butler's Pantry is already chosen as the room to keep");
  assert(/Electrical, Takeoff/.test(await page.$eval(`${managerRoom('Pantry')} .prm-panel`, panel => panel.innerText)), 'what moves across is listed');
  await click(selector('room-merge-save'));
  await managerSaved("merged into Butler's Pantry");
  assert(!(await managerRooms()).some(item => item.room === 'Pantry'));
  stored = await storedWhen(record => scheduleRow(record, "Butler's Pantry")?.quantity === 2 && !scheduleRow(record, 'Pantry'));
  assert.equal(scheduleRow(stored, "Butler's Pantry")?.quantity, 2, 'the points move to the room that is kept');
  assert.equal(scheduleRow(stored, 'Pantry'), null);
  // REMOVE with nothing attached: a normal removal
  await click(`${managerRoom('Rumpus')} ${selector('room-remove')}`);
  assert.equal(await page.$eval(selector('room-remove-confirm'), element => element.dataset.hasData), 'false');
  await click(selector('room-remove-confirm-button'));
  await managerSaved('Rumpus removed');
  assert(/Rumpus/.test(await page.$eval(selector('room-manager-removed'), element => element.innerText)));
  await closeManager();
  assert(/Project rooms 9 rooms/.test(await page.$eval(selector('project-rooms-bar'), element => element.innerText.replace(/\s+/g, ' '))), 'the main page shows the corrected room count');
  await openElectrical();
  const corrected = (await roomCards()).map(item => item.room);
  assert.deepEqual(corrected, rooms.filter(room => room !== 'Pantry').map(room => (room === 'Bedroom 1' ? 'Master Bedroom' : room)), 'the corrected house');
  rooms.splice(0, rooms.length, ...corrected);
  assert.equal(await progress(), `4 of ${rooms.length} rooms complete`);
  await screenshot('07-corrected-rooms');
  report.steps.manageRooms = {rooms:corrected, removeWarning:warning.text};

  // 7 - reload: quantities, completion and the corrected room list persist
  stored = await storedWhen(record => record.schedule?.rooms.find(room => room.room === 'Study')?.status === 'standard' && !record.schedule.rooms.some(room => room.room === 'Pantry'));
  assert.equal(stored.schedule.rooms.find(room => room.room === 'Study').status, 'standard');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector(`${GUIDED_SCREENS}, ${selector('open-local-job-file-input')}`);
  await delay(4000);
  if (!await page.$(GUIDED_SCREENS)) await loadLocalJob(fixture);
  await openElectrical();
  await page.waitForFunction((sel, text) => document.querySelector(sel)?.innerText.trim() === text, {}, selector('electrical-progress'), `4 of ${rooms.length} rooms complete`);
  const reloaded = await roomCards();
  assert(/6 powerpoints/.test(reloaded.find(item => item.room === 'Kitchen').text)); assert(/5 powerpoints/.test(reloaded.find(item => item.room === 'Master Bedroom').text)); assert(/2 powerpoints/.test(reloaded.find(item => item.room === "Butler's Pantry").text));
  assert.deepEqual(reloaded.map(item => item.room), rooms, 'the same rooms after reload');
  await editRoom('Kitchen');
  assert.equal(await quantity('double-gpo'), 6);
  assert.equal(await page.$eval(selector('electrical-notes'), element => element.value), 'Two above the island bench');
  await screenshot('08-after-reload');
  report.steps.reload = {persisted:true};
  await openInterior();
  assert(new RegExp(`4 of ${rooms.length} rooms complete`, 'i').test(await page.$eval(`${INTERIOR} [data-category-key="electrical-technology"]`, element => element.innerText.replace(/\s+/g, ' '))));

  // 8 - Lighting & Ceiling Fans: a separate product module on the same corrected rooms
  await click(`${INTERIOR} [data-category-key="lighting-fans"]`);
  await page.waitForSelector(selector('guided-category-lighting-fans'));
  const lighting = await page.$eval(selector('guided-category-lighting-fans'), element => ({text:element.innerText, requirements:[...element.querySelectorAll('article[data-requirement-key]')].map(node => node.dataset.requirementKey)}));
  assert.deepEqual(lighting.requirements.sort(), ['ceiling-fan', 'interior-lighting']);
  assert(!/powerpoint|power point|data point|tv point|electrical schedule/i.test(lighting.text), 'no electrical point quantities in Lighting');
  await page.$eval(`${selector('guided-requirement-ceiling-fan')} button.primary`, button => button.click());
  await page.waitForSelector('article.plumbingProductCard');
  const fans = await page.$$eval('article.plumbingProductCard', items => items.length);
  assert(fans > 50, `ceiling fan products to choose from: ${fans}`);
  await page.$eval('article.plumbingProductCard .guidedProductActions button.primary', button => button.click());
  await page.waitForSelector(selector('plumbing-allocation-modal'));
  const fanRooms = await page.$$eval(`${selector('plumbing-allocation-modal')} .plumbingAllocationRow span`, spans => spans.map(span => span.childNodes[0]?.textContent.trim()).filter(Boolean));
  for (const room of rooms) assert(fanRooms.includes(room), `fan can be placed in ${room}`);
  assert.deepEqual(fanRooms.filter(room => /^(pantry|bedroom 1|rumpus)$/i.test(room)), [], 'the merged, renamed and removed names are gone from Lighting too');
  assert.deepEqual(fanRooms.filter(room => NOT_ROOMS.test(room)), [], `fans are placed in real rooms only: ${fanRooms.join(', ')}`);
  await screenshot('09-lighting-fan-rooms');
  report.steps.lighting = {requirements:lighting.requirements, fanProducts:fans, rooms:fanRooms};

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
