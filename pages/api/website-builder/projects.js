import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { getWebsiteLimitForResolvedPlan, getUserPlan } from "../../../lib/planResolver";
import { COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "../../../lib/website-builder/pageBlockComponents";
import {
  deleteSplitWebsiteProject,
  assembleWebsiteForRendering,
  listSplitWebsiteProjects,
  loadFullSplitWebsiteProject,
  migrateWebsiteProjectToSplitStorage,
  saveSplitWebsiteProject,
} from "../../../lib/website-builder/supabaseSiteStorage";
import {
  buildWebsiteProjectVersion,
  diffWebsitePersistence,
  summarizeWebsitePage,
  summarizeWebsitePersistence,
  websitePersistenceHash,
} from "../../../lib/website-builder/documentVersion";
import { normalizeAccordionBlocks } from "../../../lib/website-builder/accordionPanels";
import { DEFAULT_FOOTER_COMPANY_LINKS, GR8_RESULT_FOOTER_NAVIGATION_LINKS, applyGr8AustralianFooterPanel, buildFooterNavigationContext, footerBlockToGlobalFooter, globalFooterToFooterBlock, normalizeFooterNavigationBlock, normalizeFooterNavigationBlocks } from "../../../lib/website-builder/footerNavigation";
import { normalizeVideoHeroBlock, normalizeVideoHeroBlocksForPersistence } from "../../../lib/website-builder/videoHero";
import { collectVideoHeroMedia, normalizeDomain, resolveCanonicalGlobalFooterBlock, resolveProjectSlug, withProjectPublicationIdentity } from "../../../lib/website-builder/publishConfig";

const TABLE_NAME = "published_websites";
const GR8_RESULT_PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const VIDEO_ASSET_RETAINED_SAVE_ERROR = "Save failed: the video asset was not retained in the page record.";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function toErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function isMissingDraftProjectsTable(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(TABLE_NAME) && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table"));
}

function toDraftProjectId(projectId) {
  return `draft:${String(projectId || "").trim()}`;
}

function buildDraftSlug(projectId) {
  return `draft-${String(projectId || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
}

function buildDraftPrimaryDomain(projectId) {
  return `${buildDraftSlug(projectId)}.draft.local`;
}

const CURRENT_PLATFORM_PRICING = {
  starter: {
    price: "$159",
    individualPrice: "$215",
    description: "For solo operators and small teams just getting started.",
    features: ["Team Seats — 2 users", "CRM Pipelines — 1", "Communities — 1", "Social Profiles — 3", "Automation Workflows — 5", "Calendar & Bookings", "Shared Phone Number", "Marketplace Access", "Reporting — Email & CRM stats", "Support — Email"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 5,000", "Email sends/mo — 50,000", "SMS credits/mo — 500", "Websites — 1", "Funnels — Landing pages only", "Projects Hub — 3 jobs · 5 projects · 2 users", "AI credits/mo — 50", "Storage — 5 GB"],
    billingPrice: 159,
    chartIndividualPrice: 215,
  },
  growth: {
    price: "$359",
    individualPrice: "$474",
    description: "For growing teams scaling sales and marketing operations.",
    features: ["Team Seats — 5 users", "CRM Pipelines — 3", "Communities — 3", "Social Profiles — 7", "Automation Workflows — 8", "SMS Scheduled Campaigns — 3", "Call Recording & AI Transcription", "Calendar & Bookings", "Shared Phone Number", "Affiliate Management", "Reporting — Email, SMS & Call Analytics", "Support — Priority Email"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 15,000", "Email sends/mo — 150,000", "SMS credits/mo — 2,500", "Websites — 2", "Funnels — 1 (+ extras at cost)", "Projects Hub — 15 jobs · 20 projects · dependencies", "AI credits/mo — 250", "Storage — 25 GB"],
    billingPrice: 359,
    chartIndividualPrice: 474,
  },
  scale: {
    price: "$499",
    individualPrice: "$913",
    description: "For established businesses scaling teams and operations.",
    features: ["Team Seats — 10 users", "CRM Pipelines — 10", "Communities — Unlimited", "Social Profiles — 15", "Automation Workflows — 10", "SMS Scheduled Campaigns — 10", "AI Transcription + Sentiment", "AI Website Builder", "Shared Phone Number", "Reporting — Full Analytics + CSV export", "Support — Dedicated Onboarding"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 40,000", "Email sends/mo — 400,000", "SMS credits/mo — 5,000", "Websites — 3", "Funnels — 3 (+ extras at cost)", "Projects Hub — Unlimited jobs & projects · resource allocation · critical path", "AI credits/mo — 750", "Storage — 100 GB"],
    billingPrice: 499,
    chartIndividualPrice: 913,
  },
  professional: {
    price: "$999",
    individualPrice: "$1883",
    description: "Complete business OS for large businesses with bigger teams, higher turnover, and advanced support needs.",
    features: ["Team Seats — Up to 25 users", "CRM Pipelines — Unlimited", "Communities — Unlimited", "Social Profiles — Unlimited", "Automation Workflows — Unlimited", "AI Call Transcription & Sentiment", "AI Content & Post Generation", "Shared Phone Number", "Reporting — Full Analytics + Scheduled Reports", "Support — Account Manager + SLA"],
    extras: ["14 days free trial", "Email contacts — 200,000", "Email sends/mo — 2,000,000", "SMS credits/mo — 10,000", "Websites — 5", "Funnels — 10 (+ extras at cost)", "Projects Hub — Unlimited · API", "AI credits/mo — 5,000", "Storage — 500 GB"],
    billingPrice: 999,
    chartIndividualPrice: 1883,
  },
};

const CURRENT_PLATFORM_SAVINGS_HEADLINE = '<span style="color: rgb(255, 192, 0);"><span style="font-size: 64px;">Replace Multiple Expensive Subscriptions &amp; Save Up To $10,600 Per Year</span></span>';
const CURRENT_PLATFORM_PRICING_TITLE = 'Our Pricing Plans - Save up to $10,600 per year on your subscription costs<div><span style="color: rgb(255, 192, 0);">That\'s $10,600 back in your bank, not wasted on multiple platforms that do not do what you need. Our platform is designed to help you scale your business to new heights.</span></div>';

function platformPlanKey(name) {
  return String(name || "").toLowerCase().replace(/ plan$/, "").trim();
}

function syncPlatformPricingBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const props = { ...(block.props || {}) };

    if (block.type === "competitor-comparison") {
      const rowCount = Array.isArray(props.rows) ? props.rows.length : 0;
      const isLegacyCompetitorBlock = rowCount < 12
        || Number(props.planPrice || 0) === 199
        || /business plan/i.test(String(props.planName || ""))
        || /what you(?:'|\u2019)d pay elsewhere/i.test(String(props.title || ""));

      if (isLegacyCompetitorBlock) {
        Object.assign(props, COMPETITOR_COMPARISON_TEMPLATE_PROPS, block.props || {}, {
          rows: COMPETITOR_COMPARISON_TEMPLATE_PROPS.rows,
          title: props.title && !/what you(?:'|\u2019)d pay elsewhere/i.test(String(props.title || "")) ? props.title : COMPETITOR_COMPARISON_TEMPLATE_PROPS.title,
          planName: /business plan/i.test(String(props.planName || "")) ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.planName : (props.planName || COMPETITOR_COMPARISON_TEMPLATE_PROPS.planName),
          planPrice: Number(props.planPrice || 0) === 199 ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.planPrice : (Number(props.planPrice) || COMPETITOR_COMPARISON_TEMPLATE_PROPS.planPrice),
          backgroundColor: props.backgroundColor === "#070c18" || !props.backgroundColor ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.backgroundColor : props.backgroundColor,
        });
      }
    }

    if (block.type === "hero") {
      const headline = String(props.headline || props.headlineBlock?.content || "");
      if (/Save Up To \$?(9,900|10,600)/i.test(headline)) {
        props.headline = CURRENT_PLATFORM_SAVINGS_HEADLINE;
        props.headlineBlock = { ...(props.headlineBlock || {}), content: CURRENT_PLATFORM_SAVINGS_HEADLINE };
      }
    }

    if (block.type === "pricing-table") {
      const plans = Array.isArray(props.plans) ? props.plans : [];
      const isPlatformPricingTable = plans.some((plan) => CURRENT_PLATFORM_PRICING[platformPlanKey(plan?.name)]);
      if (isPlatformPricingTable) {
        props.title = CURRENT_PLATFORM_PRICING_TITLE;
        props.plans = plans.map((plan) => {
          const current = CURRENT_PLATFORM_PRICING[platformPlanKey(plan?.name)];
          if (!current) return plan;
          return {
            ...plan,
            price: current.price,
            individualPrice: current.individualPrice,
            description: current.description,
            features: current.features,
            includedFeatures: current.features,
            extras: current.extras,
          };
        });
      }
    }

    if (block.type === "chart") {
      const plans = Array.isArray(props.plans) ? props.plans : [];
      const isPlatformChart = plans.some((plan) => CURRENT_PLATFORM_PRICING[platformPlanKey(plan?.name)]);
      if (isPlatformChart) {
        props.headline = CURRENT_PLATFORM_SAVINGS_HEADLINE;
        props.headlineBlock = { ...(props.headlineBlock || {}), content: CURRENT_PLATFORM_SAVINGS_HEADLINE };
        props.plans = plans.map((plan) => {
          const current = CURRENT_PLATFORM_PRICING[platformPlanKey(plan?.name)];
          if (!current) return plan;
          return {
            ...plan,
            billingPrice: current.billingPrice,
            individualPrice: current.chartIndividualPrice,
          };
        });
      }
    }

    return { ...block, props };
  });
}

function syncPlatformPricingPage(project) {
  if (!project?.pageBlocks || typeof project.pageBlocks !== "object") return project;
  const pageBlocks = Object.fromEntries(
    Object.entries(project.pageBlocks).map(([pageName, blocks]) => [
      pageName,
      Array.isArray(blocks) ? syncPlatformPricingBlocks(blocks) : blocks,
    ])
  );
  if (!Array.isArray(project.pageBlocks.Pricing)) return { ...project, pageBlocks };
  return {
    ...project,
    pageBlocks,
  };
}

function normalizeDeletedBlockTombstones(project) {
  const seen = new Set();
  return (Array.isArray(project?.deletedBlockIds) ? project.deletedBlockIds : [])
    .map((entry) => {
      if (typeof entry === "string") return { blockId: entry, pageId: "", deletedAt: "" };
      if (!entry || typeof entry !== "object") return null;
      return {
        blockId: String(entry.blockId || entry.id || "").trim(),
        pageId: String(entry.pageId || entry.pageName || "").trim(),
        deletedAt: String(entry.deletedAt || "").trim(),
        blockType: String(entry.blockType || entry.type || "").trim(),
      };
    })
    .filter((entry) => {
      if (!entry?.blockId) return false;
      const key = `${entry.pageId}::${entry.blockId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function applyDeletedBlockTombstones(blocks, deletedBlockIds, pageName) {
  if (!Array.isArray(blocks)) return blocks;
  if (!Array.isArray(deletedBlockIds) || deletedBlockIds.length === 0) return blocks;
  const ids = new Set(
    deletedBlockIds
      .filter((entry) => !entry?.pageId || entry.pageId === pageName)
      .map((entry) => String(entry?.blockId || ""))
      .filter(Boolean)
  );
  if (!ids.size) return blocks;
  return blocks.filter((block) => !ids.has(String(block?.id || "")));
}

function normalizeProjectBlocksForSave(project) {
  if (!project || typeof project !== "object") return project;
  const footerContext = buildFooterNavigationContext({ pages: project.pages, logInvalid: true });
  const globalFooterBlock = resolveCanonicalGlobalFooterBlock(project, footerContext) || project.globalFooterBlock || globalFooterToFooterBlock(project.globalFooter, null) || null;
  let normalizedGlobalFooterBlock = normalizeFooterNavigationBlock(globalFooterBlock, footerContext);
  if (String(project.id || "").replace(/^draft:/, "") === GR8_RESULT_PROJECT_ID && normalizedGlobalFooterBlock?.type === "footer") {
    const props = normalizedGlobalFooterBlock.props || {};
    const currentNav = Array.isArray(props.navigationLinks) ? props.navigationLinks : [];
    const currentCompany = Array.isArray(props.companyLinks || props.extraLinks) ? (props.companyLinks || props.extraLinks) : [];
    normalizedGlobalFooterBlock = applyGr8AustralianFooterPanel({
      ...normalizedGlobalFooterBlock,
      props: {
        ...props,
        navigationLinks: currentNav.length >= GR8_RESULT_FOOTER_NAVIGATION_LINKS.length ? currentNav : GR8_RESULT_FOOTER_NAVIGATION_LINKS,
        companyLinks: currentCompany.length >= DEFAULT_FOOTER_COMPANY_LINKS.length ? currentCompany : DEFAULT_FOOTER_COMPANY_LINKS,
        extraLinks: currentCompany.length >= DEFAULT_FOOTER_COMPANY_LINKS.length ? currentCompany : DEFAULT_FOOTER_COMPANY_LINKS,
        footerNavManual: true,
      },
    }, footerContext);
  }
  const deletedBlockIds = normalizeDeletedBlockTombstones(project);
  const pageBlocks = project.pageBlocks && typeof project.pageBlocks === "object"
    ? Object.fromEntries(
        Object.entries(project.pageBlocks).map(([pageName, blocks]) => [
          pageName,
          applyDeletedBlockTombstones(
            normalizeVideoHeroBlocksForPersistence(normalizeFooterNavigationBlocks(normalizeAccordionBlocks(blocks), footerContext)),
            deletedBlockIds,
            pageName
          ),
        ])
      )
    : project.pageBlocks;
  const chaiData = project.chaiData && typeof project.chaiData === "object"
    ? Object.fromEntries(
        Object.entries(project.chaiData).map(([pageName, pageData]) => [
          pageName,
          pageData && typeof pageData === "object" && Array.isArray(pageData.blocks)
            ? {
                ...pageData,
                blocks: applyDeletedBlockTombstones(
                  normalizeVideoHeroBlocksForPersistence(normalizeFooterNavigationBlocks(normalizeAccordionBlocks(pageData.blocks), footerContext)),
                  deletedBlockIds,
                  pageName
                ),
              }
            : pageData,
        ])
      )
    : project.chaiData;
  return {
    ...project,
    pageBlocks,
    chaiData,
    deletedBlockIds,
    globalFooterBlock: normalizedGlobalFooterBlock,
    globalFooter: footerBlockToGlobalFooter(normalizedGlobalFooterBlock, footerContext) || project.globalFooter || null,
    globalNavBlock: normalizeVideoHeroBlock(project.globalNavBlock),
  };
}

function countFooterNavLinks(project) {
  const block = project?.globalFooterBlock;
  if (!block || block.type !== "footer") return 0;
  const links = block.props?.navigationLinks;
  return Array.isArray(links) ? links.length : 0;
}

function collectMediaFieldCount(value, fieldNames) {
  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => sum + collectMediaFieldCount(entry, fieldNames), 0);
  }
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value).reduce((sum, [key, child]) => {
    const current = typeof child === "string" && fieldNames.has(key) && child.trim() ? 1 : 0;
    return sum + current + collectMediaFieldCount(child, fieldNames);
  }, 0);
}

