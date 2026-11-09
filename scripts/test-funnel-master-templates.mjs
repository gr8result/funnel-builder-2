import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { handler, setFunnelTemplateDb } from "../pages/api/funnels/templates.js";
import { createFunnelPreviewToken, verifyFunnelPreviewToken } from "../lib/funnels/previewToken.js";
import { handler as createFunnel, setCreateFunnelDb } from "../pages/api/funnels/create-with-pages.js";
import { handler as previewTokenHandler, setFunnelPreviewTokenDb } from "../pages/api/funnels/preview-token.js";
import publicPageHandler, { setFunnelPublicPageDb } from "../pages/api/funnels/public-page.js";

class Query {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.operation = "select";
    this.filters = [];
    this.columns = "*";
    this.payload = null;
    this.returning = false;
    this.singleMode = null;
    this.orders = [];
  }
  select(columns = "*") {
    if (this.operation === "select") this.columns = columns;
    else { this.columns = columns; this.returning = true; }
    return this;
  }
  insert(rows) { this.operation = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(row) { this.operation = "update"; this.payload = row; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  order(column, { ascending = true } = {}) { this.orders.push({ column, ascending }); return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
    const failed = this.database.failNext;
    if (failed && failed.table === this.table && failed.operation === this.operation) {
      this.database.failNext = null;
      return { data: null, error: { message: "simulated database outage" } };
    }

    const rows = this.database.tables[this.table];
    if (!rows) return { data: null, error: { message: `relation ${this.table} does not exist` } };
    const matches = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === "insert") {
      const inserted = this.payload.map((item) => ({ id: randomUUID(), ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
      rows.push(...inserted);
      return this.result(this.returning ? inserted : []);
    }
    if (this.operation === "update") {
      matches.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
      return this.result(this.returning ? matches : []);
    }
    if (this.operation === "delete") {
      this.database.tables[this.table] = rows.filter((row) => !matches.includes(row));
      return { data: null, error: null };
    }
    let result = matches;
    for (const { column, ascending } of this.orders) {
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this.columns !== "*") {
      const fields = this.columns.split(",").map((field) => field.trim());
      result = result.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));
    }
    return this.result(result);
  }

  result(rows) {
    if (this.singleMode === "single") return rows.length === 1
      ? { data: rows[0], error: null }
      : { data: null, error: { message: `expected one row, got ${rows.length}` } };
    if (this.singleMode === "maybe") return rows.length <= 1
      ? { data: rows[0] || null, error: null }
      : { data: null, error: { message: "multiple rows" } };
    return { data: rows, error: null };
  }
}

const database = {
  tables: {
    workspaces: [
      { id: "workspace-a", plan: "professional" },
      { id: "workspace-b", plan: "professional" },
      { id: "workspace-c", plan: "professional" },
    ],
    funnels: [{
      id: "source-funnel",
      owner_user_id: "admin-a",
      workspace_id: "workspace-a",
      name: "GR8 Quote Funnel",
      description: "Original funnel details",
      notify_email: "original@example.test",
      default_list_id: "source-list",
      slug: "gr8-quote",
      status: "draft",
      is_master_template: false,
      template_description: null,
      template_thumbnail: null,
    }],
    funnel_steps: [
      { id: "source-step-1", funnel_id: "source-funnel", title: "Quote", content: '<section><img src="https://assets.example.test/quote.jpg"><h1>Original quote copy</h1></section>', order_index: 0 },
      { id: "source-step-2", funnel_id: "source-funnel", title: "Thanks", content: "<section>Original thank-you copy</section>", order_index: 1 },
    ],
  },
  failNext: null,
  from(table) { return new Query(this, table); },
};

setFunnelTemplateDb(database);
setCreateFunnelDb(database);
setFunnelPreviewTokenDb(database);
setFunnelPublicPageDb(database);
process.env.FUNNEL_PREVIEW_SECRET = "isolated-funnel-preview-test-secret";
const previewToken = createFunnelPreviewToken({ funnelId: "source-funnel", workspaceId: "workspace-a" });
const previewClaims = verifyFunnelPreviewToken(previewToken, "source-funnel");
assert.equal(previewClaims.funnelId, "source-funnel");
assert.equal(previewClaims.workspaceId, "workspace-a");
assert(previewClaims.expiresAt >= Math.floor(Date.now() / 1000) + 299);
assert.equal(verifyFunnelPreviewToken(previewToken, "another-funnel"), null);
assert.equal(verifyFunnelPreviewToken(`${previewToken}tampered`, "source-funnel"), null);
const originalNow = Date.now;
Date.now = () => originalNow() + (6 * 60 * 1000);
try {
  assert.equal(verifyFunnelPreviewToken(previewToken, "source-funnel"), null, "expired tokens cannot authorize a private preview");
} finally {
  Date.now = originalNow;
}
const workspaceAdmin = { id: "admin-a" };
const builderB = { id: "builder-b" };
const builderC = { id: "builder-c" };
const req = (user, workspaceId, options = {}) => ({
  method: options.method || "GET",
  query: options.query || {},
  body: options.body || {},
  user,
  workspaceId,
  workspace: { plan: "professional" },
  memberRole: options.role || "member",
});
const callHandler = async (target, request) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
  await target(request, response);
  return response;
};
const call = (request) => callHandler(handler, request);

