import type { AreaGroupId, AreaTypeId } from "../shared/ids";

export type AreaChecklistItem = {
  areaTypeId: AreaTypeId;
  defaultQuantity: number;
  repeatable: boolean;
};

export type AreaChecklistGroup = {
  groupId: AreaGroupId;
  label: string;
  displayOrder: number;
  areaTypes: AreaChecklistItem[];
};

export const REPEATABLE_AREA_TYPE_IDS = new Set<AreaTypeId>([
  "area_type_bedroom",
  "area_type_bathroom",
  "area_type_ensuite",
  "area_type_powder_room",
  "area_type_wc",
]);

function item(areaTypeId: AreaTypeId, repeatable = false): AreaChecklistItem {
  return { areaTypeId, repeatable, defaultQuantity: 1 };
}

export const CREATE_AREAS_CHECKLIST: AreaChecklistGroup[] = [
  {
    groupId: "area_group_external",
    label: "External and Outdoor",
    displayOrder: 10,
    areaTypes: [
      item("area_type_exterior"),
      item("area_type_roof"),
      item("area_type_external_living"),
      item("area_type_patio"),
      item("area_type_porch"),
      item("area_type_balcony"),
      item("area_type_deck"),
      item("area_type_pool"),
      item("area_type_garage"),
      item("area_type_carport"),
      item("area_type_driveway"),
      item("area_type_landscaping"),
      item("area_type_fencing"),
      item("area_type_outdoor_kitchen"),
    ],
  },
  {
    groupId: "area_group_bedrooms",
    label: "Bedrooms",
    displayOrder: 20,
    areaTypes: [item("area_type_master_bedroom"), item("area_type_bedroom", true), item("area_type_guest_bedroom"), item("area_type_nursery")],
  },
  {
    groupId: "area_group_kitchen_areas",
    label: "Kitchen Areas",
    displayOrder: 30,
    areaTypes: [
      item("area_type_kitchen"),
      item("area_type_butlers_pantry"),
      item("area_type_walk_in_pantry"),
      item("area_type_kitchenette"),
      item("area_type_upper_kitchenette"),
      item("area_type_bar"),
    ],
  },
  {
    groupId: "area_group_wet_areas",
    label: "Wet Areas",
    displayOrder: 40,
    areaTypes: [item("area_type_ensuite", true), item("area_type_bathroom", true), item("area_type_powder_room", true), item("area_type_wc", true), item("area_type_laundry")],
  },
  {
    groupId: "area_group_living",
    label: "Living and Circulation",
    displayOrder: 50,
    areaTypes: [
      item("area_type_entry"),
      item("area_type_hallway"),
      item("area_type_living"),
      item("area_type_family_room"),
      item("area_type_dining_room"),
      item("area_type_media_room"),
      item("area_type_study"),
      item("area_type_rumpus_room"),
      item("area_type_games_room"),
    ],
  },
];

export function isRepeatableAreaType(areaTypeId: AreaTypeId): boolean {
  return REPEATABLE_AREA_TYPE_IDS.has(areaTypeId);
}
