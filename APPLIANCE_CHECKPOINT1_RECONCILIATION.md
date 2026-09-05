# Appliance Checkpoint 1 Reconciliation

Date: 2026-09-02

Scope: focused reconciliation only. Stage 3B Checkpoint 2 image research was not started.

## Source File Verification

| Attribute | Value |
| --- | --- |
| Absolute source path | C:\Users\grant\Downloads\appliance options.csv |
| File size | 70243 bytes |
| SHA-256 | F325357E987DAFB4A695C0529057423DB917BD5FEFADAD6C2AA7242A16667872 |
| Row count | 194 |
| CSV field count | 19 |
| Modification timestamp UTC | 2026-09-01T21:46:23.305Z |

Both implementations were reproduced against these exact bytes.

## Competing Result Totals

| Metric | Earlier implementation | Latest implementation | Authoritative result |
| --- | ---: | ---: | ---: |
| Source rows | 194 | 194 | 194 |
| Unique physical products | 100 | 83 | 83 |
| Appliance packs | 35 | 35 | 35 |
| Pack relationships | 159 | 128 | 159 |
| Duplicate component rows | 59 | 76 | 76 |
| Actual price conflict groups | 0 | 18 alleged | 0 |
| Freestanding cookers | 5 | 6 | 6 |

## Authoritative Decision

Neither implementation was fully correct.

The earlier `lib/product-library/applianceLegacyCsvImporter.js` preserved the source-row pack/component relationship count correctly: every one of the 159 `EACH` rows belongs to a pack context. It was not correct for product identity because option labels such as `CANOPY RANGEHOOD OPTION - ... ARHC60X` were treated as separate model identities.

The latest `lib/construction-estimation/catalogues/applianceLegacyCsv.js` was correct to collapse option labels to physical brand/model identities, giving 83 unique products and 76 duplicate component rows. It was not correct to reduce pack relationships to 128 best-match family links, because that lost 31 source-row relationships. It also reported 18 price conflicts that are description/selectable variations, not actual price or unit conflicts.

The corrected canonical implementation is `lib/construction-estimation/catalogues/applianceLegacyCsv.js`.

## Rule Comparison

| Rule | Earlier implementation | Latest disputed implementation | Corrected canonical rule |
| --- | --- | --- | --- |
| Model-number extraction | Preserved multi-token models but included `OPTION - ...` in some model IDs. | Removed dimensions but truncated hyphen/multi-token models. | Strip option prefix, preserve hyphenated/multi-token model numbers, reject dimensions like 600MM/900MM. |
| Product identity key | Existing ID, then brand/model, then brand/name. | Brand/model, then brand/name. | Brand/model, then brand/name fallback; option labels collapse to the physical model. |
| Product-name fallback | Used when no model was found. | Used when no model was found. | Same, only after dimension and option-prefix checks. |
| Pack detection | `PACK` unit. | `PACK` unit. | `PACK` unit. |
| Component detection | `EACH` unit. | `EACH` unit. | `EACH` unit. |
| Duplicate classification | 159 EACH - 100 products = 59 duplicates. | 159 EACH - 83 products = 76 duplicates. | 159 EACH - 83 products = 76 duplicates. |
| Price-conflict classification | Price only; found 0. | Price/unit/active/selectable/description variation; found 18. | Actual price/unit conflicts = 0; description/selectable variations reviewed separately = 18. |
| Appliance-family classification | Freestanding oven was classified as oven. | Freestanding oven/cooker classified as freestanding-cookers. | Freestanding oven/cooker rows are freestanding-cookers when source text says freestanding. |
| Pack-component relationships | Source-row context; 159 relationships. | One best product per required family; 128 relationships. | Source-row context; 159 relationships, all resolving to canonical product IDs. |
| Active/selectable treatment | Preserved booleans on records. | Preserved booleans and counted selectable variation as conflict. | Preserve booleans; do not call selectable-only variation a price conflict. |

## Numerical Discrepancies Explained

- 100 versus 83 unique products: 30 source rows change product identity. The difference is 17 physical identities, mostly option-labelled dishwasher and rangehood rows that should collapse into existing brand/model products.
- 159 versus 128 relationships: the latest disputed implementation created one selected component per required family, losing 31 source-row component relationships. The authoritative output restores all 159 EACH rows as pack-component relationships.
- 59 versus 76 duplicate rows: once 17 option-labelled records collapse into physical model identities, duplicate rows increase by 17.
- 18 alleged price conflicts: all 18 are same-price/same-unit identity variation groups. They are reviewed in `APPLIANCE_PRICE_CONFLICT_REVIEW.csv`; none are actual price conflicts.
- 5 versus 6 freestanding cookers: `OMEGA 90CM 9 FUNCTION FREESTANDING OVEN OF916FX` is classified as freestanding-cookers because the source explicitly says freestanding.

## Row-Level Review Files

- `APPLIANCE_CHECKPOINT1_RESULT_COMPARISON.csv` contains 194 row-level comparisons.
- `APPLIANCE_PRICE_CONFLICT_REVIEW.csv` contains 18 alleged conflict groups, with actual conflict flags.

## Deprecated Implementation

`lib/product-library/applianceLegacyCsvImporter.js` is superseded for Checkpoint 1 authority. Safe removal plan: keep it temporarily for historical comparison, move downstream generators/tests to `lib/construction-estimation/catalogues/applianceLegacyCsv.js`, then delete the deprecated importer once no imports reference it.
