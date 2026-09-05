import assert from "node:assert/strict";
import { inferCtaLinkType, normalizeHrefByType, resolveRenderedCtaHref } from "../lib/website-builder/buttonLinks.js";

function normalizeCtaPatch(nextCta = {}) {
  const normalized = { ...nextCta };
  if (normalized.linkType === "page") {
    normalized.pageId = String(normalized.pageId || "").trim() || null;
    normalized.href = normalizeHrefByType("page", normalized.href || "");
  } else if (normalized.linkType === "none") {
    normalized.pageId = null;
    normalized.href = "";
  } else {
    normalized.pageId = null;
    normalized.href = normalizeHrefByType(normalized.linkType, normalized.href || "");
  }
  return normalized;
}

function normalizeHeroButtonLink(props = {}, slot = "primary") {
  const isSecondary = slot === "secondary";
  const source = isSecondary ? (props.secondaryCta || {}) : (props.cta || {});
  const text = String(source.text || (isSecondary ? props.secondaryCtaText : props.ctaText || props.buttonText) || "").trim();
  const href = String(source.href || (isSecondary ? props.secondaryCtaLink : props.ctaLink || props.buttonLink || props.link || props.href) || "").trim();
  const linkType = inferCtaLinkType(href, source.linkType || "");
  return {
    text,
    href: normalizeHrefByType(linkType, href),
    linkType,
    pageId: String(source.pageId || "").trim() || null,
    newTab: !!source.newTab || !!source.openInNewTab,
  };
}

function applyHeroButtonUpdate(blockProps = {}, slot = "primary", patch = {}) {
  const isSecondary = slot === "secondary";
  const current = normalizeHeroButtonLink(blockProps, isSecondary ? "secondary" : "primary");
  const nextCta = normalizeCtaPatch({ ...current, ...patch });

  if (isSecondary) {
    return {
      ...blockProps,
      secondaryCta: nextCta,
      secondaryCtaText: nextCta.text,
      secondaryCtaLink: nextCta.href,
      secondaryCtaNewTab: nextCta.newTab,
    };
  }

  return {
    ...blockProps,
    cta: nextCta,
    ctaText: nextCta.text,
    buttonText: nextCta.text,
    ctaLink: nextCta.href,
    buttonLink: nextCta.href,
    ctaNewTab: nextCta.newTab,
  };
}

const initialProps = {
  cta: {
    text: "Start Free Trial",
    href: "https://app.gr8result.digital/login",
    linkType: "external",
    newTab: true,
  },
  ctaText: "Start Free Trial",
  ctaLink: "https://app.gr8result.digital/login",
  buttonLink: "https://app.gr8result.digital/login",
  secondaryCta: {
    text: "Book a Live Demo",
    href: "/contact",
    linkType: "page",
    newTab: false,
  },
  secondaryCtaText: "Book a Live Demo",
  secondaryCtaLink: "/contact",
};

const afterSecondaryUpdate = applyHeroButtonUpdate(initialProps, "secondary", {
  href: "/pricing",
  linkType: "page",
});

assert.equal(
  afterSecondaryUpdate.ctaLink,
  "https://app.gr8result.digital/login",
  "Updating secondary URL must not overwrite primary URL",
);
assert.equal(
  afterSecondaryUpdate.secondaryCtaLink,
  "/pricing",
  "Secondary URL must update independently",
);

const afterPrimaryUpdate = applyHeroButtonUpdate(afterSecondaryUpdate, "primary", {
  href: "https://app.gr8result.digital/create-account",
  linkType: "external",
});

assert.equal(
  afterPrimaryUpdate.ctaLink,
  "https://app.gr8result.digital/create-account",
  "Primary URL must update independently",
);
assert.equal(
  afterPrimaryUpdate.secondaryCtaLink,
  "/pricing",
  "Updating primary URL must not overwrite secondary URL",
);

const pageMap = new Map([
  ["contact", { href: "/contact" }],
  ["pricing", { href: "/pricing" }],
]);

const primaryHref = resolveRenderedCtaHref(afterPrimaryUpdate.cta, { pageMap });
const secondaryHref = resolveRenderedCtaHref(afterPrimaryUpdate.secondaryCta, { pageMap });

assert.equal(
  primaryHref,
  "https://app.gr8result.digital/create-account",
  "Renderer must keep primary external URL",
);
assert.equal(
  secondaryHref,
  "/pricing",
  "Renderer must keep secondary page URL",
);
assert.notEqual(primaryHref, secondaryHref, "Primary and secondary href must remain different");

const persistedRoundTrip = JSON.parse(JSON.stringify(afterPrimaryUpdate));
assert.equal(
  persistedRoundTrip.ctaLink,
  "https://app.gr8result.digital/create-account",
  "Primary URL must survive persistence round trip",
);
assert.equal(
  persistedRoundTrip.secondaryCtaLink,
  "/pricing",
  "Secondary URL must survive persistence round trip",
);
assert.notEqual(
  persistedRoundTrip.ctaLink,
  persistedRoundTrip.secondaryCtaLink,
  "Persisted primary and secondary URLs must remain different",
);

const requiredProjectHubPrimary = "https://app.gr8result.digital/login";
const requiredProjectHubSecondary = "/contact";
const projectHubProps = applyHeroButtonUpdate(
  applyHeroButtonUpdate(initialProps, "primary", { href: requiredProjectHubPrimary, linkType: "external" }),
  "secondary",
  { href: requiredProjectHubSecondary, linkType: "page" },
);
assert.equal(projectHubProps.ctaLink, requiredProjectHubPrimary, "Project Hub primary URL must remain exact");
assert.equal(projectHubProps.secondaryCtaLink, requiredProjectHubSecondary, "Project Hub secondary URL must remain exact");
assert.notEqual(projectHubProps.ctaLink, projectHubProps.secondaryCtaLink, "Project Hub button URLs must remain different");

console.log("website builder hero CTA independence regression checks passed");
