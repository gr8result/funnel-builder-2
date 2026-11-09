import assert from "node:assert/strict";
import { handler, setFunnelManageDb } from "../pages/api/funnels/manage.js";

class Query {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.operation = "select";
    this.columns = "*";
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.payload = null;
    this.returning = false;
    this.singleMode = null;
  }
  select(columns = "*") {
    this.columns = columns;
    if (this.operation !== "select") this.returning = true;
    return this;
  }
  insert(rows) { this.operation = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(row) { this.operation = "update"; this.payload = row; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  or(expression) {
    const [nullPart, equalsPart] = expression.split(",");
    const column = nullPart.split(".")[0];
    const value = equalsPart.split(".").slice(2).join(".");
    this.filters.push((row) => row[column] == null || row[column] === value);
    return this;
  }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  order(column, { ascending = true } = {}) { this.orders.push({ column, ascending }); return this; }
  limit(count) { this.limitCount = count; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
    const rows = this.database.tables[this.table];
    if (!rows) return { data: null, error: { message: `relation ${this.table} does not exist` } };
    const matches = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === "insert") {
      const inserted = this.payload.map((item) => ({
        id: `row-${++this.database.sequence}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      }));
      rows.push(...inserted);
      return this.result(this.returning ? inserted : []);
    }
    if (this.operation === "update") {
      matches.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
      return this.result(this.returning ? matches : []);
    }
    if (this.operation === "delete") {
      this.database.tables[this.table] = rows.filter((row) => !matches.includes(row));
      return this.result(this.returning ? matches : []);
    }
    let result = matches;
    for (const { column, ascending } of this.orders) {
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    if (this.columns !== "*") {
      const fields = this.columns.split(",").map((field) => field.trim());
      result = result.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));
    }
    return this.result(result);
  }

  result(rows) {
    if (this.singleMode === "single") return rows.length === 1
      ? { data: rows[0], error: null }
      : { data: null, error: { code: "PGRST116", message: `expected one row, got ${rows.length}` } };
    if (this.singleMode === "maybe") return rows.length <= 1
      ? { data: rows[0] || null, error: null }
      : { data: null, error: { message: "multiple rows" } };
    return { data: rows, error: null };
  }
}

const workspaceA = "aaaaaaaa-0000-4000-8000-000000000001";
const workspaceB = "bbbbbbbb-0000-4000-8000-000000000002";
const userA = { id: "a0000000-0000-4000-8000-000000000001" };
const userB = { id: "b0000000-0000-4000-8000-000000000002" };
const database = {
  sequence: 0,
  tables: {
    workspaces: [{ id: workspaceA, plan: "professional" }, { id: workspaceB, plan: "professional" }],
    email_lists: [
      { id: "list-a", user_id: userA.id, name: "Builder A list" },
      { id: "list-b", user_id: userB.id, name: "Builder B list" },
    ],
    funnels: [
      { id: "funnel-a", owner_user_id: userA.id, workspace_id: workspaceA, name: "Builder A Funnel", description: "", slug: null, status: "draft", notify_email: null, default_list_id: null, is_master_template: false },
      { id: "funnel-b", owner_user_id: userB.id, workspace_id: workspaceB, name: "Builder B Funnel", description: "", slug: "builder-b", status: "draft", notify_email: "b@example.test", default_list_id: "list-b", is_master_template: false },
      { id: "master", owner_user_id: userA.id, workspace_id: workspaceA, name: "Master", description: "", slug: null, status: "draft", notify_email: null, default_list_id: null, is_master_template: true },
    ],
    funnel_steps: [
      { id: "step-a-1", funnel_id: "funnel-a", title: "First", content: "<h1>A original</h1>", order_index: 0 },
      { id: "step-a-2", funnel_id: "funnel-a", title: "Second", content: "<h1>A next</h1>", order_index: 1 },
      { id: "step-b-1", funnel_id: "funnel-b", title: "Private B", content: "<h1>B</h1>", order_index: 0 },
    ],
  },
  from(table) { return new Query(this, table); },
};
setFunnelManageDb(database);

function request(user, workspaceId, { method = "GET", query = {}, body = {} } = {}) {
  return { method, query, body, user, workspaceId, workspace: { plan: "professional" } };
}
async function call(req) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
  await handler(req, res);
  return res;
}

let response = await call(request(userA, workspaceA, { query: { id: "funnel-a" } }));
assert.equal(response.statusCode, 200);
assert.deepEqual(response.body.steps.map((step) => step.id), ["step-a-1", "step-a-2"]);
assert.deepEqual(response.body.lists.map((list) => list.id), ["list-a"]);

response = await call(request(userA, workspaceA, { query: { id: "funnel-b" } }));
assert.equal(response.statusCode, 404, "a builder cannot load another workspace's funnel");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "saveBasics", id: "funnel-a", name: "Edited funnel", description: "Persisted details", slug: "edited-funnel", notify_email: "a@example.test", default_list_id: "list-a", user_id: userB.id },
}));
assert.equal(response.statusCode, 200);
assert.equal(response.body.funnel.owner_user_id, userA.id, "client-supplied owner fields are ignored");
assert.equal(response.body.funnel.name, "Edited funnel");
assert.equal(response.body.funnel.default_list_id, "list-a");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "saveBasics", id: "funnel-a", name: "Edited funnel", default_list_id: "list-b" },
}));
assert.equal(response.statusCode, 400, "a builder cannot route submissions to another builder's email list");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "saveStep", funnelId: "funnel-a", stepId: "step-a-1", title: "First edited", content: "<h1>Saved edit</h1>", order_index: 0 },
}));
assert.equal(response.statusCode, 200);
assert.equal(database.tables.funnel_steps.find((step) => step.id === "step-a-1").content, "<h1>Saved edit</h1>");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "saveStep", funnelId: "funnel-a", stepId: "step-b-1", title: "Intrusion", content: "x", order_index: 0 },
}));
assert.equal(response.statusCode, 404, "a step ID from another builder cannot be edited");
assert.equal(database.tables.funnel_steps.find((step) => step.id === "step-b-1").content, "<h1>B</h1>");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "saveStep", funnelId: "funnel-b", title: "Wrong tenant", content: "x", order_index: 0, owner_user_id: userA.id },
}));
assert.equal(response.statusCode, 404, "the route ignores client ownership claims and checks funnel workspace");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "deleteStep", funnelId: "funnel-a", stepId: "step-b-1" },
}));
assert.equal(response.statusCode, 404, "a builder cannot delete another builder's funnel step");

response = await call(request(userA, workspaceA, {
  method: "POST",
  body: { action: "deleteStep", funnelId: "funnel-a", stepId: "step-a-1" },
}));
assert.equal(response.statusCode, 200);
assert.deepEqual(database.tables.funnel_steps.filter((step) => step.funnel_id === "funnel-a").map((step) => step.order_index), [0]);

response = await call(request(userA, workspaceA, { method: "POST", body: { action: "publish", id: "funnel-a" } }));
assert.equal(response.statusCode, 200);
assert.equal(database.tables.funnels.find((funnel) => funnel.id === "funnel-a").status, "published");
assert.equal(database.tables.funnels.find((funnel) => funnel.id === "funnel-b").status, "draft");

response = await call(request(userA, workspaceA, { method: "POST", body: { action: "unpublish", id: "funnel-a" } }));
assert.equal(response.statusCode, 200);
assert.equal(database.tables.funnels.find((funnel) => funnel.id === "funnel-a").status, "draft");

response = await call(request(userA, workspaceA, { method: "POST", body: { action: "publish", id: "master" } }));
assert.equal(response.statusCode, 403, "master templates cannot be published through subscriber management");

console.log("PASS authenticated funnel loads, edits, step persistence, CRM list ownership, publish/unpublish and cross-builder denial");
