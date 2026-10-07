# Appliance catalogue decomposition plan - revised brand/category architecture

Status: **BLOCKED BY ACTIVE WORK**. The user's architecture clarification is adopted below. It does not explicitly release the earlier appliance/Client Selections freeze, and the master, selectors, generators and catalogue service still contain active changes. This update changes cleanup-owned documentation only. No appliance files, runtime APIs, consumers, source ranges, images or recovery artifacts were moved, split, deleted or edited.

## Required architecture

Use **appliances -> brand -> product category**, for every brand actually present, including inactive historical brands. Brand-only JSON monoliths are not an acceptable destination. No empty category files, numbered parts or model/product-specific files are permitted. This supersedes the earlier proposal for one document per model.

Start with `brands/<brand>/<category>.json`. Each brand has a small `index.js` manifest exposing only its nonempty categories. When a category warrants a further split, replace its data file with a category folder containing a small `index.js` and meaningful subcategory data files. The brand manifest keeps the same category-facing API regardless of that physical choice.

A category that naturally contains one product still belongs in its real category file; do not build a general file-per-product hierarchy. Aim below approximately 2,000 data lines, but retain a documented modest exception when there is no useful further domain boundary. Never create `part1.json`/`part2.json`, numeric buckets or model-name files to force the target.

```text
appliances/
  index.js                      # small public loader/aggregator
  catalogue-metadata.json       # every original top-level value except products
  product-order.json            # original ordered product IDs
  brands/
    whirlpool/
      index.js                  # available categories and explicit static imports
      cooktops/                 # large category with a natural energy boundary
        index.js
        gas.json
        induction.json
        ceramic-electric.json
      dishwashers/              # installation boundary, if adopted
        index.js
        fully-integrated.json
        freestanding.json
      ovens/                    # published cleaning method
        index.js
        hydrolytic.json         # 2,008-line coherent group retained
        pyrolytic.json          # includes existing hybrid-cleaning records
      microwaves.json
      rangehoods.json
      washing-machines.json
      dryers.json
    bosch/
      index.js
      # only existing categories; large ones may use meaningful subcategories
    euromaid/
      index.js
    omega/
      index.js
    westinghouse/
      index.js
    smeg/
      index.js
    blanco/
      index.js                  # historical records retained
```

The comments stand for the existing categories listed below, not empty placeholder files. Whirlpool currently has no refrigeration, freezers, washer-dryers or freestanding-cookers records, so none is proposed. Its real washing-machine and dryer categories must not be omitted merely because they were absent from the example tree.

## Current source snapshot

The current master is **68,594 physical lines, 295 products, 295 unique product IDs, seven brands and 38 nonempty brand/category groups**. An editor may display a final blank line as line 68,595. SHA-256: `79c4adc08f01e7191f7d1a3d2a093c461dae37ce6ed8f614d8a47f65b443b55c`.

`AU-WHIRLPOOL-HNC-RANGE.json` is currently 11,238 lines/41 source products (SHA-256 `38ab1b9a1af75f3b60c89cc97e45545d4041456e029608d1e76f707073cd67d1`). Its corresponding canonical master records total 11,601 lines when serialized as one array; this confirms that brand-only decomposition is insufficient. Source-range and canonical objects are separate datasets, not interchangeable duplicates.

| Brand | All products, including historical | Existing categories |
|---|---:|---|
| Blanco | 14 | cooktops, dishwashers, freestanding-cookers, ovens, rangehoods |
| Bosch | 67 | cooktops, dishwashers, ovens, rangehoods |
| Euromaid | 48 | cooktops, dishwashers, freestanding-cookers, microwaves, ovens, rangehoods |
| Omega | 97 | cooktops, dishwashers, freestanding-cookers, microwaves, ovens, rangehoods |
| Smeg | 14 | cooktops, dishwashers, freestanding-cookers, ovens, rangehoods |
| Westinghouse | 14 | cooktops, dishwashers, freestanding-cookers, ovens, rangehoods |
| Whirlpool | 41 | cooktops, dishwashers, dryers, microwaves, ovens, rangehoods, washing-machines |

The old 228-product/6-brand figures were historical. Preserve Blanco and inactive Euromaid/other records; do not delete or reclassify them while reorganizing storage. In the current schema, these product categories are represented by `familyId`; the common `categoryId: "category:appliances"` must remain unchanged.

## Category sizes and further domain boundaries

Array-line estimates use two-space JSON formatting without an enclosing metadata object. They are inspection aids, not instructions to change catalogue values or formatting to game line counts.

