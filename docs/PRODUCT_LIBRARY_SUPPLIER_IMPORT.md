# Product Library Supplier Import

Supplier products are imported into a builder organisation, never into the shared platform template.

Required CSV columns:

`product_code, linked_quote_item_code, supplier_name, brand, range, product_name, model, category, subcategory, product_family, colour, finish, size, width, height, depth, variant_name, primary_image, gallery_images, official_product_url, specification_url, rrp, builder_cost, client_price, currency, gst_treatment, price_effective_date, active, discontinued`

The import flow supports:

- preview
- category/family mapping through `product_family`
- quote/source mapping through `linked_quote_item_code`
- duplicate product-code detection
- image URL preview
- official/specification/supplier links
- create/update valid rows
- skip rows with row-level errors

A product cannot be activated unless it maps to a valid approved Product Family.

Generic demonstration products use explicit `generic-demo` pricing/source markers and must be replaced before commercial use.
