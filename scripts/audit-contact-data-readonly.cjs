require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase URL or service key in .env.local; no request was made.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TABLES = [
  "contacts",
  "gantt_contacts",
  "leads",
  "subscribers",
  "website_subscribers",
  "form_submissions",
  "bookings",
  "sms_sent_history",
  "crm_tasks",
  "crm_pipelines",
  "projects",
  "email_lists",
  "list_subscribers",
  "lead_lists",
];
const SAFE_COLUMNS = new Set([
  "id", "workspace_id", "user_id", "account_id", "website_id", "email",
  "phone", "mobile", "contact_id", "lead_id", "subscriber_id", "project_id",
  "source", "created_at", "status", "list_id", "pipeline_id",
]);
const PAGE_SIZE = 1000;
const MAX_ROWS_PER_TABLE = 250000;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const norm = (value) => String(value || "").trim().toLowerCase();

async function tableCount(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return { exists: false, error: error.message };
  return { exists: true, count: count || 0 };
}

function availableColumns(schema, table) {
  const definition = schema?.definitions?.[table];
  return Object.keys(definition?.properties || {}).filter((column) =>
    SAFE_COLUMNS.has(column)
    || /(^|_)(email|phone|mobile|telephone)(_|$)/i.test(column)
  );
}

async function readMinimalRows(table, columns, count) {
  const selectColumns = columns;
  if (!selectColumns.length) return { rows: [], truncated: count > MAX_ROWS_PER_TABLE, skipped: count > 0 };
  const rows = [];
  for (let offset = 0; offset < count && offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
    const end = Math.min(offset + PAGE_SIZE - 1, count - 1);
    const { data, error } = await supabase.from(table).select(selectColumns.join(",")).range(offset, end);
    if (error) throw new Error(`${table}: minimal read failed (${error.message})`);
    rows.push(...(data || []));
  }
  return { rows, truncated: count > MAX_ROWS_PER_TABLE, skipped: false };
}

function inspectRows(table, rows, columns, count, truncated, getTenantScope) {
  const tenantColumn = ["workspace_id", "account_id", "user_id"].find((c) => columns.includes(c));
  const missingTenant = columns.includes("workspace_id") ? rows.filter((r) => !r.workspace_id).length : null;
  const emailGroups = new Map();
  const phoneGroups = new Map();
  const identifiers = new Set();
  const unscopedIdentifiers = new Set();
  const recordsWithIdentifier = new Set();
  const emailColumns = columns.filter((column) => /(^|_)(email|email_address)(_|$)/i.test(column));
  const phoneColumns = columns.filter((column) => /(^|_)(phone|mobile|telephone)(_|$)/i.test(column));
  const idCounts = { email: 0, phone: 0 };

  rows.forEach((row, index) => {
    const scope = getTenantScope(row);
    const recordIndex = `${table}:${index}`;
    for (const column of emailColumns) {
      const email = norm(row[column]);
      if (!email) continue;
      recordsWithIdentifier.add(recordIndex);
      idCounts.email += 1;
      if (!scope) {
        unscopedIdentifiers.add(`email:${hash(email)}`);
        continue;
      }
      const key = `${scope}|email|${email}`;
      emailGroups.set(key, (emailGroups.get(key) || 0) + 1);
      identifiers.add(`${scope}|email:${hash(email)}`);
    }
    for (const column of phoneColumns) {
      const phone = String(row[column] || "").replace(/\D/g, "");
      if (phone.length < 7) continue;
      recordsWithIdentifier.add(recordIndex);
      idCounts.phone += 1;
      if (!scope) {
        unscopedIdentifiers.add(`phone:${hash(phone)}`);
        continue;
      }
      const key = `${scope}|phone|${phone}`;
      phoneGroups.set(key, (phoneGroups.get(key) || 0) + 1);
      identifiers.add(`${scope}|phone:${hash(phone)}`);
    }
  });

  const duplicateMetrics = (groups) => ({
    groups: [...groups.values()].filter((n) => n > 1).length,
    excessRows: [...groups.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0),
  });
  const countContactIdentityDuplicates = ["contacts", "leads", "subscribers", "website_subscribers"].includes(table);
  const scopedRows = rows.filter((row) => Boolean(getTenantScope(row))).length;
  const inferredWorkspaceIdRows = rows.filter((row) => !row.workspace_id && getTenantScope(row)?.startsWith("workspace:")).length;
  return {
    table,
    rows: count,
    tenantColumn: tenantColumn || null,
    workspaceIdColumnExists: columns.includes("workspace_id"),
    missingWorkspaceIdRowsScanned: missingTenant,
    inferredWorkspaceIdRows,
    rowsWithResolvedTenantScope: scopedRows,
    rowsWithoutResolvedTenantScope: rows.length - scopedRows,
    duplicateEmail: countContactIdentityDuplicates && scopedRows > 0 ? duplicateMetrics(emailGroups) : null,
    duplicatePhone: countContactIdentityDuplicates && scopedRows > 0 ? duplicateMetrics(phoneGroups) : null,
    contactReferenceColumns: columns.filter((column) => ["contact_id", "lead_id", "subscriber_id"].includes(column)),
    recordsWithEmail: idCounts.email,
    recordsWithPhone: idCounts.phone,
    recordsWithoutUsableIdentifier: Math.max(0, rows.length - recordsWithIdentifier.size),
    identifierHashes: identifiers,
    unscopedIdentifierHashes: unscopedIdentifiers,
    truncated,
  };
}

