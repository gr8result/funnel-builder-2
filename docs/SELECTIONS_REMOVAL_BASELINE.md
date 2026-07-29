# Selections Removal Baseline

Date: 2026-07-29

This baseline records the repository state before isolating/removing the failed legacy Inclusions and Selections implementation.

## Current Branch

`main`

## Current Commit Hash

`2a558df3ec2850a71f812d6304e0c95f1691588e`

## Recent Git Log

```text
2a558df feat: rebuild client selections from project areas and room templates
8d0c9b6 fix: make selections focus mode use full worksheet width
173c132 Add fixed-page DOCX import mode
62ae1cb feat: rebuild client selections as guided product workflow
e07ce46 feat: rebuild client selections as guided product workflow
```

## Complete Pre-Task Git Status

```text
 M .claude/settings.json
 M .gitignore
 M components/freedom/FreedomModuleNav.js
 M components/website-builder/WebsiteBlockRenderer.js
 M components/website-builder/page-builder/pbCanvasComponents.js
 M components/website-builder/page-builder/pbPropertiesPanels.js
 M components/website-builder/page-builder/pbStyles.js
 M components/website-builder/website-renderer/wbBlockComponents.js
 M lib/website-builder/accordionPanels.js
 M lib/website-builder/page-blocks/blockDefinitions.js
 M lib/website-builder/projectStore.js
 M lib/website-builder/publishConfig.js
 M lib/website-builder/remoteProjects.js
 M lib/website-builder/responsiveValue.js
 M lib/website-builder/siteStorage.js
 M lib/website-builder/supabaseSiteStorage.js
 M lib/website-builder/videoHero.js
 M lib/withWorkspace.js
 M modules/takeoff-v2/components/PlanDocumentList.jsx
 M modules/takeoff-v2/components/PlanViewer.jsx
 M modules/takeoff-v2/components/TakeoffV2Page.jsx
 M modules/takeoff-v2/persistence/planStore.js
 M modules/takeoff-v2/tests/planStore.test.mjs
 M modules/takeoff-v2/types.js
 M modules/takeoff-v2/viewer/PdfViewport.js
 M next.config.mjs
 M package.json
 M pages/api/ai/plan-detect.js
 M pages/api/freedom-trader/watchlist.js
 M pages/api/standard-inclusions/onlyoffice/upload-pptx.js
 M pages/api/website-builder/projects.js
 M pages/api/websites/publish.js
 M pages/freedom-trader/alerts.js
 M pages/freedom-trader/company/[symbol].js
 M pages/freedom-trader/index.js
 M pages/freedom-trader/portfolio.js
 M pages/freedom-trader/positions.js
 M pages/freedom-trader/trades.js
 M pages/freedom/company/[symbol].js
 M pages/freedom/index.js
 M pages/login.js
 M pages/modules/website-builder/project/[id]/preview.js
 M pages/modules/website-builder/visual-builder.js
 M pages/sites/[...slug].js
 M styles/website-builder-responsive.css
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/about-us.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/contact-us.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/crm.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/email.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/funnels.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/home.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/modules.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/pricing.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/project-hub.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/sms.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/social-media.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/website-builder.json
 M website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/site.json
?? .claude/settings.local.json
?? components/estimate-builder/JobFileMenu.jsx
?? docs/SELECTIONS_LEGACY_AUDIT.md
?? e2e/
?? lib/freedom/companyRoutes.js
?? lib/website-builder/gridSectionImages.js
?? lib/website-builder/sharedNavigation.js
?? modules/takeoff-v2/components/AreaConfirmDialog.jsx
?? modules/takeoff-v2/components/JobDetailsBanner.jsx
?? modules/takeoff-v2/components/OrientationNotice.jsx
?? modules/takeoff-v2/components/OrientationPicker.jsx
?? modules/takeoff-v2/components/ScaleCalibrationDialog.jsx
?? modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx
?? modules/takeoff-v2/components/TakeoffToolbar.jsx
?? modules/takeoff-v2/geometry/
?? modules/takeoff-v2/hooks/
?? modules/takeoff-v2/jobSummary.js
?? modules/takeoff-v2/orientation/
?? modules/takeoff-v2/takeoff/
?? modules/takeoff-v2/tests/areaCalculation.test.mjs
?? modules/takeoff-v2/tests/axisLock.test.mjs
?? modules/takeoff-v2/tests/clampSharpRenderScale.test.mjs
?? modules/takeoff-v2/tests/fixtures/
?? modules/takeoff-v2/tests/openingPlacement.test.mjs
?? modules/takeoff-v2/tests/orientation.test.mjs
?? modules/takeoff-v2/tests/planGeometryIndex.test.mjs
?? modules/takeoff-v2/tests/planRasterFallback.test.mjs
?? modules/takeoff-v2/tests/planSnap.test.mjs
?? modules/takeoff-v2/tests/planVectorExtraction.test.mjs
?? modules/takeoff-v2/tests/scaleCalibration.test.mjs
?? modules/takeoff-v2/tests/snapping.test.mjs
?? modules/takeoff-v2/tests/wallDrawing.test.mjs
?? modules/takeoff-v2/tests/wallGraph.test.mjs
?? modules/takeoff-v2/viewer/rotationTransform.js
?? pages/api/dev/detection-health.js
?? pages/api/freedom-trader/fib-plan.js
?? pages/freedom-trader/diagnostics/
?? pages/freedom-trader/trade-journal.js
?? playwright.config.js
?? scripts/migrate-gr8-global-navigation.mjs
?? scripts/test-gr8-global-navigation-regression.mjs
?? scripts/test-project-hub-builder-data-regression.mjs
?? scripts/test-scroll-stack-image-position-regression.mjs
?? scripts/test-standard-inclusions-pdf-import-no-text-blocks.mjs
?? scripts/test-standard-inclusions-signed-upload.mjs
?? scripts/test-takeoff-v2-detection-auth.mjs
?? scripts/test-takeoff-v2-panx-crash-regression.mjs
?? scripts/test-takeoff-v2-scale-walls-area-acceptance.mjs
?? scripts/test-website-accordion-heading-normalization.mjs
?? scripts/test-website-builder-navigation-page-registry.mjs
?? scripts/test-website-builder-preview-slug-and-panel-image-regression.mjs
?? scripts/test-website-builder-shared-navigation-persistence.mjs
?? scripts/test-website-builder-shared-navigation.mjs
?? scripts/test-website-grid-section-image-rendering.mjs
?? scripts/website-builder-responsive-regression.mjs
?? supabase/migrations/20260729_freedom_trader_fib_plans.sql
?? test/freedom-company-routes.test.js
?? website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/_global-navigation-backups/
```

