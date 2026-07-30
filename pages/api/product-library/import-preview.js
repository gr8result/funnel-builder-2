import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { csvRecords, slugify } from "../../../lib/product-library/csv";
import { PRODUCT_LIBRARY_SCOPES, normalizeLibraryScope } from "../../../lib/product-library/constants";
import { validateSelectionsProductCsvRecord } from "../../../lib/product-library/selectionsClassification";
import { isValidProductUrl } from "../../../lib/product-library/urlValidation";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const csvText = String(req.body?.csvText || "");
    if (!csvText.trim()) return res.status(400).json({ ok: false, error: "No CSV content was provided." });

    const records = csvRecords(csvText);
    const { data: existingProducts, error } = await supabaseAdmin
      .from("builder_products")
      .select("id, product_name, sku, model")
      .eq("workspace_id", req.workspaceId);
    if (error) throw error;

    const existingByIdentity = new Map(
      (existingProducts || []).map((product) => [
        [product.sku, product.model, product.product_name].map((value) => slugify(value)).join("|"),
        product,
      ])
    );
    const existingBySku = new Map((existingProducts || []).filter((p) => p.sku).map((p) => [slugify(p.sku), p]));

    const matched = [];
    const created = [];
    const errors = [];
    const seenSkusInFile = new Set();

    records.forEach((record, index) => {
      const rowNumber = index + 2; // +1 for header row, +1 for 1-based
      const productName = String(record.product_name || "").trim();
      if (!productName) {
        errors.push({ row: rowNumber, error: "product_name is required", record });
        return;
      }
      const classification = validateSelectionsProductCsvRecord(record);
      if (!classification.ok) {
        errors.push({ row: rowNumber, error: classification.errors.join("; "), record });
        return;
      }
      const libraryScope = normalizeLibraryScope(record.library_scope, "CLIENT_SELECTION");
      if (!PRODUCT_LIBRARY_SCOPES.has(libraryScope)) {
        errors.push({ row: rowNumber, error: "Product Library imports only accept CLIENT_SELECTION or BOTH records", record });
        return;
      }
      const sku = String(record.internal_product_code || record.sku || "").trim();
      if (sku) {
        const skuKey = slugify(sku);
        if (seenSkusInFile.has(skuKey)) {
          errors.push({ row: rowNumber, error: `Duplicate product code "${sku}" within this file`, record });
          return;
        }
        seenSkusInFile.add(skuKey);
      }

      const supplierUrlCheck = isValidProductUrl(record.supplier_product_url);
      if (!supplierUrlCheck.ok) {
        errors.push({ row: rowNumber, error: `Supplier product URL: ${supplierUrlCheck.error}`, record });
        return;
      }
      const manufacturerUrlCheck = isValidProductUrl(record.manufacturer_product_url);
      if (!manufacturerUrlCheck.ok) {
        errors.push({ row: rowNumber, error: `Manufacturer product URL: ${manufacturerUrlCheck.error}`, record });
        return;
      }

      const identity = [sku, record.model, productName].map((value) => slugify(value)).join("|");
      const existing = existingByIdentity.get(identity) || (sku ? existingBySku.get(slugify(sku)) : null);
      if (existing) matched.push({ row: rowNumber, existingId: existing.id, record });
      else created.push({ row: rowNumber, record });
    });

    return res.status(200).json({
      ok: true,
      summary: { totalRows: records.length, matched: matched.length, new: created.length, errors: errors.length },
      matched,
      created,
      errors,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Could not preview the import." });
  }
}

export default withWorkspace(handler);