| Brand/category | Products | Array lines |
|---|---:|---:|
| blanco/cooktops | 4 | 733 |
| blanco/dishwashers | 1 | 225 |
| blanco/freestanding-cookers | 1 | 199 |
| blanco/ovens | 2 | 416 |
| blanco/rangehoods | 6 | 1,157 |
| bosch/cooktops | 14 | 1,335 |
| bosch/dishwashers | 14 | 5,109 |
| bosch/ovens | 24 | 1,370 |
| bosch/rangehoods | 15 | 1,012 |
| euromaid/cooktops | 12 | 3,176 |
| euromaid/dishwashers | 4 | 992 |
| euromaid/freestanding-cookers | 7 | 1,726 |
| euromaid/microwaves | 1 | 249 |
| euromaid/ovens | 7 | 1,802 |
| euromaid/rangehoods | 17 | 4,111 |
| omega/cooktops | 28 | 7,861 |
| omega/dishwashers | 12 | 3,428 |
| omega/freestanding-cookers | 5 | 1,413 |
| omega/microwaves | 13 | 3,851 |
| omega/ovens | 19 | 5,417 |
| omega/rangehoods | 20 | 5,478 |
| smeg/cooktops | 4 | 784 |
| smeg/dishwashers | 1 | 224 |
| smeg/freestanding-cookers | 1 | 229 |
| smeg/ovens | 2 | 412 |
| smeg/rangehoods | 6 | 1,216 |
| westinghouse/cooktops | 4 | 888 |
| westinghouse/dishwashers | 1 | 224 |
| westinghouse/freestanding-cookers | 1 | 213 |
| westinghouse/ovens | 2 | 443 |
| westinghouse/rangehoods | 6 | 1,250 |
| whirlpool/cooktops | 10 | 2,721 |
| whirlpool/dishwashers | 10 | 2,899 |
| whirlpool/dryers | 1 | 272 |
| whirlpool/microwaves | 2 | 576 |
| whirlpool/ovens | 12 | 3,425 |
| whirlpool/rangehoods | 2 | 543 |
| whirlpool/washing-machines | 4 | 1,177 |

Eleven groups currently exceed approximately 2,000 lines. Ground any further routing in existing structured fields, with explicit manifest mappings and no edits to the product objects:

| Group | Candidate domain boundary / current evidence |
|---|---|
| Whirlpool cooktops | Existing energy: gas 3/792 lines, induction 4/1,103, ceramic-electric 3/830. |
| Whirlpool dishwashers | Installation: fully integrated 3/859, freestanding 7/2,042. The latter is an acceptable modest exception. |
| Whirlpool ovens | Published cleaning method (`specifications.manufacturerPublishedFields.Cleaning`, with existing Multi-Functions data where needed): hydrolytic 7/2,008, pyrolytic including hybrid 5/1,419. Retain the 2,008-line group. Do not infer width categories from potentially conflicting package dimensions. |
| Bosch dishwashers | Installation: built-under 4/1,462, semi-integrated 2/731, fully integrated 2/732, freestanding 6/2,190. Retain the modest freestanding exception unless a useful existing series boundary is justified. |
| Euromaid cooktops | Energy groups: gas 6/1,597, electric/ceramic 4/985, induction 2/598. Routing aliases do not rewrite stored field values. |
| Euromaid rangehoods | Existing subfamily/legacy installation: canopy 5/1,327, undermount 4/991, fixed/under-cupboard 4/887, slideout 4/912. |
| Omega rangehoods | Existing configuration/rangehood type: canopy 7/1,914, undermount 6/1,736, fixed/under-cupboard 3/722, slideout 4/1,112. |
| Omega dishwashers | Existing configuration: freestanding including legacy 7/1,970, compact/benchtop 2/576, integrated 3/886. |
| Omega cooktops | Existing energy/type: gas 6/1,654, gas-on-glass 2/574, ceramic 8/2,326, induction 11/3,022, hybrid 1/293. Ceramic/induction have plausible compact, standard and wide variants from existing dimensions and marketed sizes; validate conflicting fields before adopting those boundaries. Avoid singleton proliferation and preserve incomplete values. |
| Omega ovens | Existing configuration distinguishes multifunction, pyrolytic/steam, side-opening and double ovens. Avoid many tiny files; assess coherent groupings. Multifunction alone is 9/2,631, so retain an exception if another useful dimension is absent. |
| Omega microwaves | Existing built-in/integrated/combination records together are 6/1,783 lines; freestanding or unspecified microwave records together are 5/1,485, with a warming drawer and trim kit also present. Preserve uncertainty and the existing category of every record; do not manufacture model-specific files for companion equipment. |

A known source discrepancy must survive unchanged: Whirlpool `WDFS3I4PBSAU` has `subfamilyId` describing freestanding/built-in dishwashers but `installationType: "Fully integrated"`. A routing rule may select one existing field; it must not resolve that conflict by changing either value. Unknown/unstated values need an explicit retained group, never guessed values or discarded products.

