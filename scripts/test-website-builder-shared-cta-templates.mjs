import assert from "node:assert/strict";
import fs from "node:fs";
import { generateWebsitePageHtml } from "../lib/website-builder/projectStore.js";
import { createPublicationPayload } from "../lib/website-builder/publishConfig.js";
import {
  SHARED_FREE_TRIAL_CTA_ID,
  SHARED_FREE_TRIAL_CTA_NAME,
  buildSharedBlockTemplate,
  detachSharedBlockInstance,
  getSharedBlockTemplateUsage,
  normalizeSharedBlockTemplateProject,
  resolveCtaOpenInNewTab,
  resolveSharedBlockInstance,
  resolveSharedBlockInstances,
  updateSharedBlockTemplateFromBlock,
} from "../lib/website-builder/sharedBlockTemplates.js";

const canonicalBlock = {
  id: "canonical-free-trial-cta",
  type: "cta-button",
  props: {
    eyebrow: "Start Free Trial",
    title: "Ready To See What Your Business Could Become?",
    description: "Start with a focused 14 day trial.",
    text: "Click Here To Start Your 14 Day Free Trial",
    link: "https://app.gr8result.digital/login",
    linkType: "external",
    openInNewTab: true,
    style: "stacked-card",
    size: "large",
    note: "No card required.",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    buttonColor: "#16a34a",
    buttonTextColor: "#ffffff",
  },
};

const canonicalUrl = canonicalBlock.props.link;
const canonicalLabel = canonicalBlock.props.text;

function linkedBlock(id) {
  return {
    id,
    type: "cta-button",
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    props: {
      sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
      sharedTemplateName: SHARED_FREE_TRIAL_CTA_NAME,
    },
  };
}

function renderHomeHtml(sourceProject) {
  return generateWebsitePageHtml(sourceProject, sourceProject.pages[0], sourceProject.pageBlocks.Home);
}

function assertTargetState(html, expected, label) {
  if (expected) {
    assert.match(html, /target="_blank"/, `${label}: target should be present`);
    assert.match(html, /rel="noopener noreferrer"/, `${label}: rel should be present`);
    return;
  }
  assert.doesNotMatch(html, /target="_blank"/, `${label}: target should be absent`);
  assert.doesNotMatch(html, /rel="noopener noreferrer"/, `${label}: rel should be absent`);
}

let project = {
  id: "shared-cta-regression",
  name: "Shared CTA Regression",
  pages: [
    { id: "home", name: "Home", slug: "home", order: 0 },
    { id: "pricing", name: "Pricing", slug: "pricing", order: 1 },
    { id: "contact", name: "Contact Us", slug: "contact-us", order: 2 },
  ],
  pageBlocks: {
    Home: [linkedBlock("home-cta")],
    Pricing: [linkedBlock("pricing-cta")],
    "Contact Us": [
      {
        id: "contact-independent-cta",
        type: "cta-button",
        props: {
          title: "Book a consultation",
          text: "Talk to us",
          link: "/contact-us",
          openInNewTab: false,
        },
      },
    ],
  },
  sharedBlockTemplates: {
    [SHARED_FREE_TRIAL_CTA_ID]: buildSharedBlockTemplate({
      id: SHARED_FREE_TRIAL_CTA_ID,
      name: SHARED_FREE_TRIAL_CTA_NAME,
      blockType: "cta-button",
      blockData: canonicalBlock,
      updatedAt: "2026-08-12T00:00:00.000Z",
    }),
  },
};

assert.equal(getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID).length, 2, "two page instances should reference one shared CTA");

const resolvedBefore = resolveSharedBlockInstances([project.pageBlocks.Home[0], project.pageBlocks.Pricing[0]], project);
assert.deepEqual(resolvedBefore.map((block) => block.props.text), [
  "Click Here To Start Your 14 Day Free Trial",
  "Click Here To Start Your 14 Day Free Trial",
]);
assert.deepEqual(resolvedBefore.map((block) => block.props.link), [
  canonicalUrl,
  canonicalUrl,
]);
assert.deepEqual(resolvedBefore.map((block) => block.props.openInNewTab), [true, true]);
assert.equal(resolveCtaOpenInNewTab({ openInNewTab: false, newTab: true, targetBlank: true }), false, "openInNewTab false must win over stale true aliases");

project = updateSharedBlockTemplateFromBlock(project, SHARED_FREE_TRIAL_CTA_ID, {
  ...resolveSharedBlockInstance(project.pageBlocks.Home[0], project),
  props: {
    ...canonicalBlock.props,
    text: "TEMP SHARED CTA LABEL",
    link: "https://app.gr8result.digital/login?source=test",
    openInNewTab: false,
  },
});

const resolvedAfterEdit = resolveSharedBlockInstances([project.pageBlocks.Home[0], project.pageBlocks.Pricing[0]], project);
assert.deepEqual(resolvedAfterEdit.map((block) => block.props.text), ["TEMP SHARED CTA LABEL", "TEMP SHARED CTA LABEL"], "shared label edit should update all linked pages");
assert.deepEqual(resolvedAfterEdit.map((block) => block.props.link), ["https://app.gr8result.digital/login?source=test", "https://app.gr8result.digital/login?source=test"], "shared URL edit should update all linked pages");
assert.deepEqual(resolvedAfterEdit.map((block) => block.props.openInNewTab), [false, false], "open-in-new-tab OFF should update all linked pages");
assert.deepEqual(resolvedAfterEdit.map((block) => block.props.newTab), [false, false], "newTab alias should not stay locked true");
assertTargetState(renderHomeHtml(project), false, "open-in-new-tab OFF static HTML");

