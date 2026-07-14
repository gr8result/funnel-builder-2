import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

export const config = {
  api: {
    bodyParser: { sizeLimit: "12mb" },
  },
};

function s(value) {
  return String(value ?? "").trim();
}

function email(value) {
  return s(value).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email(value));
}

function columnFromError(error) {
  const msg = String(error?.message || error?.details || "");
  return (
    msg.match(/'([^']+)' column/)?.[1] ||
    msg.match(/column "([^"]+)"/)?.[1] ||
    msg.match(/Could not find the '([^']+)'/)?.[1] ||
    ""
  );
}

function supabaseErrorMessage(error) {
  if (!error) return "";
  return [
    error.message,
    error.details,
    error.hint,
    error.code ? `code=${error.code}` : "",
  ].filter(Boolean).join(" | ");
}

function logImport(label, payload = {}) {
  console.error(`[lead-import-csv] ${label}`, JSON.stringify(payload, null, 2));
}

function isMissingColumn(error, column) {
  return String(error?.message || error?.details || "").toLowerCase().includes(column.toLowerCase());
}

async function findLeadListByName({ workspaceId, userId, name }) {
  const byWorkspace = await supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  if (!byWorkspace.error || !isMissingColumn(byWorkspace.error, "workspace_id")) return byWorkspace;

  return supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
}

async function findLeadListById({ workspaceId, userId, id }) {
  const byWorkspace = await supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!byWorkspace.error || !isMissingColumn(byWorkspace.error, "workspace_id")) return byWorkspace;

  return supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
}

async function insertRowsAdaptive(rows, context = {}) {
  let current = rows.map((row) => ({ ...row }));
  let lastError = null;
  const removedColumns = [];

  for (let attempt = 0; attempt < 50; attempt += 1) {
    logImport("insert attempt", {
      table: "leads",
      attempt: attempt + 1,
      rowCount: current.length,
      columns: Object.keys(current[0] || {}),
      removedColumns,
      list_id: context.listId,
      user_id: context.userId,
      workspace_id: context.workspaceId,
      samplePayload: current[0] || null,
    });

    const { data, error } = await supabaseAdmin.from("leads").insert(current).select("*");
    if (!error) return { data: data || [], error: null };

    lastError = error;
    logImport("insert error", {
      table: "leads",
      attempt: attempt + 1,
      error,
      errorMessage: supabaseErrorMessage(error),
      samplePayload: current[0] || null,
      list_id: context.listId,
      user_id: context.userId,
      workspace_id: context.workspaceId,
    });

    const column = columnFromError(error);
    if (!column || !current.some((row) => column in row)) return { data: [], error };
    removedColumns.push(column);
    current = current.map((row) => {
      const next = { ...row };
      delete next[column];
      return next;
    });
  }

  const error = new Error(
    lastError
      ? `Lead insert failed after schema adaptation: ${supabaseErrorMessage(lastError)}`
      : "Lead insert failed after schema adaptation."
  );
  error.details = { removedColumns, lastError };
  return { data: [], error };
}

async function insertRowsWithDiagnostics(rows, context = {}) {
  const bulk = await insertRowsAdaptive(rows, context);
  if (!bulk.error) return bulk;

  const inserted = [];
  const failedRows = [];

  logImport("bulk insert failed, retrying row-by-row", {
    table: "leads",
    rowCount: rows.length,
    errorMessage: bulk.error.message,
    errorDetails: bulk.error.details || null,
    list_id: context.listId,
    user_id: context.userId,
    workspace_id: context.workspaceId,
  });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const result = await insertRowsAdaptive([row], { ...context, rowIndex: index });
    if (!result.error) {
      inserted.push(...(result.data || []));
      continue;
    }

    failedRows.push({
      row: context.startRow ? context.startRow + index : index + 1,
      email: row.email || "",
      error: result.error.message,
      details: result.error.details || null,
      payload: row,
    });
  }

  if (failedRows.length) {
    const first = failedRows[0];
    const error = new Error(`Lead insert failed on row ${first.row}${first.email ? ` (${first.email})` : ""}: ${first.error}`);
    error.failedRows = failedRows;
    error.inserted = inserted;
    return { data: inserted, error };
  }

  return { data: inserted, error: null };
}