## Catalogue API and consumer boundary

Proposed raw catalogue exports from `appliances/index.js`:

```js
getAllApplianceProducts()
getApplianceProductsByBrand(brandId)
getApplianceProductsByCategory(categoryId) // existing familyId vocabulary
getApplianceProductsByBrandAndCategory(brandId, categoryId)
getApplianceCategoriesByBrand(brandId)
getApplianceCatalogue() // original envelope, metadata and ordered products
```

Queries return complete original records in original catalogue order, including inactive/historical records. Business eligibility, visibility, image fallbacks and price presentation remain the existing selector layer's responsibility. Do not trim strings, regenerate IDs, normalize brands/categories, coerce prices or omit unknown keys while assembling.

The root and brand indexes use explicit static imports for browser bundling, so filesystem paths stay inside the catalogue implementation. Node tooling uses a separate filesystem reader/writer over the same manifest and shared pure assembly validation; filesystem imports must not enter browser code. Brand manifests expose category keys and storage descriptors, not copied product datasets.

After an ownership handoff, `lib/product-library/applianceCatalogueSelectors.js` should construct its existing selectors from `getApplianceCatalogue()` instead of directly importing the monolith. Product Library, Client Selections and workbook consumers retain their existing selector/service API and must not import individual data shards. The four raw query forms above serve callers that need raw catalogue data; existing public selector exports and semantics remain intact.

`AU-BOSCH-APPLIANCE-RANGE.json`, `AU-OMEGA-APPLIANCE-RANGE.json`, `AU-EUROMAID-HNC-RANGE.json` and `AU-WHIRLPOOL-HNC-RANGE.json` are supplier staging/evidence datasets with their own metadata and writers. Do not append them to the canonical API, deduplicate them against canonical records, or discard their metadata. Their eventual structural migration must use the same brand/category architecture in a separate `source-ranges/<brand>/<category>` hierarchy and range-specific manifest/reader, with independent full-envelope reconciliation and writer migration. Whirlpool source cooktops, dishwashers and ovens are 2,631, 2,809 and 3,317 lines respectively, and warrant the same meaningful subcategory inspection. Other current source-range category arrays are below 2,000 lines. They must not become a second source of canonical products.

## Lossless reconciliation and removal gate

1. After explicit release and ownership handoff, capture current source bytes/hashes, complete JSON envelopes, all ordered product IDs and complete objects, brands, packs and relationships. Capture source ranges separately. Refresh the snapshot; do not use an old count as the migration baseline.
2. Partition complete records without altering any field. Preserve all top-level metadata dynamically, including `hncRangeImports` and future unknown keys; do not copy a hard-coded subset of metadata fields. Keep an explicit global ordered-ID manifest.
3. Load the actual written files through the production aggregator. Reconstruct the original envelope and require recursive full-value equality: preserve array order, nulls, absent keys, string/number distinctions and every unknown nested field. Report both canonical hashes and exact per-field diffs on failure.
4. Require identical product counts, unique/ordered IDs, models, brand identifiers/names, category/family/subfamily values, images and image metadata, every pricing field and price-source value, specifications, source/HNC metadata, lifecycle/eligibility flags and historical records. Full-object equality is the controlling test; summary counts are insufficient.
5. For each brand, each category and every populated brand/category pair, compare API output to filtering the untouched baseline, including global order. Assert no empty data partitions, no duplicate/missing IDs, complete manifest coverage and query-independent results.
6. Keep pack/brand files unchanged in this migration. Verify their hashes, every component/relationship reference and existing selection/service outputs. Preserve saved catalogue identifiers such as `AU-APPLIANCE-CATALOGUE`; they can be business identifiers rather than physical paths. Do not modify image assets; verify all referenced image paths/metadata and any asset hashes captured for the migration.
7. Migrate all actual readers, writers, source-reading tests and dynamic scanners together, with focused tests and affected route checks. Ensure generators cannot recreate a second authoritative monolith. No business-content repairs, unrelated failures or active-session edits may be folded into this migration.
8. Recheck source/destination hashes and working-tree ownership before applying each batch. If another session changes any involved file, stop and report the collision. Remove a monolith only after on-disk API reconciliation, consumer/writer migration and runtime validation pass; do not remove recovery copies merely because they duplicate an old source.

Read-only feasibility check performed for the current snapshot: serialize and parse all 38 brand/category arrays in memory, reconstruct products in the original ID order, and compare the entire envelope. Full equality passed for all 295 records; pack component references resolve. Canonical full-value SHA-256 was `42eba28216608f04806f728879ce8cc9f1c02492581283c222b3cc12bc9d6f23`. The master, packs, brands and two HNC range hashes were unchanged across that check. This is **not** an on-disk BEFORE/AFTER migration result; no migration files were written.

## Runtime consumers

