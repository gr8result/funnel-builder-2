// Supplier price lists and product lists into ONE builder's configuration, in four explicit steps:
//
//   1 read      a CSV or Excel file becomes a table { columns, rows }       (readImportFile)
//   2 map       each column is mapped to a product field, suggested from the headings and
//               changeable by the builder                                   (suggestColumnMapping)
//   3 preview   every row is validated and matched against the builder's existing products by
//               its stable identity (supplier + SKU, or an import key). The result says exactly
//               what WOULD happen - NEW / UPDATE / UNCHANGED / INVALID / DUPLICATE - and which
//               fields would change. Nothing is written.                    (previewProductImport)
//   4 apply     the builder applies the rows they choose. The configuration must be the one that
//               was previewed, or the apply is refused.                     (applyProductImport)
//
// An import only ever changes the builder's configuration it is given. It cannot touch the master
// template, another builder, or any job: jobs keep the prices they were priced with.

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BuilderConfigError, assertBuilderConfig, masterDeltaFor, overrideMasterProduct, productMatchKey, supplierByName, upsertBuilderProduct, upsertSupplier } from "./builderConfig.js";

export const IMPORT_FIELDS = Object.freeze(["supplier", "supplierSku", "importKey", "masterProductCode", "name", "description", "brand", "range", "category", "subcategory", "unit", "cost", "price", "selectionSlot", "imageUrl", "active", "availability", "leadTimeDays"]);
const HEADINGS = {
  supplier: ["supplier", "vendor", "suppliername"], supplierSku: ["suppliersku", "sku", "itemcode", "productcode", "partnumber", "partno", "code", "stockcode"],
  importKey: ["importkey", "externalid", "stableid"], masterProductCode: ["masterproductcode", "gr8productcode", "mastercode"],
  name: ["productname", "name", "product", "itemname", "title"], description: ["description", "productdescription", "details"],
  brand: ["brand", "manufacturer", "make"], range: ["range", "collection", "series"], category: ["category", "productcategory", "group"], subcategory: ["subcategory", "subgroup"],
  unit: ["unit", "uom", "unitofmeasure"], cost: ["cost", "tradeprice", "suppliercost", "buildercost", "buyprice", "costprice", "costexgst"], price: ["price", "sellprice", "clientprice", "rrp", "retailprice"],
  selectionSlot: ["selectionslot", "selectioncategory"], imageUrl: ["imageurl", "image", "picture"], active: ["active", "enabled", "status"],
  availability: ["availability", "stock", "stockstatus"], leadTimeDays: ["leadtimedays", "leadtime", "leaddays"],
};
const norm = (value) => String(value ?? "").trim();
const headingKey = (value) => norm(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const MAX_ROWS = 20000;

// { columns, rows, sheets?, sheet? } from a .csv / .xlsx / .xls file. `content` is text (CSV) or
// bytes (Excel: Uint8Array / ArrayBuffer / Buffer).
export function readImportFile({ name = "", content, sheet = "" } = {}) {
  const excel = /\.(xlsx|xlsm|xls)$/i.test(name) || (content && typeof content !== "string");
  let table, sheets;
  if (excel) {
    const book = XLSX.read(content instanceof ArrayBuffer ? new Uint8Array(content) : content, { type: "array", cellDates: false });
    sheets = book.SheetNames;
    const chosen = sheet || sheets[0];
    if (!book.Sheets[chosen]) throw new BuilderConfigError(`The workbook has no sheet named "${chosen}".`, { sheets });
    table = XLSX.utils.sheet_to_json(book.Sheets[chosen], { header: 1, raw: false, defval: "", blankrows: false });
    sheet = chosen;
  } else {
    if (typeof content !== "string") throw new BuilderConfigError("A CSV file must be text.");
    const parsed = Papa.parse(content.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    if (parsed.errors.length) throw new BuilderConfigError(`The file could not be read: ${parsed.errors[0].message} (row ${parsed.errors[0].row + 1}).`);
    table = parsed.data;
  }
  const [columns, ...rows] = table;
  if (!columns?.length) throw new BuilderConfigError("The file has no heading row.");
  if (!rows.length) throw new BuilderConfigError("The file has a heading row but no products.");
  if (rows.length > MAX_ROWS) throw new BuilderConfigError(`The file has ${rows.length} rows; import at most ${MAX_ROWS} at a time.`);
  return { columns: columns.map(norm), rows: rows.map((row) => columns.map((_, index) => norm(row[index]))), ...(sheets ? { sheets, sheet } : {}) };
}

// { columnIndex: field | "" } - a starting point the builder can change before previewing.
export function suggestColumnMapping(columns = []) {
  const used = new Set();
  return Object.fromEntries(columns.map((column, index) => {
    const field = IMPORT_FIELDS.find((name) => !used.has(name) && HEADINGS[name].includes(headingKey(column))) || "";
    if (field) used.add(field);
    return [index, field];
  }));
}

function parseMoney(value, label, errors) {
  if (value === "" || value === undefined) return undefined;
  const cleaned = value.replace(/^\$\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned) || Number(cleaned) >= 1e9) { errors.push(`${label} "${value}" is not a valid amount.`); return undefined; }
  return Math.round(Number(cleaned) * 100) / 100;
}
const TRUE = ["true", "yes", "y", "1", "active", "enabled", "current"];
const FALSE = ["false", "no", "n", "0", "inactive", "disabled", "discontinued", "deleted"];
const COMPARED = ["supplierId", "supplierSku", "importKey", "name", "description", "brand", "range", "categoryKey", "subcategory", "unit", "cost", "price", "selectionSlotIds", "imageUrl", "active", "availability", "leadTimeDays"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// mapping: { columnIndex: field }. defaults: { supplierId } for a price list that has no supplier
// column (the whole file is one supplier's). masterProductCodes: Set of master template codes,
// so a row may update the builder's price for a master product.
// selectionSlots: the selection slot ids that exist, so a typo is reported and not stored.
export function previewProductImport({ config, table, mapping = null, defaults = {}, masterProductCodes = new Set(), selectionSlots = null, createSuppliers = true } = {}) {
  assertBuilderConfig(config);
  if (!table?.columns?.length) throw new BuilderConfigError("Read a file first.");
  mapping = mapping || suggestColumnMapping(table.columns);
  const fields = Object.values(mapping).filter(Boolean);
  const unknown = fields.find((field) => !IMPORT_FIELDS.includes(field));
  if (unknown) throw new BuilderConfigError(`"${unknown}" is not a field products can be imported into.`);
  const twice = fields.find((field, index) => fields.indexOf(field) !== index);
  if (twice) throw new BuilderConfigError(`Two columns are mapped to "${twice}". Map each field once.`);
  if (defaults.supplierId && !config.suppliers.some((supplier) => supplier.id === defaults.supplierId)) throw new BuilderConfigError("The supplier chosen for this file is not in this builder's configuration.");
  if (!fields.includes("supplierSku") && !fields.includes("importKey") && !fields.includes("masterProductCode")) throw new BuilderConfigError("Map a SKU column (with a supplier), an Import Key column or a Master Product Code column: products are matched by a stable identity, never by description.");

  const existingByKey = new Map();
  for (const product of config.products) { if (product.source !== "builder" || product.removed) continue; const key = productMatchKey(product); if (key) existingByKey.set(key, product); }
  const newSuppliers = new Map();   // lower-case name -> name as written
  const rows = table.rows.map((cells, index) => {
    const value = {};
    for (const [column, field] of Object.entries(mapping)) if (field) value[field] = norm(cells[column]);
    const errors = [], warnings = [];
    const input = {};
    // supplier: an existing one of THIS builder, the file's default, or a new one to be created
    let supplierId = "", supplierPending = "";
    if (value.supplier) {
      const found = supplierByName(config, value.supplier);
      if (found) supplierId = found.id;
      else if (createSuppliers) { supplierPending = value.supplier; if (!newSuppliers.has(value.supplier.toLowerCase())) newSuppliers.set(value.supplier.toLowerCase(), value.supplier); }
      else errors.push(`Supplier "${value.supplier}" is not one of this builder's suppliers.`);
    } else if (defaults.supplierId) supplierId = defaults.supplierId;
    const cost = parseMoney(value.cost, "Cost", errors), price = parseMoney(value.price, "Price", errors);
    if (cost !== undefined) input.cost = cost;
    if (price !== undefined) input.price = price;
    if (value.active) { const flag = value.active.toLowerCase(); if (TRUE.includes(flag)) input.active = true; else if (FALSE.includes(flag)) input.active = false; else errors.push(`Active "${value.active}" is not yes or no.`); }
    if (value.leadTimeDays) { if (/^\d{1,3}$/.test(value.leadTimeDays)) input.leadTimeDays = Number(value.leadTimeDays); else errors.push(`Lead time "${value.leadTimeDays}" is not a number of days.`); }
    if (value.imageUrl) { try { if (!["https:", "http:"].includes(new URL(value.imageUrl).protocol)) throw new Error(); input.imageUrl = value.imageUrl; } catch { errors.push("Image URL must start with http:// or https://."); } }
    if (value.selectionSlot) { if (selectionSlots && !selectionSlots.includes(value.selectionSlot)) warnings.push(`Selection slot "${value.selectionSlot}" is not known; the product will be imported without one.`); else input.selectionSlotIds = [value.selectionSlot]; }
    for (const [field, target] of [["name", "name"], ["description", "description"], ["brand", "brand"], ["range", "range"], ["category", "categoryKey"], ["subcategory", "subcategory"], ["unit", "unit"], ["availability", "availability"]]) if (value[field]) input[target] = value[field];

    // identity
    let target = null, key = "", kind = "builder";
    if (value.masterProductCode) {
      kind = "master"; key = `master|${value.masterProductCode.toLowerCase()}`;
      if (!masterProductCodes.has(value.masterProductCode)) errors.push(`"${value.masterProductCode}" is not a GR8 Result master template product.`);
      else target = masterDeltaFor(config, value.masterProductCode);
      if (supplierId) input.supplierId = supplierId;
      if (value.supplierSku) input.supplierSku = value.supplierSku;
    } else {
      if (value.supplierSku && (supplierId || supplierPending)) key = supplierId ? productMatchKey({ supplierId, supplierSku: value.supplierSku }) : `sku|new:${supplierPending.toLowerCase()}|${value.supplierSku.toLowerCase()}`;
      else if (value.importKey) key = productMatchKey({ importKey: value.importKey });
      if (!key) errors.push(value.supplierSku ? "A SKU needs a supplier: add a supplier column or choose the supplier for this file." : "A SKU (with supplier) or an Import Key is required. Descriptions are never used to match products.");
      target = key ? existingByKey.get(key) || null : null;
      if (supplierId) input.supplierId = supplierId;
      if (value.supplierSku) input.supplierSku = value.supplierSku;
      if (value.importKey) input.importKey = value.importKey;
      if (!target && !input.name && !input.description) errors.push("A new product needs a name.");
      if (!target && !input.name && input.description) input.name = input.description;
    }
    const changes = COMPARED.filter((field) => input[field] !== undefined && !same(target?.[field], input[field])).map((field) => ({ field, from: target?.[field] ?? null, to: input[field] }));
    const action = errors.length ? "INVALID" : !target && kind === "builder" ? "NEW" : changes.length || supplierPending ? "UPDATE" : "UNCHANGED";
    return { row: index + 2, action, kind, key, errors, warnings, productId: target?.id || "", masterProductCode: value.masterProductCode || "", supplierPending, input, changes, name: input.name || target?.name || value.masterProductCode || "" };
  });
  // the same product twice in one file is never guessed at
  const count = new Map();
  for (const row of rows) if (row.key) count.set(row.key, (count.get(row.key) || 0) + 1);
  for (const row of rows) if (row.key && count.get(row.key) > 1 && row.action !== "INVALID") { row.action = "DUPLICATE"; row.errors.push("This product appears more than once in the file."); }
  const report = Object.fromEntries(["NEW", "UPDATE", "UNCHANGED", "INVALID", "DUPLICATE"].map((action) => [action, rows.filter((row) => row.action === action).length]));
  return { builderId: config.builderId, basedOnChanges: config.changes || 0, mapping, rows, newSuppliers: [...newSuppliers.values()], report: { rowsRead: rows.length, ...report, priceChanges: rows.filter((row) => row.action === "UPDATE" && row.changes.some((change) => change.field === "cost" || change.field === "price")).length } };
}

// Applies the previewed rows the builder chose (all NEW / UPDATE rows when `rows` is omitted).
// Returns { config, applied: { created, updated, suppliersCreated }, productIds }.
export function applyProductImport(config, preview, { rows = null, now } = {}) {
  assertBuilderConfig(config, preview?.builderId);
  if ((config.changes || 0) !== preview.basedOnChanges) throw new BuilderConfigError("The configuration changed after this preview was made. Preview the file again before applying it.");
  const chosen = preview.rows.filter((row) => (rows ? rows.includes(row.row) : ["NEW", "UPDATE"].includes(row.action)));
  const refused = chosen.find((row) => !["NEW", "UPDATE", "UNCHANGED"].includes(row.action));
  if (refused) throw new BuilderConfigError(`Row ${refused.row} cannot be imported: ${refused.errors[0] || refused.action}.`);
  let next = config, suppliersCreated = 0, created = 0, updated = 0;
  const productIds = {};
  for (const row of chosen) {
    if (row.action === "UNCHANGED") { productIds[row.row] = row.productId; continue; }
    const input = { ...row.input };
    if (row.supplierPending) {
      let supplier = supplierByName(next, row.supplierPending);
      if (!supplier) { next = upsertSupplier(next, { name: row.supplierPending }, { now }); supplier = supplierByName(next, row.supplierPending); suppliersCreated += 1; }
      input.supplierId = supplier.id;
    }
    if (row.kind === "master") { next = overrideMasterProduct(next, row.masterProductCode, input, { now }); productIds[row.row] = `master:${row.masterProductCode}`; updated += 1; continue; }
    const before = new Set(next.products.map((product) => product.id));
    next = upsertBuilderProduct(next, row.productId ? { ...input, id: row.productId } : input, { now });
    productIds[row.row] = row.productId || next.products.find((product) => !before.has(product.id)).id;
    if (row.productId) updated += 1; else created += 1;
  }
  return { config: next, applied: { created, updated, suppliersCreated }, productIds };
}
