import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { AreaTemplate } from "../templates/templateTypes";
import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";

export const MINIMAL_INCLUSIONS_SELECTIONS_FIXTURES = {
  areaGroups: STANDARD_AREA_GROUPS,
  areaTypes: STANDARD_AREA_TYPES,
  tiers: STANDARD_INCLUSION_TIERS,
  templates: [
    {
      id: "template_bathroom_base",
      areaTypeId: "area_type_bathroom",
      name: "Bathroom base requirements",
      version: 1,
      active: true,
      requirementDefinitions: [
        {
          id: "req_def_bathroom_floor_tile",
          category: "flooring",
          subtype: "tile",
          title: "Floor tile",
          quantityMode: "per_area",
          defaultQuantity: 1,
          required: true,
          allowedAreaTypeIds: ["area_type_bathroom"],
        },
        {
          id: "req_def_bathroom_tapware",
          category: "fitting",
          subtype: "tapware",
          title: "Tapware",
          quantityMode: "per_item",
          defaultQuantity: 1,
          required: true,
          allowedAreaTypeIds: ["area_type_bathroom"],
        },
      ],
    },
  ] satisfies AreaTemplate[],
};
