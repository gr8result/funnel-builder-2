import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import ProductImagePicker from "./ProductImagePicker";
import ProductAdditionalImages from "./ProductAdditionalImages";
import {
  IMAGE_SOURCE_TYPES,
  LIBRARY_SCOPES,
  PRICE_BANDS,
  PRICING_MODES,
  PRICING_TIERS,
  SELECTION_VISIBILITY_VALUES,
  UPGRADE_VALUE_MODES,
  VERIFICATION_STATUSES,
  defaultRequiresImageForCategory,
} from "../../lib/product-library/constants";
import { computeUpgradeValue, effectiveUpgradeValue, money, upgradeImpactLabel } from "../../lib/product-library/helpers";
import { isValidProductUrl } from "../../lib/product-library/urlValidation";

const EMPTY_FORM = {
  product_name: "",
  sku: "",
  description: "",
  product_type: "",
  requirement_tags: "",
  compatible_area_types: "",
  fuel_type: "",
  mounting_type: "",
  installation_type: "",
  availability_status: "available",
  pricing_tier: "CLASSIC",
  category_id: "",
  subcategory: "",
  room_or_usage: "",
  is_visual_product: false,
  requires_image: false,
  library_scope: "CLIENT_SELECTION",
  selection_visibility: "client_selectable",
  active_status: "active",
  discontinued_status: "current",
  active: true,
  available_for_selection: true,
  display_order: 0,
  manufacturer_id: "",
  supplier_id: "",
  model: "",
  colour: "",
  finish: "",
  size_dimensions: "",
  product_url: "",
  supplier_category_url: "",
  warranty_url: "",
  cost_price: "",
  base_allowance: "",
  upgrade_value_mode: "auto",
  upgrade_cost: "",
  retail_price: "",
  gst_included: true,
  sell_price: "",
  markup_percent: "",
  pricing_mode: "markup",
  price_band: "mid_range",
  standard_included: false,
  variant_label: "",
  parent_product_id: "",
  primary_image_url: "",
  additional_image_urls: [],
  datasheet_pdf_url: "",
  manufacturer_product_url: "",
  image_source_url: "",
  image_source_type: "",
  verification_status: "unverified",
  date_last_verified: "",
  notes: "",
  client_notes: "",
};

function formFromProduct(product, categories) {
  if (!product) return EMPTY_FORM;
  const category = categories.find((entry) => entry.id === product.category_id);
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.keys(EMPTY_FORM).map((key) => [key, product[key] ?? EMPTY_FORM[key]])
    ),
    is_visual_product: product.is_visual_product ?? defaultRequiresImageForCategory(category),
    requires_image: product.requires_image ?? defaultRequiresImageForCategory(category),
    pricing_mode: product.pricing_mode || "markup",
    pricing_tier: product.pricing_tier || "CLASSIC",
    upgrade_value_mode: product.upgrade_value_mode || "auto",
    additional_image_urls: Array.isArray(product.additional_image_urls) ? product.additional_image_urls : [],
  };
}

