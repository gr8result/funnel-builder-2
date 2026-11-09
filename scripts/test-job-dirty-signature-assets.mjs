import assert from 'node:assert/strict';
import { jobDirtySignature } from '../lib/construction-estimation/jobPersistence.js';
import { rememberAssetId } from '../lib/construction-estimation/knownAssetIds.js';

// The dirty signature uses a stored image's content id instead of hashing its text, and still
// tells every change apart.
const art = `data:image/png;base64,${'A'.repeat(300000)}`;
const other = `data:image/png;base64,${'A'.repeat(299999)}B`;
const job = (image) => ({ jobId: 'j1', quotation: { a: { rows: [] } }, projectEstimateBuilder: { pages: [{ baseArtwork: image }] } });
const before = jobDirtySignature(job(art));
rememberAssetId(art, 'a'.repeat(64), art.length);
const after = jobDirtySignature(job(art));
assert.notEqual(before, after, 'representation changed (id fed instead of text) - only consistency within a session matters');
assert.equal(jobDirtySignature(job(art)), after, 'stable for the same image');
assert.notEqual(jobDirtySignature(job(other)), after, 'a different, unstored image is detected');
rememberAssetId(other, 'b'.repeat(64), other.length);
assert.notEqual(jobDirtySignature(job(other)), after, 'a different stored image is detected');
assert.notEqual(jobDirtySignature({ ...job(art), quotation: { a: { rows: [{ id: 1 }] } } }), after, 'other edits still detected');
const started = performance.now();
const big = { jobId: 'j1', projectEstimateBuilder: { pages: Array.from({ length: 60 }, (_, i) => ({ baseArtwork: `${art}${i}` })) } };
big.projectEstimateBuilder.pages.forEach((page, i) => rememberAssetId(page.baseArtwork, String(i).padStart(64, '0'), page.baseArtwork.length));
jobDirtySignature(big);
console.log(`PASS dirty signature: exact for stored and unstored images; 18 MB of stored artwork signed in ${Math.round(performance.now() - started)} ms`);
