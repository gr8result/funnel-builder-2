import type { RequirementApplicability, RequirementCategory, RequirementDefinition } from "../requirements/requirementTypes";
import type { AreaTemplate } from "./templateTypes";

type DefInput = {
  title: string;
  category: RequirementCategory;
  subtype?: string;
  applicability?: RequirementApplicability;
};

function requirement(templateCode: string, input: DefInput, index: number): RequirementDefinition {
  const applicability = input.applicability ?? "required";
  return {
    id: `req_def_${templateCode}_${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    category: input.category,
    subtype: input.subtype ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    title: input.title,
    quantityMode: "per_area",
    defaultQuantity: 1,
    required: applicability === "required",
    applicability,
    description: `Standard ${input.title.toLowerCase()} decision.`,
  };
}

function template(areaTypeId: string, code: string, name: string, definitions: DefInput[]): AreaTemplate {
  return {
    id: `area_template_${code}`,
    areaTypeId,
    name,
    version: 1,
    active: true,
    requirementDefinitions: definitions.map((definition, index) => requirement(code, definition, index)),
  };
}

const bedroom = [
  { title: "Floor Covering", category: "flooring" },
  { title: "Skirting", category: "wall_finish" },
  { title: "Wall Paint", category: "wall_finish" },
  { title: "Ceiling Paint", category: "wall_finish" },
  { title: "Cornice", category: "wall_finish" },
  { title: "Internal Door", category: "hardware" },
  { title: "Door Hardware", category: "hardware" },
  { title: "Window", category: "fixture" },
  { title: "Window Furnishings", category: "fitting" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "Data Point", category: "electrical", applicability: "optional" },
  { title: "Robe", category: "fixture", applicability: "optional" },
  { title: "Robe Fitout", category: "fitting", applicability: "optional" },
  { title: "Air Conditioning", category: "fixture", applicability: "conditional" },
  { title: "Smoke Alarm", category: "electrical", applicability: "conditional" },
] satisfies DefInput[];

const bathroom = [
  { title: "Floor Tiles", category: "flooring" },
  { title: "Wall Tiles", category: "wall_finish" },
  { title: "Waterproofing Finish Reference", category: "wall_finish" },
  { title: "Vanity Cabinetry", category: "fixture" },
  { title: "Vanity Benchtop", category: "fixture" },
  { title: "Basin", category: "plumbing" },
  { title: "Basin Mixer", category: "plumbing" },
  { title: "Mirror", category: "fixture" },
  { title: "Shower Screen", category: "fixture" },
  { title: "Shower Mixer", category: "plumbing" },
  { title: "Shower Outlet", category: "plumbing" },
  { title: "Bath", category: "plumbing", applicability: "optional" },
  { title: "Bath Mixer or Outlet", category: "plumbing", applicability: "optional" },
  { title: "Toilet", category: "plumbing" },
  { title: "Floor Waste", category: "plumbing" },
  { title: "Bathroom Accessories", category: "fitting" },
  { title: "Exhaust Fan", category: "electrical" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "Internal Door", category: "hardware" },
  { title: "Door Hardware", category: "hardware" },
  { title: "Wall Paint", category: "wall_finish" },
  { title: "Ceiling Paint", category: "wall_finish" },
] satisfies DefInput[];

const powder = [
  { title: "Floor Finish", category: "flooring" },
  { title: "Vanity or Basin", category: "plumbing" },
  { title: "Basin Mixer", category: "plumbing" },
  { title: "Mirror", category: "fixture" },
  { title: "Toilet", category: "plumbing" },
  { title: "Accessories", category: "fitting" },
  { title: "Lighting", category: "electrical" },
  { title: "Exhaust Fan", category: "electrical", applicability: "conditional" },
  { title: "Wall Paint", category: "wall_finish" },
  { title: "Ceiling Paint", category: "wall_finish" },
  { title: "Internal Door", category: "hardware" },
  { title: "Door Hardware", category: "hardware" },
] satisfies DefInput[];

const kitchen = [
  { title: "Cabinetry", category: "fixture" },
  { title: "Cabinet Finish", category: "fixture" },
  { title: "Cabinet Handles", category: "hardware" },
  { title: "Benchtops", category: "fixture" },
  { title: "Splashback", category: "wall_finish" },
  { title: "Sink", category: "plumbing" },
  { title: "Sink Mixer", category: "plumbing" },
  { title: "Oven", category: "appliance" },
  { title: "Cooktop", category: "appliance" },
  { title: "Rangehood", category: "appliance" },
  { title: "Dishwasher", category: "appliance", applicability: "optional" },
  { title: "Microwave Provision", category: "appliance", applicability: "optional" },
  { title: "Refrigerator Provision", category: "appliance" },
  { title: "Pantry Fitout", category: "fixture" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "Flooring", category: "flooring" },
  { title: "Wall Paint", category: "wall_finish" },
  { title: "Ceiling Paint", category: "wall_finish" },
] satisfies DefInput[];

const living = [
  { title: "Floor Covering", category: "flooring" },
  { title: "Skirting", category: "wall_finish" },
  { title: "Wall Paint", category: "wall_finish" },
  { title: "Ceiling Paint", category: "wall_finish" },
  { title: "Cornice", category: "wall_finish" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "Data or TV Points", category: "electrical" },
  { title: "Window", category: "fixture" },
  { title: "Window Furnishings", category: "fitting" },
  { title: "Air Conditioning", category: "fixture", applicability: "conditional" },
] satisfies DefInput[];

const garage = [
  { title: "Garage Door", category: "fixture" },
  { title: "Garage Door Motor", category: "electrical", applicability: "optional" },
  { title: "Internal Access Door", category: "hardware" },
  { title: "External Door", category: "hardware", applicability: "conditional" },
  { title: "Door Hardware", category: "hardware" },
  { title: "Floor Finish", category: "flooring" },
  { title: "Wall Finish", category: "wall_finish" },
  { title: "Ceiling Finish", category: "wall_finish" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "Storage", category: "fixture", applicability: "optional" },
] satisfies DefInput[];

const exterior = [
  { title: "External Wall Finish", category: "external_finish" },
  { title: "Brick or Cladding", category: "external_finish" },
  { title: "Mortar or Joint Finish", category: "external_finish" },
  { title: "External Paint", category: "external_finish" },
  { title: "Windows", category: "fixture" },
  { title: "External Doors", category: "hardware" },
  { title: "Fascia", category: "external_finish" },
  { title: "Gutter", category: "external_finish" },
  { title: "Downpipes", category: "external_finish" },
  { title: "Eaves", category: "external_finish" },
  { title: "External Lighting", category: "electrical" },
  { title: "House Numbers", category: "fitting" },
  { title: "External Fixtures", category: "fitting" },
] satisfies DefInput[];

const roof = [
  { title: "Roof Material", category: "external_finish" },
  { title: "Roof Profile or Tile", category: "external_finish" },
  { title: "Roof Colour", category: "external_finish" },
  { title: "Sarking or Anticon", category: "external_finish", applicability: "conditional" },
  { title: "Flashings", category: "external_finish" },
  { title: "Fascia", category: "external_finish" },
  { title: "Gutters", category: "external_finish" },
  { title: "Downpipes", category: "external_finish" },
  { title: "Roof Ventilation", category: "fixture", applicability: "conditional" },
] satisfies DefInput[];

const alfresco = [
  { title: "Floor Finish", category: "flooring" },
  { title: "Ceiling Finish", category: "wall_finish" },
  { title: "Posts or Structure Finish", category: "external_finish" },
  { title: "Lighting", category: "electrical" },
  { title: "Power Points", category: "electrical" },
  { title: "External Fan", category: "electrical", applicability: "optional" },
  { title: "External Kitchen Provision", category: "appliance", applicability: "conditional" },
  { title: "External Doors", category: "hardware" },
  { title: "Paint and Finishes", category: "external_finish" },
] satisfies DefInput[];

export const STANDARD_AREA_TEMPLATES: AreaTemplate[] = [
  template("area_type_bedroom", "bedroom", "Bedroom Template", bedroom),
  template("area_type_guest_bedroom", "guest_bedroom", "Guest Bedroom Template", bedroom.map((item) => item.title === "Robe" || item.title === "Robe Fitout" ? { ...item, applicability: "optional" } : item)),
  template("area_type_nursery", "nursery", "Nursery Template", bedroom),
  template("area_type_master_bedroom", "master_bedroom", "Master Bedroom Template", [...bedroom, { title: "Feature Lighting", category: "electrical", applicability: "optional" }, { title: "Walk-in Robe Fitout", category: "fitting", applicability: "optional" }]),
  template("area_type_bathroom", "bathroom", "Bathroom Template", bathroom),
  template("area_type_ensuite", "ensuite", "Ensuite Template", bathroom.filter((item) => !item.title.startsWith("Bath"))),
  template("area_type_powder_room", "powder_room", "Powder Room Template", powder),
  template("area_type_wc", "wc", "WC Template", powder.filter((item) => !["Vanity or Basin", "Basin Mixer", "Mirror"].includes(item.title))),
  template("area_type_laundry", "laundry", "Laundry Template", [
    { title: "Floor Finish", category: "flooring" },
    { title: "Wall Finish or Splashback", category: "wall_finish" },
    { title: "Laundry Cabinetry", category: "fixture" },
    { title: "Laundry Benchtop", category: "fixture" },
    { title: "Laundry Tub", category: "plumbing" },
    { title: "Laundry Mixer", category: "plumbing" },
    { title: "Washing Machine Connections", category: "plumbing" },
    { title: "Dryer Provision", category: "appliance", applicability: "optional" },
    { title: "Floor Waste", category: "plumbing" },
    { title: "Internal Door", category: "hardware" },
    { title: "Door Hardware", category: "hardware" },
    { title: "Lighting", category: "electrical" },
    { title: "Power Points", category: "electrical" },
    { title: "Wall Paint", category: "wall_finish" },
    { title: "Ceiling Paint", category: "wall_finish" },
  ]),
  template("area_type_kitchen", "kitchen", "Kitchen Template", kitchen),
  template("area_type_butlers_pantry", "butlers_pantry", "Butler's Pantry Template", [
    { title: "Cabinetry", category: "fixture" },
    { title: "Benchtop", category: "fixture" },
    { title: "Sink", category: "plumbing", applicability: "optional" },
    { title: "Mixer", category: "plumbing", applicability: "optional" },
    { title: "Splashback", category: "wall_finish" },
    { title: "Shelving", category: "fixture" },
    { title: "Appliance Provision", category: "appliance", applicability: "conditional" },
    { title: "Lighting", category: "electrical" },
    { title: "Power Points", category: "electrical" },
    { title: "Finishes", category: "wall_finish" },
  ]),
  template("area_type_walk_in_pantry", "walk_in_pantry", "Walk-in Pantry Template", [{ title: "Shelving", category: "fixture" }, { title: "Lighting", category: "electrical" }, { title: "Floor Finish", category: "flooring" }, { title: "Wall Paint", category: "wall_finish" }]),
  template("area_type_kitchenette", "kitchenette", "Kitchenette Template", kitchen.filter((item) => !["Oven", "Cooktop", "Rangehood", "Dishwasher"].includes(item.title))),
  template("area_type_upper_kitchenette", "upper_kitchenette", "Upper Kitchenette Template", kitchen.filter((item) => !["Oven", "Cooktop", "Rangehood", "Dishwasher"].includes(item.title))),
  template("area_type_bar", "bar", "Bar Template", [{ title: "Cabinetry", category: "fixture" }, { title: "Benchtop", category: "fixture" }, { title: "Sink", category: "plumbing", applicability: "optional" }, { title: "Splashback", category: "wall_finish" }, { title: "Lighting", category: "electrical" }, { title: "Power Points", category: "electrical" }]),
  template("area_type_living", "living", "Living Area Template", living),
  template("area_type_family_room", "family_room", "Family Room Template", living),
  template("area_type_dining_room", "dining_room", "Dining Room Template", living),
  template("area_type_media_room", "media_room", "Media Room Template", [...living, { title: "TV Point", category: "electrical" }, { title: "Acoustic Provision", category: "fixture", applicability: "optional" }]),
  template("area_type_study", "study", "Study Template", [...living, { title: "Data Points", category: "electrical" }]),
  template("area_type_rumpus_room", "rumpus_room", "Rumpus Room Template", living),
  template("area_type_games_room", "games_room", "Games Room Template", living),
  template("area_type_entry", "entry", "Entry Template", living.filter((item) => !["Air Conditioning", "Data or TV Points"].includes(item.title))),
  template("area_type_hallway", "hallway", "Hallway Template", living.filter((item) => !["Air Conditioning", "Data or TV Points", "Window", "Window Furnishings"].includes(item.title))),
  template("area_type_garage", "garage", "Garage Template", garage),
  template("area_type_carport", "carport", "Carport Template", alfresco.filter((item) => item.title !== "External Kitchen Provision")),
  template("area_type_driveway", "driveway", "Driveway Template", [{ title: "Surface Finish", category: "external_finish" }, { title: "Drainage", category: "plumbing", applicability: "conditional" }, { title: "Lighting", category: "electrical", applicability: "optional" }]),
  template("area_type_exterior", "exterior", "Exterior Template", exterior),
  template("area_type_roof", "roof", "Roof Template", roof),
  template("area_type_external_living", "alfresco", "Alfresco Template", alfresco),
  template("area_type_patio", "patio", "Patio Template", alfresco),
  template("area_type_porch", "porch", "Porch Template", alfresco.filter((item) => item.title !== "External Kitchen Provision")),
  template("area_type_balcony", "balcony", "Balcony Template", alfresco.filter((item) => item.title !== "External Kitchen Provision")),
  template("area_type_deck", "deck", "Deck Template", alfresco.filter((item) => item.title !== "External Kitchen Provision")),
  template("area_type_pool", "pool", "Pool Template", [
    { title: "Pool Interior Finish", category: "external_finish" },
    { title: "Coping", category: "external_finish" },
    { title: "Waterline Tile", category: "external_finish" },
    { title: "Surround Finish", category: "flooring" },
    { title: "Pool Fencing", category: "external_finish" },
    { title: "Gates and Hardware", category: "hardware" },
    { title: "Lighting", category: "electrical" },
    { title: "Equipment", category: "fixture" },
    { title: "Heating", category: "fixture", applicability: "optional" },
    { title: "Water Features", category: "fixture", applicability: "optional" },
  ]),
  template("area_type_landscaping", "landscaping", "Landscaping Template", [{ title: "Planting", category: "external_finish" }, { title: "Turf", category: "external_finish", applicability: "optional" }, { title: "Irrigation", category: "plumbing", applicability: "optional" }]),
  template("area_type_fencing", "fencing", "Fencing Template", [{ title: "Fence Type", category: "external_finish" }, { title: "Gate Hardware", category: "hardware", applicability: "optional" }, { title: "Finish Colour", category: "external_finish" }]),
  template("area_type_outdoor_kitchen", "outdoor_kitchen", "Outdoor Kitchen Template", [{ title: "Cabinetry", category: "fixture" }, { title: "Benchtop", category: "fixture" }, { title: "Appliances", category: "appliance", applicability: "conditional" }, { title: "Sink and Mixer", category: "plumbing", applicability: "optional" }, { title: "Lighting", category: "electrical" }, { title: "Power Points", category: "electrical" }]),
];

export function findStandardAreaTemplateForAreaType(areaTypeId: string): AreaTemplate | null {
  return STANDARD_AREA_TEMPLATES.find((template) => template.areaTypeId === areaTypeId && template.active) ?? null;
}
