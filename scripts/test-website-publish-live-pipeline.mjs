import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const publishRoute = read("pages/api/websites/publish.js");
const previewProjectsApi = read("pages/api/website-builder/projects.js");
const publicationStore = read("lib/website-builder/publicationStore.js");
const siteRenderer = read("pages/sites/[...slug].js");
const slugRenderer = read("pages/[slug].js");
const rootRenderer = read("pages/index.js");

assert.match(publishRoute, /assembleWebsiteForRendering/, "Publish API must assemble from the canonical rendering source used by preview.");
assert.doesNotMatch(publishRoute, /createPublicationPayload/, "Publish API must not serialize through the legacy publication payload builder.");
assert.match(previewProjectsApi, /assembleWebsiteForRendering/, "Preview/builder project loading must use the canonical rendering assembly function.");
assert.match(publishRoute, /writePublishedWebsiteRow/, "Publish API must write through the exact-row publish helper.");
assert.match(publishRoute, /WEBSITE_PUBLISH_WRITE_ROW_COUNT_MISMATCH/, "Publish API must fail visibly when a write returns zero or multiple rows.");
assert.match(publishRoute, /WEBSITE_PUBLISH_DUPLICATE_PROJECT_ROWS/, "Publish API must stop when duplicate active rows exist for the same website project.");
assert.match(publishRoute, /Published footer has \$\{verifiedSummary\.footerCardCount\} cards but draft footer has \$\{assembledSummary\.footerCardCount\}/, "Publish read-back must fail visibly when footer card count changes.");
assert.match(publishRoute, /finalSiteDataHash/, "Publish read-back must compare the exact stored rendering snapshot hash.");
assert.match(publishRoute, /WEBSITE_PUBLISH_DOMAIN_ROW_MISMATCH/, "Publish must verify custom-domain row resolution after writing.");
assert.match(publishRoute, /console\.warn\("\[website-publish\] live HTTP verification did not match/, "Live HTTP mismatch must be diagnostic, not the database success gate.");
assert.doesNotMatch(publishRoute, /WEBSITE_PUBLISH_LIVE_HTTP_MISMATCH/, "Publish must not fail after a successful DB/domain readback solely because external HTTP verification lagged.");

assert.match(publicationStore, /sortPublishedCandidates/, "Live resolver must rank duplicate published records deterministically.");
assert.match(publicationStore, /publicationVerifiedRank/, "Live resolver must prefer verified published snapshots.");
assert.doesNotMatch(publicationStore, /limit\(1\)\s*\.maybeSingle\(\)/, "Live resolver must not use unordered single-row lookup for duplicate-prone published records.");

[siteRenderer, slugRenderer, rootRenderer].forEach((source) => {
  assert.match(source, /Cache-Control/, "Live route must set no-store cache headers.");
  assert.match(source, /X-GR8-Published-Row-Id/, "Live route must expose published row metadata.");
  assert.match(source, /X-GR8-Published-Revision/, "Live route must expose published revision metadata.");
  assert.match(source, /X-GR8-Snapshot-Hash/, "Live route must expose snapshot hash metadata.");
});

assert.match(siteRenderer, /usesVerifiedSnapshot/, "Live renderer must distinguish verified published snapshots.");
assert.match(siteRenderer, /usesVerifiedSnapshot\s*\?\s*\(project\?\.pageBlocks \|\| \{\}\)/, "Live verified snapshots must render stored page blocks directly.");
assert.match(siteRenderer, /usesVerifiedSnapshot && rawGlobalFooterBlock\?\.type === "footer"/, "Live verified snapshots must render the stored global footer directly.");
assert.match(siteRenderer, /X-GR8-Footer-Roles/, "Live route must expose footer role diagnostics.");
assert.match(siteRenderer, /X-GR8-Nav-Sticky-Mode/, "Live route must expose sticky nav diagnostics.");
assert.match(siteRenderer, /X-GR8-Media-Block-Count/, "Live route must expose media block diagnostics.");

console.log("Website publish/live pipeline regression checks passed.");
