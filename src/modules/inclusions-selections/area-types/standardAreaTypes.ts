import type { AreaType } from "./areaTypeTypes";

export const STANDARD_AREA_TYPES: AreaType[] = [
  { id: "area_type_whole_project", groupId: "area_group_whole_project", code: "WHOLE_PROJECT", name: "Whole project", traits: [], displayOrder: 10, active: true },
  { id: "area_type_living", groupId: "area_group_living", code: "LIVING", name: "Living", traits: ["internal"], displayOrder: 20, active: true },
  { id: "area_type_kitchen", groupId: "area_group_living", code: "KITCHEN", name: "Kitchen", traits: ["internal"], displayOrder: 30, active: true },
  { id: "area_type_bedroom", groupId: "area_group_bedrooms", code: "BEDROOM", name: "Bedroom", traits: ["internal", "private"], displayOrder: 40, active: true },
  { id: "area_type_bathroom", groupId: "area_group_wet_areas", code: "BATHROOM", name: "Bathroom", traits: ["internal", "wet_area", "private"], displayOrder: 50, active: true },
  { id: "area_type_laundry", groupId: "area_group_wet_areas", code: "LAUNDRY", name: "Laundry", traits: ["internal", "wet_area"], displayOrder: 60, active: true },
  { id: "area_type_external_living", groupId: "area_group_external", code: "EXTERNAL_LIVING", name: "External living", traits: ["external", "trafficable"], displayOrder: 70, active: true },
  { id: "area_type_garage", groupId: "area_group_external", code: "GARAGE", name: "Garage", traits: ["external", "service", "trafficable"], displayOrder: 80, active: true },
];
