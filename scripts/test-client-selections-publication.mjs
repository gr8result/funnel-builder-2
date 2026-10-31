import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("pages/api/builders/publish-client-selections.js", "utf8")
  .replace(/import \{ supabaseAdmin \} from .*;/, "const supabaseAdmin = globalThis.__selectionPublishDb;")
  .replace(/import \{ withWorkspace, INTERNAL_COMMERCIAL_ROLES \} from .*;/, "const withWorkspace = handler => handler; const INTERNAL_COMMERCIAL_ROLES = [];");
assert.match(source, /export default withWorkspace\(handler, \{ roles: INTERNAL_COMMERCIAL_ROLES \}\)/, "Portal publication is restricted to internal workspace roles");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const savedBook = {
  id: "book-a", workspace_id: "workspace-a", project_id: "5179b554-6092-4148-a3d8-256f0d91a3ed",
  book_data: { rooms: [{ rows: [
    { id: "row-client", selectedProduct: "Basin", guidedSelection: { requirementKey: "bathroom-basin" } },
    { id: "row-internal", selectedProduct: "Estimator item", guidedSelection: { requirementKey: "bathroom-basin", internalOnly: true } },
    { id: "row-hidden", selectedProduct: "Not issued", guidedSelection: { requirementKey: "mirror", displayInSelectionsSchedule: false } },
  ] }] },
};
const savedRows = [
  { id: "selection-client", is_active: true, metadata: { selection_book_id: "book-a", selection_book_row_id: "row-client" }, selected_details: { requirementKey: "bathroom-basin" } },
  { id: "selection-internal", is_active: true, metadata: { selection_book_id: "book-a", selection_book_row_id: "row-internal", internalOnly: true }, selected_details: { requirementKey: "bathroom-basin", internalOnly: true } },
  { id: "selection-hidden", is_active: true, metadata: { selection_book_id: "book-a", selection_book_row_id: "row-hidden" }, selected_details: { requirementKey: "mirror", displayInSelectionsSchedule: false } },
  { id: "selection-removed", is_active: false, metadata: { selection_book_id: "book-a", selection_book_row_id: "row-client" }, selected_details: { requirementKey: "tap" } },
  { id: "other-project", is_active: true, metadata: { selection_book_id: "book-other", selection_book_row_id: "other" }, selected_details: {} },
];
let portalEnabled = true;
let omitClientRow = false;
const updates = [];
globalThis.__selectionPublishDb = {
  from(table) {
    const filters = {};
    let updatePayload = null;
    return {
      select() { return this; },
      update(payload) { updatePayload = payload; return this; },
      eq(key, value) { filters[key] = value; return this; },
      in(key, value) { filters[key] = value; return this; },
      async single() {
        if (table !== "builder_selection_books") throw new Error(`Unexpected single() on ${table}`);
        const match = savedBook.id === filters.id && savedBook.workspace_id === filters.workspace_id && savedBook.project_id === filters.project_id;
        return match ? { data: savedBook } : { data: null, error: new Error("not found") };
      },
      async maybeSingle() {
        assert.equal(table, "client_portal_settings");
        return { data: { portal_enabled: portalEnabled } };
      },
      then(resolve, reject) {
        if (table === "builder_client_selections" && !updatePayload) {
          const scopedRows = savedRows.filter((row) => row.metadata.selection_book_id === "book-a");
          const result = omitClientRow ? scopedRows.filter((row) => row.id !== "selection-client") : scopedRows;
          return Promise.resolve({ data: result }).then(resolve, reject);
        }
        if (table === "builder_client_selections" && updatePayload) {
          const ids = filters.id || [];
          const matched = savedRows.filter((row) => row.id && ids.includes(row.id) && row.metadata.selection_book_id === "book-a");
          updates.push({ filters, payload: updatePayload, ids: matched.map((row) => row.id) });
          return Promise.resolve({ data: matched.map((row) => ({ id: row.id })) }).then(resolve, reject);
        }
        return Promise.reject(new Error(`Unexpected table ${table}`)).then(resolve, reject);
      },
    };
  },
};

const { default: handler } = await import(moduleUrl);
const response = () => ({ code: 200, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = (workspaceId = "workspace-a", projectId = "5179b554-6092-4148-a3d8-256f0d91a3ed", selectionBookId = "book-a") => ({ method: "POST", workspaceId, user: { id: "builder-user" }, body: { projectId, selectionBookId } });

const success = response();
assert.equal(savedBook.book_data.rooms[0].rows[0].selectedProduct, "Basin");
await handler(request(), success);
assert.equal(success.code, 200, JSON.stringify(success.body));
assert.equal(success.body.publishedCount, 1);
assert.deepEqual(updates[0].ids, ["selection-client"]);
assert.deepEqual(updates[0].filters, { workspace_id: "workspace-a", project_id: "5179b554-6092-4148-a3d8-256f0d91a3ed", id: ["selection-client"] });
assert.deepEqual(updates[0].payload, { client_visible: true, client_status: "awaiting_client", updated_by: "builder-user", updated_at: updates[0].payload.updated_at });

const foreign = response();
await handler(request("workspace-b"), foreign);
assert.equal(foreign.code, 404, "a saved book in another workspace is not publishable");
assert.equal(updates.length, 1);

portalEnabled = false;
const disabledPortal = response();
await handler(request(), disabledPortal);
assert.equal(disabledPortal.code, 409, "disabled Client Portal blocks publication");
portalEnabled = true;

omitClientRow = true;
const missingSync = response();
await handler(request(), missingSync);
assert.equal(missingSync.code, 409, "a persisted book without its synced project row is not publishable");
assert.equal(updates.length, 1);

console.log("PASS publication requires a same-workspace saved book, enabled Portal and synced rows; only active client-safe rows are exposed.");