project = updateSharedBlockTemplateFromBlock(project, SHARED_FREE_TRIAL_CTA_ID, {
  ...resolvedAfterEdit[0],
  props: {
    ...resolvedAfterEdit[0].props,
    text: canonicalLabel,
    link: canonicalUrl,
    openInNewTab: true,
  },
});

const resolvedRestored = resolveSharedBlockInstances([project.pageBlocks.Home[0], project.pageBlocks.Pricing[0]], project);
assert.deepEqual(resolvedRestored.map((block) => block.props.text), [canonicalLabel, canonicalLabel], "shared label restore should update all linked pages");
assert.deepEqual(resolvedRestored.map((block) => block.props.openInNewTab), [true, true], "open-in-new-tab ON should update all linked pages");
assertTargetState(renderHomeHtml(project), true, "open-in-new-tab ON static HTML");

const publishedHtml = generateWebsitePageHtml(project, project.pages[0], project.pageBlocks.Home);
assert.match(publishedHtml, /href="https:\/\/app\.gr8result\.digital\/login"/, "published HTML should render canonical href");
assertTargetState(publishedHtml, true, "published HTML");

const legacyAliasProject = normalizeSharedBlockTemplateProject({
  ...project,
  sharedBlockTemplates: {
    [SHARED_FREE_TRIAL_CTA_ID]: buildSharedBlockTemplate({
      id: SHARED_FREE_TRIAL_CTA_ID,
      name: SHARED_FREE_TRIAL_CTA_NAME,
      blockType: "cta-button",
      blockData: {
        id: "legacy-alias-cta",
        type: "cta-button",
        props: {
          buttonLabel: canonicalBlock.props.text,
          href: canonicalBlock.props.link,
          targetBlank: true,
        },
      },
    }),
  },
});
const resolvedLegacyAlias = resolveSharedBlockInstance(legacyAliasProject.pageBlocks.Home[0], legacyAliasProject);
assert.equal(resolvedLegacyAlias.props.text, canonicalBlock.props.text, "legacy buttonLabel should hydrate to canonical text");
assert.equal(resolvedLegacyAlias.props.link, canonicalBlock.props.link, "legacy href should hydrate to canonical link");
assert.equal(resolvedLegacyAlias.props.openInNewTab, true, "legacy targetBlank should hydrate to canonical openInNewTab");

const futureOffProject = normalizeSharedBlockTemplateProject({
  ...project,
  sharedBlockTemplates: {
    futureOffCta: buildSharedBlockTemplate({
      id: "futureOffCta",
      name: "Future OFF CTA",
      blockType: "cta-button",
      blockData: {
        id: "future-off-cta",
        type: "cta-button",
        props: {
          text: "Stay in this tab",
          link: "/contact-us",
          openInNewTab: false,
          newTab: true,
        },
      },
    }),
  },
  pageBlocks: { Home: [{ id: "future-off-instance", type: "cta-button", sharedTemplateId: "futureOffCta", props: { sharedTemplateId: "futureOffCta" } }] },
});
assert.equal(resolveSharedBlockInstance(futureOffProject.pageBlocks.Home[0], futureOffProject).props.openInNewTab, false, "future template can choose OFF");
assertTargetState(renderHomeHtml(futureOffProject), false, "future OFF template HTML");

const futureOnProject = updateSharedBlockTemplateFromBlock(futureOffProject, "futureOffCta", {
  ...resolveSharedBlockInstance(futureOffProject.pageBlocks.Home[0], futureOffProject),
  props: {
    ...resolveSharedBlockInstance(futureOffProject.pageBlocks.Home[0], futureOffProject).props,
    openInNewTab: true,
  },
});
assert.equal(resolveSharedBlockInstance(futureOnProject.pageBlocks.Home[0], futureOnProject).props.openInNewTab, true, "future template can choose ON");
assertTargetState(renderHomeHtml(futureOnProject), true, "future ON template HTML");

const missingTemplateHtml = generateWebsitePageHtml(
  { ...project, sharedBlockTemplates: {} },
  project.pages[0],
  [linkedBlock("missing-template-cta")]
);
assert.doesNotMatch(missingTemplateHtml, /href="#"/, "missing shared template must not render a same-page CTA link");
assert.doesNotMatch(missingTemplateHtml, />Get Started<\/a>/, "missing shared template must not render a fake fallback CTA");

const publication = createPublicationPayload(project);
assert.ok(publication.site_data.sharedBlockTemplates?.[SHARED_FREE_TRIAL_CTA_ID], "publication payload must retain shared CTA templates");

const liveRouteSource = fs.readFileSync("pages/sites/[...slug].js", "utf8");
assert.match(
  liveRouteSource,
  /renderWebsiteBlock\(block,\s*\{[^}]*project[^}]*\}/s,
  "live route must pass the published project into page block rendering"
);

const detached = detachSharedBlockInstance(project.pageBlocks.Home[0], project);
assert.equal(detached.sharedTemplateId, undefined);
assert.equal(detached.props.text, canonicalLabel);
assert.equal(detached.props.openInNewTab, true);

project = updateSharedBlockTemplateFromBlock(project, SHARED_FREE_TRIAL_CTA_ID, {
  ...resolvedRestored[0],
  props: {
    ...resolvedRestored[0].props,
    text: "UPDATED AFTER DETACH",
    openInNewTab: false,
  },
});

assert.equal(detached.props.text, canonicalBlock.props.text, "detached instance should stop receiving shared updates");
assert.equal(detached.props.openInNewTab, true, "detached instance should keep copied new-tab state");
assert.equal(project.pageBlocks["Contact Us"][0].props.text, "Talk to us", "ordinary copied CTA should remain independent");

console.log("website builder shared CTA template regression checks passed");