function summarizeProjectSaveVerification(project = {}) {
  const imageFields = new Set(["imageUrl", "image", "imageSrc", "mediaUrl", "backgroundImage", "desktopImage", "iconImage", "iconUrl", "logoUrl"]);
  const videos = collectVideoHeroMedia(project?.pageBlocks || {});
  return {
    pageCount: Array.isArray(project?.pages) ? project.pages.length : 0,
    blockCount: Object.values(project?.pageBlocks || {}).reduce((sum, blocks) => sum + (Array.isArray(blocks) ? blocks.length : 0), 0),
    contentHash: websitePersistenceHash(project),
    footerNavigationCount: countFooterNavLinks(project),
    customDomain: normalizeDomain(project?.customDomain || project?.custom_domain || project?.publication?.customDomain || project?.publication?.custom_domain || ""),
    primaryDomain: normalizeDomain(project?.primaryDomain || project?.primary_domain || project?.publication?.primaryDomain || project?.publication?.primary_domain || ""),
    slug: resolveProjectSlug(project, project?.name || project?.id || "site"),
    videos: videos.map((entry) => ({
      pageName: entry.pageName || "",
      blockId: entry.id || "",
      videoUrl: entry.videoSrc || "",
      videoStoragePath: entry.videoStoragePath || "",
      videoFileName: entry.videoFileName || "",
      videoMimeType: entry.videoMimeType || "",
    })),
    imageCount: collectMediaFieldCount(project?.pageBlocks || {}, imageFields),
    marqueeIconCount: collectMediaFieldCount(project?.pageBlocks || {}, new Set(["iconName", "iconUrl"])),
  };
}

