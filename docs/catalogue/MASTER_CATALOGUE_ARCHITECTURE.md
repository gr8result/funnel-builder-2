# Master Catalogue Architecture

Date: 2026-09-02

Purpose: establish the shared source-of-truth contract for Product Library, Estimating Catalogue, Quotation Builder, and Client Selections.

## Target Ownership

| Module | Owns | Consumed by |
| --- | --- | --- |
| Product Library | Physical, client-selectable products with stable IDs, images, supplier/brand/model details, costs, sell prices or markup rules, availability, and selection eligibility | Client Selections and Quotation Builder |
| Estimating Catalogue | Labour, trades, plant, materials, preliminaries, fees, and construction activities that clients do not directly select | Quotation Builder |
| Quotation Builder | Job-specific pricing rows that reference Product Library products or Estimating Catalogue items, then freeze job snapshots | Estimate, BOQ, procurement, quote, and variations |
| Client Selections | Builder-filtered customer-facing view of eligible Product Library products | Job selections and linked quotation rows |

## Stable Identity Rules

Product Library records need a stable `productId`. Estimating Catalogue records need a stable `estimatingItemId`. Quotation rows must reference those IDs; they must not copy independent catalogue records into another local catalogue.

Do not use array positions, display names, or supplier sort order as product identities. IDs must survive CSV re-imports, price updates, discontinued products, and UI reordering.

## Live Link Versus Snapshot

New quotes and selection templates should resolve current library data through live links:

```text
Quotation Builder row
  -> sourceProductId
  -> Product Library current record

Quotation Builder row
  -> sourceEstimatingItemId
  -> Estimating Catalogue current record
```

Once a product or rate is added to a live job, issued quotation, accepted quote, procurement item, or approved variation, the row must also hold a frozen job snapshot:

```text
sourceProductId or sourceEstimatingItemId
sourceVersion
snapshotDescription
snapshotCost
snapshotSellPrice
snapshotImage
snapshotSupplier
snapshotBrand
snapshotModel
snapshotGstTreatment
selectedAt or addedAt
```

Catalogue updates may affect future quotes. They must not silently rewrite already-issued quote/job snapshots.

## Product Library Product Shape

Every selectable product should support:

| Field | Notes |
| --- | --- |
| `productId` | Stable product identity |
| `categoryCode` / `subcategoryCode` | Must map to Quotation Builder taxonomy |
| `supplier`, `brand`, `range`, `model`, `productCode` | Used for matching, import, duplicate detection, and display |
| `productName`, `description` | Client-facing product copy |
| `imageUrl` | Actual product image where possible |
| `costPrice`, `sellPrice` or `markupRule` | Pricing source for quote rows |
| `gstTreatment` | Required for pricing consistency |
| `unitOfMeasure` | Each, m2, lm, item, etc. |
| `finishes`, `colours`, `sizes`, `specifications` | Product-specific variants and specs |
| `warranty`, `supplierUrl` | Client/building admin reference |
| `availabilityStatus` | Active, discontinued, archived, pending |
| `clientSelectable` | Whether Client Selections may show it |
| `relevantRooms` / `relevantAreas` | Filtering and template eligibility |
| `lastUpdatedAt` / `sourceVersion` | Snapshot/version tracking |

Categories such as `Ovens`, `Cabinetry`, `Handles`, and `Stone benchtops` are navigation families, not products. Selecting a category should lead to suppliers/brands/ranges, then actual products.

## Estimating Catalogue Item Shape

Every estimating item should support:

| Field | Notes |
| --- | --- |
| `estimatingItemId` | Stable estimating item identity |
| `categoryCode` / `subcategoryCode` | Must map to Quotation Builder taxonomy |
| `tradeClassification` | Labour, material, plant, subcontract, preliminary, fee |
| `description` | Estimating/BOQ description |
| `unitOfMeasure` | Hour, day, m2, m3, lm, item, sum, etc. |
| `costRate` | Current rate for new quotes |
| `defaultMarkup` | Default sell calculation |
| `supplier` / `subcontractor` | Optional, where applicable |
| `region` | Rate locality |
| `effectiveDate` | Rate validity |
| `gstTreatment` | Required for pricing consistency |
| `status` | Active, inactive, archived |
| `notes` | Estimator/admin notes |

## Quotation Row Shape

Quotation rows may reference:

- `sourceProductId` for selectable physical products.
- `sourceEstimatingItemId` for labour/resources/rates.
- Both for assemblies.

Example kitchen oven assembly:

