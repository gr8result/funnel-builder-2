// Category landing page for Plumbing Fixtures & Tapware: three top-level
// groups (Kitchen/Butler's Pantry, Bathroom/Ensuite/Powder Room, Laundry),
// each with real, recognisable category-card imagery pulled from the actual
// imported HNC products - never a generic lifestyle photo or placeholder.
import { PLUMBING_GROUPS, PLUMBING_SUBCATEGORIES } from "../../lib/product-library/catalogueSectionRules";

// One genuine, exact-model HNC product image per category, chosen from the
// imported range so the card shows the fixture type at a glance.
const CATEGORY_CARD_IMAGES = {
  "kitchen-sinks": "/images/catalogues/plumbing/kitchen-sinks/528142.png",
  "kitchen-taps": "/images/catalogues/plumbing/kitchen-taps/527734.png",
  "boiling-chilled-filtered": "/images/catalogues/plumbing/boiling-chilled-filtered/527946-all.png",
  "mixers-tapware": "/images/catalogues/plumbing/mixers-tapware/520023cf.jpg",
  showers: "/images/catalogues/plumbing/showers/144-6510-40.jpg",
  "bathroom-accessories": "/images/catalogues/plumbing/bathroom-accessories/520037c.jpg",
  toilets: "/images/catalogues/plumbing/toilets/75c0015a.jpg",
  "basins-bottle-traps": "/images/catalogues/plumbing/basins-bottle-traps/4700510w.jpg",
  "baths-spas": "/images/catalogues/plumbing/baths-spas/cs103.jpg",
  "plugs-wastes": "/images/catalogues/plumbing/plugs-wastes/340859610.jpg",
  "laundry-tubs": "/images/catalogues/plumbing/laundry-tubs/71x7050.jpg",
  "laundry-tapware": "/images/catalogues/plumbing/laundry-tapware/pv09ch.jpg",
  // HNC and mainstream AU retailers (Reece, Caroma, Bathware Direct, Bunnings)
  // do not sell a "laundry mixer" as a distinct SKU separate from washing-
  // machine tap sets and general sink/laundry mixers - confirmed after
  // checking multiple sources. This uses a genuine Caroma laundry tap
  // product (its own file, not shared with the Laundry Tapware card) rather
  // than a placeholder or an unrelated category's image.
  "laundry-mixers": "/images/catalogues/plumbing/laundry-tapware/laundry-mixer-card.jpg",
};

export default function PlumbingCategoryLanding({ countsByCategory = {}, onOpenCategory }) {
  return (
    <div className="plumbing-landing" data-testid="plumbing-category-landing">
      {PLUMBING_GROUPS.map((group) => {
        const categories = PLUMBING_SUBCATEGORIES.filter((item) => item.group === group.key);
        return (
          <section key={group.key} className="plumbing-group" data-plumbing-group={group.key}>
            <h3>{group.label}</h3>
            <div className="plumbing-category-grid">
              {categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className="plumbing-category-card"
                  data-plumbing-category={category.key}
                  onClick={() => onOpenCategory(category.key)}
                >
                  <span
                    className="plumbing-category-image"
                    style={{ backgroundImage: `url(${CATEGORY_CARD_IMAGES[category.key] || ""})` }}
                    role="img"
                    aria-label={category.label}
                  />
                  <strong>{category.label}</strong>
                  <span className="plumbing-category-count">{countsByCategory[category.key] || 0} products</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <style jsx>{`
        .plumbing-landing { display: flex; flex-direction: column; gap: 28px; }
        .plumbing-group h3 { margin: 0 0 14px; font-size: 18px; color: #0f172a; }
        .plumbing-category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .plumbing-category-card {
          display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
          padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;
          cursor: pointer; text-align: left; transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .plumbing-category-card:hover { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10); border-color: #94a3b8; }
        .plumbing-category-image {
          width: 100%; height: 200px; border-radius: 8px; background-color: #f8fafc;
          background-size: contain; background-repeat: no-repeat; background-position: center;
        }
        .plumbing-category-card strong { font-size: 16px; color: #0f172a; }
        .plumbing-category-count { font-size: 16px; color: #64748b; }
        @media (max-width: 640px) {
          .plumbing-category-image { height: 160px; }
        }
      `}</style>
    </div>
  );
}
