# Builder Supplier Catalogue Import

The supplier import is a reusable Product Library import, not a separate selections database.

Required import fields are listed in `SUPPLIER_CATALOGUE_IMPORT_FIELDS` and include product code, linked quote item code, supplier, brand, range, product family, product data, media URLs, official links, prices, GST treatment, active and discontinued flags.

Import validation must provide preview, category mapping, quote-item mapping, duplicate-code detection, image preview, supplier-link validation and row-level errors.

Products cannot be activated for selections until `linked_quote_item_code` maps to an approved stable selection item code.
