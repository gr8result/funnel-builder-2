import { supabaseAdmin } from "../supabaseAdmin";
import { normalizeDomain, resolveWebsiteDomain, slugifyWebsiteValue } from "./publishConfig";

function normalizePublication(record) {
  if (!record) return null;
  return {
    ...record,
    site_data: record.site_data && typeof record.site_data === "object" ? record.site_data : {},
    resolved_domain: resolveWebsiteDomain(record),
  };
}

function shouldLogPublicationResolution() {
  return process.env.WEBSITE_PUBLISH_DEBUG === "1" || process.env.NEXT_PUBLIC_WEBSITE_PUBLISH_DEBUG === "1";
}

function logPublicationResolution(event, payload = {}) {
  if (!shouldLogPublicationResolution()) return;
  console.info(`[website-publication] ${event}`, payload);
}

function publicationRevisionSortValue(record = {}) {
  const siteData = record?.site_data && typeof record.site_data === "object" ? record.site_data : {};
  const revision = siteData.publishedVersion || siteData.publication?.publishedVersion || siteData.projectVersion || "";
  const match = String(revision || "").match(/^pv_(\d{8,17})_/);
  return match ? match[1] : "";
}

function publicationVerifiedRank(record = {}) {
  const siteData = record?.site_data && typeof record.site_data === "object" ? record.site_data : {};
  const publication = siteData.publication && typeof siteData.publication === "object" ? siteData.publication : {};
  if (publication.verified === true || publication.readBackVerified === true) return 2;
  if (siteData.publishedVersion || publication.publishedVersion) return 1;
  return 0;
}

function publicationTimeValue(record = {}, key = "published_at") {
  const value = key === "updated_at" ? record?.updated_at : record?.published_at;
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function sortPublishedCandidates(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const activeRank = Number(right?.published === true) - Number(left?.published === true);
    if (activeRank) return activeRank;
    const verifiedRank = publicationVerifiedRank(right) - publicationVerifiedRank(left);
    if (verifiedRank) return verifiedRank;
    const rightRevision = publicationRevisionSortValue(right);
    const leftRevision = publicationRevisionSortValue(left);
    if (rightRevision !== leftRevision) return rightRevision.localeCompare(leftRevision);
    return publicationTimeValue(right, "published_at") - publicationTimeValue(left, "published_at")
      || publicationTimeValue(right, "updated_at") - publicationTimeValue(left, "updated_at");
  });
}

