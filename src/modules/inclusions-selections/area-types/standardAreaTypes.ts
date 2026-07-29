import type { AreaType } from "./areaTypeTypes";

export const STANDARD_AREA_TYPES: AreaType[] = [
  { id: "area_type_whole_project", groupId: "area_group_whole_project", code: "WHOLE_PROJECT", name: "Whole project", traits: [], displayOrder: 10, active: true },

  { id: "area_type_exterior", groupId: "area_group_external", code: "EXTERIOR", name: "Exterior", traits: ["external"], displayOrder: 20, active: true },
  { id: "area_type_roof", groupId: "area_group_external", code: "ROOF", name: "Roof", traits: ["external"], displayOrder: 21, active: true },
  { id: "area_type_external_living", groupId: "area_group_external", code: "ALFRESCO", name: "Alfresco", traits: ["external", "trafficable"], displayOrder: 22, active: true },
  { id: "area_type_patio", groupId: "area_group_external", code: "PATIO", name: "Patio", traits: ["external"], displayOrder: 23, active: true },
  { id: "area_type_porch", groupId: "area_group_external", code: "PORCH", name: "Porch", traits: ["external"], displayOrder: 24, active: true },
  { id: "area_type_balcony", groupId: "area_group_external", code: "BALCONY", name: "Balcony", traits: ["external"], displayOrder: 25, active: true },
  { id: "area_type_deck", groupId: "area_group_external", code: "DECK", name: "Deck", traits: ["external"], displayOrder: 26, active: true },
  { id: "area_type_pool", groupId: "area_group_external", code: "POOL", name: "Pool", traits: ["external"], displayOrder: 27, active: true },
  { id: "area_type_garage", groupId: "area_group_external", code: "GARAGE", name: "Garage", traits: ["external", "service", "trafficable"], displayOrder: 28, active: true },
  { id: "area_type_carport", groupId: "area_group_external", code: "CARPORT", name: "Carport", traits: ["external", "trafficable"], displayOrder: 29, active: true },
  { id: "area_type_driveway", groupId: "area_group_external", code: "DRIVEWAY", name: "Driveway", traits: ["external", "trafficable"], displayOrder: 30, active: true },
  { id: "area_type_landscaping", groupId: "area_group_external", code: "LANDSCAPING", name: "Landscaping", traits: ["external"], displayOrder: 31, active: true },
  { id: "area_type_fencing", groupId: "area_group_external", code: "FENCING", name: "Fencing", traits: ["external"], displayOrder: 32, active: true },
  { id: "area_type_outdoor_kitchen", groupId: "area_group_external", code: "OUTDOOR_KITCHEN", name: "Outdoor Kitchen", traits: ["external"], displayOrder: 33, active: true },

  { id: "area_type_master_bedroom", groupId: "area_group_bedrooms", code: "MASTER_BEDROOM", name: "Master Bedroom", traits: ["internal", "private"], displayOrder: 40, active: true },
  { id: "area_type_bedroom", groupId: "area_group_bedrooms", code: "BEDROOM", name: "Bedroom", traits: ["internal", "private"], displayOrder: 41, active: true },
  { id: "area_type_guest_bedroom", groupId: "area_group_bedrooms", code: "GUEST_BEDROOM", name: "Guest Bedroom", traits: ["internal", "private"], displayOrder: 42, active: true },
  { id: "area_type_nursery", groupId: "area_group_bedrooms", code: "NURSERY", name: "Nursery", traits: ["internal", "private"], displayOrder: 43, active: true },

  { id: "area_type_kitchen", groupId: "area_group_kitchen_areas", code: "KITCHEN", name: "Kitchen", traits: ["internal"], displayOrder: 50, active: true },
  { id: "area_type_butlers_pantry", groupId: "area_group_kitchen_areas", code: "BUTLERS_PANTRY", name: "Butler's Pantry", traits: ["internal"], displayOrder: 51, active: true },
  { id: "area_type_walk_in_pantry", groupId: "area_group_kitchen_areas", code: "WALK_IN_PANTRY", name: "Walk-in Pantry", traits: ["internal"], displayOrder: 52, active: true },
  { id: "area_type_kitchenette", groupId: "area_group_kitchen_areas", code: "KITCHENETTE", name: "Kitchenette", traits: ["internal"], displayOrder: 53, active: true },
  { id: "area_type_upper_kitchenette", groupId: "area_group_kitchen_areas", code: "UPPER_KITCHENETTE", name: "Upper Kitchenette", traits: ["internal"], displayOrder: 54, active: true },
  { id: "area_type_bar", groupId: "area_group_kitchen_areas", code: "BAR", name: "Bar", traits: ["internal"], displayOrder: 55, active: true },

  { id: "area_type_ensuite", groupId: "area_group_wet_areas", code: "ENSUITE", name: "Ensuite", traits: ["internal", "wet_area", "private"], displayOrder: 60, active: true },
  { id: "area_type_bathroom", groupId: "area_group_wet_areas", code: "BATHROOM", name: "Bathroom", traits: ["internal", "wet_area", "private"], displayOrder: 61, active: true },
  { id: "area_type_powder_room", groupId: "area_group_wet_areas", code: "POWDER_ROOM", name: "Powder Room", traits: ["internal", "wet_area"], displayOrder: 62, active: true },
  { id: "area_type_wc", groupId: "area_group_wet_areas", code: "WC", name: "WC", traits: ["internal", "wet_area"], displayOrder: 63, active: true },
  { id: "area_type_laundry", groupId: "area_group_wet_areas", code: "LAUNDRY", name: "Laundry", traits: ["internal", "wet_area"], displayOrder: 64, active: true },

  { id: "area_type_entry", groupId: "area_group_living", code: "ENTRY", name: "Entry", traits: ["internal"], displayOrder: 70, active: true },
  { id: "area_type_hallway", groupId: "area_group_living", code: "HALLWAY", name: "Hallway", traits: ["internal", "trafficable"], displayOrder: 71, active: true },
  { id: "area_type_living", groupId: "area_group_living", code: "LIVING", name: "Living Room", traits: ["internal"], displayOrder: 72, active: true },
  { id: "area_type_family_room", groupId: "area_group_living", code: "FAMILY_ROOM", name: "Family Room", traits: ["internal"], displayOrder: 73, active: true },
  { id: "area_type_dining_room", groupId: "area_group_living", code: "DINING_ROOM", name: "Dining Room", traits: ["internal"], displayOrder: 74, active: true },
  { id: "area_type_media_room", groupId: "area_group_living", code: "MEDIA_ROOM", name: "Media Room", traits: ["internal"], displayOrder: 75, active: true },
  { id: "area_type_study", groupId: "area_group_living", code: "STUDY", name: "Study", traits: ["internal"], displayOrder: 76, active: true },
  { id: "area_type_rumpus_room", groupId: "area_group_living", code: "RUMPUS_ROOM", name: "Rumpus Room", traits: ["internal"], displayOrder: 77, active: true },
  { id: "area_type_games_room", groupId: "area_group_living", code: "GAMES_ROOM", name: "Games Room", traits: ["internal"], displayOrder: 78, active: true },
];