| Part | Source |
| --- | --- |
| Selected oven model | Product Library |
| Installation labour | Estimating Catalogue |
| Electrical connection | Estimating Catalogue |
| Cabinet opening/installation components | Estimating Catalogue or assembly template |
| Builder markup | Quotation Builder rule |
| Quantity and final sell price | Job row snapshot |

## Client Selections Rules

Client Selections must present a filtered Product Library view. It controls:

- Applicable room/area.
- Product family.
- Builder-enabled suppliers/brands/ranges/models.
- Included allowance, upgrade amount, and required configuration.
- Images, descriptions, and specs.
- Final selected product ID and job snapshot.

Client Selections must not maintain supplier catalogue copies inside `pages/modules/builders/selections-book.js`.

## Kitchen Cleanup Rule

Generic Paint and Lighting do not belong as Kitchen product families.

Correct mapping:

| Product type | Product Library placement |
| --- | --- |
| Kitchen pendant/task light fitting | Electrical Fixtures -> Client-selected Light Fittings |
| Paint products/colours | Painting -> Paint Products / Colours |
| Appliances | Kitchen & Appliances -> Appliances -> actual family -> brand -> model |

## Appliance Selection Flow

Required flow:

```text
Appliances
  -> family: Oven / Cooktop / Rangehood / Dishwasher / Microwave / Refrigerator
      -> builder-enabled brand
          -> actual model
              -> selected productId
              -> quotation row sourceProductId + job snapshot
```

Actual model cards should show image, model number, description, width/capacity, fuel/type, finish, features, price, and included/upgrade/allowance status.

## CSV Import Contract

Product Library CSV import should:

1. Choose catalogue family.
2. Choose supplier and brand.
3. Upload CSV.
4. Map CSV columns.
5. Preview validation.
6. Detect duplicates by supplier plus model/product code.
7. Choose add new, update existing, archive missing/discontinued, or ignore unchanged.
8. Import images by URL or image package.
9. Confirm import.
10. Update Product Library.
11. Make eligible active products available to Client Selections and Quotation Builder.

Estimating Catalogue needs a similar CSV importer with rate-specific fields.

## Current Repo Findings

| Area | Current state |
| --- | --- |
| Product Library model | `lib/product-library/catalogueModel.js` already defines product families, taxonomy definitions, import parsing, eligibility filtering, product creation, duplicate preview, and product snapshots. |
| Product Library page | `pages/modules/builders/product-library.js` uses the catalogue model/service and writes quote-structure reference fields. |
| Product Library DB | `supabase/migrations/20260813092100_builder_product_library.sql` defines product, category, supplier, image, spec, colour, finish, and price-option tables. |
| Quote structure refs | `supabase/migrations/20260813092500_builder_product_library_quote_structure_refs.sql` adds quote section/item/row mapping fields to products. |
| Commercial snapshots | `supabase/migrations/20260813091500_estimate_builder_commercial_backbone_stage1.sql` defines estimate snapshots, BOQ sections/items, procurement, approvals, variations, and client selections. |
| Estimating Catalogue | Estimate workbook exposes an Estimating Catalogue sheet, but the DB model is still supplier-price/BOQ oriented rather than an explicit estimating item master. |
| Client Selections | Active route is `pages/modules/builders/selections-book.js`; it already queries Product Library data but still embeds some static catalogues. |
| Cabinetry | `lib/builders/cabinetryWorkflow.js` has extracted substantial cabinetry domain logic; keep the working UX and move records behind Product Library interfaces gradually. |

## Required Next Implementation Stages

1. Add/keep baseline tests for source separation, route identity, cabinetry completion, and catalogue snapshots.
2. Establish canonical category/subcategory IDs shared by Product Library, Estimating Catalogue, and Quotation Builder.
3. Add an explicit Estimating Catalogue item schema/table or model layer.
4. Add quotation row source-link and snapshot fields where missing.
5. Migrate selectable physical items into Product Library.
6. Migrate non-selectable resources/rates into Estimating Catalogue.
7. Connect Quotation Builder rows to source IDs while preserving job snapshots.
8. Move Cabinetry catalogue records behind Product Library without changing screens.
9. Connect Appliances next with family -> brand -> actual model flow.
10. Remove embedded duplicate catalogues only after comparison tests pass.

## Do Not Break

- Do not replace the finished Cabinetry screens.
- Do not clear existing selections.
- Do not mutate existing job snapshots.
- Do not copy master catalogue records into multiple app modules.
- Do not use array positions as product IDs.
- Do not let catalogue updates silently alter accepted quotations.
- Do not delete catalogue records used by existing jobs; archive them.
- Do not refactor `selections-book.js` at the same time as changing the data model.

