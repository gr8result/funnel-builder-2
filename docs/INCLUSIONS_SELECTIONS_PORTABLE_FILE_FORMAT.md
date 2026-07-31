# Portable Selections File Format

Portable exports use:

`*.gr8selections.json`

Current schema:

```json
{
  "schema": "gr8.selections.project",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "sourceApplication": "gr8-result",
  "organisationReference": "organisation id",
  "projectSummary": {},
  "areasAndLevels": {},
  "templatesAndTiers": {},
  "workspace": {},
  "review": {},
  "approvals": {},
  "checksums": { "project": "hash" }
}
```

The export contains project summary, areas and levels, templates and tiers, requirements, selections, product snapshots already stored on selections, locations, pricing and allowance data, notes, review metadata and approval metadata loaded by policy.

The export must not include passwords, access tokens, environment variables, supplier credentials or database connection information.

Imports reject malformed JSON, unsupported future schema versions, cross-organisation content and checksum mismatches. Duplicate project or job number imports require explicit import-as-new handling.
