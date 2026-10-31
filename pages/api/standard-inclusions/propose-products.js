import OpenAI from "openai";
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { createBuilderCatalogueRepository } from "../../../lib/product-library/builderCatalogueRepository.js";
import { getEffectiveProductCatalogue } from "../../../lib/product-library/catalogueService.js";
import { normalizeCatalogueProduct, validateProductProposals, constrainProposalCatalogue, rankCatalogueCandidatesForCategories, limitProposalBudget } from "../../../lib/standard-inclusions/productProposal.mjs";

const MAX_PRODUCTS = 80;
const MAX_CATEGORIES = 40;

function text(value, limit = 240) {
  return String(value || "").trim().slice(0, limit);
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ ok: false, error: "AI product proposals are unavailable until the AI service is configured." });

  const categories = Array.isArray(req.body?.categories)
    ? [...new Set(req.body.categories.map((item) => text(item, 120)).filter(Boolean))].slice(0, MAX_CATEGORIES)
    : [];
  if (!categories.length) return res.status(400).json({ ok: false, error: "Add at least one inclusion category." });

  let catalogue;
  try {
    const [workspaceCatalogue, effectiveProducts] = await Promise.all([
      createBuilderCatalogueRepository(supabaseAdmin, req.workspaceId).load(),
      Promise.resolve(getEffectiveProductCatalogue({ organisationId: req.workspaceId }).products),
    ]);
    const productsById = new Map();
    for (const product of [...(workspaceCatalogue?.products || []), ...(effectiveProducts || [])]) {
      const normalized = normalizeCatalogueProduct(product);
      if (normalized.productId) productsById.set(normalized.productId, product);
    }
    catalogue = { products: [...productsById.values()] };
  } catch {
    return res.status(503).json({ ok: false, error: "This workspace's Product Library is unavailable." });
  }
  const normalizedProducts = (catalogue?.products || [])
    .map(normalizeCatalogueProduct).filter(product => product.productId && product.name && product.active);
  const familyCandidates = categories.map(category => ({
    category,
    products: rankCatalogueCandidatesForCategories(normalizedProducts, [category], { perCategory: 16, totalLimit: 16 }),
  }));
  const eligible = constrainProposalCatalogue(normalizedProducts, {
      qualityLevel: req.body?.qualityLevel,
      maxUnitAllowance: req.body?.maxUnitAllowance,
      preferredBrands: req.body?.preferredBrands,
      preferredSuppliers: req.body?.preferredSuppliers,
      specifications: req.body?.specifications,
    });
  const categoryCandidates = categories.map(category => ({
    category,
    products: rankCatalogueCandidatesForCategories(eligible, [category], { perCategory: 16, totalLimit: 16 }),
  }));
  const candidateMap = new Map();
  for (const group of categoryCandidates) for (const product of group.products) {
    const existing = candidateMap.get(product.productId) || { ...product, eligibleCategories: [] };
    existing.eligibleCategories = [...new Set([...existing.eligibleCategories, group.category])];
    candidateMap.set(product.productId, existing);
  }
  const candidates = [...candidateMap.values()].slice(0, MAX_PRODUCTS);
  if (!candidates.length) {
    const gapDetails = categories.map((category) => ({
      category,
      reason: familyCandidates.find((group) => group.category === category)?.products.length
        ? "Builder review required: compatible catalogue products exist, but none has a verified price or allowance that meets this schedule’s constraints."
        : "Builder review required: no deterministically classified product family or verified construction allowance is available for this requirement.",
    }));
    return res.status(200).json({ ok: true, proposals: [], gaps: categories, gapDetails, candidateCount: 0 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Select only productId values from the provided workspace catalogue, and only for a category listed in that product's eligibleCategories. Never invent a product, specification, price, supplier, availability, or category. Return JSON exactly as {\"proposals\":[{\"category\":string,\"productId\":string}]}. Choose the best suitable existing product for every category with eligible candidates; omit a category only when its eligible candidate list is empty or genuinely unsuitable. Product descriptions and prices are unverified source data; do not rewrite them.",
        },
        {
          role: "user",
          content: JSON.stringify({
            tier: text(req.body?.tier, 100),
            preferences: {
              qualityLevel: text(req.body?.qualityLevel, 40),
              preferredBrands: Array.isArray(req.body?.preferredBrands) ? req.body.preferredBrands.map((item) => text(item, 100)).filter(Boolean).slice(0, 20) : [],
              preferredSuppliers: Array.isArray(req.body?.preferredSuppliers) ? req.body.preferredSuppliers.map((item) => text(item, 100)).filter(Boolean).slice(0, 20) : [],
              specifications: text(req.body?.specifications, 500),
              budgetType: text(req.body?.budgetType, 40),
              budget: text(req.body?.budget, 180),
              notes: text(req.body?.notes, 500),
            },
            categories,
            categoryCandidates: categoryCandidates.map(group => ({ category: group.category, productIds: group.products.map(product => product.productId) })),
            // Image URLs and slot ids add tokens without helping the choice.
            products: candidates.map(({ active, image, selectionSlotIds, ...product }) => product),
          }),
        },
      ],
    });
    const content = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const validationProducts = candidates.map(({ eligibleCategories, ...product }) => product);
    const eligibleProductIdsByCategory = Object.fromEntries(categoryCandidates.map((group) => [group.category, group.products.map((product) => product.productId)]));
    const { proposals, gaps, allowanceTotal } = limitProposalBudget(validateProductProposals({
      proposals: parsed.proposals,
      categories,
      products: validationProducts,
      eligibleProductIdsByCategory,
    }), req.body?.budgetType === "construction" ? null : req.body?.budget);
    const gapDetails = gaps.map((category) => {
      const familyCount = familyCandidates.find((group) => group.category === category)?.products.length || 0;
      const eligibleCount = categoryCandidates.find((group) => group.category === category)?.products.length || 0;
      const reason = eligibleCount
        ? "Builder review required: compatible, priced catalogue candidates were available, but AI did not return a valid selection for this requirement."
        : familyCount
          ? "Builder review required: compatible catalogue products exist, but none has a verified price or allowance that meets this schedule’s constraints."
          : "Builder review required: no deterministically classified product family or verified construction allowance is available for this requirement.";
      return { category, reason };
    });
    return res.status(200).json({
      ok: true,
      proposals,
      gaps,
      gapDetails,
      candidateCount: candidates.length,
      catalogueScope: req.workspaceId,
      allowanceTotal,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    const code = status === 401 || status === 403
      ? "AI_SERVICE_AUTH_FAILED"
      : status === 429
        ? "AI_SERVICE_RATE_LIMITED"
        : error?.name === "APIConnectionTimeoutError" || /timeout|timed out/i.test(String(error?.message || ""))
          ? "AI_SERVICE_TIMEOUT"
          : error?.name === "APIConnectionError"
            ? "AI_SERVICE_UNREACHABLE"
            : "AI_RESPONSE_INVALID";
    console.error("Standard Inclusions product proposal failed:", { code, status, errorName: error?.name });
    const message = code === "AI_SERVICE_AUTH_FAILED"
      ? "The configured AI service rejected its credentials. Your saved draft was not changed."
      : code === "AI_SERVICE_RATE_LIMITED"
        ? "The AI service is rate-limited. Retry later; your saved draft was not changed."
        : code === "AI_SERVICE_TIMEOUT"
          ? "The AI service did not respond within 30 seconds. Retry; your saved draft was not changed."
          : code === "AI_SERVICE_UNREACHABLE"
            ? "The AI service could not be reached. Check server network access; your saved draft was not changed."
            : "AI could not prepare product proposals. Your saved draft was not changed.";
    return res.status(code === "AI_SERVICE_TIMEOUT" ? 504 : 502).json({ ok: false, code, error: message });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"] });
