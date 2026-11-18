import assert from 'node:assert/strict';
import { requireQuotationAcceptanceEnvironment as check } from './lib/quotation-acceptance-environment.mjs';
const valid = { origin: 'http://127.0.0.1:3107', supabaseUrl: 'http://127.0.0.1:55521', workspaceId: '11111111-1111-4111-8111-111111111111' };
assert.doesNotThrow(() => check(valid));
for (const key of ['origin', 'supabaseUrl']) {
  for (const value of [undefined, 'http://localhost:3000', 'http://localhost', 'https://example.supabase.co:443', 'http://example.com:3107', 'http://user:pass@localhost:3107', 'ftp://localhost:3107']) {
    assert.throws(() => check({ ...valid, [key]: value }), `${key}: ${value}`);
  }
}
assert.throws(() => check({ ...valid, workspaceId: undefined }));
console.log('PASS acceptance rejects shared services, reserved ports, missing workspace and malformed URLs');