async function createLeadListAdaptive({ userId, workspaceId, name, color = "#2563eb" }) {
  let row = {
    user_id: userId,
    workspace_id: workspaceId,
    name,
    source_type: "csv_import",
    tags: null,
    action: "CRM",
    auto_add_crm: true,
    color,
    color_tag: color,
    created_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    logImport("create list attempt", {
      table: "lead_lists",
      attempt: attempt + 1,
      payload: row,
      user_id: userId,
      workspace_id: workspaceId,
    });
    const { data, error } = await supabaseAdmin.from("lead_lists").insert(row).select("*").single();
    if (!error) return { data, error: null };
    logImport("create list error", {
      table: "lead_lists",
      attempt: attempt + 1,
      error,
      errorMessage: supabaseErrorMessage(error),
      payload: row,
      user_id: userId,
      workspace_id: workspaceId,
    });
    const column = columnFromError(error);
    if (!column || !(column in row)) return { data: null, error };
    const next = { ...row };
    delete next[column];
    row = next;
  }

  return { data: null, error: new Error("Could not create lead list") };
}

async function updateLeadAdaptive(id, workspaceId, fields) {
  let current = { ...fields };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    logImport("update attempt", {
      table: "leads",
      attempt: attempt + 1,
      id,
      workspace_id: workspaceId,
      payload: current,
    });
    const { error } = await supabaseAdmin
      .from("leads")
      .update(current)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (!error) return null;
    logImport("update error", {
      table: "leads",
      attempt: attempt + 1,
      id,
      workspace_id: workspaceId,
      error,
      errorMessage: supabaseErrorMessage(error),
      payload: current,
    });
    const column = columnFromError(error);
    if (!column || !(column in current)) return error;
    delete current[column];
  }
  return new Error("Could not update lead");
}

