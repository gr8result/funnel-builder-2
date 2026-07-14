# Document Engine Architecture

The Document Engine is the reusable publishing foundation for construction documents. It is not the Quote Proposal Builder.

## Consumer Hierarchy

```text
Document Engine
  |
  |-- Quote Proposal
  |-- Variation Letter
  |-- Purchase Order
  |-- Client Selections Book
  |-- BOQ Print
  |-- Contract
  |-- Progress Report
  |-- Handover Manual
  `-- Maintenance Manual
```

## Core Principle

The engine owns document editing primitives. Product modules own construction workflows.

The engine provides:

- Portrait A4 page model
- Object model
- Selection model
- Layering
- History
- Rendering
- Dynamic workbook field resolution
- Export preparation

The product modules provide:

- Document type
- Starting templates
- Workbook field bindings
- Business rules
- Save/load integration
- Approval workflows

## Module Boundaries

`components/document-engine/core`

Owns pure document operations:

- document state
- page state
- object movement
- object resizing
- layers
- selection
- history

`components/document-engine/objects`

Owns object factories. Objects are editable after creation.

`components/document-engine/templates`

Templates create pages and editable objects. Templates are not static designs.

`components/document-engine/renderer`

Renders the current document state as WYSIWYG pages.

`components/document-engine/fields`

Resolves dynamic fields from the inspected workbook schema only.

`components/document-engine/export`

Prepares document state for PDF/export rendering.

## Save Rule

Documents save document state only:

- page size
- page background references
- object type
- object position
- object size
- object rotation
- object layer
- object lock/visibility state
- object style
- object data
- dynamic field id
- image reference

Workbook values are never duplicated into document state for mapped dynamic fields.

## Dynamic Field Rule

Dynamic fields resolve from `WORKBOOK_FIELD_MAP.md`.

No product module may guess workbook field names.

If a field is not mapped, it must render as `Not entered` until the workbook schema and map are updated.

## First Sprint Scope

The first sprint is foundation only:

- A4 portrait pages
- Object movement
- Object resizing
- Duplicate/delete primitives
- Layer primitives
- Lock primitives
- Single and multi-selection
- Bounding boxes
- Resize handles in render output
- Undo/redo history
- Save/reload model
- Export render payload

No construction-specific document workflow is part of the first sprint.
