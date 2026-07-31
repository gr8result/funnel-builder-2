import { memo, useMemo, useRef, useState } from "react";
import { DEFAULT_TABLE_COLUMNS, OPTIONAL_TABLE_COLUMNS, DENSITY_OPTIONS } from "../../lib/product-library/constants";
import { money, computeSellPrice, isMissingRequiredImage } from "../../lib/product-library/helpers";

const ALL_COLUMNS = [...DEFAULT_TABLE_COLUMNS, ...OPTIONAL_TABLE_COLUMNS];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function sortValue(product, key, lookups) {
  switch (key) {
    case "product_name": return product.product_name || "";
    case "category": return lookups.categoryById.get(product.category_id) || "";
    case "supplier": return lookups.supplierById.get(product.supplier_id) || "";
    case "cost": return Number(product.cost_price ?? 0);
    case "sell": return Number(computeSellPrice(product) ?? 0);
    case "status": return product.active === false ? "inactive" : "active";
    case "sku": return product.sku || "";
    case "room_or_usage": return product.room_or_usage || "";
    case "price_band": return product.price_band || "";
    case "updated_at": return product.updated_at || "";
    default: return "";
  }
}

function ProductRow({ product, lookups, columns, widths, onOpen }) {
  const imageUrl = product.primary_image_url;
  const missingImage = isMissingRequiredImage(product);
  const sellPrice = computeSellPrice(product);

  return (
    <div className="row" role="row" onClick={() => onOpen(product)}>
      {columns.map((column) => {
        const style = { width: widths[column.key] || column.width };
        switch (column.key) {
          case "image":
            return (
              <div key={column.key} className="cell image-cell" style={style}>
                {product.is_visual_product ? (
                  imageUrl ? (
                    <img src={imageUrl} alt="" loading="lazy" />
                  ) : missingImage ? (
                    <span className="badge required" title="Image required">IMG</span>
                  ) : (
                    <span className="badge muted">—</span>
                  )
                ) : (
                  <span className="badge icon" title={lookups.categoryById.get(product.category_id) || "Cost item"}>
                    {(lookups.categoryById.get(product.category_id) || "•")[0]}
                  </span>
                )}
              </div>
            );
          case "product_name":
            return (
              <div key={column.key} className="cell" style={style}>
                <strong>{product.product_name}</strong>
                {missingImage && <span className="inline-badge">Image required</span>}
              </div>
            );
          case "brand_model":
            return (
              <div key={column.key} className="cell" style={style}>
                {[lookups.manufacturerById.get(product.manufacturer_id), product.model].filter(Boolean).join(" · ") || "—"}
              </div>
            );
          case "category":
            return <div key={column.key} className="cell" style={style}>{lookups.categoryById.get(product.category_id) || "Uncategorised"}</div>;
          case "supplier":
            return <div key={column.key} className="cell" style={style}>{lookups.supplierById.get(product.supplier_id) || "—"}</div>;
          case "cost":
            return <div key={column.key} className="cell align-right" style={style}>{money(product.cost_price)}</div>;
          case "sell":
            return <div key={column.key} className="cell align-right" style={style}>{money(sellPrice)}</div>;
          case "status":
            return (
              <div key={column.key} className="cell" style={style}>
                <span className={product.active === false ? "status inactive" : "status active"}>
                  {product.active === false ? "Inactive" : "Active"}
                </span>
              </div>
            );
          case "sku":
            return <div key={column.key} className="cell" style={style}>{product.sku || "—"}</div>;
          case "room_or_usage":
            return <div key={column.key} className="cell" style={style}>{product.room_or_usage || "—"}</div>;
          case "price_band":
            return <div key={column.key} className="cell" style={style}>{product.price_band || "—"}</div>;
          case "updated_at":
            return <div key={column.key} className="cell" style={style}>{product.updated_at ? new Date(product.updated_at).toLocaleDateString("en-AU") : "—"}</div>;
          case "actions":
            return (
              <div key={column.key} className="cell actions-cell" style={style} onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => onOpen(product)}>Edit</button>
                {product.product_url ? <a href={product.product_url} target="_blank" rel="noopener noreferrer">Supplier</a> : null}
              </div>
            );
          default:
            return <div key={column.key} className="cell" style={style} />;
        }
      })}
    </div>
  );
}