function videoEntryWasRetained(expected, stored) {
  if (!stored) return false;
  if (stored.pageName !== expected.pageName) return false;
  if (stored.blockId !== expected.blockId) return false;
  if (stored.videoUrl !== expected.videoUrl) return false;
  return ["videoStoragePath", "videoFileName", "videoMimeType"].every((field) => {
    const expectedValue = String(expected?.[field] || "").trim();
    return !expectedValue || String(stored?.[field] || "").trim() === expectedValue;
  });
}

function getVideoRetentionError(verificationIssues = [], fallbackError = "Save failed verification. The database read-back does not match the submitted website project.") {
  return verificationIssues.some((issue) => issue?.type === "video-asset-not-retained")
    ? VIDEO_ASSET_RETAINED_SAVE_ERROR
    : fallbackError;
}

function compareProjectPersistenceForSave(expectedProject, storedProject, pageName = "") {
  const expectedHash = websitePersistenceHash(expectedProject);
  const storedHash = websitePersistenceHash(storedProject);
  const diffs = expectedHash === storedHash ? [] : diffWebsitePersistence(expectedProject, storedProject);
  return {
    ok: expectedHash === storedHash,
    expectedHash,
    storedHash,
    diffs,
    expected: summarizeWebsitePersistence(expectedProject, pageName),
    stored: summarizeWebsitePersistence(storedProject, pageName),
  };
}

