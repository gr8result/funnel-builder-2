# Website Builder module

Owns: the visual page builder, published-site rendering support, project/backup/media
storage, and the Website Builder REST API. See `docs/PHASE1_WEBSITE_BUILDER_FILE_MANIFEST.md`
for the full move-by-move record of this module's migration, and
`docs/DEPENDENCY_RULEBOOK.md` for the import rules this module must follow.

## Public interface

Everything outside this module must import only from `modules/website-builder/index.js`
(the barrel) — never a direct path into `components/`, `lib/`, `services/`, `storage/`,
or `api/` below. See that file for the current exported surface.

## This module imports from

- The permanent shared layer only (`context/AuthContext`, `utils/supabase-client`,
  `hooks/useWorkspace`, `pages/modules/_guard.js`, `components/billing`/`components/pricing`
  where applicable).
- No other product module. Confirmed zero cross-module code imports to/from Estimate
  Builder, CRM, Email, Trading, Gantt, Standard Inclusions, or Document Engine
  (`docs/MODULE_ARCHITECTURE_AUDIT.md` §4.1–4.2).

## This module is imported by

Platform-level routes that render public/published content or reference project
creation, all through the public barrel (`docs/DEPENDENCY_RULEBOOK.md` §3.2):

- `pages/[slug].js`, `pages/sites/[...slug].js` — public site rendering
- `middleware.js` — custom-domain/site-slug routing
- `pages/pricing.js`, `pages/index.js` — publish-status lookups on marketing pages
- `pages/assets.js`, `pages/dev/icon-library.js` — shared icon library
- `pages/modules/funnels/new.js` — website-builder asset store reuse
- `lib/assetLibrary.js` — re-exports the icon library for its own consumers
- `components/qa/WebsiteFooterNavigationQaClient.js` — QA harness for the shared footer

## Runtime data (not part of this module's source, never moved)

- `website-builder-sites/` — live project files
- `website-builder-backups/` — backup snapshots
- Supabase `websites`/publication tables, custom-domain records, subscriber records

Storage adapters in `storage/` resolve these via `process.cwd()`-anchored paths
(overridable by `WEBSITE_BUILDER_SITES_DIR`/`WEBSITE_BUILDER_BACKUPS_DIR`), so their
physical location inside this module does not change what data they read or write.
