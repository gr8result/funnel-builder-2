import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { buildCabinetryRoomSelectionPayload, defaultCabinetryRoom } from "../lib/builders/cabinetryRoomSelection.js";

for (const filename of [".env.local", ".env"]) {
  if (fs.existsSync(filename)) dotenv.config({ path: filename, quiet: true });
}
const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceUrl || !serviceKey) throw new Error("The live schema probe requires a Supabase URL and service-role credential in the local environment.");
const client = createClient(serviceUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const page = fs.readFileSync("pages/modules/builders/client-selections.js", "utf8");
const sessionColumns = page.match(/const SESSION_COLUMNS = "([^"]+)";/)?.[1];
if (!sessionColumns) throw new Error("Could not read the actual Client Selections session column list.");
const payload = buildCabinetryRoomSelectionPayload({
  workspaceId: null, projectId: null, sessionId: null, snapshotId: null,
  room: defaultCabinetryRoom("kitchen"),
});
const probes = [
  { table: "builder_client_selections", columns: Object.keys(payload).sort() },
  { table: "builder_selection_sessions", columns: sessionColumns.split(",").map((column) => column.trim()) },
];
const results = [];
for (const probe of probes) {
  // A zero-row SELECT validates the referenced columns without retrieving records.
  // There are deliberately no inserts, updates, deletes or workspace lookups here.
  const { data, error } = await client.from(probe.table).select(probe.columns.join(",")).limit(0);
  let errorMessage = error?.message || "";
  for (const sensitive of [serviceUrl, serviceKey]) errorMessage = errorMessage.split(sensitive).join("[redacted]");
  const returnedRows = Array.isArray(data) ? data.length : 0;
  const result = {
    table: probe.table,
    selectedColumnCount: probe.columns.length,
    selectedColumns: probe.columns,
    passed: !error && returnedRows === 0,
    returnedRows,
    ...(error ? { errorCode: error.code || "unknown", errorMessage } : {}),
  };
  results.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${probe.table}: ${probe.columns.length} column references checked; returned rows=${returnedRows}${error ? `; ${errorMessage}` : ""}`);
}
const report = {
  checkedAt: new Date().toISOString(),
  scope: "Read-only live zero-row SELECT probes using service-role authentication; no live data writes or record contents retrieved",
  verifies: "Existence of the current room payload and canonical session columns",
  doesNotVerify: "Authenticated end-user RLS access, inserts, updates, constraints on writes, or complete save/reload behavior",
  passed: results.every((result) => result.passed),
  results,
};
const reportPath = path.resolve("artifacts/test-results/client-selections-cabinetry-rooms/live-schema-probe.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log("Live schema probe checks column existence only; end-user RLS writes remain unverified.");
if (!report.passed) process.exitCode = 1;
