# Product Library Selections Audit

## Current Structure

- Product Library page: `pages/modules/builders/product-library.js`
- Admin drawer/components: `components/product-library/*`
- APIs: `pages/api/product-library/products.js`, `list.js`, `import-preview.js`, `import-commit.js`, `bulk-update.js`
- Helpers/constants: `lib/product-library/helpers.js`, `constants.js`, `csv.js`
- Storage tables: `builder_products`, `builder_product_categories`, `builder_product_suppliers`, `builder_product_manufacturers`

## Existing Fields

Products already support IDs, SKU/product code, product name, description, category, subcategory, room/usage, manufacturer/brand, model, colour, finish, size, supplier, images, product URLs, PDF URL, pricing tier, active status, available-for-selection, standard inclusion, builder cost, allowance, sell price, RRP, GST, library scope and variant parent rows.

## Gaps Found

- No central machine-readable selections tag taxonomy.
- Requirement matching relied mainly on broad category/subtype compatibility.
- Product Library CSV import did not require precise selection tags.
- Stage 3 showed an inline technical product browser instead of a room-item picker modal.
- Product admin lacked explicit selections compatibility fields such as requirement tags, compatible area types, product type, fuel type, mounting type, installation type and availability status.

## Direction

Selections now use a Product Library adapter boundary and central compatibility service. The development adapter is a stand-in catalogue source; React components do not hard-code the final catalogue.
