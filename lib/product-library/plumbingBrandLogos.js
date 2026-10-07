// Official brand logo lookup for the Plumbing Fixtures & Tapware brand bar.
// Follows the same convention as cabinetryCatalogueSelectors.js's inline
// { logo: "/images/catalogues/product-library/brands/..." } references -
// no separate JSON brand-registry file exists for this generic folder, so
// this module is the single lookup point rather than inventing a new one.
// Brands without a sourced official logo fall back to a text chip in the UI
// (PlumbingBrandBar) - never a placeholder pretending to be a logo.
const PLUMBING_BRAND_LOGOS = {
  Abey: "/images/catalogues/product-library/brands/abey-logo.png",
  Caroma: "/images/catalogues/product-library/brands/caroma-logo.png",
  Oliveri: "/images/catalogues/product-library/brands/oliveri-logo.png",
  Seima: "/images/catalogues/product-library/brands/seima-logo.png",
  Parisi: "/images/catalogues/product-library/brands/parisi-logo.png",
  Everhard: "/images/catalogues/product-library/brands/everhard-logo.png",
  Blanco: "/images/catalogues/appliances/brands/blanco-logo.svg",
};

export function plumbingBrandLogo(brandName) {
  return PLUMBING_BRAND_LOGOS[brandName] || "";
}
