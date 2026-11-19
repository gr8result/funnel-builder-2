// Private test data (reference plans, frozen plan inputs, recorded traces): never in the repository
// (WORKFLOW.md D6; artifacts/ is git-ignored). Tests find it through GR8_PRIVATE_TEST_DATA, the folder that
// holds what used to live under artifacts/test-results; without it, this checkout's own artifacts/test-results.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PRIVATE_TEST_DATA = path.resolve(process.env.GR8_PRIVATE_TEST_DATA || path.join(root, 'artifacts', 'test-results'));

export function privateTestData(...parts) {
  return path.join(PRIVATE_TEST_DATA, ...parts);
}

// A folder of private data as a file URL ending in '/', for `new URL(name, base)`.
export function privateTestDataUrl(...parts) {
  return pathToFileURL(privateTestData(...parts) + path.sep).href;
}
