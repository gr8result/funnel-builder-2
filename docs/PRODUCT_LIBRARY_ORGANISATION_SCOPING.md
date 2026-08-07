# Product Library Organisation Scoping

The system template defines:

- top-level areas
- categories
- product families
- required attributes
- optional attributes
- supported variant types

Each organisation defines:

- suppliers
- brands
- ranges
- actual products
- product images
- supplier URLs
- specification URLs
- builder costs and client prices

Workspace data is loaded from workspace-scoped product tables. Imported product entities store `organisationId` and family metadata so one organisation cannot see or use another organisation's private catalogue data.

No supplier is hard-coded into the shared Product Family template. Names found in the approved source CSV, such as supplier-like product descriptions, are treated as source context or generic examples only.
