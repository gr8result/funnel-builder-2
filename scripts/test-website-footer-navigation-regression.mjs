import fs from "node:fs";
import assert from "node:assert/strict";
import {
  buildFooterLinksFromMainNavigation,
  buildFooterNavigationContext,
  normalizeFooterNavigationProps,
} from "../lib/website-builder/footerNavigation.js";

const expectedFooterLinks = [
  ["Home", "/"],
  ["Modules", "/modules"],
  ["Email", "/email"],
  ["SMS", "/sms"],
  ["CRM", "/crm"],
  ["Funnels", "/funnels"],
  ["Website Builder", "/website-builder"],
  ["Social Media", "/social-media"],
  ["Project Hub", "/project-hub"],
  ["About Us", "/about-us"],
  ["Pricing", "/pricing"],
  ["Contact Us", "/contact-us"],
].map(([label, href]) => ({ label, href }));

const pages = expectedFooterLinks.map((link, index) => ({
  id: `page-${index}`,
  name: link.label,
  slug: link.href === "/" ? "home" : link.href.slice(1),
  order: index,
}));

const mainNavigation = [
  { label: "Home", href: "/" },
  {
    label: "Modules",
    href: "/modules",
    children: [
      { label: "Email", href: "/email" },
      { label: "SMS", href: "/sms" },
      { label: "CRM", href: "/crm" },
      { label: "Funnels", href: "/funnels" },
      { label: "Website Builder", href: "/website-builder" },
      { label: "Social Media", href: "/social-media" },
      { label: "Project Hub", href: "/project-hub" },
    ],
  },
  { label: "About Us", href: "/about-us" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact Us", href: "/contact-us" },
];

const context = buildFooterNavigationContext({ pages });
const matchedLinks = buildFooterLinksFromMainNavigation(mainNavigation, pages, context).map(({ label, href }) => ({ label, href }));
assert.deepEqual(matchedLinks, expectedFooterLinks, "match-main footer links should flatten dropdown children and use the required order");

const normalized = normalizeFooterNavigationProps({
  navLinks: [
    { label: "Home", href: "/" },
    { label: "[object Object]", href: "#object-object" },
    { label: "Page 9", href: "#page-9" },
  ],
  footerLinks: [{ label: "Should not compete", href: "/old" }],
  extraLinks: [{ label: "Blog", href: "/blog" }],
  spotlightHeading: "Highlights",
  spotlightText: "Add a stronger closing note here.",
}, context);

assert.deepEqual(normalized.navigationLinks.map(({ label, href }) => ({ label, href })), [{ label: "Home", href: "/" }]);
assert.equal(Object.prototype.hasOwnProperty.call(normalized, "navLinks"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized, "footerLinks"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized, "spotlightHeading"), false);
assert.equal(Object.prototype.hasOwnProperty.call(normalized, "spotlightText"), false);

const sparseContext = buildFooterNavigationContext({ pages: pages.filter((page) => !["social-media", "project-hub", "funnels", "website-builder"].includes(page.slug)) });
const sparseNormalized = normalizeFooterNavigationProps({ navigationLinks: expectedFooterLinks }, sparseContext);
assert.deepEqual(
  sparseNormalized.navigationLinks.map(({ label, href }) => ({ label, href })),
  expectedFooterLinks,
  "canonical product footer links must survive even when they are nested outside the top-level page records"
);

const editedPageLink = normalizeFooterNavigationProps({
  navigationLinks: [{ pageId: "page-0", label: "Edited Home", href: "/start-here" }],
}, context);
assert.deepEqual(
  editedPageLink.navigationLinks.map(({ label, href }) => ({ label, href })),
  [{ label: "Edited Home", href: "/start-here" }],
  "manual footer label and href edits must not be overwritten by matched page records"
);

const defaults = JSON.parse(fs.readFileSync("data/website-builder-defaults.json", "utf8"));
const footer = defaults?.projects?.["2208a52a-8175-477e-823c-fc6de7fe4afe"]?.globalFooterBlock
  || findGlobalFooter(defaults);
assert.equal(footer?.type, "footer");
assert.deepEqual(footer.props.navigationLinks.map(({ label, href }) => ({ label, href })), expectedFooterLinks);
assert.deepEqual(footer.props.extraLinks.map(({ label, href }) => ({ label, href })), [
  { label: "Blog", href: "/blog" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms" },
]);

const rendererSource = fs.readFileSync("components/website-builder/WebsiteBlockRenderer.js", "utf8");
assert.equal(rendererSource.includes("Add a stronger closing note here."), false);
assert.equal(rendererSource.includes(">Highlights<"), false);

console.log("Website footer navigation regression checks passed.");

function findGlobalFooter(value) {
  if (!value || typeof value !== "object") return null;
  if (value.globalFooterBlock?.type === "footer" && value.globalFooterBlock?.props?.brand === "Gr8 Result Digital Solutions") {
    return value.globalFooterBlock;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findGlobalFooter(item);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findGlobalFooter(item);
    if (found) return found;
  }
  return null;
}
