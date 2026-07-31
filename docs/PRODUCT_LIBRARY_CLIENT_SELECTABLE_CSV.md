# Client Selectable Product CSV

Required columns:

`product_code, product_name, brand, range, model, description, selection_visibility, category, subcategory, product_type, requirement_tags, compatible_area_types, tier, supplier_name, supplier_sku, builder_cost, client_price, rrp, allowance, currency, gst_treatment, colour, finish, size, width, configuration, fuel_type, mounting_type, installation_type, thumbnail_image, primary_image, gallery_images, supplier_product_url, specification_url, active_status, availability_status, discontinued_status, price_effective_date`

Supported visibility values are `client_selectable`, `builder_selectable`, `estimating_only`, `hidden`, and `archived`. Selections catalogue imports accept client/builder selectable rows. Estimating-only rows remain an estimating catalogue concern.

Validation covers product name, category, subcategory, requirement tags, known tag taxonomy, tier, supplier name, visibility, active/discontinued status, duplicate product codes, preview row errors, add-new, update-existing and upsert modes.
