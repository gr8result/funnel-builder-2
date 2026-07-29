# Inclusions Selections Stage 5 Approvals and Snapshots

Date: 2026-07-30

## Scope

Stage 5 adds the active approval workflow at `/inclusions-selections/approvals`.

The stage covers:

- client review preparation,
- sent-for-review and client-reviewing status history,
- client approval,
- builder approval,
- changes requested,
- approval revocation,
- deterministic approval fingerprints,
- stale approval detection,
- snapshot readiness validation,
- immutable locked selection snapshots,
- snapshot version history,
- snapshot comparison,
- new editable draft revisions after a locked version.

Final selection documents, procurement, and Estimate Builder export are not implemented in this stage.

## Approval Rule

Client and builder approvals are independent records. A locked snapshot can be created only when both approvals reference the current approval fingerprint.

Builder approval can be recorded before client approval, but the snapshot readiness checklist remains blocked until both current approvals are present.

## Fingerprint Inputs

The approval fingerprint is derived from material approval data only:

- review readiness/status and Stage 4 selection fingerprint,
- review issues,
- project areas,
- project requirements,
- selections,
- quantities and locations,
- product and variant identity,
- custom selection details,
- selected prices, allowances, GST, and variations,
- Not Applicable reasons,
- client-visible notes.

UI-only state such as the selected review view does not alter the fingerprint.

## Changes Requested

When the client requests changes, existing approved approval records are marked stale and Stage 4 Ready for Approval is revoked. The builder must return to the Selection Workspace or Review stage, revise the material selections, mark the review Ready for Approval again, and collect fresh approvals.

## Locked Snapshot Rule

Locked snapshots are append-only. The repository exposes mutation and delete methods only to reject them explicitly. A new approved selection version creates the next snapshot version and records which previous snapshot it supersedes while preserving the earlier locked version for reading and comparison.

## Route Boundary

`/inclusions-selections/documents-export` is intentionally a placeholder for the next stage with this text:

Approved selection schedules, final documents and Estimate Builder export will be completed in the next stage.

The Stage 5 route does not import Estimate Builder, final document, or procurement code.