function mapProjectRow(row) {
  if (!row) return null;

  const project = row.site_data && typeof row.site_data === "object"
    ? row.site_data
    : {};

  return {
    ...project,
    id: String(project?.id || row.project_id || "").trim().replace(/^draft:/, ""),
    name: project?.name || row.name || "Untitled Website",
    createdAt: project?.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || project?.updatedAt || row.created_at || new Date().toISOString(),
  };
}

function compactProjectForDb(project) {
  if (!project || typeof project !== "object") return {};
  const {
    pageBlocks: _pageBlocks,
    pagesContent: _pagesContent,
    chaiData: _chaiData,
    brandAssets: _brandAssets,
    __saveBaseUpdatedAt: _saveBaseUpdatedAt,
    __saveRequestId: _saveRequestId,
    ...site
  } = project;
  return {
    ...site,
    __splitStorage: true,
    storageVersion: 2,
  };
}

function hasProjectDomainField(project = {}) {
  const publication = project?.publication && typeof project.publication === "object" ? project.publication : {};
  return Object.prototype.hasOwnProperty.call(project || {}, "customDomain")
    || Object.prototype.hasOwnProperty.call(project || {}, "custom_domain")
    || Object.prototype.hasOwnProperty.call(publication, "customDomain")
    || Object.prototype.hasOwnProperty.call(publication, "custom_domain");
}

function resolveSavedDraftDomain(nextProject = {}, existingRow = null) {
  const incoming = normalizeDomain(nextProject?.customDomain || nextProject?.custom_domain || nextProject?.publication?.customDomain || nextProject?.publication?.custom_domain || "");
  if (hasProjectDomainField(nextProject)) return incoming;
  return normalizeDomain(
    existingRow?.custom_domain
    || existingRow?.site_data?.customDomain
    || existingRow?.site_data?.custom_domain
    || existingRow?.site_data?.publication?.customDomain
    || existingRow?.site_data?.publication?.custom_domain
    || ""
  );
}

function getProjectPageBlocks(project, pageName) {
  if (!project || !pageName) return [];
  if (Array.isArray(project?.pageBlocks?.[pageName])) return project.pageBlocks[pageName];
  if (Array.isArray(project?.chaiData?.[pageName]?.blocks)) return project.chaiData[pageName].blocks;
  return [];
}

function summarizeBlockList(blocks) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  return {
    count: safeBlocks.length,
    blockIds: safeBlocks.map((block, index) => ({
      index,
      id: block?.id || "",
      type: block?.type || "",
    })),
    listBlocks: safeBlocks
      .map((block, index) => String(block?.type || "") === "feature-list" ? {
        index,
        id: block?.id || "",
        headline: String(block?.props?.headline || block?.props?.title || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
      } : null)
      .filter(Boolean),
    accordionImages: safeBlocks
      .map((block, index) => {
        const type = String(block?.type || "");
        if (!["feature-accordion", "side-scroll-accordion", "scroll-stack"].includes(type)) return null;
        const panels = Array.isArray(block?.props?.panels)
          ? block.props.panels
          : (Array.isArray(block?.props?.items) ? block.props.items : []);
        return {
          index,
          id: block?.id || "",
          type,
          images: panels.map((panel, panelIndex) => ({
            panelIndex,
            panelId: panel?.id || "",
            imageUrl: panel?.imageUrl || panel?.image?.url || panel?.image?.src || panel?.media?.url || "",
          })),
        };
      })
      .filter(Boolean),
  };
}

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

function isMissingSplitPageError(error) {
  return error?.code === "WEBSITE_PAGE_FILE_MISSING";
}

