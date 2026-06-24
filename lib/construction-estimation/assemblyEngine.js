import { normaliseProjectInputs } from "./schemas/projectInputs.js";
import { SITEWORKS_ASSEMBLIES } from "./assemblies/siteworks.js";
import { SLAB_ASSEMBLIES } from "./assemblies/slabs.js";
import { FRAMING_ASSEMBLIES } from "./assemblies/framing.js";
import { ROOFING_ASSEMBLIES } from "./assemblies/roofing.js";
import { EXTERNAL_WALL_ASSEMBLIES } from "./assemblies/externalWalls.js";
import { INTERNAL_WALL_ASSEMBLIES } from "./assemblies/internalWalls.js";
import { WINDOWS_DOORS_ASSEMBLIES } from "./assemblies/windowsDoors.js";
import { SERVICES_ASSEMBLIES } from "./assemblies/services.js";
import { LININGS_ASSEMBLIES } from "./assemblies/linings.js";
import { WET_AREA_ASSEMBLIES } from "./assemblies/wetAreas.js";
import { FIXOUT_ASSEMBLIES } from "./assemblies/fixout.js";
import { EXTERNAL_WORKS_ASSEMBLIES } from "./assemblies/externalWorks.js";

export const ALL_ASSEMBLIES = [
  ...SITEWORKS_ASSEMBLIES,
  ...SLAB_ASSEMBLIES,
  ...FRAMING_ASSEMBLIES,
  ...ROOFING_ASSEMBLIES,
  ...EXTERNAL_WALL_ASSEMBLIES,
  ...INTERNAL_WALL_ASSEMBLIES,
  ...WINDOWS_DOORS_ASSEMBLIES,
  ...SERVICES_ASSEMBLIES,
  ...LININGS_ASSEMBLIES,
  ...WET_AREA_ASSEMBLIES,
  ...FIXOUT_ASSEMBLIES,
  ...EXTERNAL_WORKS_ASSEMBLIES,
];

export function resolveAssemblies(rawInput = {}) {
  const input = normaliseProjectInputs(rawInput);
  return ALL_ASSEMBLIES
    .filter((assembly) => !assembly.appliesWhen || assembly.appliesWhen(input))
    .map((assembly) => ({
      ...assembly,
      materials: (assembly.materials || []).map((item) => ({ ...item })),
    }));
}
