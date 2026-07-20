import assert from "node:assert/strict";
import {
  createBlankStandardInclusionsV2Document,
  createStandardInclusionsV2Page,
} from "../lib/standard-inclusions-v2/schema.js";
import {
  STALE_STANDARD_INCLUSIONS_V2_SAVE,
  createMemoryStandardInclusionsV2Adapter,
  createStandardInclusionsV2Store,
} from "../lib/standard-inclusions-v2/storage.js";

const tenantId = "tenant-a";
const ownerUserId = "owner-a";
const adapter = createMemoryStandardInclusionsV2Adapter();
const store = createStandardInclusionsV2Store(adapter);

const pageOne = createStandardInclusionsV2Page({ name: "Cover", order: 0 });
const initialDocument = {
  ...createBlankStandardInclusionsV2Document({ tenantId, ownerUserId }),
  pages: [pageOne],
};

const saved = await store.saveDocument(initialDocument, {
  tenantId,
  ownerUserId,
  trigger: "create-blank",
  createRevision: false,
});

assert.equal(saved.pages.length, 1, "blank document should save with one page");
assert.equal((await store.listDocuments({ tenantId: "tenant-b", ownerUserId })).length, 0, "other tenants must not see this document");
await assert.rejects(
  () => store.loadDocument({ tenantId: "tenant-b", ownerUserId, documentId: saved.id }),
  /tenant mismatch/,
  "cross-tenant loads must be rejected",
);

const pageTwo = createStandardInclusionsV2Page({ name: "Selections", order: 1 });
const updated = await store.saveDocument({ ...saved, pages: [...saved.pages, pageTwo] }, {
  tenantId,
  ownerUserId,
  baseUpdatedAt: saved.updatedAt,
  baseRevisionId: saved.activeRevisionId,
  trigger: "add-page",
});

assert.equal(updated.pages.length, 2, "updated document should contain the added page");

await assert.rejects(
  () => store.saveDocument({ ...saved, name: "Stale write" }, {
    tenantId,
    ownerUserId,
    baseUpdatedAt: saved.updatedAt,
    baseRevisionId: saved.activeRevisionId,
    trigger: "stale-save",
  }),
  (error) => error?.code === STALE_STANDARD_INCLUSIONS_V2_SAVE,
  "stale saves must be rejected",
);

await store.saveNavigation({
  tenantId,
  ownerUserId,
  documentId: updated.id,
  selectedPageId: pageTwo.id,
  zoom: 1.25,
});

const navigationBeforeDelete = await store.loadNavigation({ tenantId, ownerUserId });
assert.equal(navigationBeforeDelete.selectedPageId, pageTwo.id, "selected page should persist");
assert.equal(navigationBeforeDelete.zoom, 1.25, "zoom should persist");

await store.deleteDocument({ tenantId, ownerUserId, documentId: updated.id });
assert.equal(await store.loadActiveDocument({ tenantId, ownerUserId }), null, "delete must not fall back to another document");

const navigationAfterDelete = await store.loadNavigation({ tenantId, ownerUserId });
assert.equal(navigationAfterDelete.documentId, "", "delete must clear active document navigation");
assert.equal(navigationAfterDelete.selectedPageId, "", "delete must clear selected page navigation");

console.log("standard-inclusions-v2 storage contract passed");