const createResponse = {
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
};
await createFunnel({
  method: "POST",
  user: builderB,
  workspaceId: "workspace-b",
  body: { funnelTypeId: "lead-magnet", brand: { name: "Builder B offer" }, userId: "admin-a", useAI: false },
}, createResponse);
assert.equal(createResponse.statusCode, 200);
const createdFunnel = database.tables.funnels.find((funnel) => funnel.id === createResponse.body.funnelId);
assert.equal(createdFunnel.owner_user_id, builderB.id, "funnel creation trusts authenticated user identity, not request-body user IDs");
assert.equal(createdFunnel.workspace_id, "workspace-b");
assert.equal(database.tables.funnel_steps.filter((step) => step.funnel_id === createdFunnel.id).length, 2,
  "new multi-step funnels persist every generated page");

const originalSteps = structuredClone(database.tables.funnel_steps.filter((step) => step.funnel_id === "source-funnel"));
let response = await call(req(workspaceAdmin, "workspace-a", {
  method: "POST",
  role: "admin",
  body: { action: "save", id: "source-funnel", description: "A polished local quote funnel." },
}));
assert.equal(response.statusCode, 200);
assert.equal(response.body.template.is_master_template, true);
assert.equal(response.body.template.template_thumbnail, "https://assets.example.test/quote.jpg");

response = await call(req(builderB, "workspace-b", {
  method: "POST",
  body: { action: "save", id: "source-funnel", description: "Not allowed" },
}));
assert.equal(response.statusCode, 403, "regular subscribers cannot save master templates");

response = await call(req(builderB, "workspace-b"));
assert.equal(response.statusCode, 200);
assert.equal(response.body.templates.length, 1, "authorized builders see the shared catalogue");
assert.equal(response.body.templates[0].stepCount, 2);

response = await call(req(builderB, "workspace-b", { query: { id: "source-funnel" } }));
assert.equal(response.body.template.steps[0].content, originalSteps[0].content, "preview returns original content without changing it");

const createCopy = async (user, workspaceId) => call(req(user, workspaceId, {
  method: "POST",
  body: { action: "clone", templateId: "source-funnel", name: "My independent quote funnel" },
}));
const copyBResponse = await createCopy(builderB, "workspace-b");
const copyCResponse = await createCopy(builderC, "workspace-c");
assert.equal(copyBResponse.statusCode, 201);
assert.equal(copyCResponse.statusCode, 201);
const copyBId = copyBResponse.body.funnel.id;
const copyCId = copyCResponse.body.funnel.id;
assert.notEqual(copyBId, copyCId, "each builder receives a distinct funnel record");