- `lib/product-library/applianceCatalogueSelectors.js:1` imports the catalogue JSON directly.
- `lib/product-library/catalogueService.js` uses selectors and emits the old path as fallback source metadata at line 171.
- `pages/modules/builders/product-library.js`, `pages/modules/builders/selections-book.js`, and `components/product-library/ApplianceCard.jsx` import selectors.
- `pages/modules/builders/client-selections.js` and `components/estimate-builder/EstimateBuilderWorkbook.js` consume the catalogue service.
- `lib/builders/applianceClientSelectionFlow.js:153,178,206` stores `AU-APPLIANCE-CATALOGUE` in selection metadata; retain these values.
- `lib/product-library/productLibraryTaxonomy.js` maps appliance categories/quotation selections; preserve its output.

## Direct writers to migrate together

```text
scripts/apply-appliance-official-image-audit.mjs
scripts/enrich-appliance-harvey-visuals.mjs
scripts/enrich-appliance-imagery-from-sources.mjs
scripts/generate-appliance-canonical-catalogue.mjs
scripts/generate-appliance-checkpoint-a-product-library.mjs
scripts/import-verified-appliance-oven-images.mjs
scripts/reset-unverified-appliance-images.mjs
scripts/product-library/import-appliance-images.mjs
scripts/product-library/integrate-bosch-range.mjs
scripts/product-library/integrate-bosch-dishwashers.mjs
scripts/product-library/integrate-bosch-rangehoods.mjs
scripts/product-library/integrate-omega-range.mjs
scripts/update-omega-images.ps1
scripts/update-missing-models-from-hnc.ps1
scripts/product-library/integrate-hnc-appliance-ranges.mjs
```

The image importer is exposed as `catalogue:import-appliance-images` in `package.json`.

## Direct readers and structural tests

```text
scripts/audit-appliance-official-page-images.mjs
scripts/test-appliance-image-integrity.mjs
scripts/test-appliance-hnc-corrections.mjs
scripts/test-appliance-checkpoint-a-product-library.mjs
scripts/test-appliance-brand-removal.mjs
scripts/test-client-selections-appliance-catalogue-flow.mjs
scripts/test-product-library-independent-startup-browser.mjs
scripts/test-product-library-appliance-catalogue-ui.mjs
scripts/test-product-library-checkpoint-a-correction.mjs
scripts/verify-product-library-oven-images-live.mjs
scripts/verify-product-library-appliance-visual-catalogue-live.mjs
```

## Dynamic filesystem and path assertions

- `scripts/test-appliance-brand-removal.mjs:55` reads and JSON-parses every top-level directory entry as a file. Adding brand directories or `index.js` breaks it; migrate it to manifest-aware traversal.
- `scripts/audit-product-library-images.mjs:19` and `scripts/product-library/inventory-missing-images.mjs:6` recursively discover JSON and extract arrays. They must avoid counting manifest/source-range duplicates or treating metadata/order manifests as product data.
- `scripts/test-product-library-appliance-catalogue-ui.mjs:86` explicitly expects the old JSON filename in selector source; update this structural assertion.
- Source ranges are active inputs/outputs of `scripts/product-library/clean_bosch_range.js`, `enrich-bosch-import.mjs`, `import-bosch-range.mjs`, `import-omega-range.mjs`, and integration scripts. They are not demonstrated dead duplicates.

## Additional current source-range dependencies

- `scripts/product-library/import-whirlpool-hnc-range.mjs` writes the Whirlpool source range.
- `scripts/product-library/import-euromaid-hnc-range.mjs` reads the canonical master and writes the Euromaid source range.
- `scripts/product-library/integrate-hnc-appliance-ranges.mjs` reads the range files and writes the canonical master/brands; it must be included in a coordinated migration.
- `scripts/test-whirlpool-hnc-range.mjs`, `scripts/test-euromaid-hnc-range.mjs`, `scripts/test-hnc-appliance-integration.mjs` and `scripts/verify-hnc-appliance-library-live.mjs` depend on these paths or envelopes.

The earlier dependency list is a starting map, not a claim that all current writers are frozen in time. Repeat the reference and dynamic-reader audit at handoff; several consumers are actively changing.

## Active-work and recovery evidence

The master catalogue, packs, brands, image audit, canonical generator, selector core, catalogue service and associated builder/importer work remain modified by other sessions. They were not touched by this clarification update. Clean direct selector wrappers also remain blocked because their inputs and consumers are active.

The 49,668-line appliance safety snapshot preserves the earlier catalogue and now differs from the live master. The packs safety copy still matches the pack file at this snapshot (SHA-256 `56591537b4e30c7b22238e932d5c915c571d3a10c09ef263634789d6f743bcfa`). Both remain recovery artifacts; no deletion is justified.
