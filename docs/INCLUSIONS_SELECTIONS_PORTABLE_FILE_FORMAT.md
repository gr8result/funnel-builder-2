# Inclusions & Selections Portable File Format

Portable project files use the preferred extension:

`.gr8selections.json`

The current schema is:

`gr8.selections.project` version `1`

Exports include schema version, application source, export timestamp, organisation reference, project summary, levels, areas, templates, tiers, requirements, product selections, locations, notes, pricing, review metadata, approval metadata where available and a project checksum.

Exports must not include passwords, access tokens, API keys, environment variables, database credentials or unrestricted supplier credentials.

Imports validate the extension, JSON shape, schema version, required project identity, organisation reference, checksum, duplicate project/job warnings and script-like content before any data is written.
