import { useState } from "react";
import { PRICE_STATUS_OPTIONS, PRICING_TIERS } from "../../lib/product-library/constants";

export function ProductLibraryToolbar({
  viewMode,
  onChangeViewMode,
  onAddProduct,
  onImportCsv,
  onExportCsv,
  onManageCategories,
  selectedCount,
  onBulkUpdate,
}) {
  return (
    <header className="toolbar">
      <div>
        <p className="eyebrow">Builders Platform</p>
        <h1>Product Library</h1>
        <p className="subtitle">A reusable product catalogue organised by category, supplier, brand and pricing tier.</p>
      </div>
      <div className="actions">
        <div className="view-toggle">
          <button type="button" className={viewMode === "catalogue" ? "active" : ""} onClick={() => onChangeViewMode("catalogue")}>Catalogue</button>
          <button type="button" className={viewMode === "table" ? "active" : ""} onClick={() => onChangeViewMode("table")}>Table View</button>
          <button type="button" className={viewMode === "card" ? "active" : ""} onClick={() => onChangeViewMode("card")}>Card View</button>
        </div>
        {selectedCount > 0 && (
          <button type="button" className="bulk" onClick={onBulkUpdate}>Bulk Update ({selectedCount})</button>
        )}
        <button type="button" onClick={onManageCategories}>Manage Categories</button>
        <button type="button" onClick={onImportCsv}>Import CSV</button>
        <button type="button" onClick={onExportCsv}>Export CSV</button>
        <button type="button" className="primary" onClick={onAddProduct}>Add Product</button>
      </div>

      <style jsx>{`
        .toolbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.92);
          border-radius: 10px;
          padding: 20px;
        }
        .eyebrow {
          margin: 0 0 6px;
          color: #38bdf8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        h1 {
          margin: 0 0 6px;
          font-size: 26px;
          color: #e5eefb;
        }
        .subtitle {
          margin: 0;
          max-width: 560px;
          color: #a8bbd4;
          font-size: 13px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .view-toggle {
          display: flex;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 8px;
          overflow: hidden;
          margin-right: 4px;
        }
        .view-toggle button {
          background: transparent;
          border: 0;
        }
        .view-toggle button.active {
          background: #2563eb;
        }
        button {
          border: 0;
          border-radius: 8px;
          background: rgba(148, 163, 184, 0.14);
          color: #e5eefb;
          cursor: pointer;
          font-weight: 800;
          font-size: 12.5px;
          padding: 9px 12px;
          white-space: nowrap;
        }
        button.primary {
          background: #2563eb;
        }
        button.bulk {
          background: #d97706;
        }
        @media (max-width: 900px) {
          .actions {
            width: 100%;
            justify-content: flex-start;
          }
          button {
            flex: 1 1 auto;
          }
        }
      `}</style>
    </header>
  );
}

export function ProductLibraryFilters({
  search,
  onSearch,
  categories,
  suppliers,
  manufacturers,
  filters,
  onChangeFilter,
  roomAreas = [],
  resultCount,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="filter-bar">
      <div className="search-row">
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search name, brand, model, code, supplier, category..."
          className="search"
        />
        {typeof resultCount === "number" && <span className="result-count">{resultCount} result{resultCount === 1 ? "" : "s"}</span>}
        <button type="button" className="filter-toggle" onClick={() => setExpanded((current) => !current)}>
          Filters {expanded ? "▲" : "▼"}
        </button>
      </div>

      <div className={expanded ? "filter-grid open" : "filter-grid"}>
        <select value={filters.roomArea} onChange={(event) => onChangeFilter("roomArea", event.target.value)}>
          <option value="all">All rooms / areas</option>
          {roomAreas.map((roomArea) => (
            <option key={roomArea} value={roomArea}>{roomArea}</option>
          ))}
        </select>
        <select value={filters.categoryId} onChange={(event) => onChangeFilter("categoryId", event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.category_name}</option>
          ))}
        </select>
        <select value={filters.supplierId} onChange={(event) => onChangeFilter("supplierId", event.target.value)}>
          <option value="all">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
          ))}
        </select>
        <select value={filters.manufacturerId} onChange={(event) => onChangeFilter("manufacturerId", event.target.value)}>
          <option value="all">All brands</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.manufacturer_name}</option>
          ))}
        </select>
        <select value={filters.visualType} onChange={(event) => onChangeFilter("visualType", event.target.value)}>
          <option value="all">All selection items</option>
          <option value="visual">Visual products only</option>
          <option value="non_visual">Selections without images</option>
        </select>
        <select value={filters.missingImages} onChange={(event) => onChangeFilter("missingImages", event.target.value)}>
          <option value="all">All images</option>
          <option value="missing">Missing images</option>
        </select>
        <select value={filters.active} onChange={(event) => onChangeFilter("active", event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All statuses</option>
        </select>
        <input
          value={filters.room}
          onChange={(event) => onChangeFilter("room", event.target.value)}
          placeholder="Room / usage"
        />
        <select value={filters.priceStatus} onChange={(event) => onChangeFilter("priceStatus", event.target.value)}>
          {PRICE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={filters.pricingTier} onChange={(event) => onChangeFilter("pricingTier", event.target.value)}>
          <option value="all">All pricing tiers</option>
          {PRICING_TIERS.map((tier) => (
            <option key={tier.value} value={tier.value}>{tier.label}</option>
          ))}
        </select>
        <select value={filters.standardInclusion} onChange={(event) => onChangeFilter("standardInclusion", event.target.value)}>
          <option value="all">Standard + upgrades</option>
          <option value="yes">Standard inclusion only</option>
          <option value="no">Upgrades only</option>
        </select>
        <select value={filters.availableForSelection} onChange={(event) => onChangeFilter("availableForSelection", event.target.value)}>
          <option value="all">All selection availability</option>
          <option value="yes">Available for selection</option>
          <option value="no">Not available for selection</option>
        </select>
        <button type="button" className="clear-filters" onClick={() => onChangeFilter("__clear", true)}>Clear all filters</button>
      </div>

      <style jsx>{`
        .filter-bar {
          display: grid;
          gap: 10px;
        }
        .search-row {
          display: flex;
          gap: 10px;
        }
        .search {
          flex: 1;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 8px;
          background: #0b1626;
          color: #e5eefb;
          padding: 10px 12px;
          font: inherit;
        }
        .result-count {
          align-self: center;
          color: #93a4bd;
          font-size: 12px;
          white-space: nowrap;
        }
        .clear-filters {
          grid-column: 1 / -1;
          justify-self: start;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #e5eefb;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .filter-toggle {
          display: none;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: transparent;
          color: #e5eefb;
          border-radius: 8px;
          padding: 0 14px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        select,
        input {
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 8px;
          background: #0b1626;
          color: #e5eefb;
          padding: 9px 10px;
          font: inherit;
          font-size: 13px;
        }
        @media (max-width: 900px) {
          .filter-toggle {
            display: block;
          }
          .filter-grid {
            display: none;
          }
          .filter-grid.open {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </section>
  );
}