Git also printed:

```text
warning: unable to access 'C:\Users\grant/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\grant/.config/git/ignore': Permission denied
```

This warning was recorded only. No attempt was made to fix it, and it does not block the application cleanup.

## Pre-Existing Modified Files

- `.claude/settings.json`
- `.gitignore`
- `components/freedom/FreedomModuleNav.js`
- `components/website-builder/WebsiteBlockRenderer.js`
- `components/website-builder/page-builder/pbCanvasComponents.js`
- `components/website-builder/page-builder/pbPropertiesPanels.js`
- `components/website-builder/page-builder/pbStyles.js`
- `components/website-builder/website-renderer/wbBlockComponents.js`
- `lib/website-builder/accordionPanels.js`
- `lib/website-builder/page-blocks/blockDefinitions.js`
- `lib/website-builder/projectStore.js`
- `lib/website-builder/publishConfig.js`
- `lib/website-builder/remoteProjects.js`
- `lib/website-builder/responsiveValue.js`
- `lib/website-builder/siteStorage.js`
- `lib/website-builder/supabaseSiteStorage.js`
- `lib/website-builder/videoHero.js`
- `lib/withWorkspace.js`
- `modules/takeoff-v2/components/PlanDocumentList.jsx`
- `modules/takeoff-v2/components/PlanViewer.jsx`
- `modules/takeoff-v2/components/TakeoffV2Page.jsx`
- `modules/takeoff-v2/persistence/planStore.js`
- `modules/takeoff-v2/tests/planStore.test.mjs`
- `modules/takeoff-v2/types.js`
- `modules/takeoff-v2/viewer/PdfViewport.js`
- `next.config.mjs`
- `package.json`
- `pages/api/ai/plan-detect.js`
- `pages/api/freedom-trader/watchlist.js`
- `pages/api/standard-inclusions/onlyoffice/upload-pptx.js`
- `pages/api/website-builder/projects.js`
- `pages/api/websites/publish.js`
- `pages/freedom-trader/alerts.js`
- `pages/freedom-trader/company/[symbol].js`
- `pages/freedom-trader/index.js`
- `pages/freedom-trader/portfolio.js`
- `pages/freedom-trader/positions.js`
- `pages/freedom-trader/trades.js`
- `pages/freedom/company/[symbol].js`
- `pages/freedom/index.js`
- `pages/login.js`
- `pages/modules/website-builder/project/[id]/preview.js`
- `pages/modules/website-builder/visual-builder.js`
- `pages/sites/[...slug].js`
- `styles/website-builder-responsive.css`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/about-us.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/contact-us.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/crm.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/email.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/funnels.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/home.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/modules.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/pricing.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/project-hub.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/sms.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/social-media.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/website-builder.json`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/site.json`

