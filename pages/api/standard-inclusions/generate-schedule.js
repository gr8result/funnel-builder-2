import { randomUUID } from "node:crypto";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getEffectiveProductCatalogue } from "../../../lib/product-library/catalogueService.js";
import { createStandardInclusionsScheduleDraft, loadStandardInclusionsSchedule, updateStandardInclusionsSchedule } from "../../../lib/standard-inclusions/pdfLibrary.js";
import { generateMasterInclusionsSchedule, PRODUCT_PRICE_LEVELS, STANDARD_INCLUSION_TIERS } from "../../../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { STANDARD_TIER_SETTINGS } from "../../../lib/standard-inclusions/tierScheduleReview.mjs";
import { handler as readWorkspaceBranding } from "./branding.js";

const text = (value, limit = 160) => String(value || "").trim().slice(0, limit);

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const tier = text(req.body?.tier, 40);
  const priceLevel = STANDARD_TIER_SETTINGS[tier]?.priceLevel || text(req.body?.priceLevel, 40);
  if (!STANDARD_INCLUSION_TIERS.includes(tier)) {
    return res.status(400).json({ ok: false, error: "Choose Economy, Classic, Premier or Premium." });
  }
  if (!PRODUCT_PRICE_LEVELS.some((level) => level.key === priceLevel)) {
    return res.status(400).json({ ok: false, error: "Choose Budget, Mid-range or High-end." });
  }

  try {
    const requestedId = text(req.body?.scheduleId, 120);
    const existing = requestedId ? await loadStandardInclusionsSchedule({ workspaceId: req.workspaceId, scheduleId: requestedId }) : null;
    if (requestedId && !existing) return res.status(404).json({ ok: false, error: "This draft was not found in the selected workspace. Nothing was changed." });
    if (existing && (["Approved", "Published"].includes(existing.metadata?.workflowStatus) || existing.metadata?.publishedSnapshots?.length)) {
      return res.status(409).json({ ok: false, error: "This schedule has approved or published content and cannot be regenerated. Create a new working draft; the approved schedule was not changed." });
    }
    if (existing && req.body?.expectedUpdatedAt && req.body.expectedUpdatedAt !== existing.updatedAt) return res.status(409).json({ ok: false, error: "This draft changed in another session. Reopen it before generating so those changes are not overwritten." });
    const scheduleId = requestedId || randomUUID();
    const catalogue = getEffectiveProductCatalogue({ organisationId: req.workspaceId });
    let profileResult;
    let profileTimer;
    try {
      await Promise.race([
        readWorkspaceBranding({ ...req, method: "GET" }, { setHeader() {}, status() { return this; }, json(payload) { profileResult = payload; } }),
        new Promise((_, reject) => { profileTimer = setTimeout(() => reject(new Error("Optional Business Profile lookup timed out.")), 8000); }),
      ]);
    } catch {
      profileResult = null;
    } finally {
      clearTimeout(profileTimer);
    }
    const fallbackBranding = existing?.metadata?.brochureBranding?.snapshot || {};
    const overrides = req.body?.brandingOverrides && typeof req.body.brandingOverrides === "object" ? req.body.brandingOverrides : {};
    const branding = { ...fallbackBranding, ...(profileResult?.ok ? profileResult.branding : {}), ...overrides };
    const brandingWarning = profileResult?.ok ? "" : "The canonical Business Profile could not be loaded. Saved branding was retained where available; optional branding details do not block this draft. Retry loading the profile before publishing.";
    const generated = generateMasterInclusionsSchedule({
      scheduleId,
      tier,
      priceLevel,
      products: catalogue.products,
      branding,
    });
    const now = new Date().toISOString();
    const gapDetails = generated.gaps.map((gap) => ({ category: gap.category, requirementTitle: gap.requirementTitle, reason: gap.reason }));
    const metadata = {
      ...(existing?.metadata || {}),
      schemaVersion: 2,
      workflowStatus: "Needs Review",
      generatedSchedule: true,
      reviewRequirementIds: generated.items.map(item => item.id),
      generatedAt: now,
      productPriceLevel: priceLevel,
      brochureDocument: generated.document,
      brochureBranding: { source: profileResult?.ok ? "business-profile-vault" : "saved-profile-fallback", snapshot: branding, profileUpdatedAt: profileResult?.updated_at || null, capturedAt: now },
      inclusionsDraft: {
        status: "Needs Review",
        categories: [...new Set(generated.items.map((item) => item.category))],
        items: generated.items,
        gaps: gapDetails.map((gap) => `${gap.category}: ${gap.requirementTitle}`),
        gapDetails,
        excludedCategories: [],
        preferences: { market: "", brands: "", suppliers: "", budget: "", budgetType: "inclusions", specifications: "", notes: "", maxUnitAllowance: "", ...(existing?.metadata?.inclusionsDraft?.preferences || {}), ...(req.body?.preferences && typeof req.body.preferences === "object" ? req.body.preferences : {}), qualityLevel: { budget: "Economy", "mid-range": "Mid-range", "high-end": "Premium" }[priceLevel], priceLevel },
      },
    };
    const record = {
      workspaceId: req.workspaceId,
      userId: req.user.id,
      scheduleId,
      name: existing?.name || `${tier} Inclusions Schedule - ${generated.priceLevel}`,
      description: `Generated from the supplied 10-page master template. ${generated.items.filter((item) => item.product).length} verified catalogue matches; ${generated.gaps.length} builder review items.`,
      tierKey: tier,
      metadata,
      ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}),
    };
    const schedule = existing ? await updateStandardInclusionsSchedule(record) : await createStandardInclusionsScheduleDraft(record);
    return res.status(existing ? 200 : 201).json({ ok: true, schedule, itemCount: generated.items.length, matchedCount: generated.items.filter((item) => item.product).length, gaps: gapDetails, brandingWarning });
  } catch (error) {
    console.error("Standard Inclusions schedule generation failed:", error?.message || error);
    return res.status(error?.statusCode === 409 ? 409 : 500).json({ ok: false, error: error?.statusCode === 409 ? error.message : "The schedule could not be generated. Reopen the draft, check its saved status, and retry. Approved schedules remain protected." });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"], authTimeoutMs: 8000 });
