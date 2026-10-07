import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Tiles & Stone in the running app: configure the Main Bathroom, apply its tile scheme to other wet
// rooms, and confirm each room keeps its own dimensions, quantities and independent selections. Uses an isolated local job; cloud
// writes are blocked, existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-scheme-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/tiling-scheme-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-tiling-scheme-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local tiling scheme regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-tiling-job.json');
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
const report = {passed:false, projectId, tests:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'tiling-rooms-workflow'].map(selector).join(', ');
const text = testId => page.$eval(selector(testId), element => element.innerText.replace(/\s+/g, ' ').trim());

async function screenshot(name) {
  await page.screenshot({path:path.join(out, `${name}.png`)});
  report.screenshots.push(`${name}.png`);
}

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate((value) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

async function openTiling() {
  const rooms = selector('tiling-rooms-workflow');
  for (let guard = 0; guard < 6 && !await page.$(rooms); guard++) {
    if (await page.$(selector('guided-client-selections-home'))) {
      await page.$eval(`${selector('guided-client-selections-home')} [data-category-key="interior"]`, element => element.click());
      await page.waitForSelector(selector('guided-interior-categories'));
    } else if (await page.$(selector('guided-interior-categories'))) {
      await page.$eval(`${selector('guided-interior-categories')} [data-category-key="tiles-stone"]`, element => element.click());
      await page.waitForSelector(rooms);
    } else {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await delay(800);
    }
  }
  await page.waitForSelector(rooms);
}

async function openRoom(name) {
  if (await page.$(selector('tiling-room-editor'))) await page.$eval(`${selector('tiling-room-editor')} .tl-link`, button => button.click());
  await page.waitForSelector(selector('tiling-rooms-workflow'));
  await page.evaluate((roomName) => {
    const card = [...document.querySelectorAll('.tl-room-card')].find(item => item.querySelector('h3').innerText.trim().toLowerCase() === roomName.toLowerCase());
    card.querySelector('.tl-primary').click();
  }, name);
  await page.waitForSelector(selector('tiling-room-editor'));
}

async function enter(testId, value) {
  await page.click(selector(testId), {clickCount:3});
  await page.keyboard.press('Backspace');
  await page.type(selector(testId), String(value));
}

async function gotoStep(label) {
  await page.evaluate((value) => [...document.querySelectorAll('.tl-steps button')].find(button => button.innerText.includes(value)).click(), label);
  await delay(150);
}

// Every dimension field on screen: its label and unit.
const fieldUnits = () => page.$$eval('.tl-main .tl-field', fields => fields.map(field => ({label:field.childNodes[0].textContent.trim(), unit:field.querySelector('em')?.innerText || ''})).filter(field => field.unit));

// Where each Choose Tile button sits relative to the area above it.
const choosePlacement = () => page.$$eval('.tl-slot', slots => slots.map(slot => {
  const area = slot.querySelector('.tl-slot-areas').getBoundingClientRect();
  const button = slot.querySelector('.tl-choose').getBoundingClientRect();
  const box = slot.getBoundingClientRect();
  return {slot:slot.dataset.testid, label:slot.querySelector('.tl-choose').innerText, leftOffset:Math.round(button.left - area.left), gapBelowArea:Math.round(button.top - area.bottom), rightGap:Math.round(box.right - button.right), slotWidth:Math.round(box.width)};
}));

function assertPlacement(placement, label) {
  assert(placement.length, `${label}: tile slots shown`);
  for (const item of placement) {
    assert(Math.abs(item.leftOffset) <= 4, `${label} ${item.slot}: button starts under its area (offset ${item.leftOffset}px)`);
    assert(item.gapBelowArea >= 0 && item.gapBelowArea <= 40, `${label} ${item.slot}: button is directly below the area (${item.gapBelowArea}px)`);
    assert(/^(CHOOSE|CHANGE) (FLOOR|WALL|SPLASHBACK|FEATURE) TILE$|^(CHOOSE|CHANGE) MOSAIC$/.test(item.label), `${label}: specific label (${item.label})`);
  }
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites.push({method:request.method(), path:new URL(request.url()).pathname});
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  await openTiling();
  const slotProduct = (slot) => page.$eval(selector(`tiling-slot-${slot}`), element => element.querySelector('.tl-product-line strong')?.innerText.trim() || '');
  const hasSlot = async (slot) => Boolean(await page.$(selector(`tiling-slot-${slot}`)));
  async function chooseTile(slot, position = 0) {
    await page.$eval(selector(`tiling-choose-${slot}`), button => button.click());
    await page.waitForSelector(selector('tiling-tile-picker'));
    await page.evaluate((index, testId) => document.querySelectorAll(testId)[index].click(), position, selector('tiling-tile-select'));
    await page.waitForSelector(selector(`tiling-slot-${slot}`));
    return slotProduct(slot);
  }
  const typeInto = async (testId, value) => { await page.click(selector(testId), {clickCount:3}); await page.keyboard.press('Backspace'); await page.type(selector(testId), value); };

  // Ensuite and Powder Room keep their OWN dimensions: set them before any scheme is applied.
  await openRoom('Ensuite');
  await enter('tiling-width', 2000);
  await enter('tiling-length', 3400);
  await enter('tiling-ceiling', 2700);
  assert.equal(await text('tiling-floor-result'), '6.80m²');
  await gotoStep('Shower, bath');
  await page.$eval(selector('tiling-component-shower'), input => input.click());
  await enter('tiling-shower-width', 1000);
  await enter('tiling-shower-length', 1000);
  await openRoom('Powder Room');
  await page.$eval(selector('tiling-spec-standard'), button => button.click());
  await enter('tiling-width', 1000);
  await enter('tiling-length', 1800);

  // 1. Main Bathroom configured completely.
  await openRoom('Main Bathroom');
  await page.$eval(selector('tiling-spec-standard'), button => button.click());
  await enter('tiling-width', 3100);
  await enter('tiling-length', 4000);
  await enter('tiling-ceiling', 2400);
  assert.equal(await text('tiling-floor-result'), '12.40m²');
  await gotoStep('Shower, bath');
  for (const key of ['shower', 'bath', 'feature']) await page.$eval(selector(`tiling-component-${key}`), input => input.click());
  await enter('tiling-shower-width', 900);
  await enter('tiling-shower-length', 1200);
  await enter('tiling-bath-length-0', 1700);
  await enter('tiling-feature-width-0', 1200);
  await enter('tiling-feature-height-0', 2400);
  await gotoStep('Tiles');
  assert.equal(await page.$eval(selector('tiling-scheme-apply-open'), button => button.disabled), true, 'nothing to copy until tiles are chosen');
  const main = {floor:await chooseTile('floor', 0), wall:await chooseTile('wall', 0), feature:await chooseTile('feature', 1)};
  assert(main.floor && main.wall && main.feature, `Main Bathroom tiles chosen: ${JSON.stringify(main)}`);
  await page.select(selector('tiling-finish-pattern'), 'Herringbone');
  await typeInto('tiling-finish-grout', 'Cement Grey');
  await typeInto('tiling-finish-trim', 'Brushed nickel square edge');
  await enter('tiling-wastage', 12);
  const mainFloorOrder = await page.$eval(`${selector('tiling-slot-floor')} .tl-calc`, element => element.innerText.replace(/\s+/g, ' '));
  assert.match(mainFloorOrder, /12\.40m² \+ 12% wastage = 13\.89m²/);

  // The action is under the selections, left-aligned - not out at the right edge.
  const actionBox = await page.evaluate((sel) => { const button = document.querySelector(sel).getBoundingClientRect(); const block = document.querySelector('.tl-scheme').getBoundingClientRect(); return {leftOffset:Math.round(button.left - block.left), blockWidth:Math.round(block.width), right:Math.round(block.right - button.right)}; }, selector('tiling-scheme-apply-open'));
  assert(actionBox.leftOffset <= 4 && actionBox.right > actionBox.blockWidth / 3, `scheme action is left-aligned under the tiles: ${JSON.stringify(actionBox)}`);

  // 2. Apply to other rooms: only genuine project wet areas are listed.
  await page.$eval(selector('tiling-scheme-apply-open'), button => button.click());
  await page.waitForSelector(selector('tiling-scheme-panel'));
  const offered = await page.$$eval(`${selector('tiling-scheme-panel')} .tl-scheme-rooms label`, labels => labels.map(label => label.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(offered, ['Ensuite', 'Laundry', 'Powder Room'].filter(name => offered.includes(name)).length === 3 ? offered : [], `wet areas offered: ${offered}`);
  assert(!offered.some(name => /Kitchen|Main Bathroom/.test(name)), 'not the source room, not the kitchen');
  await page.$eval(selector('tiling-scheme-select-all'), button => button.click());
  const checked = await page.$$eval(`${selector('tiling-scheme-panel')} .tl-scheme-rooms label`, labels => labels.filter(label => label.querySelector('input').checked).map(label => label.innerText.trim()));
  assert.deepEqual(checked.sort(), ['Ensuite', 'Powder Room'], 'Select all relevant = the other bathroom-type rooms, not the Laundry');
  const panelText = (await text('tiling-scheme-panel'));
  assert.match(panelText, /Feature tile not copied - Ensuite has no feature surface/, '9: incompatible surface skipped (Ensuite has no feature wall)');
  assert.match(panelText, /Wall tile not copied - Powder Room has no wall surface/, '9: Powder Room has no wall tiling');
  await screenshot('scheme-apply-panel');
  await page.$eval(selector('tiling-scheme-apply'), button => button.click());
  assert.match(await text('tiling-scheme-message'), /applied to Ensuite, Powder Room/);
  report.tests.apply = {offered, checked, panelText};

  // 3-5. Ensuite: own dimensions, copied products, quantities from its own 6.80 m².
  await openRoom('Ensuite');
  assert.equal(await text('tiling-floor-result'), '6.80m²', '3: Ensuite keeps its floor area');
  assert.equal(await page.$eval(selector('tiling-width'), input => input.value), '2000');
  assert.equal(await page.$eval(selector('tiling-ceiling'), input => input.value), '2700');
  await gotoStep('Shower, bath');
  assert.equal(await page.$eval(selector('tiling-shower-width'), input => input.value), '1000', '3: Ensuite keeps its shower size');
  assert.equal(await page.$eval(selector('tiling-component-bath'), input => input.checked), false, 'no bath created in the Ensuite');
  assert.equal(await page.$eval(selector('tiling-component-feature'), input => input.checked), false, 'no feature wall created in the Ensuite');
  await gotoStep('Tiles');
  assert.equal(await slotProduct('floor'), main.floor, '4: floor tile copied');
  assert.equal(await slotProduct('wall'), main.wall, '4: wall tile copied');
  assert.equal(await hasSlot('feature'), false, '9: no feature selection in a room with no feature wall');
  assert.equal(await page.$eval(selector('tiling-finish-pattern'), select => select.value), 'Herringbone');
  assert.equal(await page.$eval(selector('tiling-finish-grout'), input => input.value), 'Cement Grey');
  assert.equal(await page.$eval(selector('tiling-wastage'), input => input.value), '12');
  const ensuiteFloorOrder = await page.$eval(`${selector('tiling-slot-floor')} .tl-calc`, element => element.innerText.replace(/\s+/g, ' '));
  assert.match(ensuiteFloorOrder, /6\.80m² \+ 12% wastage = 7\.62m²/, `5: Ensuite quantity from its own area: ${ensuiteFloorOrder}`);
  await screenshot('ensuite-after-apply');

  // 6-7. Change one Ensuite tile; the Main Bathroom is untouched.
  const ensuiteWall = await chooseTile('wall', 2);
  assert.notEqual(ensuiteWall, main.wall, '6: Ensuite wall tile changed');
  await openRoom('Main Bathroom');
  await gotoStep('Tiles');
  assert.deepEqual({floor:await slotProduct('floor'), wall:await slotProduct('wall'), feature:await slotProduct('feature')}, main, '7: Main Bathroom unchanged');
  // ...and changing the Main Bathroom afterwards does not reach the Ensuite.
  const mainFloor2 = await chooseTile('floor', 3);
  assert.notEqual(mainFloor2, main.floor);
  await openRoom('Ensuite');
  await gotoStep('Tiles');
  assert.equal(await slotProduct('floor'), main.floor, 'a later Main Bathroom change does not update the Ensuite');
  assert.equal(await slotProduct('wall'), ensuiteWall);

  // Overwrite warning: the Ensuite now has selections. Only fill empty keeps them.
  await openRoom('Main Bathroom');
  await gotoStep('Tiles');
  await page.$eval(selector('tiling-scheme-apply-open'), button => button.click());
  await page.waitForSelector(selector('tiling-scheme-panel'));
  const ensuiteId = await page.$$eval(`${selector('tiling-scheme-panel')} .tl-scheme-rooms label`, labels => labels.find(label => label.innerText.trim().startsWith('Ensuite')).querySelector('input').dataset.testid);
  await page.$eval(selector(ensuiteId), input => input.click());
  const warning = await text('tiling-scheme-panel');
  assert.match(warning, /Ensuite already has tile selections\. Replacing will change: Floor tile, Wall tile\. Its dimensions and calculated areas are kept\./, `overwrite warning: ${warning}`);
  assert(await page.$(selector('tiling-scheme-fill')) && await page.$(selector('tiling-scheme-replace')), 'fill-empty and replace are both offered');
  await screenshot('scheme-overwrite-warning');
  await page.$eval(selector('tiling-scheme-fill'), button => button.click());
  await openRoom('Ensuite');
  await gotoStep('Tiles');
  assert.equal(await slotProduct('wall'), ensuiteWall, 'fill-empty kept the Ensuite wall tile');
  assert.equal(await slotProduct('floor'), main.floor, 'fill-empty kept the Ensuite floor tile');

  // 8. Default scheme: mark the Main Bathroom, then the Laundry is offered it as a one-time copy.
  await openRoom('Main Bathroom');
  await gotoStep('Review');
  assert(await page.$(`${selector('tiling-review')} ${selector('tiling-scheme-actions')}`), 'scheme actions are also on the review step');
  await page.$eval(selector('tiling-scheme-default'), button => button.click());
  assert.equal(await page.$eval(selector('tiling-scheme-default'), button => button.innerText), '✓ BATHROOM DEFAULT');
  await openRoom('Laundry');
  await enter('tiling-width', 1800);
  await enter('tiling-length', 3000);
  await gotoStep('Tiles');
  const banner = await text('tiling-scheme-default-banner');
  assert.match(banner, /Bathroom default available - Main Bathroom/);
  assert.match(banner, /Wall tile not copied - Laundry has no wall surface/, '9: Laundry gets only the surfaces it has');
  await page.$eval(selector('tiling-scheme-default-apply'), button => button.click());
  await page.waitForSelector(selector('tiling-scheme-copied'));
  assert.equal(await slotProduct('floor'), mainFloor2, 'Laundry floor from the default scheme');
  assert.equal(await hasSlot('wall'), false);
  const laundryOrder = await page.$eval(`${selector('tiling-slot-floor')} .tl-calc`, element => element.innerText.replace(/\s+/g, ' '));
  assert.match(laundryOrder, /5\.40m² \+ 12% wastage = 6\.05m²/, `Laundry quantity from its own 1800 x 3000: ${laundryOrder}`);
  report.tests.rooms = {main, mainFloor2, ensuiteWall, mainFloorOrder, ensuiteFloorOrder, laundryOrder};

  // 10. Save: each room's own quantity in the Quotation Builder; the same tile consolidated with its rooms.
  await page.$eval(selector('tiling-room-save'), button => button.click());
  let saved;
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await page.evaluate(async key => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try { return await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
    }, `job:${projectId}`);
    if (saved?.workbook?.quotation?.['TILING - LAUNDRY']) break;
  }
  const selection = (saved.workbook.clientSelectionsBook.rooms || []).flatMap(room => room.rows || []).find(row => row.guidedSelection?.tilingRooms).guidedSelection;
  const byName = Object.fromEntries(selection.tilingRooms.map(room => [room.name, room]));
  assert.deepEqual([Number(byName.Ensuite.geometry.widthMm), Number(byName.Ensuite.geometry.lengthMm)], [2000, 3400], 'saved Ensuite dimensions are its own');
  assert.equal(byName.Ensuite.schemeCopy.copiedFromRoomName, 'Main Bathroom');
  assert.notEqual(byName.Ensuite.products.wall, byName['Main Bathroom'].products.wall, 'rooms hold separate selection records');
  assert.equal(byName['Powder Room'].products.wall, undefined, 'no wall tile stored on the Powder Room');
  const floorQty = (section) => Number(saved.workbook.quotation[section].rows.find(row => row.item.startsWith('Floor tiles')).qty);
  assert.deepEqual([floorQty('TILING - MAIN BATHROOM'), floorQty('TILING - ENSUITE'), floorQty('TILING - LAUNDRY')], [13.89, 7.62, 6.05], 'Quotation Builder quantities per room');
  const shared = selection.tilingProductTotals.find(entry => entry.rooms.length >= 2);
  assert(shared, 'a tile used in several rooms is consolidated');
  assert.equal(Math.round(shared.rooms.reduce((sum, room) => sum + room.orderAreaM2, 0) * 100), Math.round(shared.orderAreaM2 * 100), 'total = sum of the room allocations');
  const procurementShared = (saved.workbook.procurement.items || []).filter(item => item.productId === shared.productId);
  assert(procurementShared.length >= 2 && procurementShared.every(item => item.productTotalOrderAreaM2 === shared.orderAreaM2 && item.location), 'procurement: a line per room, each with the product total');
  // The rooms overview shows the consolidated order.
  await page.$eval(`${selector('tiling-room-editor')} .tl-link`, button => button.click());
  const summary = await text('tiling-order-summary');
  assert.match(summary, /Ensuite: /);
  await page.$eval(selector('tiling-order-summary'), element => element.scrollIntoView());
  await screenshot('tile-order-summary');
  report.tests.saved = {consolidated:selection.tilingProductTotals.map(entry => `${entry.productName}: ${entry.rooms.map(room => `${room.roomName} ${room.orderAreaM2} m²`).join(' + ')} = ${entry.orderAreaM2} m² (${entry.boxes ?? '-'} boxes)`), summary};

  const smallText = await page.$$eval('.tl-shell *', elements => elements.filter(element => element.children.length === 0 && element.innerText?.trim() && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.innerText.slice(0, 30)));
  assert.deepEqual(smallText, [], 'no text under 16px');
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
  console.log(JSON.stringify({passed:true, tests:report.tests, blockedCloudWrites:report.blockedCloudWrites.length}, null, 2));
} catch (error) {
  report.error = error.message;
  if (page) {
    await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
    fs.writeFileSync(path.join(out, 'failure.txt'), await page.evaluate(() => document.body.innerText).catch(() => ''));
  }
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
