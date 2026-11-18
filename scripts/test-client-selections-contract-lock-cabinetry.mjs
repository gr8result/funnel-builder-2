// Post-contract lock, cabinetry engine (15 Nov 2026 P0). The cabinetry engine runs on every job load
// and after every Client Selections save. Before this fix a cabinetry change made after contract was
// written straight into the contracted CABINETRY quote rows on the next save or reopen, undoing
// deferUnapprovedQuotationChanges. Runs on a read-only copy of the real job.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-contract-lock-cabinetry.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { applyCabinetryRequirementsToQuotation as apply, returnCabinetryRowToAutomatic } from "../lib/construction-estimation/cabinetryRequirements.js";
import { bookWithContractLock, createContractLock } from "../lib/builders/contractLock.js";

const arg = process.argv.find((item) => item.startsWith("--job="))?.slice(6);
const file = arg || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
assert(fs.existsSync(file), `real job copy not found: ${file}`);
const zip = await JSZip.loadAsync(fs.readFileSync(file));
const original = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const owner = original.workspaceId;
const sig = (quotation) => JSON.stringify((quotation.CABINETRY?.rows || []).map((row) => [row.importKey, Number(row.quantity) || 0]));

const settled = apply(original, owner);
const lock = createContractLock({ lockedAt: "2026-11-15T00:00:00.000Z", lockedBy: "builder" });
const locked = { ...settled, clientSelectionsBook: bookWithContractLock(settled.clientSelectionsBook, lock) };
assert.equal(apply(locked, owner), locked, "a locked job with no cabinetry change is returned unchanged");

// The client adds two Kitchen base units after contract.
const changedBook = structuredClone(locked.clientSelectionsBook);
const line = changedBook.rooms.flatMap((room) => room.rows || []).map((row) => row.guidedSelection?.cabinetrySelection).filter(Boolean)
  .flatMap((selection) => selection.schedule || []).find((entry) => Number(entry.quantity) > 0 && /kitchen/i.test(entry.location));
assert(line, "the real job has a scheduled Kitchen cabinet");
line.quantity = Number(line.quantity) + 2;
const changed = { ...locked, clientSelectionsBook: changedBook };

const after = apply(changed, owner);
assert.equal(sig(after.quotation), sig(locked.quotation), "contracted CABINETRY quote rows never rewritten after contract");
assert.equal(after.quotation, locked.quotation);
assert.equal(after.cabinetryReconciliation.contractLocked.quotationUnchanged, true);
assert(after.cabinetryReconciliation.contractLocked.pendingRowChanges > 0, "the pending cabinetry change is reported");
assert.equal(apply(after, owner), after, "repeat load/save returns the same workbook (no dirty loop)");

// Reconcile Selections' proposal pass still sees the change, so it can become a variation.
assert.notEqual(sig(apply(changed, owner, { ignoreContractLock: true }).quotation), sig(locked.quotation));
// Return to automatic cannot move a contracted line either.
const someKey = (locked.quotation.CABINETRY.rows.find((row) => row.importKey) || {}).importKey;
assert.equal(returnCabinetryRowToAutomatic(changed, someKey, owner), changed);

// Before contract nothing changes: the selection still drives the quotation.
const unlockedBook = structuredClone(changedBook);
delete unlockedBook.metadata.contractLock;
assert.notEqual(sig(apply({ ...settled, clientSelectionsBook: unlockedBook }, owner).quotation), sig(settled.quotation), "pre-contract cabinetry changes still sync");

console.log(`contract lock cabinetry: contracted CABINETRY rows kept after contract (${line.location}: ${line.unitType} -> ${line.quantity}); change still proposed for a variation; pre-contract sync unchanged`);
