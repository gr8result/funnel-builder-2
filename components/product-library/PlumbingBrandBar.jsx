// Visual brand selection row for Plumbing Fixtures & Tapware categories.
// Desktop: a wrapping row of compact cards. Mobile: a horizontally
// scrollable strip - never a dropdown, never squashed into unreadable
// columns. Brands are supplied by the caller, derived dynamically from
// whatever's actually in the current category - nothing hard-coded here.
import { plumbingBrandLogo } from "../../lib/product-library/plumbingBrandLogos";

export default function PlumbingBrandBar({ brands, selectedBrand, onSelectBrand, countsByBrand = {}, totalCount = 0 }) {
  return (
    <div className="plumbing-brand-bar" data-testid="plumbing-brand-bar">
      <div className="plumbing-brand-scroll">
        <button
          type="button"
          className={`plumbing-brand-card ${selectedBrand === "all" ? "selected" : ""}`}
          onClick={() => onSelectBrand("all")}
          data-brand="all"
        >
          <span className="plumbing-brand-mark plumbing-brand-mark-all">All</span>
          <span className="plumbing-brand-name">All Brands</span>
          <span className="plumbing-brand-count">{totalCount}</span>
        </button>
        {brands.map((brand) => {
          const logo = plumbingBrandLogo(brand);
          return (
            <button
              key={brand}
              type="button"
              className={`plumbing-brand-card ${selectedBrand === brand ? "selected" : ""}`}
              onClick={() => onSelectBrand(brand)}
              data-brand={brand}
            >
              <span className="plumbing-brand-mark">
                {logo ? <img src={logo} alt={brand} /> : <span className="plumbing-brand-text-mark">{brand}</span>}
              </span>
              <span className="plumbing-brand-name">{brand}</span>
              {countsByBrand[brand] != null ? <span className="plumbing-brand-count">{countsByBrand[brand]}</span> : null}
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .plumbing-brand-bar { margin-top: 12px; }
        .plumbing-brand-scroll {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
          scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch;
        }
        .plumbing-brand-card {
          flex: 0 0 auto; scroll-snap-align: start;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          width: 112px; height: 76px; padding: 8px 6px;
          border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .plumbing-brand-card:hover { border-color: #94a3b8; box-shadow: 0 2px 8px rgba(15,23,42,0.08); }
        .plumbing-brand-card.selected { border-color: #1764d9; border-width: 2px; background: #eef4ff; }
        .plumbing-brand-mark { height: 28px; display: flex; align-items: center; justify-content: center; max-width: 100%; }
        .plumbing-brand-mark img { max-height: 28px; max-width: 90px; object-fit: contain; }
        .plumbing-brand-mark-all { font-size: 16px; font-weight: 700; color: #1764d9; }
        .plumbing-brand-text-mark { font-size: 16px; font-weight: 600; color: #334155; text-align: center; line-height: 1.1; }
        .plumbing-brand-name { font-size: 16px; color: #64748b; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
        .plumbing-brand-count { font-size: 16px; color: #94a3b8; }
        @media (min-width: 900px) {
          .plumbing-brand-scroll { flex-wrap: wrap; overflow-x: visible; }
        }
        @media (max-width: 480px) {
          .plumbing-brand-card { width: 92px; height: 72px; }
        }
      `}</style>
    </div>
  );
}
