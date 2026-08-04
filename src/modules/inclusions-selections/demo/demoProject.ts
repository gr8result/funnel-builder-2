import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectRequirement, RequirementCategory } from "../requirements/requirementTypes";
import { approvalStageRepository, type ApprovalHistoryEvent, type ApprovalRecord } from "../repositories/approvalStageRepository";
import { projectAreaRegisterRepository, type ProjectAreaRegister, type ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { selectionReviewRepository, type ReviewAuditEvent, type SelectionReviewState } from "../repositories/selectionReviewRepository";
import { selectionWorkspaceRepository, type RequirementAttachmentReference, type RequirementNote, type WorkspaceDraftState } from "../repositories/selectionWorkspaceRepository";
import { templateStageRepository } from "../repositories/templateStageRepository";
import type { SelectionLocation } from "../selections/selectionLocationTypes";
import type { ProjectSelection, SelectionValue } from "../selections/selectionTypes";
import { makeScopedId } from "../shared/ids";
import { money, roundCurrency } from "../shared/money";
import { createStandardProjectLevels, makeProjectLevelId } from "../levels/standardProjectLevels";
import { generateRequirementsForArea } from "../templates/templateGenerationService";
import { STANDARD_AREA_TEMPLATES, findStandardAreaTemplateForAreaType } from "../templates/standardAreaTemplates";
import type { TemplateStageConfiguration } from "../templates/templateAssignmentTypes";
import { calculateApprovalFingerprint, loadApprovalStage } from "../services/approvalStageService";

export const DEMO_PROJECT_CONTEXT: ProjectSelectionContext = {
  organisationId: "org_demo_inclusions",
  projectId: "project_johnson_residence",
  projectName: "Johnson Residence",
  clientName: "Michael and Sarah Johnson",
  siteAddress: "Sunshine Coast, Queensland",
  jobNumber: "DEMO-001",
};

export const DEMO_PROJECT_TYPE = "Four-bedroom single-storey residential home";
const now = () => new Date().toISOString();

const demoAreas = [
  ["Exterior", "area_type_exterior", "external"],
  ["Roof", "area_type_roof", "external"],
  ["Porch", "area_type_porch", "external"],
  ["Alfresco", "area_type_external_living", "external"],
  ["Garage", "area_type_garage", "external"],
  ["Driveway", "area_type_driveway", "external"],
  ["Master Bedroom", "area_type_master_bedroom", "ground-floor"],
  ["Bedroom 2", "area_type_bedroom", "ground-floor"],
  ["Bedroom 3", "area_type_bedroom", "ground-floor"],
  ["Bedroom 4", "area_type_bedroom", "ground-floor"],
  ["Ensuite", "area_type_ensuite", "ground-floor"],
  ["Main Bathroom", "area_type_bathroom", "ground-floor"],
  ["Powder Room", "area_type_powder_room", "ground-floor"],
  ["Laundry", "area_type_laundry", "ground-floor"],
  ["Kitchen", "area_type_kitchen", "ground-floor"],
  ["Butler's Pantry", "area_type_butlers_pantry", "ground-floor"],
  ["Walk-in Pantry", "area_type_walk_in_pantry", "ground-floor"],
  ["Entry", "area_type_entry", "ground-floor"],
  ["Hallway", "area_type_hallway", "ground-floor"],
  ["Living Room", "area_type_living", "ground-floor"],
  ["Dining Room", "area_type_dining_room", "ground-floor"],
  ["Media Room", "area_type_media_room", "ground-floor"],
  ["Study", "area_type_study", "ground-floor"],
] as const;

function areaId(name: string): string {
  return makeScopedId("project_area", [DEMO_PROJECT_CONTEXT.organisationId, DEMO_PROJECT_CONTEXT.projectId, name]);
}

function requirementId(area: ProjectArea, title: string): string {
  return makeScopedId("requirement", [area.organisationId, area.projectId, area.id, title]);
}

function buildAreaRegister(): ProjectAreaRegister {
  const levels = createStandardProjectLevels(DEMO_PROJECT_CONTEXT.organisationId, DEMO_PROJECT_CONTEXT.projectId)
    .map((level) => ({ ...level, active: level.code === "ground-floor" || level.code === "external" }));
  const areas: ProjectArea[] = demoAreas.map(([name, areaTypeId, levelCode], index) => {
    const areaType = STANDARD_AREA_TYPES.find((type) => type.id === areaTypeId);
    const levelId = makeProjectLevelId(DEMO_PROJECT_CONTEXT.projectId, levelCode);
    const level = levels.find((item) => item.id === levelId) ?? levels[0];
    return {
      id: areaId(name),
      organisationId: DEMO_PROJECT_CONTEXT.organisationId,
      projectId: DEMO_PROJECT_CONTEXT.projectId,
      areaTypeId,
      groupId: areaType?.groupId ?? "area_group_custom",
      name,
      level: level.displayOrder,
      levelId: level.id,
      displayOrder: index,
      status: "draft",
      source: "standard_area",
      sourceAreaTypeId: areaTypeId,
      generatedOrdinal: areaTypeId === "area_type_bedroom" ? Number(name.replace(/\D/g, "")) - 1 : undefined,
    };
  });
  const counts = new Map<string, number>();
  areas.forEach((area) => counts.set(area.areaTypeId, (counts.get(area.areaTypeId) ?? 0) + 1));
  return {
    ...DEMO_PROJECT_CONTEXT,
    levels,
    areas,
    customAreaTypes: [],
    selections: [...counts.entries()].map(([areaTypeId, quantity]) => ({ areaTypeId, quantity })),
    updatedAt: now(),
  };
}

function buildConfiguration(context: ProjectSelectionContext): TemplateStageConfiguration {
  return {
    id: makeScopedId("template_stage", [context.organisationId, context.projectId]),
    ...context,
    projectDefault: { scope: "project", tierId: "tier_premier", mode: "standard" },
    groupOverrides: [
      { scope: "area_group", groupId: "area_group_bedrooms", templateId: "area_template_bedroom", tierId: "tier_premier", mode: "standard" },
      { scope: "area_group", groupId: "area_group_wet_areas", templateId: "area_template_bathroom", tierId: "tier_premium", mode: "standard" },
      { scope: "area_group", groupId: "area_group_kitchen_areas", templateId: "area_template_kitchen", tierId: "tier_premium", mode: "standard" },
      { scope: "area_group", groupId: "area_group_living", templateId: "area_template_living", tierId: "tier_premier", mode: "standard" },
      { scope: "area_group", groupId: "area_group_external", templateId: "area_template_exterior", tierId: "tier_premier", mode: "standard" },
    ],
    areaTypeOverrides: [
      { scope: "area_type", areaTypeId: "area_type_ensuite", templateId: "area_template_ensuite", tierId: "tier_premium", mode: "standard" },
      { scope: "area_type", areaTypeId: "area_type_kitchen", templateId: "area_template_kitchen", tierId: "tier_premium", mode: "standard" },
      { scope: "area_type", areaTypeId: "area_type_butlers_pantry", templateId: "area_template_butlers_pantry", tierId: "tier_premium", mode: "standard" },
      { scope: "area_type", areaTypeId: "area_type_roof", templateId: "area_template_roof", tierId: "tier_premier", mode: "standard" },
      { scope: "area_type", areaTypeId: "area_type_garage", templateId: "area_template_garage", tierId: "tier_classic", mode: "standard" },
    ],
    areaOverrides: [],
    savedBuilderTemplateId: "demo_johnson_residence_visual_workflow",
    updatedAt: now(),
  };
}

function buildRequirements(register: ProjectAreaRegister): ProjectRequirement[] {
  const generated = register.areas.flatMap((area) => {
    const template = findStandardAreaTemplateForAreaType(area.areaTypeId);
    return template ? generateRequirementsForArea({ area, template }).requirements : [];
  });
  const kitchen = register.areas.find((area) => area.name === "Kitchen");
  const ensuite = register.areas.find((area) => area.name === "Ensuite");
  const extras: Array<[ProjectArea | undefined, string, RequirementCategory, string]> = [
    [kitchen, "Kitchen pendant lighting", "electrical", "lighting"],
    [kitchen, "Stone waterfall end", "fixture", "benchtops"],
    [kitchen, "Feature tile splashback", "wall_finish", "splashback"],
    [kitchen, "Appliance package allowance", "appliance", "appliance_package"],
    [ensuite, "Heated towel rail", "electrical", "heated_towel_rail"],
  ];
  return [
    ...generated,
    ...extras.filter((item): item is [ProjectArea, string, RequirementCategory, string] => Boolean(item[0])).map(([area, title, category, subtype], index) => ({
      id: requirementId(area, title),
      organisationId: area.organisationId,
      projectId: area.projectId,
      definitionId: makeScopedId("req_def_demo", [title]),
      areaId: area.id,
      templateId: STANDARD_AREA_TEMPLATES.find((template) => template.areaTypeId === area.areaTypeId)?.id,
      category,
      subtype,
      title,
      quantity: 1,
      status: "required" as const,
      required: true,
      applicability: "required" as const,
      displayOrder: 900 + index,
    })),
  ].map((requirement, index) => ({ ...requirement, displayOrder: requirement.displayOrder ?? index }));
}

function findRequirement(requirements: ProjectRequirement[], register: ProjectAreaRegister, areaName: string, titleIncludes: string): ProjectRequirement | undefined {
  const area = register.areas.find((item) => item.name === areaName);
  return requirements.find((item) => item.areaId === area?.id && item.title.toLowerCase().includes(titleIncludes.toLowerCase()));
}

function pricedSelection(context: ProjectSelectionContext, requirement: ProjectRequirement, input: { productId?: string; variantId?: string; name?: string; category?: string; allowance: number; selected?: number; builder?: number; status?: ProjectSelection["selectionStatus"]; pricingStatus?: SelectionValue["pricingStatus"]; supplierId?: string; notApplicableReason?: string; protected?: boolean }): ProjectSelection {
  const selected = input.selected;
  const variation = selected === undefined ? undefined : roundCurrency(selected - input.allowance);
  const value: SelectionValue = input.productId ? {
    productReferenceId: input.productId,
    variantId: input.variantId,
    allowance: money(input.allowance),
    clientPrice: selected === undefined ? undefined : money(selected),
    builderCost: money(input.builder ?? Math.max(0, (selected ?? input.allowance) * 0.68)),
    priceSource: input.pricingStatus === "supplier_quote_required" ? "supplier_quote" : "catalogue",
    pricingStatus: input.pricingStatus ?? (selected === undefined ? "price_missing" : "confirmed"),
    note: "Demonstration product and indicative price",
  } : {
    customSelectionId: makeScopedId("custom_selection", [context.projectId, requirement.id]),
    customSelectionName: input.name ?? "Custom demonstration selection",
    customSelectionCategory: input.category ?? requirement.category,
    description: input.name ? `${input.name} entered by builder for demo review.` : "Custom item entered by builder for demo review.",
    allowance: money(input.allowance),
    clientPrice: selected === undefined ? undefined : money(selected),
    builderCost: money(input.builder ?? Math.max(0, (selected ?? input.allowance) * 0.65)),
    supplierId: input.supplierId,
    priceSource: "manual",
    pricingStatus: input.pricingStatus ?? "manual_price",
    note: "Demonstration custom selection and indicative price",
  };
  return {
    id: makeScopedId("selection", [context.organisationId, context.projectId, requirement.id]),
    organisationId: context.organisationId,
    projectId: context.projectId,
    requirementId: requirement.id,
    value,
    source: "builder",
    status: "draft",
    revision: 1,
    selectionStatus: input.status ?? (input.notApplicableReason ? "not_applicable" : "complete"),
    quantity: requirement.quantity || 1,
    unit: "each",
    allowance: money(input.allowance),
    selectedPrice: selected === undefined ? undefined : money(selected),
    variation: variation === undefined ? undefined : money(variation),
    gst: selected === undefined ? undefined : money(roundCurrency(Math.max(variation ?? 0, 0) * 0.1)),
    notApplicableReason: input.notApplicableReason,
    inheritedFrom: "johnson_residence_demo",
    protected: input.protected,
  };
}

function buildSelections(context: ProjectSelectionContext, register: ProjectAreaRegister, requirements: ProjectRequirement[]): { selections: ProjectSelection[]; locations: SelectionLocation[]; notes: RequirementNote[]; attachments: RequirementAttachmentReference[] } {
  const picks: Array<[ProjectRequirement | undefined, Parameters<typeof pricedSelection>[2]]> = [
    [findRequirement(requirements, register, "Ensuite", "Basin Mixer"), { productId: "demo_phoenix_vivid_basin_mixer", variantId: "demo_phoenix_basin_chrome", allowance: 450, selected: 450 }],
    [findRequirement(requirements, register, "Kitchen", "Sink Mixer"), { productId: "demo_phoenix_vivid_sink_mixer", variantId: "demo_phoenix_sink_chrome", allowance: 450, selected: 590 }],
    [findRequirement(requirements, register, "Laundry", "Laundry Mixer"), { productId: "product_dev_laundry_mixer", variantId: "variant_dev_laundry_chrome", allowance: 320, selected: 280 }],
    [findRequirement(requirements, register, "Kitchen", "Cabinetry"), { productId: "demo_polytec_cabinetry", variantId: "demo_polytec_oak_ravine", allowance: 5200, selected: 6100 }],
    [findRequirement(requirements, register, "Kitchen", "Benchtops"), { productId: "demo_caesarstone_benchtop", variantId: "demo_caesarstone_snowdrift", allowance: 4500, selected: 5200 }],
    [findRequirement(requirements, register, "Kitchen", "Splashback"), { productId: "demo_feature_tile_unavailable", allowance: 900, selected: 1400, pricingStatus: "unavailable_product" }],
    [findRequirement(requirements, register, "Kitchen", "Oven"), { productId: "demo_smeg_900_oven", allowance: 1250, selected: 1890 }],
    [findRequirement(requirements, register, "Kitchen", "Cooktop"), { productId: "demo_westinghouse_induction", allowance: 980, selected: 980 }],
    [findRequirement(requirements, register, "Kitchen", "Rangehood"), { productId: "demo_rangehood", allowance: 700, selected: 820 }],
    [findRequirement(requirements, register, "Kitchen", "Dishwasher"), { productId: "demo_dishwasher", allowance: 890, selected: 890 }],
    [findRequirement(requirements, register, "Ensuite", "Shower Mixer"), { productId: "demo_phoenix_vivid_shower_mixer", variantId: "demo_phoenix_shower_chrome", allowance: 390, selected: 390 }],
    [findRequirement(requirements, register, "Ensuite", "Shower Screen"), { productId: "demo_shower_screen", allowance: 760, selected: 890 }],
    [findRequirement(requirements, register, "Ensuite", "Toilet"), { productId: "demo_caroma_luna_toilet", allowance: 690, selected: 690 }],
    [findRequirement(requirements, register, "Ensuite", "Floor Tile"), { productId: "demo_porcelain_floor_tile", allowance: 720, selected: 720 }],
    [findRequirement(requirements, register, "Bedroom 2", "Carpet"), { productId: "demo_carpet", allowance: 450, selected: 450 }],
    [findRequirement(requirements, register, "Bedroom 2", "Door Hardware"), { productId: "product_dev_internal_door_hardware", allowance: 120, selected: 120, pricingStatus: "confirmed" }],
    [findRequirement(requirements, register, "Bedroom 2", "Robe Fitout"), { productId: "demo_single_shelf_rail", allowance: 320, selected: 280 }],
    [findRequirement(requirements, register, "Bedroom 3", "Robe Fitout"), { productId: "demo_single_shelf_rail", allowance: 320, selected: 280 }],
    [findRequirement(requirements, register, "Bedroom 4", "Robe Fitout"), { productId: "demo_single_shelf_rail", allowance: 320, selected: 280 }],
    [findRequirement(requirements, register, "Master Bedroom", "Walk-in Robe Fitout"), { productId: "demo_premium_drawer_shelf", allowance: 690, selected: 1250 }],
    [findRequirement(requirements, register, "Living Room", "Floor Covering"), { productId: "demo_hybrid_floor", allowance: 450, selected: 520 }],
    [findRequirement(requirements, register, "Roof", "Roof Material"), { productId: "demo_colorbond_roof", variantId: "demo_colorbond_monument", allowance: 82, selected: 84 }],
    [findRequirement(requirements, register, "Exterior", "Brick or Cladding"), { productId: "demo_pgh_brick", allowance: 115, selected: 115 }],
    [findRequirement(requirements, register, "Entry", "Window Furnishings"), { name: "Custom sheer curtain package", category: "fitting", allowance: 900, selected: 1450, pricingStatus: "manual_price" }],
    [findRequirement(requirements, register, "Living Room", "Window Furnishings"), { allowance: 600, selected: 0, status: "not_applicable", notApplicableReason: "Client is supplying living room window furnishings after handover." }],
    [findRequirement(requirements, register, "Media Room", "Air Conditioning"), { allowance: 1800, selected: 0, status: "not_applicable", notApplicableReason: "Client confirmed future split-system provision only for this room." }],
  ];
  const selections = picks.filter((item): item is [ProjectRequirement, Parameters<typeof pricedSelection>[2]] => Boolean(item[0])).map(([requirement, input]) => pricedSelection(context, requirement, input));
  const locations = selections.map((selection) => {
    const requirement = requirements.find((item) => item.id === selection.requirementId)!;
    const area = register.areas.find((item) => item.id === requirement.areaId)!;
    return {
      id: makeScopedId("selection_location", [context.organisationId, context.projectId, selection.id, area.id]),
      organisationId: context.organisationId,
      projectId: context.projectId,
      selectionId: selection.id,
      requirementId: requirement.id,
      areaId: area.id,
      label: `${area.name} - ${requirement.title}`,
      quantity: selection.quantity ?? 1,
      pricingQuantity: selection.quantity ?? 1,
      unit: selection.unit ?? "each",
    };
  });
  const notes: RequirementNote[] = selections.slice(0, 10).map((selection, index) => ({
    id: makeScopedId("requirement_note", [context.projectId, selection.requirementId, index]),
    organisationId: context.organisationId,
    projectId: context.projectId,
    requirementId: selection.requirementId,
    kind: index % 2 ? "client_visible" : "internal",
    text: index % 2 ? "Demonstration note for client variation preview." : "Builder demo note: indicative pricing only.",
    createdAt: now(),
  }));
  const attachments: RequirementAttachmentReference[] = selections.slice(0, 8).map((selection, index) => ({
    id: makeScopedId("requirement_attachment", [context.projectId, selection.requirementId, index]),
    organisationId: context.organisationId,
    projectId: context.projectId,
    requirementId: selection.requirementId,
    kind: "product_image",
    label: "Demo product placeholder image",
    url: "demo://placeholder",
  }));
  return { selections, locations, notes, attachments };
}

function completeRequiredSelectionsForApproval(context: ProjectSelectionContext, register: ProjectAreaRegister, requirements: ProjectRequirement[], workspace: ReturnType<typeof buildSelections>): ReturnType<typeof buildSelections> {
  const selectedRequirementIds = new Set(workspace.selections.map((selection) => selection.requirementId));
  const completedSelections = workspace.selections.map((selection) => selection.selectionStatus === "not_applicable"
    ? { ...selection, selectionStatus: "complete" as const, selectedPrice: selection.allowance, variation: money(0), gst: money(0), notApplicableReason: undefined, value: { ...selection.value, clientPrice: selection.allowance, pricingStatus: "confirmed" as const, note: `${selection.value.note ?? "Demonstration selection"} - included for fully approved demo.` } }
    : selection);
  const fillers = requirements
    .filter((requirement) => requirement.required && requirement.status !== "obsolete" && requirement.status !== "blocked_obsolete" && !selectedRequirementIds.has(requirement.id))
    .map((requirement) => pricedSelection(context, requirement, { name: `Included ${requirement.title}`, category: requirement.category, allowance: 0, selected: 0, pricingStatus: "manual_price" }));
  const selections = [...completedSelections, ...fillers];
  const existingLocationIds = new Set(workspace.locations.map((location) => location.selectionId));
  const fillerLocations = selections
    .filter((selection) => !existingLocationIds.has(selection.id))
    .map((selection) => {
      const requirement = requirements.find((item) => item.id === selection.requirementId)!;
      const area = register.areas.find((item) => item.id === requirement.areaId)!;
      return {
        id: makeScopedId("selection_location", [context.organisationId, context.projectId, selection.id, area.id]),
        organisationId: context.organisationId,
        projectId: context.projectId,
        selectionId: selection.id,
        requirementId: requirement.id,
        areaId: area.id,
        label: `${area.name} - ${requirement.title}`,
        quantity: selection.quantity ?? 1,
        pricingQuantity: selection.quantity ?? 1,
        unit: selection.unit ?? "each",
      };
    });
  return { ...workspace, selections, locations: [...workspace.locations, ...fillerLocations] };
}

function reviewState(context: ProjectSelectionContext, readyForApproval: boolean): SelectionReviewState {
  return {
    organisationId: context.organisationId,
    projectId: context.projectId,
    selectedView: "summary",
    status: readyForApproval ? "ready_for_approval" : "conflicts_present",
    readyForApproval,
    selectionFingerprint: "demo_pending_review",
    savedStatus: "saved",
    updatedAt: now(),
  };
}

export async function loadDemonstrationProject(options: { approvalState?: "pending" | "approved"; reset?: boolean } = {}): Promise<ProjectSelectionContext> {
  const context = DEMO_PROJECT_CONTEXT;
  if (options.reset !== false) {
    projectAreaRegisterRepository.resetProject(context);
    templateStageRepository.resetProject(context);
    selectionWorkspaceRepository.resetProject(context);
    selectionReviewRepository.resetProject(context);
    approvalStageRepository.resetProject(context);
  }
  const register = buildAreaRegister();
  const configuration = buildConfiguration(context);
  const requirements = buildRequirements(register);
  const workspace = options.approvalState === "approved"
    ? completeRequiredSelectionsForApproval(context, register, requirements, buildSelections(context, register, requirements))
    : buildSelections(context, register, requirements);
  const draft: WorkspaceDraftState = { organisationId: context.organisationId, projectId: context.projectId, selectedView: "room", selectedAreaId: areaId("Kitchen"), savedStatus: "saved", updatedAt: now() };
  const audit: ReviewAuditEvent = { id: makeScopedId("review_audit", [context.projectId, "demo-loaded"]), organisationId: context.organisationId, projectId: context.projectId, actorId: "demo-loader", actorType: "system", entityType: "DemoProject", entityId: context.projectId, action: "demo_project_loaded", timestamp: now(), correlationId: "johnson-residence-demo" };

  await projectAreaRegisterRepository.save(register);
  await templateStageRepository.saveConfiguration(configuration);
  await templateStageRepository.saveRequirements(context, requirements);
  await selectionWorkspaceRepository.saveSelections(context, workspace.selections);
  await selectionWorkspaceRepository.saveLocations(context, workspace.locations);
  await selectionWorkspaceRepository.saveRequirementNotes(context, workspace.notes);
  await selectionWorkspaceRepository.saveAttachments(context, workspace.attachments);
  await selectionWorkspaceRepository.saveDraftState(draft);
  await selectionReviewRepository.saveReviewState(reviewState(context, options.approvalState === "approved"));
  await selectionReviewRepository.saveAuditEvents(context, [audit]);

  if (options.approvalState === "approved") {
    let stage = await loadApprovalStage(context);
    await selectionReviewRepository.saveIssues(context, stage.review.issues.map((issue) => ({ ...issue, resolvedAt: now() })));
    await selectionReviewRepository.saveReviewState({ ...stage.review.reviewState, readyForApproval: true, status: "ready_for_approval", selectionFingerprint: stage.review.reviewState.selectionFingerprint });
    stage = await loadApprovalStage(context);
    const fingerprint = calculateApprovalFingerprint(stage.review);
    const approvals: ApprovalRecord[] = [
      { id: "demo_client_approval", organisationId: context.organisationId, projectId: context.projectId, party: "client", status: "approved", approverName: "Michael Johnson", approverRole: "Client", method: "in_app", approvedAt: now(), approvedFingerprint: fingerprint, declaration: "Demonstration approval only - not a legal digital signature.", comments: "Fully approved demo state.", recordedBy: "demo-loader", recordedByRepresentative: true },
      { id: "demo_builder_approval", organisationId: context.organisationId, projectId: context.projectId, party: "builder", status: "approved", approverName: "Demo Builder", approverRole: "Builder", method: "in_app", approvedAt: now(), approvedFingerprint: fingerprint, declaration: "Demonstration approval only - not a legal digital signature.", comments: "Ready to create a locked demonstration snapshot.", recordedBy: "demo-loader" },
    ];
    const history: ApprovalHistoryEvent[] = [
      { id: "demo_approval_prepared", organisationId: context.organisationId, projectId: context.projectId, eventType: "demo_pending_approval_loaded", actor: "demo-loader", actorRole: "system", timestamp: now(), fingerprint },
      { id: "demo_approval_fully_approved", organisationId: context.organisationId, projectId: context.projectId, eventType: "demo_fully_approved_loaded", actor: "demo-loader", actorRole: "system", timestamp: now(), fingerprint, comments: "Not a legal digital signature." },
    ];
    await approvalStageRepository.saveApprovals(context, approvals);
    await approvalStageRepository.saveHistory(context, history);
  } else {
    await approvalStageRepository.saveApprovals(context, []);
    await approvalStageRepository.saveHistory(context, [{ id: "demo_approval_pending", organisationId: context.organisationId, projectId: context.projectId, eventType: "demo_pending_approval_loaded", actor: "demo-loader", actorRole: "system", timestamp: now(), fingerprint: "pending", comments: "Client Approval Pending and Builder Approval Pending demonstration state." }]);
  }
  return context;
}

export async function resetDemonstrationProject(): Promise<ProjectSelectionContext> {
  return loadDemonstrationProject({ approvalState: "pending", reset: true });
}
