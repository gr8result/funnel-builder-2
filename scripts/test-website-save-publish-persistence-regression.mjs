import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createPublicationPayload,
  normalizePublishedGlobalFooterBlock,
  resolveWebsitePublicationStatus,
  resolveWebsiteUrls,
} from "../lib/website-builder/publishConfig.js";
import {
  diffWebsitePersistence,
  websitePersistenceHash,
} from "../lib/website-builder/documentVersion.js";
import { normalizeFooterNavigationBlock } from "../lib/website-builder/footerNavigation.js";

const pages = [
  { id: "home", name: "Home", slug: "home", order: 0 },
  { id: "modules", name: "Modules", slug: "modules", order: 1 },
  { id: "email", name: "Email", slug: "email", order: 2 },
  { id: "pricing", name: "Pricing", slug: "pricing", order: 3 },
];

const footerBlock = {
  id: "global-footer",
  type: "footer",
  props: {
    brand: "Gr8 Result Digital Solutions",
    contactHeading: "Contact",
    showNewsletter: true,
    newsletterHeading: "Stay Updated",
    linkGroups: [
      {
        id: "footer-navigation-column",
        heading: "Navigation",
        links: [
          { id: "nav-home", label: "Home", href: "/" },
          { id: "nav-email", label: "Email", href: "/email", nestedUnknown: { keep: true } },
        ],
      },
      {
        id: "footer-company-column",
        heading: "Company",
        links: [{ id: "company-privacy", label: "Privacy Policy", href: "/privacy-policy" }],
      },
    ],
  },
};

const project = {
  id: "2208a52a-8175-477e-823c-fc6de7fe4afe",
  name: "Gr8 Result Digital Solutions",
  slug: "gr8-result-digital-solutions",
  customDomain: "gr8result.solutions",
  primaryDomain: "gr8result.solutions",
  pages,
  pageBlocks: {
    Home: [{ id: "home-hero", type: "hero", props: { title: "Home" } }],
    Modules: [{ id: "modules-hero", type: "hero", props: { title: "Modules" } }],
    Email: [{ id: "email-hero", type: "hero", props: { title: "Email", unknownNested: { retainMe: "yes" } } }],
    Pricing: [{ id: "pricing-hero", type: "hero", props: { title: "Pricing" } }],
  },
  pagesContent: { Home: "", Modules: "", Email: "", Pricing: "" },
  chaiData: {},
  globalNavBlock: {
    id: "global-nav",
    type: "nav-bar",
    props: {
      brand: "Gr8 Result",
      stickyMode: "sticky",
      links: [{ label: "Email", href: "/email" }],
    },
  },
  globalFooterBlock: footerBlock,
};

const normalizedFooter = normalizeFooterNavigationBlock(footerBlock, { pages, logInvalid: true });
assert.equal(normalizedFooter.props.linkGroups.length, 2, "explicit footer link groups must survive normalization");
assert.equal(normalizedFooter.props.linkGroups[0].heading, "Navigation", "Navigation footer column heading must survive");
assert.equal(normalizedFooter.props.navigationLinks.length, 2, "Navigation group must populate navigationLinks for legacy render paths");
assert.equal(normalizedFooter.props.companyLinks.length, 1, "Company group must populate companyLinks for legacy render paths");
assert.equal(normalizedFooter.props.linkGroups[0].links[1].nestedUnknown.keep, true, "unknown nested footer link properties must not be stripped");

const publication = createPublicationPayload(project);
const siteData = publication.site_data;
const rootUrls = resolveWebsiteUrls(project);
const emailUrls = resolveWebsiteUrls(project, { page: "Email" });
const modulesUrls = resolveWebsiteUrls(project, { page: "Modules" });
const pricingUrls = resolveWebsiteUrls(project, { page: "Pricing" });
const publishedFooterGroups = siteData.globalFooterBlock.props.linkGroups;
const australianPanel = publishedFooterGroups.find((group) => group.type === "australian-company-panel");
const navigationPanel = publishedFooterGroups.find((group) => group.role === "navigation");
const oldCompanyPanel = publishedFooterGroups.find((group) => group.heading === "Company" && Array.isArray(group.links));
const footerCardRoles = [
  "contact",
  ...publishedFooterGroups.map((group) => group.role || group.type),
  ...(siteData.globalFooterBlock.props.showNewsletter !== false ? ["newsletter"] : []),
];