export async function getPublishedWebsiteBySlug(slug) {
  const safeSlug = slugifyWebsiteValue(slug);
  if (!safeSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id, project_id, name, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .eq("slug", safeSlug)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(25);

  const selected = sortPublishedCandidates(data)[0] || null;
  if (error || !selected) return null;
  return normalizePublication(selected);
}

export async function getPublishedWebsiteByDomain(hostname) {
  const host = normalizeDomain(hostname);
  if (!host) return null;

  const { data, error } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id, project_id, name, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .or(`custom_domain.eq.${host},primary_domain.eq.${host}`)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(10);

  const rows = Array.isArray(data) ? data : [];
  const exactCustomDomain = sortPublishedCandidates(rows.filter((record) => normalizeDomain(record?.custom_domain) === host))[0] || null;
  const exactPrimaryDomain = sortPublishedCandidates(rows.filter((record) => normalizeDomain(record?.primary_domain) === host))[0] || null;
  const selected = exactCustomDomain || exactPrimaryDomain || sortPublishedCandidates(rows)[0] || null;

  logPublicationResolution("domain lookup", {
    host,
    found: !!selected,
    id: selected?.id || null,
    slug: selected?.slug || null,
    customDomain: selected?.custom_domain || null,
    primaryDomain: selected?.primary_domain || null,
    published: selected?.published ?? null,
    candidateCount: rows.length,
    error: error?.message || null,
  });

  if (error || !selected) return null;
  return normalizePublication(selected);
}

export function slugifyPublishedPage(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function publishedPageAliases(value) {
  const slug = slugifyPublishedPage(value);
  if (!slug) return [""];
  const aliases = new Set([slug]);
  if (slug === "contact") aliases.add("contact-us");
  if (slug === "contact-us") aliases.add("contact");
  if (slug === "about") aliases.add("about-us");
  if (slug === "about-us") aliases.add("about");
  return Array.from(aliases);
}

export function publishedWebsiteHasPage(publication, requestedPath = []) {
  const project = publication?.site_data || {};
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const requested = Array.isArray(requestedPath) ? requestedPath.join("/") : String(requestedPath || "");
  const requestedAliases = publishedPageAliases(requested || "home");
  if (!requestedAliases[0] || requestedAliases.includes("home")) return pages.length > 0;

  return pages.some((page) => {
    const pageSlug = slugifyPublishedPage(page?.slug || page?.name || page?.title || "");
    return requestedAliases.includes(pageSlug);
  });
}

export async function getPrimaryPublishedWebsite(hostname = "") {
  const requestedHost = normalizeDomain(hostname);
  const directMatch = await getPublishedWebsiteByDomain(hostname);
  if (directMatch) {
    logPublicationResolution("primary resolved by domain", {
      requestedHost,
      id: directMatch.id || null,
      slug: directMatch.slug || null,
      customDomain: directMatch.custom_domain || null,
      primaryDomain: directMatch.primary_domain || null,
    });
    return directMatch;
  }

  const configuredSlug = slugifyWebsiteValue(
    process.env.PRIMARY_WEBSITE_SLUG
    || process.env.NEXT_PUBLIC_PRIMARY_WEBSITE_SLUG
    || ""
  );
  if (configuredSlug) {
    const byConfiguredSlug = await getPublishedWebsiteBySlug(configuredSlug);
    if (byConfiguredSlug) {
      logPublicationResolution("primary resolved by configured slug", {
        requestedHost,
        configuredSlug,
        id: byConfiguredSlug.id || null,
        customDomain: byConfiguredSlug.custom_domain || null,
      });
      return byConfiguredSlug;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id, project_id, name, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error || !Array.isArray(data)) {
    logPublicationResolution("primary list lookup failed", {
      requestedHost,
      error: error?.message || null,
    });
    return null;
  }

  const sortedRows = sortPublishedCandidates(data);
  const primaryRecord = sortedRows.find((record) => {
    const siteData = record?.site_data && typeof record.site_data === "object" ? record.site_data : {};
    const publication = siteData.publication && typeof siteData.publication === "object" ? siteData.publication : {};
    return siteData.isPrimaryWebsite === true
      || publication.isPrimaryWebsite === true
      || publication.primaryWebsite === true;
  });

  if (primaryRecord) {
    logPublicationResolution("primary resolved by flag", {
      requestedHost,
      id: primaryRecord.id || null,
      slug: primaryRecord.slug || null,
      customDomain: primaryRecord.custom_domain || null,
      primaryDomain: primaryRecord.primary_domain || null,
    });
    return normalizePublication(primaryRecord);
  }

  const gr8ResultRecord = sortedRows.find((record) => (
    slugifyWebsiteValue(record?.slug || "") === "gr8-result-digital-solutions"
    || /gr8 result digital solutions/i.test(String(record?.name || record?.site_data?.name || ""))
  ));

  const fallbackRecord = gr8ResultRecord || sortedRows[0] || null;
  logPublicationResolution("primary resolved by fallback", {
    requestedHost,
    found: !!fallbackRecord,
    id: fallbackRecord?.id || null,
    slug: fallbackRecord?.slug || null,
    customDomain: fallbackRecord?.custom_domain || null,
    primaryDomain: fallbackRecord?.primary_domain || null,
    candidateCount: data.length,
  });
  return normalizePublication(fallbackRecord);
}