function buildLead(row, { userId, workspaceId, listId }) {
  const firstName = s(row.first_name || row.firstName || row["First Name"]);
  const lastName = s(row.last_name || row.lastName || row["Last Name"]);
  const fullName = s(row.name || row.full_name || [firstName, lastName].filter(Boolean).join(" "));
  const tags = s(row.tags || row.Tags);
  const source = s(row.lead_source || row.source || row["Lead Source"]) || "CSV Import";
  const customFields = row.custom_fields && typeof row.custom_fields === "object" ? row.custom_fields : {};

  return {
    user_id: userId,
    workspace_id: workspaceId,
    list_id: listId,
    list: listId,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    name: fullName || email(row.email),
    company: s(row.company) || null,
    email: email(row.email),
    phone: s(row.phone) || null,
    mobile: s(row.mobile) || null,
    address: s(row.address) || null,
    city: s(row.city) || null,
    state: s(row.state) || null,
    postcode: s(row.postcode || row.zip) || null,
    country: s(row.country) || null,
    website: s(row.website) || null,
    tags,
    notes: s(row.notes) || null,
    source,
    lead_source: source,
    custom_fields: customFields,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { workspaceId, user } = req;

  try {
    const {
      list_id: providedListId,
      createNewListName,
      newListName,
      listColor = "#2563eb",
      leads,
      duplicateMode = "update",
    } = req.body || {};
    let listId = s(providedListId);
    const requestedNewListName = s(createNewListName || newListName);

    if (!listId && !requestedNewListName) {
      return res.status(400).json({ ok: false, error: "Select a list or enter a new list name." });
    }
    if (!Array.isArray(leads) || !leads.length) {
      return res.status(400).json({ ok: false, error: "No leads provided" });
    }

    logImport("request received", {
      table: "leads",
      providedListId,
      createNewListName: requestedNewListName,
      leadsCount: leads.length,
      duplicateMode,
      user_id: user?.id,
      workspace_id: workspaceId,
      firstIncomingRow: leads[0] || null,
    });

    let list = null;
    if (!listId && requestedNewListName) {
      const created = await createLeadListAdaptive({
        userId: user.id,
        workspaceId,
        name: requestedNewListName,
        color: s(listColor) || "#2563eb",
      });
      if (created.error || !created.data?.id) {
        const existing = await findLeadListByName({
          workspaceId,
          userId: user.id,
          name: requestedNewListName,
        });
        if (existing.data?.id) {
          list = existing.data;
          listId = existing.data.id;
          logImport("new list name already exists, reusing existing list", {
            table: "lead_lists",
            list,
            list_id: listId,
            user_id: user.id,
            workspace_id: workspaceId,
            originalError: created.error ? supabaseErrorMessage(created.error) : "",
          });
        } else {
          return res.status(500).json({
            ok: false,
            error: created.error?.message || existing.error?.message || "New list creation failed.",
            details: created.error ? supabaseErrorMessage(created.error) : existing.error ? supabaseErrorMessage(existing.error) : "",
          });
        }
      }
      if (created.data?.id) {
        list = created.data;
        listId = created.data.id;
        logImport("new list created", {
          table: "lead_lists",
          list,
          list_id: listId,
          user_id: user.id,
          workspace_id: workspaceId,
        });
      }
    } else {
      const result = await findLeadListById({
        workspaceId,
        userId: user.id,
        id: listId,
      });
      if (result.error) {
        logImport("list lookup error", {
          table: "lead_lists",
          list_id: listId,
          user_id: user.id,
          workspace_id: workspaceId,
          error: result.error,
          errorMessage: supabaseErrorMessage(result.error),
        });
      }
      list = result.data;
    }

    if (!list) return res.status(404).json({ ok: false, error: "List not found" });

    const invalidRows = [];
    const normalised = [];
    const seenInFile = new Set();

    leads.forEach((row, index) => {
      const csvRowNumber = index + 2;
      if (!validEmail(row?.email)) {
        invalidRows.push({ row: csvRowNumber, email: row?.email || "", phone: row?.phone || "", reason: "Invalid or missing email", data: row });
        return;
      }
      const key = email(row.email);
      if (seenInFile.has(key) && duplicateMode !== "allow" && duplicateMode !== "allow_duplicates") {
        invalidRows.push({ row: csvRowNumber, email: key, phone: row?.phone || "", reason: `Duplicate email in CSV: ${key}`, data: row });
        return;
      }
      seenInFile.add(key);
      normalised.push({ ...buildLead(row, { userId: user.id, workspaceId, listId }), __csvRow: csvRowNumber });
    });

    logImport("normalised rows", {
      table: "leads",
      normalisedCount: normalised.length,
      invalidRows,
      samplePayload: normalised[0] || null,
      list_id: listId,
      user_id: user.id,
      workspace_id: workspaceId,
    });

    const existingByEmail = new Map();
    const emails = normalised.map((row) => row.email);
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("email", chunk);
      (data || []).forEach((row) => existingByEmail.set(email(row.email), row));
    }

    const toInsert = [];
    const toUpdate = [];
    const skippedRows = [];
    const updatedRows = [];

    for (const lead of normalised) {
      const existing = existingByEmail.get(lead.email);
      const { __csvRow, ...leadPayload } = lead;
      if (!existing || duplicateMode === "allow" || duplicateMode === "allow_duplicates") {
        toInsert.push(leadPayload);
        continue;
      }
      if (duplicateMode === "update") {
        toUpdate.push({ id: existing.id, fields: leadPayload });
        updatedRows.push({
          row: __csvRow,
          email: lead.email,
          phone: lead.phone || "",
          reason: `Existing contact updated and attached to list: ${lead.email}`,
          existingLeadId: existing.id,
          duplicateField: "email",
        });
      } else if (duplicateMode === "merge") {
        const merged = { ...leadPayload };
        Object.keys(merged).forEach((key) => {
          if (existing[key] && !["list_id", "list", "updated_at"].includes(key)) {
            merged[key] = existing[key];
          }
        });
        toUpdate.push({ id: existing.id, fields: merged });
        updatedRows.push({
          row: __csvRow,
          email: lead.email,
          phone: lead.phone || "",
          reason: `Existing contact merged and attached to list: ${lead.email}`,
          existingLeadId: existing.id,
          duplicateField: "email",
        });
      } else {
        skippedRows.push({
          row: __csvRow,
          email: lead.email,
          phone: lead.phone || "",
          reason: `Duplicate email already exists in this workspace: ${lead.email}`,
          existingLeadId: existing.id,
          duplicateField: "email",
        });
      }
    }

    logImport("duplicate analysis", {
      table: "leads",
      normalisedCount: normalised.length,
      toInsertCount: toInsert.length,
      toUpdateCount: toUpdate.length,
      skippedDuplicates: skippedRows.length,
      skippedRows,
      updatedRows,
      duplicateMode,
      existingEmails: [...existingByEmail.keys()],
      list_id: listId,
      user_id: user.id,
      workspace_id: workspaceId,
    });

    let importedCount = 0;
    const insertFailures = [];
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { data, error } = await insertRowsWithDiagnostics(chunk, {
        listId,
        userId: user.id,
        workspaceId,
        startRow: i + 2,
      });
      if (error) {
        insertFailures.push(...(error.failedRows || []));
        return res.status(500).json({
          ok: false,
          error: error.message || "Import insert failed",
          details: error.details || null,
          failedRows: error.failedRows || [],
          insertedBeforeFailure: error.inserted?.length || data?.length || 0,
          debug: {
            table: "leads",
            list_id: listId,
            user_id: user.id,
            workspace_id: workspaceId,
            samplePayload: chunk[0] || null,
          },
        });
      }
      importedCount += data.length;
    }

    let updatedCount = 0;
    const failedRows = [];
    for (const item of toUpdate) {
      const error = await updateLeadAdaptive(item.id, workspaceId, item.fields);
      if (!error) {
        updatedCount += 1;
      } else {
        const rowReport = updatedRows.find((row) => row.existingLeadId === item.id);
        failedRows.push({
          row: rowReport?.row || null,
          email: item.fields.email || "",
          phone: item.fields.phone || "",
          error: error.message || "Update existing contact failed",
          reason: error.message || "Update existing contact failed",
          payload: item.fields,
        });
      }
    }

    const { data: listLeads, error: listLeadsError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("list_id", listId)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (listLeadsError) {
      logImport("post-import list lead reload error", {
        table: "leads",
        list_id: listId,
        user_id: user.id,
        workspace_id: workspaceId,
        error: listLeadsError,
        errorMessage: supabaseErrorMessage(listLeadsError),
      });
    }

    const report = {
      totalRows: leads.length,
      importedRows: importedCount,
      updatedRows: updatedCount,
      skippedDuplicateRows: skippedRows.length,
      invalidRows: invalidRows.length,
      failedRows: failedRows.length,
      skippedRows,
      updatedRowDetails: updatedRows,
      invalidRowDetails: invalidRows,
      failedRowDetails: failedRows,
    };

    logImport("import complete", {
      table: "leads",
      report,
      list_id: listId,
      user_id: user.id,
      workspace_id: workspaceId,
      listLeadCount: Array.isArray(listLeads) ? listLeads.length : null,
    });

    return res.status(200).json({
      ok: true,
      importedCount,
      updatedCount,
      skippedDuplicates: skippedRows.length,
      skippedRows,
      invalidRows,
      failedRows,
      processedCount: leads.length,
      report,
      list: { ...list, lead_count: Array.isArray(listLeads) ? listLeads.length : importedCount + updatedCount },
      list_id: listId,
      leads: listLeads || [],
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Unexpected import error" });
  }
}

export default withWorkspace(handler);