assert.equal(siteData.globalFooterBlock.props.linkGroups.length, 2, "published snapshot must retain shared footer link groups and content panels");
assert.deepEqual(footerCardRoles, ["contact", "navigation", "australian-company", "newsletter"], "published footer must retain four cards in the required order");
assert.equal(siteData.globalFooterBlock.props.linkGroups[0].heading, "Navigation", "published footer must retain Navigation column");
assert.ok(navigationPanel, "published shared footer must include the Navigation card");
assert.deepEqual(navigationPanel.links.map((link) => link.label), [
  "Home",
  "Modules",
  "Email",
  "SMS",
  "CRM",
  "Funnels",
  "Website Builder",
  "Social Media",
  "Project Hub",
  "About Us",
  "Pricing",
  "Contact Us",
], "Navigation card links must survive publishing");
assert.ok(australianPanel, "published shared footer must include the Australian company panel");
assert.equal(australianPanel.role, "australian-company", "Australian panel must keep a stable semantic role");
assert.equal(australianPanel.heading, "Proudly Australian", "Australian panel heading must survive publishing");
assert.equal(australianPanel.body, "Gr8 Result Digital Solutions is proudly Australian owned and operated. Our platform development and customer support are handled by our Australian team.", "Australian company wording must survive publishing");
assert.equal(australianPanel.location, "Sunshine Coast, Queensland", "Australian panel location must survive publishing");
assert.equal(australianPanel.timezone, "UTC+10", "Australian panel timezone must survive publishing");
assert.match(australianPanel.flagImageUrl, /^(data:image\/svg\+xml|https?:\/\/)/, "Australian flag image reference must survive publishing");
assert.equal(oldCompanyPanel, undefined, "legacy Company footer panel with Blog/Privacy/Terms must not be restored");
assert.deepEqual(siteData.globalFooterBlock.props.companyLinks.map((link) => link.label), ["Blog", "Privacy Policy", "Terms"], "legal links must remain in the narrow bottom footer row");
assert.equal(siteData.globalNavBlock.props.stickyMode, "sticky", "published snapshot must retain sticky nav mode");
assert.equal(siteData.pageBlocks.Email[0].props.unknownNested.retainMe, "yes", "unknown valid nested block props must survive publishing");
assert.equal(siteData.pageBlocks.Modules[0].props.title, "Modules", "publishing Email must not replace another page's content");
assert.equal(rootUrls.primaryPublicUrl, "https://gr8result.solutions", "custom domain must be the primary public website URL");
assert.equal(rootUrls.customDomainUrl, "https://gr8result.solutions", "custom domain URL must be explicit and not hidden behind primary_domain");
assert.match(rootUrls.internalPreviewUrl, /\/sites\/gr8-result-digital-solutions$/, "internal preview URL must remain the hosted /sites route");
assert.equal(emailUrls.primaryPublicUrl, "https://gr8result.solutions/email", "Email page URL must be appended to the custom domain");
assert.equal(emailUrls.customDomainUrl, "https://gr8result.solutions/email", "Email page custom domain URL must be page-aware");
assert.match(emailUrls.internalPreviewUrl, /\/sites\/gr8-result-digital-solutions\/email$/, "Email internal preview URL must be page-aware");
assert.equal(modulesUrls.primaryPublicUrl, "https://gr8result.solutions/modules", "page switches must not clear the custom domain owner");
assert.equal(pricingUrls.primaryPublicUrl, "https://gr8result.solutions/pricing", "Pricing must use the same custom-domain shared footer URL space");
["Home", "Email", "Modules", "Pricing"].forEach((pageName) => {
  const pageBlocks = siteData.pageBlocks[pageName] || [];
  assert.equal(pageBlocks.some((block) => block?.type === "footer"), false, `${pageName} must not publish a separate outdated page footer`);
  assert.ok(siteData.globalFooterBlock.props.linkGroups.find((group) => group.type === "australian-company-panel"), `${pageName} must rely on the shared Australian footer panel`);
});

