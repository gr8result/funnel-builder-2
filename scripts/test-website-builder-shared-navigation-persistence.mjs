import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createPublicationPayload } from "../lib/website-builder/publishConfig.js";
import { normalizeSharedPrimaryNavigation } from "../lib/website-builder/sharedNavigation.js";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function flattenLinks(links = []) {
  return (Array.isArray(links) ? links : []).flatMap((link) => [
    link,
    ...flattenLinks(link.children || []),
  ]);
}

function countHref(project, href) {
  return flattenLinks(project.globalNavBlock?.props?.links || [])
    .filter((link) => String(link.href || "") === href)
    .length;
}

const project = {
  id: "2208a52a-8175-477e-823c-fc6de7fe4afe",
  name: "Gr8 Result Digital Solutions",
  pages: [
    { id: "home", name: "Home", slug: "home" },
    { id: "modules", name: "Modules", slug: "modules" },
    { id: "email", name: "Email", slug: "email" },
    { id: "sms", name: "SMS", slug: "sms" },
    { id: "crm", name: "CRM", slug: "crm" },
  ],
  pageBlocks: {
    Home: [
      {
        id: "stale-page-nav",
        type: "nav-bar",
        props: {
          stickyMode: "normal",
          links: [{ id: "stale-email", label: "Email", href: "/email" }],
        },
      },
    ],
  },
  globalNavBlock: {
    id: "existing-nav",
    type: "nav-bar",
    props: {
      stickyMode: "sticky-solid",
      links: [
        { id: "nav-home", label: "Home", href: "/" },
        {
          id: "nav-modules",
          label: "Modules",
          href: "/modules",
          children: [
            { id: "nav-email", label: "Email", href: "/email" },
            { id: "nav-email-marketing", label: "Email Marketing", href: "/email" },
            { id: "nav-sms", label: "SMS", href: "/sms" },
            { id: "nav-sms-marketing", label: "SMS Marketing", href: "/sms" },
            { id: "nav-crm", label: "CRM", href: "/crm" },
            { id: "nav-crm-management", label: "CRM Management", href: "/crm" },
          ],
        },
      ],
    },
  },
};

const once = normalizeSharedPrimaryNavigation(project);
const twice = normalizeSharedPrimaryNavigation(once);
assert.deepEqual(twice.globalNavBlock, once.globalNavBlock, "Repeated shared navigation normalization must be idempotent.");
assert.equal(countHref(once, "/email"), 1, "Email must appear once.");
assert.equal(countHref(once, "/sms"), 1, "SMS must appear once.");
assert.equal(countHref(once, "/crm"), 1, "CRM must appear once.");
assert.equal(once.globalNavBlock.props.stickyMode, "sticky-solid", "sticky-solid must survive shared navigation normalization.");
assert.equal(once.pageBlocks.Home.some((block) => block.type === "nav-bar"), false, "Page-level primary nav blocks must be stripped once a shared nav exists.");

const published = createPublicationPayload(once).site_data;
assert.equal(countHref(published, "/email"), 1, "Published shared navigation must keep Email once.");
assert.equal(countHref(published, "/sms"), 1, "Published shared navigation must keep SMS once.");
assert.equal(countHref(published, "/crm"), 1, "Published shared navigation must keep CRM once.");
assert.equal(published.globalNavBlock.props.stickyMode, "sticky-solid", "Published shared navigation must keep sticky-solid.");

const propertiesPanel = read("components/website-builder/page-builder/pbPropertiesPanels.js");
assert.match(propertiesPanel, /if \(existingRows\.length > 0\)/, "The nav editor must not merge default links into an existing saved navigation.");

const visualBuilder = read("pages/modules/website-builder/visual-builder.js");
assert.match(visualBuilder, /function loadPageDraftIntoProject\(pageName\)/, "Page switching must fetch the selected page draft from split storage.");
assert.match(visualBuilder, /remoteWouldDropDurableVideo/, "Page switching must not replace a durable local video with a remote page that lost it.");

console.log("Website Builder shared navigation and Modules video persistence checks passed.");
