# Product Library Client Selectable Architecture

The Product Library remains the shared owner of products and estimating resources. Inclusions & Selections reads it through a catalogue adapter and only displays records whose selection visibility is `client_selectable` or, for builder-driven choices, `builder_selectable`.

## Visibility Contract

- `client_selectable`: safe for client-facing product selection.
- `builder_selectable`: selectable by builder/staff, not general estimating stock.
- `estimating_only`: construction resource/rate/BOQ item.
- `hidden`: retained but not shown in selections.
- `archived`: retained for history and excluded from active workflows.

Derived flags are supported as read-model helpers: `isClientSelectable`, `isBuilderSelectable`, `isEstimatingResource`, `activeStatus`, and `discontinuedStatus`.

## Separation

Estimating catalogue rows remain in Product Library/rates for Estimate Builder, BOQ and quotations. The selections catalogue is a filtered view of the same ownership boundary, not a duplicate React data set.

## Admin Default

Product Library defaults to Client Selectable Products and provides explicit filters for visibility, category, supplier, brand, tier, active, discontinued, missing image, missing price, missing supplier link and missing tags.
