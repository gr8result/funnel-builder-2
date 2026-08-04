import assert from "node:assert/strict";
import { normalizeSharedPrimaryNavigation, primaryNavigationSharedComponentId } from "../lib/website-builder/sharedNavigation.js";

const NAV_BAR = "nav-bar";
const HERO = "hero";
const TEXT = "text";

function navBlock(id, props = {}) {
  return {
    id,
    type: NAV_BAR,
    props: {
      logoText: "GR8",
      stickyMode: "normal",
      links: [
        { label: "Home", href: "/" },
        { label: "Contact", href: "/contact-us" },
      ],
      ...props,
    },
  };
}

function baseProject() {
  return {
    id: "site-shared-nav-test",
    name: "Shared Navigation Test",
    pages: [
      { name: "Home", slug: "home" },
      { name: "Contact Us", slug: "contact-us" },
      { name: "CRM", slug: "crm" },
    ],
    globalNavBlock: navBlock("global-nav", {
      stickyMode: "normal",
      links: [{ label: "Home", href: "/" }],
    }),
    pageBlocks: {
      Home: [
        navBlock("home-stale-nav", { stickyMode: "stale-home", links: [{ label: "Stale Home", href: "#" }] }),
        { id: "home-hero", type: HERO, props: { headline: "Home body" } },
      ],
      "Contact Us": [
        navBlock("contact-stale-nav", { stickyMode: "stale-contact", links: [{ label: "Stale Contact", href: "#" }] }),
        { id: "contact-text", type: TEXT, props: { text: "Contact body" } },
      ],
      CRM: [
        navBlock("crm-stale-nav", { stickyMode: "stale-crm", links: [{ label: "Stale CRM", href: "#" }] }),
        { id: "crm-text", type: TEXT, props: { text: "CRM body" } },
      ],
    },
  };
}

function pageHasNavigation(project, pageName) {
  return (project.pageBlocks?.[pageName] || []).some((block) => block?.type === NAV_BAR);
}

function normalizeAfterEditingGlobalNav(project, editedProps) {
  return normalizeSharedPrimaryNavigation({
    ...project,
    globalNavBlock: {
      ...project.globalNavBlock,
      props: {
        ...(project.globalNavBlock?.props || {}),
        ...editedProps,
      },
    },
  });
}

function assertNoPageNavigationCopies(project) {
  for (const page of project.pages) {
    assert.equal(pageHasNavigation(project, page.name), false, `${page.name} should reference shared navigation, not store a page nav copy`);
  }
}

{
  const contactEdit = normalizeAfterEditingGlobalNav(baseProject(), {
    stickyMode: "sticky",
    links: [{ label: "Contact Changed", href: "/contact-us" }],
  });

  assert.equal(contactEdit.globalNavBlock.props.stickyMode, "sticky", "editing navigation on Contact Us updates the canonical shared nav");
  assert.deepEqual(contactEdit.globalNavBlock.props.links, [{ label: "Contact Changed", href: "/contact-us" }], "CRM receives the same canonical menu links");
  assertNoPageNavigationCopies(contactEdit);
}

{
  const crmEdit = normalizeAfterEditingGlobalNav(baseProject(), {
    logoText: "CRM Edit",
    stickyMode: "sticky",
  });

  assert.equal(crmEdit.globalNavBlock.props.logoText, "CRM Edit", "editing navigation on CRM changes Home through the shared nav");
  assert.equal(crmEdit.globalNavBlock.props.stickyMode, "sticky", "sticky setting remains identical across all pages");
  assertNoPageNavigationCopies(crmEdit);
}

{
  const saved = normalizeAfterEditingGlobalNav(baseProject(), {
    stickyMode: "sticky",
    supportButtonLabel: "Book now",
  });
  const refreshed = normalizeSharedPrimaryNavigation(JSON.parse(JSON.stringify(saved)));

  assert.equal(refreshed.globalNavBlock.props.stickyMode, "sticky", "refreshing the builder retains the shared navigation");
  assert.equal(refreshed.globalNavBlock.props.supportButtonLabel, "Book now", "refresh retains visible nav settings");
}

{
  const projectWithNewPage = normalizeSharedPrimaryNavigation({
    ...baseProject(),
    pages: [...baseProject().pages, { name: "Email", slug: "email" }],
    pageBlocks: {
      ...baseProject().pageBlocks,
      Email: [{ id: "email-text", type: TEXT, props: { text: "Email body remains page-specific" } }],
    },
  });

  assert.equal(projectWithNewPage.globalNavBlock.sharedComponentId, primaryNavigationSharedComponentId(projectWithNewPage), "new pages use the stable shared navigation id");
  assert.equal(pageHasNavigation(projectWithNewPage, "Email"), false, "adding a new page does not create a navigation copy");
  assert.equal(projectWithNewPage.pageBlocks.Email[0].props.text, "Email body remains page-specific", "new page body content remains page-specific");
}

{
  const publishedFromAnyPage = normalizeSharedPrimaryNavigation({
    ...baseProject(),
    activePage: "CRM",
    globalNavBlock: navBlock("global-nav", { stickyMode: "sticky", backgroundColor: "#111111" }),
  });

  assert.equal(publishedFromAnyPage.globalNavBlock.props.backgroundColor, "#111111", "publishing from any page uses the same shared navigation");
  assertNoPageNavigationCopies(publishedFromAnyPage);
}

{
  const normalized = normalizeSharedPrimaryNavigation(baseProject());

  assert.deepEqual(normalized.pageBlocks.Home, [{ id: "home-hero", type: HERO, props: { headline: "Home body" } }], "Home body content remains page-specific");
  assert.deepEqual(normalized.pageBlocks["Contact Us"], [{ id: "contact-text", type: TEXT, props: { text: "Contact body" } }], "Contact body content remains page-specific");
  assert.deepEqual(normalized.pageBlocks.CRM, [{ id: "crm-text", type: TEXT, props: { text: "CRM body" } }], "CRM body content remains page-specific");
}

{
  const normalized = normalizeSharedPrimaryNavigation(baseProject());

  assert.equal(normalized.globalNavBlock.props.stickyMode, "normal", "old page-level navigation copies cannot overwrite the shared navigation");
  assert.equal(normalized.globalNavBlock.props.links[0].label, "Home", "stale page-level links cannot overwrite the shared navigation");
}

{
  const legacyWithoutGlobal = normalizeSharedPrimaryNavigation({
    id: "legacy-site-with-page-navs",
    pages: [{ name: "Home" }, { name: "CRM" }],
    pageBlocks: {
      Home: [navBlock("approved-home-nav", { stickyMode: "sticky", logoText: "Approved" }), { id: "home-text", type: TEXT, props: { text: "Home" } }],
      CRM: [navBlock("stale-crm-nav", { stickyMode: "normal", logoText: "Stale" }), { id: "crm-text", type: TEXT, props: { text: "CRM" } }],
    },
  });

  assert.equal(legacyWithoutGlobal.globalNavBlock.props.logoText, "Approved", "legacy normalisation promotes the current approved navigation");
  assert.equal(legacyWithoutGlobal.globalNavBlock.props.stickyMode, "sticky", "legacy normalisation preserves approved navigation settings");
  assertNoPageNavigationCopies(legacyWithoutGlobal);
}

console.log("Website Builder shared navigation regression tests passed.");
