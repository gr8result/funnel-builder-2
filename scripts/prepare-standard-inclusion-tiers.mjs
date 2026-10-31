import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { listStandardInclusionsSchedules, createStandardInclusionsScheduleDraft } from "../lib/standard-inclusions/pdfLibrary.js";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { generateMasterInclusionsSchedule } from "../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { STANDARD_TIER_SETTINGS } from "../lib/standard-inclusions/tierScheduleReview.mjs";
import { handler as readBranding } from "../pages/api/standard-inclusions/branding.js";

const option = name => process.argv[process.argv.indexOf(name) + 1];
const workspaceId = process.argv.includes("--workspace-id") ? option("--workspace-id") : "";
if (!workspaceId) throw new Error("An explicit --workspace-id is required.");
const { data: owner, error } = await supabaseAdmin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("role", "owner").eq("status", "active").order("created_at").limit(1).maybeSingle();
if (error || !owner) throw new Error("The workspace must have a verified active owner.");
let branding;
await readBranding({ method: "GET", workspaceId, user: { id: owner.user_id } }, {
  setHeader() {}, status() { return this; }, json(body) { if (!body.ok) throw new Error(body.error); branding = body.branding; },
});
const existing = await listStandardInclusionsSchedules({ workspaceId, includeArchived: true });
const products = getEffectiveProductCatalogue({ organisationId: workspaceId }).products;
const results = [];
for (const [tier, settings] of Object.entries(STANDARD_TIER_SETTINGS)) {
  const reusable = existing.find(schedule => schedule.status !== "archived" && schedule.tierKey === tier && schedule.metadata?.tierReviewWorkflowVersion === 2);
  if (reusable) { results.push({ id: reusable.id, tier, reused: true }); continue; }
  const id = randomUUID();
  const generated = generateMasterInclusionsSchedule({ scheduleId: id, tier, priceLevel: settings.priceLevel, products, branding });
  const sources = existing.filter(schedule => new RegExp(tier, "i").test(`${schedule.tierKey} ${schedule.name}`)).map(schedule => schedule.id);
  const metadata = {
    schemaVersion: 3, tierReviewWorkflowVersion: 2, workflowStatus: "Needs Review", generatedSchedule: true,
    recoveredFromScheduleIds: sources, reviewRequirementIds: generated.items.map(item => item.id),
    productPriceLevel: settings.priceLevel, generatedAt: new Date().toISOString(),
    quotationDefaultCandidate: tier === "Premier", quotationDefault: false,
    brochureBranding: { source: "business-profile-vault", snapshot: branding }, brochureDocument: generated.document,
    inclusionsDraft: {
      status: "Needs Review", categories: [...new Set(generated.items.map(item => item.category))], items: generated.items,
      gaps: generated.gaps.map(gap => `${gap.category}: ${gap.requirementTitle}`), gapDetails: generated.gaps,
      excludedCategories: [], preferences: { qualityLevel: settings.label, priceLevel: settings.priceLevel, brands: "", suppliers: "", budget: "", budgetType: "inclusions", specifications: "", notes: "", maxUnitAllowance: "" },
    },
  };
  if (!process.argv.includes("--write")) { results.push({ tier, planned: true, sourceIds: sources, requirements: generated.items.length }); continue; }
  const schedule = await createStandardInclusionsScheduleDraft({ workspaceId, userId: owner.user_id, scheduleId: id,
    name: `${tier} Inclusions - Builder Review`, tierKey: tier,
    description: `${settings.label} review draft. Original schedules and artwork retained. Requires builder approval before publication or quotation use.`, metadata });
  results.push({ id: schedule.id, tier, pages: generated.document.pages.length, requirements: generated.items.length, matched: generated.items.filter(item => item.product).length, exceptions: generated.gaps.length, status: "Needs Review", sourceIds: sources });
}
console.log(JSON.stringify({ workspaceId, existingRecordsPreserved: existing.length, wroteDrafts: process.argv.includes("--write"), schedules: results }, null, 2));