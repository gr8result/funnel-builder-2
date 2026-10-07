# Funnels catalogue

The module owns reusable funnel sections, service templates, image selection,
and page assembly. Next.js routes remain under `pages/` and consume `index.js`;
the image API and shared media consumers import the dedicated image service.

- `data/themes/`: one complete theme per existing service slug; `index.js`
  preserves the catalogue's original order.
- `data/serviceImages.js`: image pools, search terms, and service group mappings.
- `sections/`: generic and service section HTML.
- `templates/serviceVariants.js`: long/short template structure and descriptions.
- `services/images.js`: template image URLs, fallback selection, and asset listing.
- `catalogue.js`: ordered section and funnel registrations.
- `assemblePage.js`: section lookup and existing typography normalization.

The decomposition preserves the original templates and rendering behavior.
There is no compatibility file at the previous shared-library location.

## Reconciliation

Run `node --test modules/funnels/tests/catalogue-reconciliation.test.mjs`.

The baseline was captured from the original 4,885-line source before migration
(SHA-256 `7c83d7fbf3c93237e5d39cd2f6c203634b124dda8848551b6d7b8fe7d56a9c51`).
It records 38 complete themes, 291 ordered blocks, 90 funnel definitions,
178 rendered funnel pages, 76 image assets, public section outputs, and 1,280
image fallback cases. Hashes cover all object fields and exact generated HTML.
The test also rejects duplicate theme, block, and funnel IDs.