const readBackHash = websitePersistenceHash(JSON.parse(JSON.stringify(siteData)));
assert.equal(readBackHash, websitePersistenceHash(siteData), "published snapshot hash must survive JSON database round trip");
assert.deepEqual(diffWebsitePersistence(siteData, JSON.parse(JSON.stringify(siteData))), [], "canonical persistence diff must be empty after JSON round trip");

assert.equal(resolveWebsitePublicationStatus({
  id: project.id,
  pages,
  publishedAt: "2026-07-20T17:35:31.171+10:00",
}).label, "Never published", "timestamp alone must not count as published");

assert.equal(resolveWebsitePublicationStatus({
  id: project.id,
  pages,
  projectVersion: "pv_same",
  publishedVersion: "pv_same",
  publishedAt: "2026-07-20T17:35:31.171+10:00",
}, { expectedWebsiteId: project.id }).label, "Published", "matching saved and published revision must be Published");

assert.equal(resolveWebsitePublicationStatus({
  id: project.id,
  pages,
  projectVersion: "pv_draft_newer",
  publishedVersion: "pv_live_old",
  publishedAt: "2026-07-20T17:35:31.171+10:00",
}, { expectedWebsiteId: project.id }).label, "Unpublished changes", "newer draft revision against valid published snapshot must be Unpublished changes");

assert.equal(resolveWebsitePublicationStatus({
  id: project.id,
  pages,
  projectVersion: "pv_draft_newer",
  publishedVersion: "pv_live_old",
  publishedAt: "2026-07-20T17:35:31.171+10:00",
}, { expectedWebsiteId: "different-website" }).label, "Never published", "published snapshot from another website must not count as valid");

const rendererSource = fs.readFileSync("components/website-builder/WebsiteBlockRenderer.js", "utf8");
assert.match(rendererSource, /explicitLinkGroups/, "public renderer must render explicit saved footer link groups");
assert.match(rendererSource, /australian-company-panel/, "public renderer must render the Australian company panel");
const navRendererSource = fs.readFileSync("components/website-builder/website-renderer/wbBlockComponents.js", "utf8");
assert.match(navRendererSource, /stickyMode === "sticky"/, "public renderer must apply sticky navigation from saved stickyMode");

const routeSource = fs.readFileSync("pages/sites/[...slug].js", "utf8");
assert.match(routeSource, /X-GR8-Published-Revision/, "public route must expose published revision header");
assert.match(routeSource, /X-GR8-Snapshot-Hash/, "public route must expose snapshot hash header");

const normalizedPublishedFooter = normalizePublishedGlobalFooterBlock(siteData.globalFooterBlock, siteData, { pages }, null);
assert.equal(normalizedPublishedFooter.props.linkGroups[0].heading, "Navigation", "published footer normalizer must not fall back to a three-column footer");
const normalizedAustralianPanel = normalizedPublishedFooter.props.linkGroups.find((group) => group.type === "australian-company-panel");
assert.ok(normalizedAustralianPanel, "published footer normalizer must retain the Australian panel on hard refresh");
assert.equal(normalizedAustralianPanel.body, australianPanel.body, "hard refresh must not restore the old Company panel text");
assert.deepEqual([
  "contact",
  ...normalizedPublishedFooter.props.linkGroups.map((group) => group.role || group.type),
  ...(normalizedPublishedFooter.props.showNewsletter !== false ? ["newsletter"] : []),
], ["contact", "navigation", "australian-company", "newsletter"], "hard refresh must not reduce the footer to three cards");

console.log("Website save-to-publish persistence regression checks passed.");
