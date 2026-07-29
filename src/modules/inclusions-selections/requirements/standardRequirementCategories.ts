import type { RequirementCategory } from "./requirementTypes";

export const STANDARD_REQUIREMENT_CATEGORIES: Array<{ id: RequirementCategory; name: string; displayOrder: number }> = [
  { id: "flooring", name: "Flooring", displayOrder: 10 },
  { id: "wall_finish", name: "Wall finish", displayOrder: 20 },
  { id: "fixture", name: "Fixtures", displayOrder: 30 },
  { id: "fitting", name: "Fittings", displayOrder: 40 },
  { id: "appliance", name: "Appliances", displayOrder: 50 },
  { id: "hardware", name: "Hardware", displayOrder: 60 },
  { id: "electrical", name: "Electrical", displayOrder: 70 },
  { id: "plumbing", name: "Plumbing", displayOrder: 80 },
  { id: "external_finish", name: "External finishes", displayOrder: 90 },
  { id: "allowance", name: "Allowances", displayOrder: 100 },
];