const copyB = database.tables.funnels.find((funnel) => funnel.id === copyBId);
const copyC = database.tables.funnels.find((funnel) => funnel.id === copyCId);
assert.equal(copyB.owner_user_id, builderB.id);
assert.equal(copyB.workspace_id, "workspace-b");
assert.equal(copyC.owner_user_id, builderC.id);
assert.equal(copyC.workspace_id, "workspace-c");
for (const copy of [copyB, copyC]) {
  assert.equal(copy.status, "draft");
  assert.equal(copy.is_master_template, false);
  assert.equal(copy.notify_email, null, "master notification settings are not copied across tenants");
  assert.equal(copy.default_list_id, null, "master CRM list references are not copied across tenants");
}
const copyBSteps = database.tables.funnel_steps.filter((step) => step.funnel_id === copyBId);
assert.deepEqual(copyBSteps.map(({ title, content, order_index }) => ({ title, content, order_index })),
  originalSteps.map(({ title, content, order_index }) => ({ title, content, order_index })));

const publicResponse = {
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
};
await publicPageHandler({ method: "GET", query: { preview: "1", funnelId: copyBId } }, publicResponse);
assert.equal(publicResponse.statusCode, 404, "draft previews require a signed private token");
const tokenResponse = await callHandler(previewTokenHandler, req(builderB, "workspace-b", {
  method: "POST",
  body: { funnelId: copyBId },
}));
assert.equal(tokenResponse.statusCode, 200);
const ownerTokenResponse = {
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader() {},
};
await previewTokenHandler({ method: "POST", user: builderC, workspaceId: "workspace-c", body: { funnelId: copyBId } }, ownerTokenResponse);
assert.equal(ownerTokenResponse.statusCode, 404, "a different builder cannot mint a preview token for another workspace");
const signedPreview = {
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
};
await publicPageHandler({
  method: "GET",
  query: { preview: "1", funnelId: copyBId, previewToken: tokenResponse.body.token },
}, signedPreview);
assert.equal(signedPreview.statusCode, 200);
assert.equal(signedPreview.body.steps.length, 2, "authorized builder preview loads the complete private funnel");

response = await call(req(builderB, "workspace-b", { query: { id: copyBId } }));
assert.equal(response.statusCode, 404, "subscriber copies are not exposed as master templates");
response = await call(req(builderB, "workspace-b", {
  method: "POST",
  body: { action: "clone", templateId: "copy-from-another-builder", name: "Intrusion attempt" },
}));
assert.equal(response.statusCode, 404, "non-master/foreign IDs cannot be cloned");
response = await call(req(builderB, "workspace-b", {
  method: "POST",
  body: { action: "save", id: copyBId, description: "Unauthorized mutation" },
}));
assert.equal(response.statusCode, 403, "a subscriber cannot promote or mutate a source template");

assert.deepEqual(database.tables.funnel_steps.filter((step) => step.funnel_id === "source-funnel"), originalSteps,
  "copying does not modify any original page");
assert.equal(database.tables.funnels.find((funnel) => funnel.id === "source-funnel").name, "GR8 Quote Funnel");

database.failNext = { table: "funnels", operation: "select" };
response = await call(req(builderB, "workspace-b"));
assert.equal(response.statusCode, 500, "catalogue database failures are returned explicitly");
response = await createCopy({ id: "builder-retry" }, "workspace-b");
assert.equal(response.statusCode, 201, "copying recovers after a transient database failure");

database.failNext = { table: "funnel_steps", operation: "insert" };
response = await createCopy({ id: "builder-failed-copy" }, "workspace-c");
assert.equal(response.statusCode, 500, "failed page insertion is reported");
assert.equal(database.tables.funnels.some((funnel) => funnel.owner_user_id === "builder-failed-copy"), false,
  "incomplete copies are rolled back");

console.log("PASS multi-step creation, preview token, master-template catalogue, administrator gate, tenant-safe copies, and failure recovery");