async function requireUserId(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing Bearer token" });
    return null;
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    res.status(401).json({ ok: false, error: toErrorMessage(authError, "Authentication failed") });
    return null;
  }

  return userData.user.id;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const userId = await requireUserId(req, res);
  if (!userId) return;

  if (req.method === "GET") {
    const projectId = String(req.query?.projectId || "").trim();
    const requestedPage = pageNameFromValue(req.query?.page || "");
    const draftProjectId = projectId ? toDraftProjectId(projectId) : "";

    const baseSelect = supabaseAdmin
      .from(TABLE_NAME)
      .select("id, project_id, name, site_data, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (projectId) {
      try {
        const splitProject = await assembleWebsiteForRendering(userId, projectId);
        if (splitProject) {
          return res.status(200).json({ ok: true, project: splitProject });
        }
      } catch (error) {
        if (isMissingSplitPageError(error)) {
          return res.status(409).json({ ok: false, error: error.message, code: error.code, pageName: error.pageName });
        }
        throw error;
      }

      // Draft data is the only editable source. Published rows are never used
      // to hydrate builder state.
      const draftResult = await baseSelect
        .eq("project_id", draftProjectId)
        .limit(1)
        .maybeSingle();

      if (draftResult.error) {
        if (isMissingDraftProjectsTable(draftResult.error)) {
          return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
        }
        return res.status(500).json({ ok: false, error: toErrorMessage(draftResult.error, "Could not load website project") });
      }

      if (draftResult.data) {
        const mapped = mapProjectRow(draftResult.data);
        const migrated = await migrateWebsiteProjectToSplitStorage(userId, mapped, { pageName: requestedPage });
        return res.status(200).json({ ok: true, project: migrated || mapped });
      }

      return res.status(404).json({
        ok: false,
        error: "Website draft project was not found. Published website data is not used to hydrate the editable builder.",
        code: "WEBSITE_DRAFT_PROJECT_NOT_FOUND",
      });
    }

    // List all projects — include both drafts and published sites
    const result = await baseSelect.limit(100);

    if (result.error) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not load website projects") });
    }

    // Deduplicate by effective project id. In-progress builder saves are written
    // to draft/split storage, so newer draft content must beat older published
    // or compact rows when the dashboard lists/open projects.
    const preferProjectEntry = (existing, incoming) => {
      if (!existing) return incoming;
      const existingTs = Date.parse(existing.mapped?.updatedAt || existing.mapped?.createdAt || 0) || 0;
      const incomingTs = Date.parse(incoming.mapped?.updatedAt || incoming.mapped?.createdAt || 0) || 0;
      if (incomingTs !== existingTs) return incomingTs > existingTs ? incoming : existing;

      const existingSplit = existing.source === "split" || !!existing.mapped?.__splitStorage || Number(existing.mapped?.storageVersion || 0) >= 2;
      const incomingSplit = incoming.source === "split" || !!incoming.mapped?.__splitStorage || Number(incoming.mapped?.storageVersion || 0) >= 2;
      if (incomingSplit !== existingSplit) return incomingSplit ? incoming : existing;

      if (incoming.isDraft !== existing.isDraft) return incoming.isDraft ? incoming : existing;
      return existing;
    };

    const seen = new Map();
    for (const splitProject of await listSplitWebsiteProjects(userId)) {
      if (!splitProject?.id) continue;
      const key = String(splitProject.id);
      seen.set(key, preferProjectEntry(seen.get(key), { mapped: splitProject, isDraft: true, source: "split" }));
    }
    for (const row of Array.isArray(result.data) ? result.data : []) {
      if (!String(row.project_id || "").startsWith("draft:")) continue;
      const mapped = mapProjectRow(row);
      if (!mapped?.id) continue;
      const isDraft = String(row.project_id || "").startsWith("draft:");
      seen.set(mapped.id, preferProjectEntry(seen.get(mapped.id), { mapped, isDraft, source: isDraft ? "draft-row" : "published-row" }));
      const existing = { isDraft, mapped: { updatedAt: "9999-12-31T23:59:59.999Z" } };
      if (!existing) {
        seen.set(mapped.id, { mapped, isDraft });
      } else if (existing.isDraft && !isDraft) {
        // Published row beats draft row unconditionally
        seen.set(mapped.id, { mapped, isDraft });
      } else if (!existing.isDraft && isDraft) {
        // Already have a published row — skip the draft
      } else {
        // Same kind (both draft or both published) — keep the most recently updated
        const existingTs = Date.parse(existing.mapped.updatedAt || 0) || 0;
        const incomingTs = Date.parse(mapped.updatedAt || 0) || 0;
        if (incomingTs > existingTs) seen.set(mapped.id, { mapped, isDraft });
      }
    }

    return res.status(200).json({ ok: true, projects: Array.from(seen.values()).map((e) => e.mapped) });
  }

  if (req.method === "POST") {
    const project = req.body?.project;
    if (!project || typeof project !== "object") {
      return res.status(400).json({ ok: false, error: "Missing website project payload" });
    }

    const projectId = String(project?.id || req.body?.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ ok: false, error: "A website project id is required" });
    }

    const draftProjectId = toDraftProjectId(projectId);
    const requestedPage = pageNameFromValue(req.body?.pageName || req.query?.page || "");
    const siteOnly = req.body?.siteOnly === true;
    const saveSource = String(req.body?.saveSource || req.query?.saveSource || (siteOnly ? "site-save" : "autosave")).trim();
    const requestId = String(req.body?.requestId || project?.__saveRequestId || "").trim();
    const pageVersion = String(req.body?.pageVersion || project?.projectVersion || "").trim();
    const baseUpdatedAt = String(req.body?.baseUpdatedAt || project?.__saveBaseUpdatedAt || "").trim();

    const normalizedProject = normalizeProjectBlocksForSave(project);
    const now = new Date().toISOString();
    const versionMeta = buildWebsiteProjectVersion(normalizedProject, now);
    const nextProject = {
      ...normalizedProject,
      id: projectId,
      createdAt: normalizedProject?.createdAt || now,
      updatedAt: now,
      savedAt: versionMeta.savedAt,
      projectVersion: versionMeta.projectVersion,
      contentHash: versionMeta.contentHash,
    };
    const incomingBlocks = requestedPage ? getProjectPageBlocks(nextProject, requestedPage) : [];
    console.info("[website-builder save] incoming payload", {
      projectId,
      draftProjectId,
      pageName: requestedPage || "",
      saveSource,
      siteOnly,
      pageVersion: pageVersion || nextProject.projectVersion,
      baseUpdatedAt,
      requestId,
      savedAt: nextProject.savedAt,
      deletedBlockIds: normalizeDeletedBlockTombstones(nextProject),
      page: summarizeBlockList(incomingBlocks),
    });

    let currentSplitProject = null;
    try {
      currentSplitProject = await loadFullSplitWebsiteProject(userId, projectId);
    } catch {
      currentSplitProject = null;
    }
    const currentSplitUpdatedAt = currentSplitProject?.updatedAt || currentSplitProject?.savedAt || "";
    const incomingBaseMs = Date.parse(baseUpdatedAt || 0) || 0;
    const currentSplitMs = Date.parse(currentSplitUpdatedAt || 0) || 0;
    if (baseUpdatedAt && currentSplitUpdatedAt && incomingBaseMs < currentSplitMs) {
      console.warn("[website-builder save] rejected stale split-storage write before page upsert", {
        projectId,
        pageName: requestedPage || "",
        saveSource,
        requestId,
        baseUpdatedAt,
        currentUpdatedAt: currentSplitUpdatedAt,
      });
      return res.status(409).json({
        ok: false,
        error: "Rejected stale website page save because split storage has a newer version.",
        code: "STALE_WEBSITE_PAGE_SAVE",
        requestId,
        baseUpdatedAt,
        currentUpdatedAt: currentSplitUpdatedAt,
      });
    }
    const previousFooterLinkCount = countFooterNavLinks(currentSplitProject);
    const nextFooterLinkCount = countFooterNavLinks(nextProject);
    if (previousFooterLinkCount > 3 && nextFooterLinkCount <= 1) {
      return res.status(409).json({
        ok: false,
        error: `Footer navigation save blocked because it would reduce ${previousFooterLinkCount} links to ${nextFooterLinkCount}.`,
      });
    }

    let splitProject = null;
    try {
      splitProject = await saveSplitWebsiteProject(userId, nextProject, { pageName: requestedPage, siteOnly, backupSource: saveSource });
    } catch (storageError) {
      return res.status(500).json({ ok: false, error: toErrorMessage(storageError, "Could not save website page file") });
    }

    if (splitProject?.id) {
      const savedProject = splitProject;
      const expectedVerification = summarizeProjectSaveVerification(nextProject);
      const splitVerification = summarizeProjectSaveVerification(savedProject);
      const savedBlocks = requestedPage ? getProjectPageBlocks(savedProject, requestedPage) : [];
      const payloadBlockIds = new Set((Array.isArray(incomingBlocks) ? incomingBlocks : []).map((block) => String(block?.id || "")).filter(Boolean));
      const savedBlockIds = new Set((Array.isArray(savedBlocks) ? savedBlocks : []).map((block) => String(block?.id || "")).filter(Boolean));
      const extraReadBackIds = [...savedBlockIds].filter((id) => !payloadBlockIds.has(id));
      const missingReadBackIds = [...payloadBlockIds].filter((id) => !savedBlockIds.has(id));
      const missingVideos = expectedVerification.videos
        .filter((entry) => entry.videoUrl)
        .filter((entry) => !splitVerification.videos.some((stored) => videoEntryWasRetained(entry, stored)));
      const verificationIssues = [];
      if (expectedVerification.pageCount && splitVerification.pageCount !== expectedVerification.pageCount) {
        verificationIssues.push({ type: "page-count-mismatch", expected: expectedVerification.pageCount, actual: splitVerification.pageCount });
      }
      if (expectedVerification.footerNavigationCount > 0 && splitVerification.footerNavigationCount !== expectedVerification.footerNavigationCount) {
        verificationIssues.push({ type: "footer-navigation-count-mismatch", expected: expectedVerification.footerNavigationCount, actual: splitVerification.footerNavigationCount });
      }
      if (expectedVerification.customDomain && splitVerification.customDomain !== expectedVerification.customDomain) {
        verificationIssues.push({ type: "custom-domain-mismatch", expected: expectedVerification.customDomain, actual: splitVerification.customDomain });
      }
      if (expectedVerification.primaryDomain && splitVerification.primaryDomain !== expectedVerification.primaryDomain) {
        verificationIssues.push({ type: "primary-domain-mismatch", expected: expectedVerification.primaryDomain, actual: splitVerification.primaryDomain });
      }
      if (expectedVerification.imageCount > 0 && splitVerification.imageCount < expectedVerification.imageCount) {
        verificationIssues.push({ type: "image-count-decreased", expected: expectedVerification.imageCount, actual: splitVerification.imageCount });
      }
      if (expectedVerification.marqueeIconCount > 0 && splitVerification.marqueeIconCount < expectedVerification.marqueeIconCount) {
        verificationIssues.push({ type: "marquee-icon-count-decreased", expected: expectedVerification.marqueeIconCount, actual: splitVerification.marqueeIconCount });
      }
      if (missingVideos.length) {
        verificationIssues.push({ type: "video-asset-not-retained", missingVideos });
      }
      const persistenceVerification = compareProjectPersistenceForSave(nextProject, savedProject, requestedPage);
      if (!persistenceVerification.ok) {
        verificationIssues.push({
          type: "structural-hash-mismatch",
          expectedHash: persistenceVerification.expectedHash,
          actualHash: persistenceVerification.storedHash,
          diffs: persistenceVerification.diffs.slice(0, 20),
        });
      }

      console.info("[website-builder save] verified split-storage source of truth", {
        projectId,
        pageName: requestedPage || "",
        saveSource,
        siteOnly,
        expected: expectedVerification,
        splitStorage: splitVerification,
        persistenceAudit: persistenceVerification,
        extraReadBackIds,
        missingReadBackIds,
        issues: verificationIssues,
      });

      if (verificationIssues.length || (requestedPage && (extraReadBackIds.length || missingReadBackIds.length))) {
        return res.status(409).json({
          ok: false,
          error: getVideoRetentionError(
            verificationIssues,
            persistenceVerification.ok
              ? "Save failed verification. The database read-back does not match the submitted website project."
              : "Save verification failed. The database did not retain the complete page structure.",
          ),
          code: "WEBSITE_SAVE_READBACK_MISMATCH",
          projectId,
          pageName: requestedPage || "",
          extraReadBackIds,
          missingReadBackIds,
          verification: {
            expected: expectedVerification,
            splitStorage: splitVerification,
            issues: verificationIssues,
            persistence: persistenceVerification,
          },
        });
      }

      return res.status(200).json({
        ok: true,
        project: savedProject,
        verification: {
          ok: true,
          expected: expectedVerification,
          splitStorage: splitVerification,
          persistence: persistenceVerification,
        },
      });
    }

    const existing = await supabaseAdmin
      .from(TABLE_NAME)
      .select("id, published, published_at, custom_domain, domain_status, slug, primary_domain, site_data, updated_at")
      .eq("user_id", userId)
      .eq("project_id", draftProjectId)
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      if (isMissingDraftProjectsTable(existing.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The publishing table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(existing.error, "Could not load website draft") });
    }

    const currentUpdatedAt = existing.data?.updated_at || existing.data?.site_data?.updatedAt || "";
    const currentMs = Date.parse(currentUpdatedAt || 0) || 0;
    if (baseUpdatedAt && currentUpdatedAt && incomingBaseMs < currentMs) {
      console.warn("[website-builder save] rejected stale write", {
        projectId,
        pageName: requestedPage || "",
        saveSource,
        requestId,
        baseUpdatedAt,
        currentUpdatedAt,
      });
      return res.status(409).json({
        ok: false,
        error: "Rejected stale website page save because the database has a newer version.",
        code: "STALE_WEBSITE_PAGE_SAVE",
        requestId,
        baseUpdatedAt,
        currentUpdatedAt,
      });
    }

    if (!requestedPage && existing.data?.site_data?.pageBlocks && nextProject.pageBlocks) {
      const dbPageBlocks = existing.data.site_data.pageBlocks;
      for (const [pageName, dbBlocks] of Object.entries(dbPageBlocks)) {
        if (!Array.isArray(dbBlocks)) continue;
        const pinnedBlocks = dbBlocks.filter((b) => b && b._pinned);
        if (pinnedBlocks.length === 0) continue;
        const pageIncomingBlocks = Array.isArray(nextProject.pageBlocks[pageName]) ? nextProject.pageBlocks[pageName] : [];
        const incomingIds = new Set(pageIncomingBlocks.map((b) => b?.id).filter(Boolean));
        const missing = pinnedBlocks.filter((b) => !incomingIds.has(b.id));
        if (missing.length > 0) {
          console.warn("[website-builder save] pinned block restore disabled; not re-adding missing DB blocks", {
            projectId,
            pageName,
            saveSource,
            missingPinnedBlocks: missing.map((block) => ({ id: block?.id || "", type: block?.type || "" })),
          });
        }
      }
    }

    const draftCustomDomain = resolveSavedDraftDomain(nextProject, existing.data);
    const draftPrimaryDomain = draftCustomDomain || existing.data?.primary_domain || buildDraftPrimaryDomain(projectId);
    const draftSlug = resolveProjectSlug(nextProject, existing.data?.site_data?.slug || existing.data?.slug || nextProject?.name || projectId);
    const draftSiteData = withProjectPublicationIdentity(compactProjectForDb(splitProject || nextProject), {
      slug: draftSlug,
      customDomain: draftCustomDomain,
      primaryDomain: draftPrimaryDomain,
    });

    const record = {
      user_id: userId,
      project_id: draftProjectId,
      name: nextProject?.name || "Untitled Website",
      slug: existing.data?.slug || buildDraftSlug(projectId),
      primary_domain: existing.data?.primary_domain || buildDraftPrimaryDomain(projectId),
      custom_domain: null,
      domain_status: draftCustomDomain ? "saved_for_publish" : "generated",
      published: false,
      published_at: null,
      site_data: {
        ...draftSiteData,
        __draftSync: true,
      },
    };

    const result = existing.data?.id
      ? await supabaseAdmin
        .from(TABLE_NAME)
        .update(record)
        .eq("id", existing.data.id)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .maybeSingle()
      : await (async () => {
          // ── QUOTA CHECK on new project insert ─────────────────────────────
          const resolvedPlan = await getUserPlan(supabaseAdmin, userId);
          const { plan } = resolvedPlan;
          const websiteLimit = getWebsiteLimitForResolvedPlan(resolvedPlan).limit;

          if (websiteLimit !== null) {
            const { data: existingRows } = await supabaseAdmin
              .from(TABLE_NAME)
              .select("project_id")
              .eq("user_id", userId);

            const uniqueIds = new Set(
              (existingRows || []).map((r) => String(r.project_id || "").replace(/^draft:/, ""))
            );

            if (uniqueIds.size >= websiteLimit) {
              return {
                _quotaError: true,
                code: "WEBSITE_LIMIT_EXCEEDED",
                error: `Website limit reached (${websiteLimit} on ${plan} plan). Upgrade to create more.`,
                limit: websiteLimit,
                used: uniqueIds.size,
              };
            }
          }
          // ─────────────────────────────────────────────────────────────────

          return supabaseAdmin
            .from(TABLE_NAME)
            .insert(record)
            .select("id, project_id, name, site_data, created_at, updated_at")
            .maybeSingle();
        })();

    if (result?._quotaError) {
      return res.status(429).json({ ok: false, ...result });
    }

    if (result.error || !result.data) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not save website draft") });
    }

    const readBack = result.data?.id
      ? await supabaseAdmin
        .from(TABLE_NAME)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .eq("id", result.data.id)
        .limit(1)
        .maybeSingle()
      : { data: result.data, error: null };

    if (readBack.error) {
      console.error("[website-builder save] database read-back failed", {
        projectId,
        draftProjectId,
        rowId: result.data?.id || "",
        error: readBack.error?.message || readBack.error,
      });
      return res.status(500).json({ ok: false, error: toErrorMessage(readBack.error, "Could not verify saved website draft") });
    }

    const savedProject = splitProject || mapProjectRow(readBack.data || result.data);
    const readBackProject = mapProjectRow(readBack.data || result.data);
    const expectedVerification = summarizeProjectSaveVerification(nextProject);
    const splitVerification = summarizeProjectSaveVerification(savedProject);
    const missingVideos = expectedVerification.videos
      .filter((entry) => entry.videoUrl)
      .filter((entry) => !splitVerification.videos.some((stored) => videoEntryWasRetained(entry, stored)));
    const verificationIssues = [];
    if (expectedVerification.pageCount && splitVerification.pageCount !== expectedVerification.pageCount) {
      verificationIssues.push({
        type: "page-count-mismatch",
        expected: expectedVerification.pageCount,
        actual: splitVerification.pageCount,
      });
    }
    if (expectedVerification.footerNavigationCount > 0 && splitVerification.footerNavigationCount !== expectedVerification.footerNavigationCount) {
      verificationIssues.push({
        type: "footer-navigation-count-mismatch",
        expected: expectedVerification.footerNavigationCount,
        actual: splitVerification.footerNavigationCount,
      });
    }
    if (expectedVerification.customDomain && splitVerification.customDomain !== expectedVerification.customDomain) {
      verificationIssues.push({
        type: "custom-domain-mismatch",
        expected: expectedVerification.customDomain,
        actual: splitVerification.customDomain,
      });
    }
    if (expectedVerification.primaryDomain && splitVerification.primaryDomain !== expectedVerification.primaryDomain) {
      verificationIssues.push({
        type: "primary-domain-mismatch",
        expected: expectedVerification.primaryDomain,
        actual: splitVerification.primaryDomain,
      });
    }
    if (expectedVerification.imageCount > 0 && splitVerification.imageCount < expectedVerification.imageCount) {
      verificationIssues.push({
        type: "image-count-decreased",
        expected: expectedVerification.imageCount,
        actual: splitVerification.imageCount,
      });
    }
    if (expectedVerification.marqueeIconCount > 0 && splitVerification.marqueeIconCount < expectedVerification.marqueeIconCount) {
      verificationIssues.push({
        type: "marquee-icon-count-decreased",
        expected: expectedVerification.marqueeIconCount,
        actual: splitVerification.marqueeIconCount,
      });
    }
    if (missingVideos.length) {
      verificationIssues.push({
        type: "video-asset-not-retained",
        missingVideos,
      });
    }
    const persistenceVerification = compareProjectPersistenceForSave(nextProject, savedProject, requestedPage);
    if (!persistenceVerification.ok) {
      verificationIssues.push({
        type: "structural-hash-mismatch",
        expectedHash: persistenceVerification.expectedHash,
        actualHash: persistenceVerification.storedHash,
        diffs: persistenceVerification.diffs.slice(0, 20),
      });
    }
    const pageSummary = summarizeWebsitePage(savedProject, requestedPage);
    const readBackBlocks = requestedPage ? getProjectPageBlocks(savedProject, requestedPage) : [];
    const payloadBlockIds = new Set((Array.isArray(incomingBlocks) ? incomingBlocks : []).map((block) => String(block?.id || "")).filter(Boolean));
    const readBackBlockIds = new Set((Array.isArray(readBackBlocks) ? readBackBlocks : []).map((block) => String(block?.id || "")).filter(Boolean));
    const extraReadBackIds = [...readBackBlockIds].filter((id) => !payloadBlockIds.has(id));
    const missingReadBackIds = [...payloadBlockIds].filter((id) => !readBackBlockIds.has(id));
    console.info("[website-builder save] saved project", {
      projectId,
      draftProjectId,
      rowId: readBack.data?.id || result.data?.id || "",
      pageId: pageSummary.pageId,
      pageName: pageSummary.pageName || requestedPage || "",
      blockCount: pageSummary.blockCount,
      updatedAt: savedProject?.updatedAt || now,
      savedAt: savedProject?.savedAt || versionMeta.savedAt,
      projectVersion: savedProject?.projectVersion || versionMeta.projectVersion,
      contentHash: savedProject?.contentHash || versionMeta.contentHash,
      pageHash: pageSummary.pageHash,
      saveSource,
      siteOnly,
      splitStorageReadBack: summarizeBlockList(readBackBlocks),
      draftRowReadBack: summarizeBlockList(requestedPage ? getProjectPageBlocks(readBackProject, requestedPage) : []),
      verification: {
        expected: expectedVerification,
        splitStorage: splitVerification,
        issues: verificationIssues,
        persistence: persistenceVerification,
      },
      extraReadBackIds,
      missingReadBackIds,
      deletedBlockIds: normalizeDeletedBlockTombstones(readBackProject),
    });

    if (verificationIssues.length) {
      console.error("[website-builder save] split-storage verification mismatch after save; rejecting saved status", {
        projectId,
        draftProjectId,
        pageName: requestedPage || "",
        saveSource,
        expected: expectedVerification,
        splitStorage: splitVerification,
        issues: verificationIssues,
      });
      return res.status(409).json({
        ok: false,
        error: getVideoRetentionError(
          verificationIssues,
          persistenceVerification.ok
            ? "Save failed verification. The database read-back does not match the submitted website project."
            : "Save verification failed. The database did not retain the complete page structure.",
        ),
        code: "WEBSITE_SAVE_READBACK_MISMATCH",
        projectId,
        pageName: requestedPage || "",
        verification: {
          expected: expectedVerification,
          splitStorage: splitVerification,
          issues: verificationIssues,
          persistence: persistenceVerification,
        },
      });
    }

    if (requestedPage && (extraReadBackIds.length || missingReadBackIds.length)) {
      console.error("[website-builder save] verification mismatch after save; rejecting saved status", {
        projectId,
        draftProjectId,
        pageName: requestedPage,
        extraReadBackIds,
        missingReadBackIds,
        payload: summarizeBlockList(incomingBlocks),
        readBack: summarizeBlockList(readBackBlocks),
      });
      return res.status(409).json({
        ok: false,
        error: "Save failed verification. Your current page has not been replaced.",
        code: "WEBSITE_SAVE_VERIFICATION_FAILED",
        projectId,
        pageName: requestedPage,
        extraReadBackIds,
        missingReadBackIds,
      });
    }

    return res.status(200).json({
      ok: true,
      project: savedProject,
      verification: {
        ok: true,
        expected: expectedVerification,
        splitStorage: splitVerification,
        persistence: persistenceVerification,
      },
    });
  }

  if (req.method === "PATCH") {
    const { projectId: patchProjectId, name: patchName } = req.body || {};
    const newName = String(patchName || "").trim();
    if (!patchProjectId || !newName) {
      return res.status(400).json({ ok: false, error: "projectId and name are required" });
    }

    const draftId = toDraftProjectId(patchProjectId);

    // Fetch all rows matching either the published or draft project_id
    const { data: matchingRows, error: fetchError } = await supabaseAdmin
      .from(TABLE_NAME)
      .select("id, project_id, site_data")
      .eq("user_id", userId)
      .in("project_id", [patchProjectId, draftId]);

    if (fetchError) {
      return res.status(500).json({ ok: false, error: toErrorMessage(fetchError, "Could not find website project") });
    }

    if (!matchingRows?.length) {
      return res.status(404).json({ ok: false, error: "Website project not found" });
    }

    const now = new Date().toISOString();
    for (const row of matchingRows) {
      const nextSiteData = { ...(row.site_data && typeof row.site_data === "object" ? row.site_data : {}), name: newName };
      await supabaseAdmin.from(TABLE_NAME).update({ name: newName, site_data: nextSiteData, updated_at: now }).eq("id", row.id);
      const splitId = String(row.project_id || "").replace(/^draft:/, "");
      const splitProject = await loadFullSplitWebsiteProject(userId, splitId);
      if (splitProject) {
        await saveSplitWebsiteProject(userId, { ...splitProject, name: newName, updatedAt: now }, { siteOnly: true, backupSource: "rename" });
      }
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const projectId = String(req.query?.projectId || req.body?.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ ok: false, error: "A website project id is required" });
    }

    const draftProjectId = toDraftProjectId(projectId);

    // Delete by draft-prefixed project_id OR raw project_id (covers both draft and non-draft rows)
    const result = await supabaseAdmin
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId)
      .or(`project_id.eq.${draftProjectId},project_id.eq.${projectId}`)
      .neq("published", true);

    await deleteSplitWebsiteProject(userId, projectId);

    if (result.error) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not delete website draft") });
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withAuth(handler);