async function main() {
  const tableResults = [];
  const identifierSets = new Map();
  const unscopedIdentifierSets = new Map();
  const rowSets = new Map();
  const detailedErrors = [];
  let schema;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/openapi+json",
      },
    });
    if (!response.ok) throw new Error(`PostgREST schema request returned ${response.status}`);
    schema = await response.json();
  } catch (error) {
    throw new Error(`Could not read PostgREST schema metadata: ${error.message || error}`);
  }

  const userWorkspaces = new Map();
  const addUserWorkspace = (userId, workspaceId) => {
    if (!userId || !workspaceId) return;
    if (!userWorkspaces.has(String(userId))) userWorkspaces.set(String(userId), new Set());
    userWorkspaces.get(String(userId)).add(String(workspaceId));
  };
  if (schema?.paths?.["/workspace_members"]) {
    const { data, error } = await supabase.from("workspace_members").select("user_id,workspace_id,status");
    if (error) throw new Error(`workspace_members tenant mapping read failed (${error.message})`);
    for (const row of data || []) if (!row.status || row.status === "active") addUserWorkspace(row.user_id, row.workspace_id);
  }
  if (schema?.paths?.["/workspaces"]) {
    const { data, error } = await supabase.from("workspaces").select("id,owner_id");
    if (error) throw new Error(`workspaces owner mapping read failed (${error.message})`);
    for (const row of data || []) addUserWorkspace(row.owner_id, row.id);
  }
  const getTenantScope = (row) => {
    if (row.workspace_id) return `workspace:${row.workspace_id}`;
    if (row.user_id) {
      const workspaces = userWorkspaces.get(String(row.user_id));
      if (workspaces?.size === 1) return `workspace:${[...workspaces][0]}`;
    }
    return null;
  };

  for (const table of TABLES) {
    const countResult = await tableCount(table);
    if (!countResult.exists) {
      tableResults.push({ table, exists: false, error: countResult.error });
      continue;
    }
    const columns = availableColumns(schema, table);
    if (!schema?.paths?.[`/${table}`]) {
      tableResults.push({ table, querySucceeded: true, rows: countResult.count, schemaColumns: "not exposed by PostgREST OpenAPI", analysis: "identifier/link analysis unavailable" });
      continue;
    }
    let analysis = {
      table,
      exists: true,
      rows: countResult.count,
      detectedColumns: columns,
      tenantColumn: ["workspace_id", "user_id", "account_id"].find((c) => columns.includes(c)) || null,
      missingWorkspaceIdRowsScanned: null,
      duplicateEmail: null,
      duplicatePhone: null,
      recordsWithoutUsableIdentifier: null,
      truncated: countResult.count > MAX_ROWS_PER_TABLE,
    };
    try {
      const { rows, truncated, skipped } = await readMinimalRows(table, columns, countResult.count);
      rowSets.set(table, rows);
      const inspected = inspectRows(table, rows, columns, countResult.count, truncated, getTenantScope);
      const { identifierHashes, unscopedIdentifierHashes, ...summary } = inspected;
      analysis = { ...analysis, ...summary, exists: true, detectedColumns: columns, scanSkippedNoIdentifiers: skipped };
      identifierSets.set(table, identifierHashes);
      unscopedIdentifierSets.set(table, unscopedIdentifierHashes);
    } catch (error) {
      detailedErrors.push(String(error.message || error));
      analysis.analysisError = String(error.message || error);
    }
    tableResults.push(analysis);
  }

  const leadRows = rowSets.get("leads") || [];
  const leadIds = new Set(leadRows.map((row) => String(row.id || "")).filter(Boolean));
  const references = ["subscribers", "website_subscribers", "form_submissions", "bookings", "sms_sent_history", "crm_tasks"].map((table) => {
    const rows = rowSets.get(table);
    if (!rows) return { table, status: "not scanned" };
    const hasContactId = rows.some((row) => Object.hasOwn(row, "contact_id"));
    const hasLeadId = rows.some((row) => Object.hasOwn(row, "lead_id"));
    const nonemptyContactIds = rows.filter((row) => row.contact_id).length;
    const nonemptyLeadIds = rows.filter((row) => row.lead_id).length;
    const nonemptyContactIdsMatchingLeads = rows.filter((row) => row.contact_id && leadIds.has(String(row.contact_id))).length;
    const leadReferencesMatchingLeads = rows.filter((row) => row.lead_id && leadIds.has(String(row.lead_id))).length;
    return {
      table,
      rows: rows.length,
      hasContactIdColumn: hasContactId,
      rowsWithContactId: nonemptyContactIds,
      contactIdReferencesMatchingLeadIds: nonemptyContactIdsMatchingLeads,
      contactIdReferencesNotMatchingLeadIds: Math.max(0, nonemptyContactIds - nonemptyContactIdsMatchingLeads),
      hasLeadIdColumn: hasLeadId,
      rowsWithLeadId: nonemptyLeadIds,
      leadIdReferencesMatchingLeads: leadReferencesMatchingLeads,
      leadIdReferencesNotMatchingLeads: Math.max(0, nonemptyLeadIds - leadReferencesMatchingLeads),
    };
  });

  const scopedIds = (table) => {
    const ids = new Set();
    const unscoped = new Set();
    for (const row of rowSets.get(table) || []) {
      if (!row.id) continue;
      const scope = getTenantScope(row);
      if (scope) ids.add(`${scope}|${row.id}`);
      else unscoped.add(String(row.id));
    }
    return { ids, unscoped };
  };
  const emailListIds = scopedIds("email_lists");
  const leadListIds = scopedIds("lead_lists");
  const listReferences = ["leads", "subscribers", "form_submissions"].map((table) => {
    const rows = rowSets.get(table);
    if (!rows) return { table, status: "not scanned" };
    const rowsWithListId = rows.filter((row) => row.list_id).length;
    const scopedRows = rows.filter((row) => row.list_id && getTenantScope(row));
    const matchesEmail = scopedRows.filter((row) => emailListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`)).length;
    const matchesLead = scopedRows.filter((row) => leadListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`)).length;
    const matchesBoth = scopedRows.filter((row) => emailListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`) && leadListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`)).length;
    const unresolvedTargetTenant = rows.filter((row) => row.list_id && getTenantScope(row)
      && (emailListIds.unscoped.has(String(row.list_id)) || leadListIds.unscoped.has(String(row.list_id)))).length;
    const unresolvedSourceTenant = rows.filter((row) => row.list_id && !getTenantScope(row)).length;
    const matchedAny = scopedRows.filter((row) => emailListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`) || leadListIds.ids.has(`${getTenantScope(row)}|${row.list_id}`)).length;
    return {
      table,
      rows: rows.length,
      rowsWithListId,
      matchingEmailListIdsInSameWorkspace: matchesEmail,
      matchingLeadListIdsInSameWorkspace: matchesLead,
      listIdsMatchingBothTablesInSameWorkspace: matchesBoth,
      unresolvedSourceTenantRows: unresolvedSourceTenant,
      unresolvedTargetListTenantRows: unresolvedTargetTenant,
      unmatchedScopedListIds: Math.max(0, scopedRows.length - matchedAny - unresolvedTargetTenant),
    };
  });

  const linkTables = ["subscribers", "website_subscribers", "form_submissions", "bookings", "sms_sent_history"];
  const leadsIds = identifierSets.get("leads") || new Set();
  const disconnected = linkTables.map((table) => {
    const set = identifierSets.get(table);
    const unscoped = unscopedIdentifierSets.get(table);
    if (!set || !unscoped) return { table, status: "unavailable" };
    let sharedIdentifiers = 0;
    for (const value of set) if (leadsIds.has(value)) sharedIdentifiers += 1;
    return {
      table,
      tenantScopedUniqueIdentifierKeys: set.size,
      unscopedUniqueIdentifierKeys: unscoped.size,
      keysMatchingLeadsInSameWorkspace: sharedIdentifiers,
      tenantScopedKeysNotMatchingLeads: Math.max(0, set.size - sharedIdentifiers),
    };
  });

  const output = {
    audit: "read-only; exact counts plus minimally selected identifier/tenant columns; no writes",
    generatedAt: new Date().toISOString(),
    truncationLimitPerTable: MAX_ROWS_PER_TABLE,
    userWorkspaceMapping: {
      uniqueUsersWithOneWorkspace: [...userWorkspaces.values()].filter((workspaces) => workspaces.size === 1).length,
      usersMappedToMultipleWorkspaces: [...userWorkspaces.values()].filter((workspaces) => workspaces.size > 1).length,
    },
    tables: tableResults,
    disconnectedFromLeadsByExactNormalizedEmailOrPhoneHash: disconnected,
    recordLinkageColumnsAndLeadReferences: references,
    listReferenceIntegrity: listReferences,
    errors: detailedErrors,
  };
  console.log(JSON.stringify(output, (key, value) => value instanceof Set ? [...value] : value, 2));
  if (detailedErrors.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Read-only audit failed: ${error.message || error}`);
  process.exitCode = 1;
});
