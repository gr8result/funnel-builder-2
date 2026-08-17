import assert from "node:assert/strict";
import { hasExplicitPageWidthOverride, resolvePageWidthMode, withPageLayoutDefaults } from "../lib/website-builder/pageLayout.js";

const legacyProject = {
  pageWidthMode: "full",
  globalPageWidthMode: "full",
  pages: [
    { name: "Home", slug: "home", pageWidthMode: "contained" },
    { name: "Pricing", slug: "pricing", pageWidthMode: "contained" },
    { name: "Modules", slug: "modules", pageWidthMode: "contained" },
  ],
};

for (const pageName of ["Home", "Pricing", "Modules"]) {
  assert.equal(resolvePageWidthMode(legacyProject, pageName), "full", `${pageName} should inherit site-wide full width over legacy page default`);
}

const explicitOverrideProject = {
  pageWidthMode: "full",
  globalPageWidthMode: "full",
  pages: [
    { name: "Home", slug: "home" },
    { name: "Pricing", slug: "pricing", pageWidthMode: "contained", pageWidthModeOverride: true },
    { name: "Modules", slug: "modules", containerMode: "contained" },
  ],
};

assert.equal(resolvePageWidthMode(explicitOverrideProject, "Home"), "full", "missing page value should inherit site-wide full width");
assert.equal(resolvePageWidthMode(explicitOverrideProject, "Pricing"), "contained", "explicit page override should win");
assert.equal(resolvePageWidthMode(explicitOverrideProject, "Modules"), "contained", "legacy explicit containerMode should win");
assert.equal(hasExplicitPageWidthOverride({ pageWidthMode: "contained" }), false, "plain pageWidthMode is not explicit because older saves defaulted it");
assert.equal(hasExplicitPageWidthOverride({ pageWidthMode: "contained", pageWidthModeOverride: true }), true, "override marker is explicit");
assert.deepEqual(withPageLayoutDefaults({ name: "Contact Us" }), { name: "Contact Us" }, "normalization must not add destructive contained defaults");

const pageOnlyProject = {
  pages: [{ name: "Landing", slug: "landing", pageWidthMode: "full" }],
};
assert.equal(resolvePageWidthMode(pageOnlyProject, "Landing"), "full", "older page-only projects should keep their page width mode");

console.log("Website builder layout integrity checks passed");