const MemoRow = memo(ProductRow);

export default function ProductLibraryTable({ products, categoryById, supplierById, manufacturerById, onOpenProduct, server = null }) {
  const [visibleOptional, setVisibleOptional] = useState(() => new Set());
  const [density, setDensity] = useState("normal");
  const [sort, setSort] = useState({ key: "product_name", direction: "asc" });
  const [widths, setWidths] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const resizingRef = useRef(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const lookups = { categoryById, supplierById, manufacturerById };
  const isServerPaginated = Boolean(server);

  const columns = useMemo(
    () => [...DEFAULT_TABLE_COLUMNS, ...OPTIONAL_TABLE_COLUMNS.filter((column) => visibleOptional.has(column.key))],
    [visibleOptional]
  );

  const sortedProducts = useMemo(() => {
    if (isServerPaginated) return products;
    const list = [...products];
    list.sort((a, b) => {
      const left = sortValue(a, sort.key, lookups);
      const right = sortValue(b, sort.key, lookups);
      const comparison = typeof left === "number" ? left - right : String(left).localeCompare(String(right));
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sort, categoryById, supplierById, isServerPaginated]);

  const effectiveSort = isServerPaginated ? { key: server.sortBy, direction: server.sortDirection } : sort;
  const effectivePageSize = isServerPaginated ? server.pageSize : pageSize;
  const pageCount = isServerPaginated ? server.totalPages : Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const currentPage = isServerPaginated ? server.page : Math.min(page, pageCount);
  const pageProducts = isServerPaginated ? sortedProducts : sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalCount = isServerPaginated ? server.total : sortedProducts.length;

  function toggleSort(columnKey) {
    if (isServerPaginated) {
      server.onSortChange(columnKey);
      return;
    }
    setSort((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function goToPage(next) {
    if (isServerPaginated) server.onPageChange(Math.max(1, Math.min(pageCount, next)));
    else setPage((current) => Math.max(1, Math.min(pageCount, next)));
  }

  function changePageSize(size) {
    if (isServerPaginated) server.onPageSizeChange(size);
    else {
      setPageSize(size);
      setPage(1);
    }
  }

  function startResize(columnKey, event) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[columnKey] || ALL_COLUMNS.find((c) => c.key === columnKey)?.width || 140;
    resizingRef.current = { columnKey, startX, startWidth };

    function onMove(moveEvent) {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startX;
      setWidths((current) => ({ ...current, [resizingRef.current.columnKey]: Math.max(70, resizingRef.current.startWidth + delta) }));
    }
    function onUp() {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="table-shell">
      <div className="table-toolbar">
        <div className="density-toggle">
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={density === option.value ? "active" : ""}
              onClick={() => setDensity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="column-picker">
          <button type="button" onClick={() => setShowColumnMenu((current) => !current)}>Columns</button>
          {showColumnMenu && (
            <div className="column-menu">
              {OPTIONAL_TABLE_COLUMNS.map((column) => (
                <label key={column.key}>
                  <input
                    type="checkbox"
                    checked={visibleOptional.has(column.key)}
                    onChange={() =>
                      setVisibleOptional((current) => {
                        const next = new Set(current);
                        if (next.has(column.key)) next.delete(column.key);
                        else next.add(column.key);
                        return next;
                      })
                    }
                  />
                  {column.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <span className="count">{totalCount} products{isServerPaginated ? "" : " (loaded)"}</span>
      </div>

      <div className={density === "compact" ? "table-scroll compact" : "table-scroll"}>
        <div className="table" style={{ minWidth: columns.reduce((sum, column) => sum + (widths[column.key] || column.width), 0) }}>
          <div className="row header-row" role="row">
            {columns.map((column) => (
              <div
                key={column.key}
                className={`cell header-cell ${column.align === "right" ? "align-right" : ""}`}
                style={{ width: widths[column.key] || column.width }}
                onClick={() => column.sortable && toggleSort(column.key)}
              >
                <span>{column.label}</span>
                {column.sortable && effectiveSort.key === column.key && <span className="sort-arrow">{effectiveSort.direction === "asc" ? "▲" : "▼"}</span>}
                {!column.alwaysVisible && <span className="resize-handle" onMouseDown={(event) => startResize(column.key, event)} />}
              </div>
            ))}
          </div>

          {pageProducts.map((product) => (
            <MemoRow key={product.id} product={product} lookups={lookups} columns={columns} widths={widths} onOpen={onOpenProduct} />
          ))}

          {!pageProducts.length && <div className="empty-row">No products match the current filters.</div>}
        </div>
      </div>

      <div className="pagination">
        <select value={effectivePageSize} onChange={(event) => changePageSize(Number(event.target.value))}>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
        <div className="pages">
          <button type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>Prev</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>Next</button>
        </div>
      </div>

      <style jsx>{`
        .table-shell {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .table-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .density-toggle {
          display: flex;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }
        .density-toggle button {
          border: 0;
          background: transparent;
          color: #cbd5e1;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .density-toggle button.active {
          background: #2563eb;
          color: white;
        }
        .column-picker {
          position: relative;
        }
        .column-picker > button {
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: transparent;
          color: #e5eefb;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .column-menu {
          position: absolute;
          top: 34px;
          left: 0;
          z-index: 5;
          display: grid;
          gap: 6px;
          background: #0f1c30;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 8px;
          padding: 10px;
          min-width: 180px;
        }
        .column-menu label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #e5eefb;
          font-size: 12px;
        }
        .count {
          margin-left: auto;
          color: #93a4bd;
          font-size: 12px;
        }
        .table-scroll {
          overflow-x: auto;
          overflow-y: visible;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 12px;
          background: #0b1626;
          max-height: 62vh;
          overflow-y: auto;
        }
        .table {
          display: grid;
        }
        .row {
          display: flex;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          cursor: pointer;
        }
        .row:hover {
          background: rgba(56, 189, 248, 0.06);
        }
        .header-row {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #0f766e;
          cursor: default;
        }
        .header-row:hover {
          background: #0f766e;
        }
        .cell {
          flex-shrink: 0;
          padding: 12px 10px;
          color: #e5eefb;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
        }
        .compact .cell {
          padding: 6px 10px;
          font-size: 12px;
        }
        .cell.align-right {
          justify-content: flex-end;
        }
        .header-cell {
          position: relative;
          color: #ffffff;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 800;
          cursor: pointer;
          user-select: none;
        }
        .sort-arrow {
          margin-left: 6px;
          font-size: 9px;
        }
        .resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
        }
        .image-cell img {
          width: 36px;
          height: 36px;
          object-fit: cover;
          border-radius: 6px;
        }
        .badge {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
        }
        .badge.required {
          background: rgba(251, 191, 36, 0.18);
          color: #fbbf24;
        }
        .badge.muted {
          background: rgba(148, 163, 184, 0.12);
          color: #64748b;
        }
        .badge.icon {
          background: rgba(56, 189, 248, 0.14);
          color: #38bdf8;
          text-transform: uppercase;
        }
        .inline-badge {
          margin-left: 8px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(251, 191, 36, 0.16);
          color: #fbbf24;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .status {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }
        .status.active {
          background: rgba(34, 197, 94, 0.16);
          color: #4ade80;
        }
        .status.inactive {
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
        }
        .actions-cell button {
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: transparent;
          color: #e5eefb;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .actions-cell {
          gap: 6px;
        }
        .actions-cell a {
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5eefb;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          text-decoration: none;
        }
        .empty-row {
          padding: 30px;
          text-align: center;
          color: #93a4bd;
        }
        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pagination select {
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: #0f1c30;
          color: #e5eefb;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
        }
        .pages {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #cbd5e1;
        }
        .pages button {
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: transparent;
          color: #e5eefb;
          border-radius: 6px;
          padding: 5px 10px;
          cursor: pointer;
        }
        .pages button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
