# Appliance Complete Catalogue Report

Checkpoint: Stage 3B Checkpoint A - Product Library canonical catalogue.

Source workbook: `C:\Users\grant\Downloads\Appliances.xlsx`

Source sheet: `Quote Import`

Source SHA-256: `3A12FD4B34D6685F0E824EDEFD885D409AEAA67AA520A231BEC924E1FE7FBB42`

## Architecture Inspection

| Area | Confirmed owner/location |
| --- | --- |
| Existing Product Library appliance products | `data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json` |
| Existing Product Library appliance packages | `data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json` |
| Appliance brand/logo metadata | `data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json` |
| Canonical appliance selectors | `lib/product-library/applianceCatalogueSelectors.js` and `lib/product-library/applianceCatalogueSelectorsCore.js` |
| Catalogue service exposure | `lib/product-library/catalogueService.js` maps appliance products and packs into the master Product Library catalogue |
| Persistence/storage mechanism | committed Product Library JSON files for platform master data; builder deltas remain separate by organisation/workspace |
| Tenant ownership model | platform master records use `sourcePlatform: platform-master`; tenant records/deltas are organisation-specific overlays and do not own this catalogue |
| Current appliance JSON files | the three files listed above under `data/product-library/catalogues/appliances` |
| Duplicate hard-coded appliance arrays | none added for Checkpoint A; consuming modules were not connected or edited |
| Imported product/image destination | products/packages/brands in `data/product-library/catalogues/appliances`; approved future local product image assets should live under `public/images/catalogues/appliances/products/<brand>/<model>.*` with the source audit updated |

The proposed catalogue owner is Product Library. No live consuming module is the canonical owner.

## Workbook Reconciliation

| Metric | Count |
| --- | ---: |
| Quote Import rows after header | 251 |
| Rows transformed into legacy appliance rows | 194 |
| Priced rows | 194 |
| Heading/note rows ignored as non-catalogue records | 53 |
| Canonical physical products | 83 |
| Canonical packages | 35 |
| Pack-component relationships | 159 |
| Duplicate component rows consolidated | 76 |
| Unresolved source rows | 0 |
| Actual price conflict groups | 0 |
| Workbook-only rows held for review | 4 |

Workbook-only review exclusions:

| Source row | Item | Unit | Rate | Reason |
| --- | --- | --- | --- | --- |
| 120 | - OMEGA 90CM 5 BURNER GAS COOKTOP OCG95FFX | EACH | 699 | workbook-only product not present in accepted 83-product Checkpoint A baseline |
| 121 | - OMEGA 90CM SLIDE OUT RANGEHOOD ORT9WXA | EACH | 399 | workbook-only duplicate component relationship not present in accepted 159-relationship Checkpoint A baseline |
| 122 | - OMEGA 60CM FREESTANDING DISHWASHER ODW702XB | EACH | 699 | workbook-only duplicate component relationship not present in accepted 159-relationship Checkpoint A baseline |
| 147 | BLANCO PACK - 600MM GAS COOKTOP PACK - OVEN / GAS COOKTOP / SLIDEOUT RANGEHOOD / DISHWASHER | PACK | 2746 | workbook-only package not present in accepted 35-package Checkpoint A baseline |

## Brand Coverage

| Brand | Products | Packages | Logo | Logo source |
| --- | --- | --- | --- | --- |
| Ariston | 14 | 6 | official-source-referenced | https://ariston.com.au/ |
| Blanco | 14 | 5 | official-source-referenced | https://www.blanco.au/ |
| Euromaid | 14 | 6 | official-source-referenced | https://www.euromaid.com/en-au |
| Omega | 13 | 6 | official-source-referenced | https://omegaappliances.com.au/ |
| Smeg | 14 | 6 | official-source-referenced | https://www.smeg.com/au |
| Westinghouse | 14 | 6 | official-source-referenced | https://www.westinghouse.com.au/ |

## Product Families

| Family | Products |
| --- | --- |
| cooktops | 23 |
| dishwashers | 6 |
| freestanding-cookers | 6 |
| ovens | 12 |
| rangehoods | 36 |

## Image And Source Status

| Status | Count |
| --- | ---: |
| Product images with approved local/remote primary image | 18 |
| Product images pending licence | 5 |
| Exact product image unavailable after initial pass | 60 |
| Missing image review rows | 65 |
| Exact model product pages verified | 23 |

No generic kitchen paint, lighting, microwave or refrigerator rows were created. Product images were not substituted with wrong-model imagery; 18 exact official remote image references are recorded where verified and unresolved images remain in the missing image review or use clearly flagged category fallback artwork in the Product Library UI.

## Price Preservation

Product and package prices are preserved from `C:\Users\grant\Downloads\Appliances.xlsx`; current retail research fields remain separate and empty, so external price research cannot overwrite workbook pricing.

## Checkpoint Boundary

Client Selections and Quotation Builder were not connected in this checkpoint. `pages/modules/builders/selections-book.js`, saved jobs, quotation snapshots and job-file persistence are not part of this Product Library catalogue owner change.
