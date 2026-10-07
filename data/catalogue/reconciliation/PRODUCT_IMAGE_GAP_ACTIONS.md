# Product image gap — what was imported, what is left, and why

Re-measure any time:

```
npm run catalogue:image-gap            # products not showing their own photo
npm run test:product-library-images    # guard: every card resolves to an image
node --import ./scripts/register-json-loader.mjs scripts/product-library/list-cooktop-rangehood-gap.mjs
```

## Where the appliance catalogue stands

| | Was | Now |
| --- | --- | --- |
| Appliance records with a real product photo | 31 / 83 | **56 / 83** |
| Cooktops + rangehoods missing a photo | 41 | **27** |

## The five sourcing tiers

`scripts/product-library/import-appliance-images.mjs` tries these in order and
stops at the first that proves the exact model:

1. **Live manufacturer AU page** → `verified-official-local`
2. **Harvey Norman Commercial media CDN** → `verified-authorised-supplier-local`
3. **Archived manufacturer product page** (Internet Archive) → `verified-official-archived-local`
4. **Archived manufacturer image asset**, matched by model code in the filename → same
5. **Archived authorised-reseller product image** (HN Commercial, Appliances Online) → `verified-authorised-supplier-local`

Tiers 3–5 exist because most of the remaining models are discontinued: they have
been removed from the live brand sites, but the manufacturers' own product
photography is still archived.

### Guards that stop a wrong photo reaching a card

- **Type agreement.** Tiers 1 and 3 read the source's own product naming and
  reject it when it disagrees with the family we file the model under.
- **Brand-collision rejection.** A three-to-five character model code collides
  across manufacturers. Searching a retailer CDN for Euromaid `CS60S` matches
  `cs60ss/ilve-60cm-slideout-rangehood` — an **ILVE** product. Tier 5 rejects any
  path naming a different manufacturer.
- **Placeholder fingerprinting.** HN Commercial is Magento: a missing SKU still
  answers `200`, with a 262×262 placeholder logo. That exact image (sha256 prefix
  `2637f446bc664022`) is rejected.
- **Size and content-type floors.** Under 250 px, or not `image/*` → rejected.

### Downstream allow-lists

Two allow-lists gate whether an image reaches the UI, and both had to learn the
new archived status or the imports would have stayed invisible:

- `lib/product-library/applianceCatalogueSelectorsCore.js` — `hasApprovedImage`
- `lib/product-library/productLibraryExchange.js` — `APPROVED_IMAGE_STATUS`

## BLOCKING DATA ERROR — Blanco BIC90X

`BIC90X` is catalogued as **"BLANCO 90CM INDUCTION COOKTOP"**, family `cooktops`,
**$1,499**. It is a **90 cm island canopy rangehood**. Three independent sources:

- Grays: "Blanco 90cm Stainless Steel Island Canopy Rangehood (BIC90X)",
  735–1110 × 900 × 600 mm, "minimum height above cooktop … 650 mm".
- Appliances Online's archived image path: `product/bic90x/external/blanco-canopy-rangehood-bic90x`.
- Blanco's own AU prefixes: `BCC`/`BCG` = cooktop, `BRC` = rangehood canopy,
  `BRU` = rangehood undermount, `BIC` = island canopy. Every other `B_C`/`B_U`
  code in this catalogue sits under `rangehoods`.

Origin is the legacy source CSV row itself
(`APPLIANCE_CHECKPOINT1_RESULT_COMPARISON.csv` line 77), not the import.

**Not auto-corrected** — moving it changes family, room category and a priced
line item. No image was imported for it either: a rangehood photo on a card a
client picks a cooktop from is the exact failure this work is meant to prevent.

A sweep of every other appliance code against its brand's prefix convention
found no second instance.

## Still missing: 27 cooktops + rangehoods

| Group | Count | Why |
| --- | --- | --- |
| Ariston rangehoods `ARHC60X` `ARHC90X` `ARHS90X` `ARU60X` `ARU90X` | 5 | Not present under those codes on `ariston.com.au` — live or archived. Likely a builder-channel code series never published on the consumer site. |
| Blanco `BCG604WX` `BCG905WX` `BIC90X` `BRC60X` `BRC90X` `BRU60X` `BRU90X` `BRU90UX` | 8 | `blanco.com.au` holds only 33 archived image captures; `blancoaustralia.com.au`, `blanco-australia.com.au` and `blancoappliances.com.au` hold **zero**. The AU appliance arm's real web presence has not been located. |
| Euromaid `ECCK900` `GC90S` `CS60S` `FS90S` | 4 | Archived captures exist for other models but not these. |
| Omega `OI90Z` `ORC60X` `ORC90X` | 3 | Absent from the current 339-URL sitemap, the archive index, and the HN Commercial CDN. |
| Westinghouse `WRI930SB` | 1 | No archived image capture under the code across 26,616 `westinghouse.com.au` captures. (`WRR604SB` **was** recovered — see below.) |
| Bosch `PCR6A5B90A`, `DWP66BC50A` | 2 | `PCR6A5B90A` 404s on Bosch AU. The `DWP66BC50A` page carries only `DWP64BC50` and `DWP94BC50` shots — **neighbouring models**, so rejected. |
| Smeg `PGA75` | 1 | Only a 350x124 banner strip survives. `PGA75F` / `PGA75SC` captures exist but are **different models**, so they were not substituted. |
| Remainder (duplicates of resolved rows) | 3 | Same discontinued-model pattern. |

### What unblocks these

1. **Blanco is the biggest single win (8 records) and needs a human.** The AU
   appliance domain could not be identified from the archive. A dealer contact
   or the correct historical domain would let tier 3/4 run against it unchanged —
   add it to `BRAND_ARCHIVE_DOMAINS` in the importer.
2. **Dealer media packs.** Drop files at
   `public/images/catalogues/appliances/products/<brand>/<model>.<ext>` and the
   naming convention picks them up with no code change.
3. **Confirm these are still sellable.** Every one of the 27 is discontinued at
   the manufacturer. If they are not orderable, retiring the rows beats sourcing
   images for them.

## Sources deliberately not used

- **harveynorman.com.au** (retail) serves an Imperva bot-detection interstitial
  to automated clients. Reseller entitlement covers *displaying* manufacturer
  imagery; it does not extend to defeating a site's access controls, and HN's own
  retail photography is not the manufacturer's to sub-license. The separate
  `backend.harveynormancommercial.com.au` media CDN was used instead — no access
  control, `robots.txt` is `Allow: /`, and existing rows in this catalogue
  already cite it.
- **Appliance Central, Stax, e&s, Bing Lee, Betta** — 403 to non-browser clients,
  or JS-rendered with no model data in the HTML.
