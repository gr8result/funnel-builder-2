// lib/modules/modules/modules/modules/affiliatessss/adapter.js
// Chooses which affiliate adapter to use. Default: mock.
// Swap 'mock' -> 'impact'|'partnerstack' etc. later with same method signatures.

import mock from "./adapters/mock";

const adapters = {
  mock,
};

const ACTIVE = process.env.AFFILIATE_ADAPTER || "mock";

const adapter = adapters[ACTIVE];
if (!adapter) {
  throw new Error(`Unknown AFFILIATE_ADAPTER "${ACTIVE}". Available: ${Object.keys(adapters).join(", ")}`);
}

export default adapter;




