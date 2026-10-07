// Compact, light-themed filter/search toolbar for Plumbing Fixtures &
// Tapware category browsing. Replaces the old stack of full-width black
// bars with one row on desktop (search gets most of the width, the rest are
// compact controls) and a mobile-friendly layout: full-width search, then a
// small Filters / Sort / Clear row, with Finish + Price tucked into a
// popover sheet on small screens rather than crammed into one microscopic
// row. Active filters surface as removable chips underneath either way.
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export default function PlumbingFilterToolbar({
  categoryLabel,
  totalCount,
  visibleCount,
  filters,
  onChange,
  onClearAll,
  finishOptions,
  priceOptions,
  sortOptions,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeChips = [];
  if (filters.brand !== "all") activeChips.push({ key: "brand", label: filters.brand });
  if (filters.finish !== "all") activeChips.push({ key: "finish", label: filters.finish });
  if (filters.price !== "all") activeChips.push({ key: "price", label: (priceOptions.find((o) => o.value === filters.price) || {}).label || filters.price });
  if (filters.productType && filters.productType !== "all") activeChips.push({ key: "productType", label: filters.productType });
  if (filters.search) activeChips.push({ key: "search", label: `"${filters.search}"` });

  const clearOne = (key) => onChange({ ...filters, [key]: key === "search" ? "" : "all" });

  return (
    <div className="plumbing-toolbar-wrap" data-testid="plumbing-filter-toolbar">
      <div className="plumbing-results-line">
        <strong>{categoryLabel}</strong>
        <span>{visibleCount === totalCount ? `${totalCount} products` : `Showing ${visibleCount} of ${totalCount}`}</span>
      </div>

      <div className="plumbing-toolbar-row">
        <input
          type="search"
          className="plumbing-search"
          placeholder="Search products..."
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
        <div className="plumbing-toolbar-desktop-controls">
          <select aria-label="Finish" value={filters.finish} onChange={(event) => onChange({ ...filters, finish: event.target.value })}>
            <option value="all">Finish</option>
            {finishOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select aria-label="Price" value={filters.price} onChange={(event) => onChange({ ...filters, price: event.target.value })}>
            {priceOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select aria-label="Sort" value={filters.sort} onChange={(event) => onChange({ ...filters, sort: event.target.value })}>
            {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="button" className="plumbing-toolbar-clear" onClick={onClearAll}>Clear</button>
        </div>
        <div className="plumbing-toolbar-mobile-controls">
          <button type="button" className="plumbing-filters-btn" onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal size={15} /> Filters{activeChips.some((c) => c.key === "finish" || c.key === "price") ? " •" : ""}
          </button>
          <select aria-label="Sort" value={filters.sort} onChange={(event) => onChange({ ...filters, sort: event.target.value })}>
            {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="button" className="plumbing-toolbar-clear" onClick={onClearAll}>Clear</button>
        </div>
      </div>

      {activeChips.length ? (
        <div className="plumbing-chip-row" data-testid="plumbing-active-chips">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" className="plumbing-chip" onClick={() => clearOne(chip.key)}>
              {chip.label} <X size={12} />
            </button>
          ))}
          <button type="button" className="plumbing-chip-clear-all" onClick={onClearAll}>Clear all</button>
        </div>
      ) : null}

      {mobileFiltersOpen ? (
        <div className="plumbing-mobile-sheet-overlay" onClick={() => setMobileFiltersOpen(false)}>
          <div className="plumbing-mobile-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="plumbing-mobile-sheet-head">
              <strong>Filters</strong>
              <button type="button" onClick={() => setMobileFiltersOpen(false)}><X size={18} /></button>
            </div>
            <label>
              Finish
              <select value={filters.finish} onChange={(event) => onChange({ ...filters, finish: event.target.value })}>
                <option value="all">All Finishes</option>
                {finishOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>
              Price
              <select value={filters.price} onChange={(event) => onChange({ ...filters, price: event.target.value })}>
                {priceOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <button type="button" className="plumbing-mobile-sheet-apply" onClick={() => setMobileFiltersOpen(false)}>Show results</button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .plumbing-toolbar-wrap { margin-top: 14px; }
        .plumbing-results-line { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 16px; color: #64748b; }
        .plumbing-results-line strong { font-size: 16px; color: #0f172a; }
        .plumbing-toolbar-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px;
        }
        .plumbing-search {
          flex: 1 1 240px; min-width: 160px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px;
        }
        .plumbing-toolbar-desktop-controls { display: flex; gap: 8px; flex-wrap: wrap; }
        .plumbing-toolbar-desktop-controls select, .plumbing-toolbar-mobile-controls select {
          padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; background: #fff; color: #0f172a;
        }
        .plumbing-toolbar-clear { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #334155; cursor: pointer; font-size: 16px; }
        .plumbing-toolbar-mobile-controls { display: none; gap: 8px; width: 100%; }
        .plumbing-filters-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
          background: #f8fafc; color: #0f172a; font-size: 16px; cursor: pointer; flex: 1;
        }
        .plumbing-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
        .plumbing-chip {
          display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 999px;
          border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; font-size: 16px; cursor: pointer;
        }
        .plumbing-chip-clear-all { font-size: 16px; color: #64748b; background: none; border: none; text-decoration: underline; cursor: pointer; padding: 4px; }
        .plumbing-mobile-sheet-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 1000; display: flex; align-items: flex-end; }
        .plumbing-mobile-sheet { background: #fff; width: 100%; border-radius: 16px 16px 0 0; padding: 16px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
        .plumbing-mobile-sheet-head { display: flex; justify-content: space-between; align-items: center; }
        .plumbing-mobile-sheet label { display: flex; flex-direction: column; gap: 6px; font-size: 16px; color: #475569; }
        .plumbing-mobile-sheet select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; }
        .plumbing-mobile-sheet-apply { padding: 12px; border-radius: 10px; background: #1764d9; color: #fff; border: none; font-size: 16px; font-weight: 600; cursor: pointer; }
        @media (max-width: 767px) {
          .plumbing-toolbar-desktop-controls { display: none; }
          .plumbing-toolbar-mobile-controls { display: flex; }
          .plumbing-search { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
}
