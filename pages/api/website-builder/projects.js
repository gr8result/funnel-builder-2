import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { getWebsiteLimitForResolvedPlan, getUserPlan } from "../../../lib/planResolver";
import { COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "../../../lib/website-builder/pageBlockComponents";
import {
  deleteSplitWebsiteProject,
  listSplitWebsiteProjects,
  loadFullSplitWebsiteProject,
  migrateWebsiteProjectToSplitStorage,
  saveSplitWebsiteProject,
} from "../../../lib/website-builder/supabaseSiteStorage";
import { buildWebsiteProjectVersion, summarizeWebsitePage } from "../../../lib/website-builder/documentVersion";
import { normalizeAccordionBlocks } from "../../../lib/website-builder/accordionPanels";

const TABLE_NAME = "published_websites";

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

function normalizeAccordionBlocksForProject(project) {
  if (!project?.pageBlocks || typeof project.pageBlocks !== "object") return project;
  const pageBlocks = Object.fromEntries(
    Object.entries(project.pageBlocks).map(([pageName, blocks]) => [
      pageName,
      normalizeAccordionBlocks(blocks),
    ])
  );
  const chaiData = project.chaiData && typeof project.chaiData === "object"
    ? Object.fromEntries(
        Object.entries(project.chaiData).map(([pageName, pageData]) => [
          pageName,
          pageData && typeof pageData === "object" && Array.isArray(pageData.blocks)
            ? { ...pageData, blocks: normalizeAccordionBlocks(pageData.blocks) }
            : pageData,
        ])
      )
    : project.chaiData;
  return { ...project, pageBlocks, chaiData };
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
  const { pageBlocks: _pageBlocks, pagesContent: _pagesContent, chaiData: _chaiData, brandAssets: _brandAssets, ...site } = project;
  return {
    ...site,
    __splitStorage: true,
    storageVersion: 2,
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
        const splitProject = await loadFullSplitWebsiteProject(userId, projectId);
        if (splitProject) {
          return res.status(200).json({ ok: true, project: splitProject });
        }
      } catch (error) {
        if (isMissingSplitPageError(error)) {
          return res.status(409).json({ ok: false, error: error.message, code: error.code, pageName: error.pageName });
        }
        throw error;
      }

      // Try draft-prefixed row first, then fall back to the raw project_id (published sites)
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

      // Fall back: look up by the raw (non-draft-prefixed) project_id for published sites
      const publishedResult = await supabaseAdmin
        .from(TABLE_NAME)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .limit(1)
        .maybeSingle();

      if (publishedResult.error) {
        return res.status(500).json({ ok: false, error: toErrorMessage(publishedResult.error, "Could not load website project") });
      }

      const mapped = mapProjectRow(publishedResult.data);
      const migrated = mapped ? await migrateWebsiteProjectToSplitStorage(userId, mapped, { pageName: requestedPage }) : null;
      return res.status(200).json({ ok: true, project: migrated || mapped });
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

    const normalizedProject = normalizeAccordionBlocksForProject(project);
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

    let splitProject = null;
    try {
      splitProject = await saveSplitWebsiteProject(userId, nextProject, { pageName: requestedPage, siteOnly, backupSource: saveSource });
    } catch (storageError) {
      return res.status(500).json({ ok: false, error: toErrorMessage(storageError, "Could not save website page file") });
    }

    const existing = await supabaseAdmin
      .from(TABLE_NAME)
      .select("id, published, published_at, custom_domain, domain_status, slug, primary_domain, site_data")
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

    // Preserve any blocks marked _pinned:true that exist in the DB but are missing from the incoming payload.
    // This prevents auto-saves from the visual builder from removing manually-pinned blocks.
    if (!requestedPage && existing.data?.site_data?.pageBlocks && nextProject.pageBlocks) {
      const dbPageBlocks = existing.data.site_data.pageBlocks;
      for (const [pageName, dbBlocks] of Object.entries(dbPageBlocks)) {
        if (!Array.isArray(dbBlocks)) continue;
        const pinnedBlocks = dbBlocks.filter((b) => b && b._pinned);
        if (pinnedBlocks.length === 0) continue;
        const incomingBlocks = Array.isArray(nextProject.pageBlocks[pageName]) ? nextProject.pageBlocks[pageName] : [];
        const incomingIds = new Set(incomingBlocks.map((b) => b?.id).filter(Boolean));
        const missing = pinnedBlocks.filter((b) => !incomingIds.has(b.id));
        if (missing.length > 0) {
          nextProject.pageBlocks[pageName] = [...incomingBlocks, ...missing];
        }
      }
    }

    const record = {
      user_id: userId,
      project_id: draftProjectId,
      name: nextProject?.name || "Untitled Website",
      slug: existing.data?.slug || buildDraftSlug(projectId),
      primary_domain: existing.data?.primary_domain || buildDraftPrimaryDomain(projectId),
      custom_domain: existing.data?.custom_domain || null,
      domain_status: existing.data?.domain_status || "generated",
      published: false,
      published_at: null,
      site_data: {
        ...compactProjectForDb(splitProject || nextProject),
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

    const savedProject = splitProject || mapProjectRow(result.data);
    const pageSummary = summarizeWebsitePage(savedProject, requestedPage);
    console.info("[website-builder save] saved project", {
      projectId,
      draftProjectId,
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
    });

    return res.status(200).json({ ok: true, project: savedProject });
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
