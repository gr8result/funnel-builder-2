import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace, INTERNAL_COMMERCIAL_ROLES } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const workspaceId = req.workspaceId;
  const projectId = String(req.body?.projectId || "").trim();
  const selectionBookId = String(req.body?.selectionBookId || "").trim();
  if (!projectId || !selectionBookId) return res.status(400).json({ ok: false, error: "A cloud project and saved Selections Book are required." });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return res.status(400).json({ ok: false, error: "Portal publication requires a valid cloud project." });
  }

  const { data: savedBook, error: bookError } = await supabaseAdmin
    .from("builder_selection_books")
    .select("id, workspace_id, project_id, book_data")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("id", selectionBookId)
    .single();
  if (bookError || !savedBook) return res.status(404).json({ ok: false, error: "The saved Selections Book was not found in this workspace and project." });

  const { data: portalSettings, error: settingsError } = await supabaseAdmin
    .from("client_portal_settings")
    .select("portal_enabled")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (settingsError) return res.status(500).json({ ok: false, error: settingsError.message || "Could not verify Client Portal settings." });
  if (portalSettings?.portal_enabled !== true) return res.status(409).json({ ok: false, error: "Enable this project's Client Portal before publishing selections." });

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("builder_client_selections")
    .select("id, is_active, metadata, selected_details")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);
  if (rowsError) return res.status(500).json({ ok: false, error: rowsError.message || "Could not verify saved selections." });

  const bookRows = (savedBook.book_data?.rooms || []).flatMap((room) => room.rows || []).filter((row) => {
    const selection = row.guidedSelection || {};
    if (row.internalOnly === true || selection.internalOnly === true) return false;
    if (selection.displayInSelectionsSchedule === false || selection.notApplicable && selection.clientDecisionRequired === false) return false;
    return Boolean(row.selectedProduct || row.productModel || row.supplier || row.imageUrl || selection.productName || selection.selectedProduct || selection.configurationComplete || selection.exteriorColourSelection?.areas?.some((area) => area?.applicable !== false && (area.colourSelection?.colourName || area.linkedComponentId || area.confirmationStatus)) || selection.externalLightingSelection?.lineItems?.length || selection.windowWorkflow?.effectiveWindows?.length);
  });
  const rowByBookRowId = new Map((rows || [])
    .filter((row) => row.is_active !== false && row.metadata?.selection_book_id === selectionBookId && row.metadata?.selection_book_row_id)
    .map((row) => [row.metadata.selection_book_row_id, row]));
  const missing = bookRows.filter((row) => !rowByBookRowId.has(row.id));
  if (missing.length) return res.status(409).json({ ok: false, error: `${missing.length} selection${missing.length === 1 ? " is" : "s are"} not confirmed in the project database yet. Save again before publishing.` });

  const publishRows = bookRows.map((row) => rowByBookRowId.get(row.id)).filter((row) => row.is_active !== false && row.metadata?.internalOnly !== true && row.selected_details?.internalOnly !== true && row.selected_details?.displayInSelectionsSchedule !== false);
  if (!publishRows.length) return res.status(409).json({ ok: false, error: "There are no saved client selections to publish." });
  const publishedAt = new Date().toISOString();
  const { data: publishedRows, error: publishError } = await supabaseAdmin
    .from("builder_client_selections")
    .update({ client_visible: true, client_status: "awaiting_client", updated_by: req.user.id, updated_at: publishedAt })
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .in("id", publishRows.map((row) => row.id))
    .select("id");
  if (publishError || publishedRows?.length !== publishRows.length) {
    return res.status(500).json({ ok: false, error: publishError?.message || "The server could not confirm publication of every saved selection." });
  }

  return res.status(200).json({ ok: true, publishedCount: publishedRows.length, publishedAt });
}

export default withWorkspace(handler, { roles: INTERNAL_COMMERCIAL_ROLES });