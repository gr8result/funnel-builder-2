import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { csvRecords, slugify, normalizeMoney, truthyCsv, normalizePriceBand, normalizePricingTierCsv } from "../../../lib/product-library/csv";
import { PRODUCT_LIBRARY_SCOPES, VERIFICATION_STATUSES, defaultRequiresImageForCategory, normalizeLibraryScope } from "../../../lib/product-library/constants";
import { roundMoney } from "../../../lib/builders/selectionBudget";
import { isValidProductUrl } from "../../../lib/product-library/urlValidation";

const VALID_VERIFICATION_STATUSES = new Set(VERIFICATION_STATUSES.map((entry) => entry.value));

function splitImageUrls(value) {
  return String(value || "")
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const VALID_APPLY_MODES = new Set(["upsert", "create_only", "update_only"]);

async function ensureLookup(table, nameColumn, name, workspaceId, cache, extraInsertFields = {}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  const key = slugify(cleanName);
  if (cache.has(key)) return cache.get(key);
  const { data: existing } = await supabaseAdmin
    .from(table)
    .select("id")
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .ilike(nameColumn, cleanName)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const insertPayload = { workspace_id: workspaceId, [nameColumn]: cleanName, active: true, ...extraInsertFields };
  if (table === "builder_product_categories") insertPayload.category_key = key;
  const { data: created, error } = await supabaseAdmin.from(table).insert(insertPayload).select("id").single();
  if (error) throw error;
  cache.set(key, created.id);
  return created.id;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const csvText = String(req.body?.csvText || "");
    const applyMode = VALID_APPLY_MODES.has(req.body?.applyMode) ? req.body.applyMode : "upsert";
    if (!csvText.trim()) return res.status(400).json({ ok: false, error: "No CSV content was provided." });

    const records = csvRecords(csvText);
    const { data: categories } = await supabaseAdmin
      .from("builder_product_categories")
      .select("id, category_key, metadata")
      .or(`workspace_id.is.null,workspace_id.eq.${req.workspaceId}`);
    const { data: existingProducts } = await supabaseAdmin
      .from("builder_products")
      .select("id, product_name, sku, model")
      .eq("workspace_id", req.workspaceId);

    const existingByIdentity = new Map(
      (existingProducts || []).map((product) => [
        [product.sku, product.model, product.product_name].map((value) => slugify(value)).join("|"),
        product,
      ])
    );
    const existingBySku = new Map((existingProducts || []).filter((p) => p.sku).map((p) => [slugify(p.sku), p]));
    const categoryByKey = new Map((categories || []).map((category) => [category.category_key, category]));

    const categoryCache = new Map();
    const manufacturerCache = new Map();
    const supplierCache = new Map();
    const seenSkusInFile = new Set();

    const { data: batch } = await supabaseAdmin
      .from("builder_product_import_batches")
      .insert({
        workspace_id: req.workspaceId,
        source_name: "csv-import",
        source_type: "csv",
        file_name: req.body?.fileName || "import.csv",
        imported_count: records.length,
        status: "processing",
      })
      .select("id")
      .single();

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        const productName = String(record.product_name || "").trim();
        if (!productName) throw new Error("product_name is required");
        const libraryScope = normalizeLibraryScope(record.library_scope, "CLIENT_SELECTION");
        if (!PRODUCT_LIBRARY_SCOPES.has(libraryScope)) {
          throw new Error("Product Library imports only accept CLIENT_SELECTION or BOTH records");
        }
        const sku = String(record.internal_product_code || record.sku || "").trim();
        if (sku) {
          const skuKey = slugify(sku);
          if (seenSkusInFile.has(skuKey)) throw new Error(`Duplicate product code "${sku}" within this file`);
          seenSkusInFile.add(skuKey);
        }

        const supplierUrlCheck = isValidProductUrl(record.supplier_product_url);
        if (!supplierUrlCheck.ok) throw new Error(`Supplier product URL: ${supplierUrlCheck.error}`);
        const manufacturerUrlCheck = isValidProductUrl(record.manufacturer_product_url);
        if (!manufacturerUrlCheck.ok) throw new Error(`Manufacturer product URL: ${manufacturerUrlCheck.error}`);

        const identity = [sku, record.model, productName].map((value) => slugify(value)).join("|");
        const existing = existingByIdentity.get(identity) || (sku ? existingBySku.get(slugify(sku)) : null);
        if (existing && applyMode === "create_only") throw new Error("Row matches an existing product and applyMode is create_only");
        if (!existing && applyMode === "update_only") throw new Error("Row does not match an existing product and applyMode is update_only");

        const categoryId = record.category
          ? await ensureLookup("builder_product_categories", "category_name", record.category, req.workspaceId, categoryCache, {
              selection_group: record.selection_group || null,
            })
          : null;
        const manufacturerId = record.brand || record.manufacturer
          ? await ensureLookup("builder_product_manufacturers", "manufacturer_name", record.brand || record.manufacturer, req.workspaceId, manufacturerCache)
          : null;
        const supplierId = record.supplier
          ? await ensureLookup("builder_product_suppliers", "supplier_name", record.supplier, req.workspaceId, supplierCache)
          : null;

        const category = categoryId ? categories?.find((entry) => entry.id === categoryId) || categoryByKey.get(slugify(record.category)) : null;
        const isVisual = record.visual_product ? truthyCsv(record.visual_product) : defaultRequiresImageForCategory(category);
        const requiresImage = record.requires_image ? truthyCsv(record.requires_image) : isVisual;

        const costPrice = normalizeMoney(record.cost);
        const includedAllowance = normalizeMoney(record.included_allowance) ?? 0;
        const manualUpgradeValue = normalizeMoney(record.upgrade_value);
        const upgradeValueMode = manualUpgradeValue !== null ? "manual" : "auto";
        const upgradeCost = upgradeValueMode === "manual"
          ? roundMoney(manualUpgradeValue)
          : roundMoney((costPrice ?? 0) - includedAllowance);

        const payload = {
          workspace_id: req.workspaceId,
          product_name: productName,
          pricing_tier: normalizePricingTierCsv(record.pricing_tier),
          category_id: categoryId,
          subcategory: record.subcategory || null,
          manufacturer_id: manufacturerId,
          supplier_id: supplierId,
          sku: sku || null,
          model: record.model || null,
          colour: record.colour || null,
          finish: record.finish || null,
          size_dimensions: record.size || null,
          description: record.description || null,
          notes: record.notes || null,
          client_notes: record.client_notes || null,
          is_visual_product: isVisual,
          requires_image: requiresImage,
          library_scope: libraryScope,
          cost_price: costPrice,
          base_allowance: includedAllowance,
          upgrade_value_mode: upgradeValueMode,
          upgrade_cost: upgradeCost,
          retail_price: normalizeMoney(record.rrp),
          gst_included: truthyCsv(record.gst_included, true),
          sell_price: normalizeMoney(record.sell_price ?? record.rrp),
          markup_percent: normalizeMoney(record.markup),
          pricing_mode: record.markup ? "markup" : "fixed_sell",
          price_band: normalizePriceBand(record.price_band),
          standard_included: truthyCsv(record.standard_included, false),
          available_for_selection: truthyCsv(record.available_for_selection, true),
          display_order: Number(record.display_order) || 0,
          primary_image_url: record.image_url || null,
          additional_image_urls: splitImageUrls(record.additional_image_urls),
          product_url: supplierUrlCheck.url || null,
          manufacturer_product_url: manufacturerUrlCheck.url || null,
          image_source_url: record.image_source_url || null,
          verification_status: VALID_VERIFICATION_STATUSES.has(record.image_verification_status) ? record.image_verification_status : "unverified",
          date_last_verified: record.date_last_verified || null,
          datasheet_pdf_url: record.spec_pdf_url || null,
          active: truthyCsv(record.active, true),
          updated_at: new Date().toISOString(),
        };

        const request = existing?.id
          ? supabaseAdmin.from("builder_products").update(payload).eq("workspace_id", req.workspaceId).eq("id", existing.id).select("id").single()
          : supabaseAdmin.from("builder_products").insert(payload).select("id").single();
        const { data: saved, error: saveError } = await request;
        if (saveError) throw saveError;
        if (existing?.id) updated += 1;
        else created += 1;
        existingByIdentity.set(identity, { id: saved.id, product_name: productName, sku, model: record.model });
        if (sku) existingBySku.set(slugify(sku), { id: saved.id });
      } catch (rowError) {
        errors.push({ row: rowNumber, error: rowError?.message || "Import failed for this row.", record });
      }
    }

    const report = { totalRows: records.length, created, updated, errorCount: errors.length, errors };

    if (batch?.id) {
      await supabaseAdmin
        .from("builder_product_import_batches")
        .update({ created_count: created, updated_count: updated, status: "completed" })
        .eq("workspace_id", req.workspaceId)
        .eq("id", batch.id);
      await supabaseAdmin.from("builder_product_library_import_reports").insert({
        workspace_id: req.workspaceId,
        batch_id: batch.id,
        report,
        created_by: req.user.id,
      });
    }

    return res.status(200).json({ ok: true, ...report });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Could not import products." });
  }
}

export default withWorkspace(handler);
