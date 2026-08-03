# Inclusions & Selections Portable File Format

Portable project files use the preferred extension:

`.gr8select`

The contents are JSON with MIME type `application/json`. The older `.json` format can be opened for compatibility, but native File System Access API picker options must not use `.gr8selections.json` because Chrome rejects long extension strings.

The current schema is:

`gr8.selections.project` version `1`

Exports include schema version, application version, file ID, `copiedFromFileId` where applicable, created/updated/exported timestamps, content fingerprint, organisation reference, project details, levels, selected areas, templates, tiers, generated items, selected products, variants, supplier display data, quantities, allowances, selected prices, variations, notes, attachment metadata, review state, approval state, locked snapshots and audit metadata.

Exports must not include passwords, access tokens, API keys, environment variables, database credentials or unrestricted supplier credentials.

Open File validates the extension, JSON shape, schema version, required project identity, content fingerprint or legacy checksum, duplicate project/job warnings and script-like content before any browser working state is replaced.
