import { useEffect, useState } from "react";
import { roundMoney } from "../builders/selectionBudget.js";

export {
  slugify,
  normalizeMoney,
  truthyCsv,
  normalizePriceBand,
  normalizeSelectionVisibilityCsv,
  csvCell,
  parseCsv,
  csvRecords,
  PRODUCT_CSV_HEADERS,
} from "./csv.js";
export {
  normalizeSelectionVisibility,
  normalizeActiveStatus,
  normalizeDiscontinuedStatus,
  selectionVisibilityFlags,
  isSelectionsCatalogueProduct,
  selectionVisibilityToLegacyScope,
} from "./selectionVisibility.js";
import { csvCell } from "./csv.js";
import {
  CATEGORY_AREA_MAP,
  CLIENT_SELECTION_CATEGORY_KEYS,
  ESTIMATING_ONLY_CATEGORY_KEYS,
  PRODUCT_LIBRARY_SCOPES,
  normalizeLibraryScope,
} from "./constants.js";
import { isSelectionsCatalogueProduct } from "./selectionVisibility.js";

export function money(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  });
}

export function downloadCsv(fileName, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function computeSellPrice(product) {
  if (product.pricing_mode === "markup" && product.cost_price != null && product.markup_percent != null) {
    return Math.round(Number(product.cost_price) * (1 + Number(product.markup_percent) / 100) * 100) / 100;
  }
  return product.sell_price ?? null;
}

export function isMissingRequiredImage(product) {
  return Boolean(product.requires_image) && !product.primary_image_url;
}

export function productSearchText(product, categoryName, supplierName, manufacturerName) {
  return [
    product.product_name,
    manufacturerName,
    product.model,
    product.sku,
    supplierName,
    categoryName,
    product.description,
    product.subcategory,
    product.room_or_usage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function categoryKey(category) {
  return String(category?.category_key || "").trim().toLowerCase();
}

export function inferredScopeForCategory(category) {
  const key = categoryKey(category);
  if (ESTIMATING_ONLY_CATEGORY_KEYS.has(key)) return "ESTIMATING";
  if (CLIENT_SELECTION_CATEGORY_KEYS.has(key)) return "CLIENT_SELECTION";
  return "CLIENT_SELECTION";
}

export function scopeForProduct(product, category) {
  return normalizeLibraryScope(product?.library_scope, inferredScopeForCategory(category));
}

export function isProductLibraryProduct(product, category) {
  return PRODUCT_LIBRARY_SCOPES.has(scopeForProduct(product, category));
}

export function isClientSelectableProduct(product) {
  return isSelectionsCatalogueProduct(product, { includeBuilderSelectable: false });
}

export function roomAreaForProduct(product, category) {
  const explicit = String(product?.room_or_usage || "").trim();
  if (explicit) return explicit;
  return CATEGORY_AREA_MAP[categoryKey(category)] || "Other Selections";
}

export function productTypeForProduct(product) {
  return String(product?.subcategory || product?.variant_label || "Products").trim() || "Products";
}

// Upgrade Value = Builder Cost - Included Allowance (spec formula). Positive = upgrade,
// negative = credit, zero = included. Rounded to cents at the single subtraction step,
// consistent with the rest of the platform's money handling (lib/builders/selectionBudget.js).
export function computeUpgradeValue(product) {
  const builderCost = Number(product?.cost_price ?? 0) || 0;
  const includedAllowance = Number(product?.base_allowance ?? 0) || 0;
  return roundMoney(builderCost - includedAllowance);
}

export function effectiveUpgradeValue(product) {
  if (product?.upgrade_value_mode === "manual") {
    return roundMoney(Number(product?.upgrade_cost ?? 0) || 0);
  }
  return computeUpgradeValue(product);
}

export function upgradeImpactType(upgradeValue) {
  const value = roundMoney(upgradeValue);
  if (value > 0) return "upgrade";
  if (value < 0) return "credit";
  return "included";
}

export function upgradeImpactLabel(upgradeValue) {
  const value = roundMoney(upgradeValue);
  if (value === 0) return "Included";
  const formatted = money(Math.abs(value));
  return value > 0 ? `+${formatted} Upgrade` : `-${formatted} Credit`;
}

export function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