## Pre-Existing Untracked Files

- `.claude/settings.local.json`
- `components/estimate-builder/JobFileMenu.jsx`
- `docs/SELECTIONS_LEGACY_AUDIT.md`
- `e2e/`
- `lib/freedom/companyRoutes.js`
- `lib/website-builder/gridSectionImages.js`
- `lib/website-builder/sharedNavigation.js`
- `modules/takeoff-v2/components/AreaConfirmDialog.jsx`
- `modules/takeoff-v2/components/JobDetailsBanner.jsx`
- `modules/takeoff-v2/components/OrientationNotice.jsx`
- `modules/takeoff-v2/components/OrientationPicker.jsx`
- `modules/takeoff-v2/components/ScaleCalibrationDialog.jsx`
- `modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx`
- `modules/takeoff-v2/components/TakeoffToolbar.jsx`
- `modules/takeoff-v2/geometry/`
- `modules/takeoff-v2/hooks/`
- `modules/takeoff-v2/jobSummary.js`
- `modules/takeoff-v2/orientation/`
- `modules/takeoff-v2/takeoff/`
- `modules/takeoff-v2/tests/areaCalculation.test.mjs`
- `modules/takeoff-v2/tests/axisLock.test.mjs`
- `modules/takeoff-v2/tests/clampSharpRenderScale.test.mjs`
- `modules/takeoff-v2/tests/fixtures/`
- `modules/takeoff-v2/tests/openingPlacement.test.mjs`
- `modules/takeoff-v2/tests/orientation.test.mjs`
- `modules/takeoff-v2/tests/planGeometryIndex.test.mjs`
- `modules/takeoff-v2/tests/planRasterFallback.test.mjs`
- `modules/takeoff-v2/tests/planSnap.test.mjs`
- `modules/takeoff-v2/tests/planVectorExtraction.test.mjs`
- `modules/takeoff-v2/tests/scaleCalibration.test.mjs`
- `modules/takeoff-v2/tests/snapping.test.mjs`
- `modules/takeoff-v2/tests/wallDrawing.test.mjs`
- `modules/takeoff-v2/tests/wallGraph.test.mjs`
- `modules/takeoff-v2/viewer/rotationTransform.js`
- `pages/api/dev/detection-health.js`
- `pages/api/freedom-trader/fib-plan.js`
- `pages/freedom-trader/diagnostics/`
- `pages/freedom-trader/trade-journal.js`
- `playwright.config.js`
- `scripts/migrate-gr8-global-navigation.mjs`
- `scripts/test-gr8-global-navigation-regression.mjs`
- `scripts/test-project-hub-builder-data-regression.mjs`
- `scripts/test-scroll-stack-image-position-regression.mjs`
- `scripts/test-standard-inclusions-pdf-import-no-text-blocks.mjs`
- `scripts/test-standard-inclusions-signed-upload.mjs`
- `scripts/test-takeoff-v2-detection-auth.mjs`
- `scripts/test-takeoff-v2-panx-crash-regression.mjs`
- `scripts/test-takeoff-v2-scale-walls-area-acceptance.mjs`
- `scripts/test-website-accordion-heading-normalization.mjs`
- `scripts/test-website-builder-navigation-page-registry.mjs`
- `scripts/test-website-builder-preview-slug-and-panel-image-regression.mjs`
- `scripts/test-website-builder-shared-navigation-persistence.mjs`
- `scripts/test-website-builder-shared-navigation.mjs`
- `scripts/test-website-grid-section-image-rendering.mjs`
- `scripts/website-builder-responsive-regression.mjs`
- `supabase/migrations/20260729_freedom_trader_fib_plans.sql`
- `test/freedom-company-routes.test.js`
- `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/_global-navigation-backups/`

## Task-Owned Files Planned

The task may intentionally create or change only cleanup/isolation files after this baseline. Any such files must be staged explicitly by path.

Known task-owned file at this moment:

- `docs/SELECTIONS_REMOVAL_BASELINE.md`

## Safety Confirmation

- No `git reset --hard` was run.
- No `git clean` was run.
- No destructive checkout command was run.
- No stash was created.
- No unrelated pre-existing work was discarded, overwritten, cleaned, reset, or staged.
- The unrelated pre-existing modified and untracked files listed above must not be included in the cleanup commit.
