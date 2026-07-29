import type { AreaGroup } from "./areaGroupTypes";

export const STANDARD_AREA_GROUPS: AreaGroup[] = [
  { id: "area_group_whole_project", code: "WHOLE_PROJECT", name: "Whole project", kind: "whole_project", displayOrder: 10, active: true },
  { id: "area_group_living", code: "LIVING", name: "Living areas", kind: "internal", displayOrder: 20, active: true },
  { id: "area_group_bedrooms", code: "BEDROOMS", name: "Bedrooms", kind: "internal", displayOrder: 30, active: true },
  { id: "area_group_wet_areas", code: "WET_AREAS", name: "Wet areas", kind: "internal", displayOrder: 40, active: true },
  { id: "area_group_external", code: "EXTERNAL", name: "External areas", kind: "external", displayOrder: 50, active: true },
  { id: "area_group_services", code: "SERVICES", name: "Services", kind: "service", displayOrder: 60, active: true },
];