function groupCategoriesBySelectionGroup(categories) {
  const groups = new Map();
  categories.forEach((category) => {
    const groupName = category.selection_group || "Other";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(category);
  });
  return Array.from(groups, ([groupName, items]) => ({
    groupName,
    items: items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  })).sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export default function ProductDetailDrawer({
  open,
  product,
  categories,
  manufacturers,
  suppliers,
  products,
  canViewCosts = true,
  supabase,
  userId,
  saving,
  error,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setForm(formFromProduct(product, categories));
  }, [product, categories]);

  if (!open) return null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCategory(categoryId) {
    const category = categories.find((entry) => entry.id === categoryId);
    setForm((current) => ({
      ...current,
      category_id: categoryId,
      // Only auto-suggest when the user hasn't already overridden it on an existing product.
      is_visual_product: product ? current.is_visual_product : defaultRequiresImageForCategory(category),
      requires_image: product ? current.requires_image : defaultRequiresImageForCategory(category),
    }));
  }

  const autoUpgradeValue = computeUpgradeValue(form);
  const effectiveValue = effectiveUpgradeValue(form);
  const impactLabel = upgradeImpactLabel(effectiveValue);
  const groupedCategories = groupCategoriesBySelectionGroup(categories);
  const productUrlCheck = isValidProductUrl(form.product_url);
  const manufacturerUrlCheck = isValidProductUrl(form.manufacturer_product_url);
  const canSaveUrls = productUrlCheck.ok && manufacturerUrlCheck.ok;

  return (
    <div className="drawer-overlay" onClick={onCancel}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <h2>{product ? "Edit Product" : "New Product"}</h2>
          <button type="button" className="icon" onClick={onCancel} aria-label="Close">×</button>
        </header>

        <div className="drawer-body">
          {error && <p className="drawer-error">{error}</p>}

          <section>
            <h3>General</h3>
            <div className="grid two">
              <label>
                Product Code
                <input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="SKU / product code" />
              </label>
              <label>
                Pricing Tier
                <select value={form.pricing_tier} onChange={(event) => update("pricing_tier", event.target.value)}>
                  {PRICING_TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Product Name
              <input value={form.product_name} onChange={(event) => update("product_name", event.target.value)} required />
            </label>
            <label>
              Description
              <textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} />
            </label>
            <div className="grid two">
              <label>
                Category
                <select value={form.category_id} onChange={(event) => updateCategory(event.target.value)}>
                  <option value="">Select category</option>
                  {groupedCategories.map((group) => (
                    <optgroup key={group.groupName} label={group.groupName}>
                      {group.items.map((category) => (
                        <option key={category.id} value={category.id}>{category.category_name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                Subcategory
                <input value={form.subcategory} onChange={(event) => update("subcategory", event.target.value)} placeholder="e.g. Built-in, Freestanding" />
              </label>
            </div>
          </section>

          <section>
            <h3>Product Details</h3>
            <div className="grid two">
              <label>
                Brand / Make
                <select value={form.manufacturer_id} onChange={(event) => update("manufacturer_id", event.target.value)}>
                  <option value="">Select brand</option>
                  {manufacturers.map((manufacturer) => (
                    <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.manufacturer_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Model
                <input value={form.model} onChange={(event) => update("model", event.target.value)} />
              </label>
              <label>
                Supplier
                <select value={form.supplier_id} onChange={(event) => update("supplier_id", event.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Colour
                <input value={form.colour} onChange={(event) => update("colour", event.target.value)} />
              </label>
              <label>
                Finish
                <input value={form.finish} onChange={(event) => update("finish", event.target.value)} />
              </label>
              <label>
                Size / Dimensions
                <input value={form.size_dimensions} onChange={(event) => update("size_dimensions", event.target.value)} placeholder="Optional" />
              </label>
              <label>
                Product Type
                <input value={form.product_type} onChange={(event) => update("product_type", event.target.value)} placeholder="Built-in Oven, Bench-mounted Basin Mixer" />
              </label>
              <label>
                Fuel Type
                <input value={form.fuel_type} onChange={(event) => update("fuel_type", event.target.value)} placeholder="Electric, Gas, Induction" />
              </label>
              <label>
                Mounting Type
                <input value={form.mounting_type} onChange={(event) => update("mounting_type", event.target.value)} placeholder="Bench-mounted, wall-mounted" />
              </label>
              <label>
                Installation Type
                <input value={form.installation_type} onChange={(event) => update("installation_type", event.target.value)} placeholder="Built-in, freestanding, hinged" />
              </label>
            </div>
          </section>

          <section>
            <h3>Selections Compatibility</h3>
            <label>
              Requirement Tags
              <input value={form.requirement_tags} onChange={(event) => update("requirement_tags", event.target.value)} placeholder="appliance, oven, 900mm" />
            </label>
            <label>
              Compatible Room / Area Types
              <input value={form.compatible_area_types} onChange={(event) => update("compatible_area_types", event.target.value)} placeholder="Kitchen, Butler's Pantry, Outdoor Kitchen" />
            </label>
            <label>
              Availability
              <select value={form.availability_status} onChange={(event) => update("availability_status", event.target.value)}>
                <option value="available">Available</option>
                <option value="supplier_quote_required">Supplier quote required</option>
                <option value="unavailable">Unavailable</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </label>
            <p className="hint">Use precise tags such as oven, basin-mixer, shower-mixer, sink-mixer, garage-door, floor-tile or cabinetry so Inclusions & Selections can show the right products.</p>
          </section>

          {canViewCosts && (
            <section>
              <h3>Pricing</h3>
              <div className="grid two">
                <label>
                  Builder Cost
                  <input type="number" step="0.01" value={form.cost_price} onChange={(event) => update("cost_price", event.target.value)} />
                </label>
                <label>
                  Included Allowance
                  <input type="number" step="0.01" value={form.base_allowance} onChange={(event) => update("base_allowance", event.target.value)} />
                </label>
              </div>
              <label>
                Upgrade Value
                <select value={form.upgrade_value_mode} onChange={(event) => update("upgrade_value_mode", event.target.value)}>
                  {UPGRADE_VALUE_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </label>
              {form.upgrade_value_mode === "manual" ? (
                <div className="manual-upgrade-row">
                  <input
                    type="number"
                    step="0.01"
                    value={form.upgrade_cost}
                    onChange={(event) => update("upgrade_cost", event.target.value)}
                    placeholder="Negative value = credit"
                  />
                  <button type="button" className="ghost small" onClick={() => { update("upgrade_value_mode", "auto"); update("upgrade_cost", ""); }}>
                    Reset to automatic
                  </button>
                </div>
              ) : (
                <p className="hint">Calculated automatically: {money(autoUpgradeValue)} ({impactLabel})</p>
              )}
              <div className="grid two">
                <label>
                  Retail / RRP <span className="optional">(optional)</span>
                  <input type="number" step="0.01" value={form.retail_price} onChange={(event) => update("retail_price", event.target.value)} />
                </label>
                <label className="check gst">
                  <input type="checkbox" checked={form.gst_included} onChange={(event) => update("gst_included", event.target.checked)} />
                  GST included
                </label>
              </div>
            </section>
          )}

          <section>
            <h3>Media</h3>
            <p className="field-label">Main Image</p>
            <ProductImagePicker
              supabase={supabase}
              userId={userId}
              imageUrl={form.primary_image_url}
              requiresImage={form.requires_image}
              onChange={(url) => update("primary_image_url", url)}
            />
            <p className="field-label">Additional Images</p>
            <ProductAdditionalImages
              supabase={supabase}
              userId={userId}
              imageUrls={form.additional_image_urls}
              onChange={(urls) => update("additional_image_urls", urls)}
            />
            <label>
              Specification PDF <span className="optional">(URL, optional)</span>
              <input value={form.datasheet_pdf_url} onChange={(event) => update("datasheet_pdf_url", event.target.value)} placeholder="https://..." />
            </label>

            <p className="field-label">Product Links</p>
            <label>
              Supplier Product URL <span className="optional">(direct product page, not the supplier's home page)</span>
              <input
                value={form.product_url}
                onChange={(event) => update("product_url", event.target.value)}
                placeholder="https://www.supplier.com/products/exact-model"
              />
            </label>
            {!productUrlCheck.ok && <p className="field-error">{productUrlCheck.error}</p>}
            {productUrlCheck.ok && productUrlCheck.warning && <p className="field-warning">{productUrlCheck.warning}</p>}
            {productUrlCheck.ok && !productUrlCheck.empty && (
              <a className="view-product-link" href={productUrlCheck.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> View Product Website
              </a>
            )}
            {(productUrlCheck.empty || !productUrlCheck.ok) && (
              <p className="hint">Product website not available.</p>
            )}
            <label>
              Manufacturer Product URL <span className="optional">(optional)</span>
              <input
                value={form.manufacturer_product_url}
                onChange={(event) => update("manufacturer_product_url", event.target.value)}
                placeholder="https://www.manufacturer.com/products/exact-model"
              />
            </label>
            {!manufacturerUrlCheck.ok && <p className="field-error">{manufacturerUrlCheck.error}</p>}
            <div className="grid two">
              <label>
                Supplier Category URL <span className="optional">(optional)</span>
                <input value={form.supplier_category_url} onChange={(event) => update("supplier_category_url", event.target.value)} placeholder="https://www.supplier.com/category" />
              </label>
              <label>
                Warranty URL <span className="optional">(optional)</span>
                <input value={form.warranty_url} onChange={(event) => update("warranty_url", event.target.value)} placeholder="https://www.supplier.com/warranty" />
              </label>
            </div>

            <p className="field-label">Image Verification</p>
            <div className="grid two">
              <label>
                Image Source URL <span className="optional">(where this photo came from, optional)</span>
                <input value={form.image_source_url} onChange={(event) => update("image_source_url", event.target.value)} placeholder="https://..." />
              </label>
              <label>
                Image Source Type
                <select value={form.image_source_type} onChange={(event) => update("image_source_type", event.target.value)}>
                  <option value="">Not set</option>
                  {IMAGE_SOURCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Verification Status
                <select value={form.verification_status} onChange={(event) => update("verification_status", event.target.value)}>
                  {VERIFICATION_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Date Last Verified
                <input type="date" value={form.date_last_verified || ""} onChange={(event) => update("date_last_verified", event.target.value)} />
              </label>
            </div>
            {form.verification_status !== "exact_model_verified" && (
              <p className="hint warning">
                This image is not confirmed as the exact model — it will not be presented to a client as verified.
              </p>
            )}
          </section>

          <section>
            <h3>Notes</h3>
            <label>
              Interior Designer Notes <span className="optional">(staff only)</span>
              <textarea rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
            </label>
            <label>
              Client Notes <span className="optional">(may appear on the client schedule)</span>
              <textarea rows={2} value={form.client_notes} onChange={(event) => update("client_notes", event.target.value)} />
            </label>
          </section>

          <section>
            <h3>Settings</h3>
            <div className="switch-row">
              <label className="check">
                <input type="checkbox" checked={form.standard_included} onChange={(event) => update("standard_included", event.target.checked)} />
                Standard inclusion for this tier
              </label>
              <label className="check">
                <input type="checkbox" checked={form.available_for_selection} onChange={(event) => update("available_for_selection", event.target.checked)} />
                Available for selection
              </label>
              <label className="check">
                <input type="checkbox" checked={form.active} onChange={(event) => update("active", event.target.checked)} />
                Active
              </label>
            </div>
            <div className="grid three">
              <label>
                Selection Visibility
                <select value={form.selection_visibility} onChange={(event) => update("selection_visibility", event.target.value)}>
                  {SELECTION_VISIBILITY_VALUES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Active Status
                <select value={form.active_status} onChange={(event) => update("active_status", event.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                Discontinued Status
                <select value={form.discontinued_status} onChange={(event) => update("discontinued_status", event.target.value)}>
                  <option value="current">Current</option>
                  <option value="discontinued">Discontinued</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>
            <label>
              Display Order
              <input type="number" value={form.display_order} onChange={(event) => update("display_order", event.target.value)} />
            </label>
          </section>

          <section className="advanced">
            <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? "Hide" : "Show"} advanced / estimating fields
            </button>
            {showAdvanced && (
              <div className="advanced-body">
                <div className="grid two">
                  <label>
                    Library Scope
                    <select value={form.library_scope} onChange={(event) => update("library_scope", event.target.value)}>
                      {LIBRARY_SCOPES.map((scope) => (
                        <option key={scope.value} value={scope.value}>{scope.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Room / Usage
                    <input value={form.room_or_usage} onChange={(event) => update("room_or_usage", event.target.value)} placeholder="Kitchen, Ensuite..." />
                  </label>
                </div>
                {canViewCosts && (
                  <>
                    <div className="grid three">
                      <label>
                        Estimating Pricing Mode
                        <select value={form.pricing_mode} onChange={(event) => update("pricing_mode", event.target.value)}>
                          {PRICING_MODES.map((mode) => (
                            <option key={mode.value} value={mode.value}>{mode.label}</option>
                          ))}
                        </select>
                      </label>
                      {form.pricing_mode === "markup" ? (
                        <label>
                          Markup %
                          <input type="number" step="0.1" value={form.markup_percent} onChange={(event) => update("markup_percent", event.target.value)} />
                        </label>
                      ) : (
                        <label>
                          Sell Price
                          <input type="number" step="0.01" value={form.sell_price} onChange={(event) => update("sell_price", event.target.value)} />
                        </label>
                      )}
                      <label>
                        Price Band
                        <select value={form.price_band} onChange={(event) => update("price_band", event.target.value)}>
                          {PRICE_BANDS.map((band) => (
                            <option key={band.value} value={band.value}>{band.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </>
                )}
                <div className="grid two">
                  <label>
                    Variant Label
                    <input value={form.variant_label} onChange={(event) => update("variant_label", event.target.value)} placeholder="e.g. Stainless steel, 900mm" />
                  </label>
                  <label>
                    Parent Product
                    <select value={form.parent_product_id} onChange={(event) => update("parent_product_id", event.target.value)}>
                      <option value="">None (this is a standalone/parent product)</option>
                      {products.filter((entry) => entry.id !== product?.id).map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.product_name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="switch-row">
                  <label className="check">
                    <input type="checkbox" checked={form.is_visual_product} onChange={(event) => update("is_visual_product", event.target.checked)} />
                    Visual product (needs an image)
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={form.requires_image} onChange={(event) => update("requires_image", event.target.checked)} />
                    Requires image
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="drawer-footer">
          <div className="left">
            {product && (
              <>
                <button type="button" className="danger" disabled={saving} onClick={() => onDelete(product.id)}>Archive</button>
                <button type="button" className="ghost" disabled={saving} onClick={() => onDuplicate(product)}>Duplicate</button>
              </>
            )}
          </div>
          <div className="right">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="button" disabled={saving || !form.product_name.trim() || !canSaveUrls} onClick={() => onSave(form, { close: false })}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" disabled={saving || !form.product_name.trim() || !canSaveUrls} onClick={() => onSave(form, { close: true })}>
              Save &amp; Close
            </button>
          </div>
        </footer>
      </aside>

      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: flex;
          justify-content: flex-end;
          z-index: 60;
        }
        .drawer {
          width: min(560px, 100vw);
          height: 100vh;
          background: #0b1626;
          color: #e5eefb;
          display: grid;
          grid-template-rows: auto 1fr auto;
          box-shadow: -20px 0 60px rgba(0, 0, 0, 0.35);
        }
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }
        .drawer-header h2 {
          margin: 0;
          font-size: 18px;
        }
        button.icon {
          background: transparent;
          border: 0;
          color: #94a3b8;
          font-size: 22px;
          cursor: pointer;
          line-height: 1;
        }
        .drawer-body {
          overflow-y: auto;
          padding: 16px 18px;
          display: grid;
          gap: 22px;
        }
        .drawer-error {
          margin: 0;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(248, 113, 113, 0.45);
          color: #fecaca;
          background: rgba(127, 29, 29, 0.25);
          font-size: 13px;
        }
        section h3 {
          margin: 0 0 10px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #38bdf8;
        }
        .field-label {
          margin: 0 0 6px;
          font-size: 13px;
          font-weight: 700;
          color: #bfd0e8;
        }
        label {
          display: grid;
          gap: 6px;
          margin-bottom: 10px;
          color: #bfd0e8;
          font-size: 13px;
          font-weight: 700;
        }
        label .optional {
          font-weight: 400;
          color: #7d8fac;
          text-transform: none;
        }
        label.check {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 0;
        }
        label.check input {
          width: auto;
        }
        label.check.gst {
          align-self: end;
        }
        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 8px;
          background: #0f1c30;
          color: #e5eefb;
          padding: 9px 10px;
          font: inherit;
        }
        textarea {
          resize: vertical;
        }
        .grid {
          display: grid;
          gap: 10px;
        }
        .grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .switch-row {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 6px;
          margin-bottom: 10px;
        }
        .manual-upgrade-row {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        .manual-upgrade-row input {
          flex: 1;
        }
        .hint {
          margin: 4px 0 10px;
          color: #93a4bd;
          font-size: 12px;
        }
        .hint.warning {
          color: #fbbf24;
        }
        .field-error {
          margin: -4px 0 10px;
          color: #fca5a5;
          font-size: 12px;
          font-weight: 600;
        }
        .field-warning {
          margin: -4px 0 10px;
          color: #fbbf24;
          font-size: 12px;
        }
        .view-product-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: -2px 0 12px;
          color: #38bdf8;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }
        .view-product-link:hover {
          text-decoration: underline;
        }
        .advanced {
          border-top: 1px dashed rgba(148, 163, 184, 0.25);
          padding-top: 14px;
        }
        .advanced-toggle {
          background: transparent;
          border: 0;
          color: #93a4bd;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }
        .advanced-body {
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }
        .drawer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          flex-wrap: wrap;
        }
        .left,
        .right {
          display: flex;
          gap: 8px;
        }
        button {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-weight: 800;
          padding: 9px 14px;
        }
        button.small {
          padding: 6px 10px;
          font-size: 12px;
        }
        button.ghost {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5eefb;
        }
        button.danger {
          background: #b91c1c;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        @media (max-width: 640px) {
          .drawer {
            width: 100vw;
          }
          .grid.two,
          .grid.three {
            grid-template-columns: 1fr;
          }
          .drawer-footer {
            flex-direction: column;
            align-items: stretch;
          }
          .left,
          .right {
            width: 100%;
          }
          .right button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
