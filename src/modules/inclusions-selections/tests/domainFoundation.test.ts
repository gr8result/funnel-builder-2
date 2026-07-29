import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import { canLockSelectionSet } from "../approvals/approvalRules";
import { createEstimateSelectionExport } from "../estimate-export/estimateExportAdapter";
import { calculateSelectionPricing } from "../pricing/pricingService";
import type { ProductReference } from "../products/productReferenceTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import { generateRequirementsForArea } from "../templates/templateGenerationService";
import { createSelectionSnapshot } from "../snapshots/snapshotService";
import { previewApplySelection } from "../selections/applyToService";
import { money } from "../shared/money";
import type { AreaTemplate } from "../templates/templateTypes";
import { validateProjectAreas } from "../areas/projectAreaValidation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runInclusionsSelectionsDomainTests(): void {
  const areas: ProjectArea[] = [
    { id: "area_main_bath", organisationId: "org_1", projectId: "project_1", areaTypeId: "area_type_bathroom", groupId: "area_group_wet_areas", name: "Main Bathroom", level: 0, displayOrder: 1, status: "active" },
    { id: "area_ensuite", organisationId: "org_1", projectId: "project_1", areaTypeId: "area_type_bathroom", groupId: "area_group_wet_areas", name: "Ensuite", level: 0, displayOrder: 2, status: "active" },
  ];
  const validation = validateProjectAreas(areas, STANDARD_AREA_TYPES, STANDARD_AREA_GROUPS);
  assert(validation.ok, "Project area validation should pass for known groups and types.");

  const template: AreaTemplate = {
    id: "template_bathroom",
    areaTypeId: "area_type_bathroom",
    name: "Bathroom",
    version: 1,
    active: true,
    requirementDefinitions: [
      { id: "req_def_tile", category: "flooring", subtype: "tile", title: "Floor tile", quantityMode: "per_area", defaultQuantity: 1, required: true },
    ],
  };
  const generated = generateRequirementsForArea({ area: areas[0], template });
  assert(generated.requirements.length === 1, "Template generation should create a requirement.");

  const product: ProductReference = {
    id: "product_tile",
    organisationId: "org_1",
    name: "Porcelain tile",
    unit: "m2",
    active: true,
    compatibility: { category: "flooring", subtype: "tile", areaTypeIds: ["area_type_bathroom"], internalExternal: "internal" },
    unitCost: money(50),
  };
  const pricing = calculateSelectionPricing({ quantity: 10, unitCost: product.unitCost, allowance: money(450), markupRate: 0.2, gstRate: 0.1 });
  assert(pricing.variation.amount === 150, "Pricing should calculate allowance variance.");

  const selection = {
    id: "selection_1",
    organisationId: "org_1",
    projectId: "project_1",
    requirementId: generated.requirements[0].id,
    value: { productReferenceId: product.id },
    source: "client" as const,
    status: "approved" as const,
    revision: 1,
  };
  const approvals = [
    { id: "approval_builder", organisationId: "org_1", projectId: "project_1", selectionId: selection.id, role: "builder" as const, decision: "approved" as const },
    { id: "approval_client", organisationId: "org_1", projectId: "project_1", selectionId: selection.id, role: "client" as const, decision: "approved" as const },
  ];
  assert(canLockSelectionSet(generated.requirements, [selection], approvals), "Approved required selections should be lockable.");

  const preview = previewApplySelection(generated.requirements[0], selection.value, "whole_project", generated.requirements, areas, STANDARD_AREA_TYPES, [product]);
  assert(preview.every((item) => item.compatible), "Compatible product should preview cleanly.");

  const snapshot = createSelectionSnapshot({
    organisationId: "org_1",
    projectId: "project_1",
    version: 1,
    lockedBy: "user_1",
    requirements: generated.requirements,
    lines: [
      {
        requirementId: generated.requirements[0].id,
        areaId: areas[0].id,
        category: "flooring",
        subtype: "tile",
        title: "Floor tile",
        productReferenceId: product.id,
        productName: product.name,
        quantity: 10,
        unit: product.unit,
        cost: pricing.cost,
        sell: pricing.sell,
        variation: pricing.variation,
      },
    ],
  });
  const exportPayload = createEstimateSelectionExport(snapshot, { gstRate: 0.1 });
  assert(exportPayload.lines.length === 1, "Estimate export should include snapshot line.");
}

runInclusionsSelectionsDomainTests();
