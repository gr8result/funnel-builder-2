import type { AreaType } from "../area-types/areaTypeTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProductReference } from "../products/productReferenceTypes";
import type { ProjectRequirement } from "../requirements/requirementTypes";
import { makeScopedId } from "../shared/ids";
import type { ProjectSelection, SelectionValue } from "./selectionTypes";

export type ApplyScope = "single_requirement" | "same_area_type" | "same_category" | "whole_project";

export type ApplySelectionPreviewItem = {
  requirementId: string;
  compatible: boolean;
  reason?: string;
};

export function previewApplySelection(
  sourceRequirement: ProjectRequirement,
  value: SelectionValue,
  scope: ApplyScope,
  requirements: ProjectRequirement[],
  areas: ProjectArea[],
  areaTypes: AreaType[],
  products: ProductReference[],
): ApplySelectionPreviewItem[] {
  const sourceArea = areas.find((area) => area.id === sourceRequirement.areaId);
  const product = value.productReferenceId ? products.find((item) => item.id === value.productReferenceId) : undefined;

  return requirements
    .filter((requirement) => {
      const area = areas.find((candidate) => candidate.id === requirement.areaId);
      if (scope === "single_requirement") return requirement.id === sourceRequirement.id;
      if (scope === "same_area_type") return area?.areaTypeId === sourceArea?.areaTypeId;
      if (scope === "same_category") return requirement.category === sourceRequirement.category;
      return true;
    })
    .map((requirement) => {
      const area = areas.find((candidate) => candidate.id === requirement.areaId);
      const areaType = areaTypes.find((candidate) => candidate.id === area?.areaTypeId);
      const compatible = isProductCompatible(requirement, areaType, product);
      return {
        requirementId: requirement.id,
        compatible,
        reason: compatible ? undefined : "Product compatibility does not match this requirement or area type.",
      };
    });
}

export function applySelectionPreview(
  sourceSelection: ProjectSelection,
  preview: ApplySelectionPreviewItem[],
): ProjectSelection[] {
  return preview
    .filter((item) => item.compatible)
    .map((item) => ({
      ...sourceSelection,
      id: makeScopedId("selection", [sourceSelection.projectId, item.requirementId, sourceSelection.revision + 1]),
      requirementId: item.requirementId,
      revision: sourceSelection.revision + 1,
      status: "draft",
    }));
}

function isProductCompatible(requirement: ProjectRequirement, areaType?: AreaType, product?: ProductReference): boolean {
  if (!product) return true;
  if (!product.active) return false;
  if (product.compatibility.category !== requirement.category) return false;
  if (product.compatibility.subtype && product.compatibility.subtype !== requirement.subtype) return false;
  if (product.compatibility.areaTypeIds?.length && (!areaType || !product.compatibility.areaTypeIds.includes(areaType.id))) return false;
  if (product.compatibility.internalExternal === "internal" && !areaType?.traits.includes("internal")) return false;
  if (product.compatibility.internalExternal === "external" && !areaType?.traits.includes("external")) return false;
  return true;
}
