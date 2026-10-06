import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('hooks/estimate-builder/useEstimateBuilderWorkbook.js', 'utf8');
const start = source.indexOf('async function listStoredTemplates() {');
const end = source.indexOf('\nasync function saveMasterTemplateBackup(', start);
assert.ok(start !== -1 && end > start);
let closed = false;
let visited = 0;
const transaction = {
  objectStore: () => ({
    getAll: () => { throw new Error('Template listing must not retain every full workbook'); },
    openCursor: () => {
      const request = {};
      const advance = () => queueMicrotask(() => {
        const index = visited++;
        request.result = index < 100 ? {
          // Generate one record at a time, as IndexedDB does. Historical payloads
          // must not be inspected or included in the returned template list.
          value: {
            type: index === 50 ? 'template' : 'template-backup',
            key: index === 50 ? 'master' : `backup:${index}`,
            name: 'Base Template', owner_id: 'owner', savedAt: '2026-09-29',
            versions: [{ versionId: 'one', savedAt: '2026-09-28', workbook: { document: 'not metadata' } }],
            get workbook() { throw new Error('Template metadata must not read workbook payloads'); },
          },
          continue: advance,
        } : null;
        request.onsuccess();
        if (!request.result) transaction.oncomplete?.();
      });
      advance();
      return request;
    },
  }),
};
const deps = {
  openTemplateDb: async () => ({ transaction: () => transaction, close: () => { closed = true; } }),
  currentTemplateOwnerId: () => 'owner', TEMPLATE_STORE_NAME: 'templates',
  MASTER_TEMPLATE_KEY: 'master', LEGACY_MASTER_TEMPLATE_KEY: 'legacy', MASTER_TEMPLATE_NAME: 'Base Template',
  parseTags: () => [],
};
const load = new Function(...Object.keys(deps), `${source.slice(start, end)}\nreturn listStoredTemplates();`);
const summaries = await load(...Object.values(deps));
assert.equal(summaries.length, 1);
assert.equal(summaries[0].key, 'master');
assert.equal(summaries[0].versions[0].versionId, 'one');
assert.ok(!JSON.stringify(summaries).includes('workbook'));
assert.equal(visited, 101);
assert.ok(closed);
console.log('PASS template listing streams 100 records and retains only metadata, including version metadata.');
