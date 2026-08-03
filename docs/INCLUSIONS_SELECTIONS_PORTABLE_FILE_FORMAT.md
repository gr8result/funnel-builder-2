# Inclusions & Selections Portable File Format

Portable project files use the preferred extension:

`.gr8selections.json`

The current schema is:

`gr8.selections.project` version `1`

Exports include schema version, application version, file ID, created/updated timestamps, application source, export timestamp, organisation reference, project details, levels, areas, templates, tiers, requirements, product selections, variants, locations, notes, quantities, pricing and allowances, review metadata, approval metadata, locked snapshot containers, attachment metadata containers, variation containers, audit metadata and a project checksum.

Exports must not include passwords, access tokens, API keys, environment variables, database credentials or unrestricted supplier credentials.

Open File validates the extension, JSON shape, schema version, required project identity, checksum, duplicate project/job warnings and script-like content before any browser working state is replaced.
