// What the job's AI Plan Takeoff / Job Setup can genuinely supply to a tiled room. Takeoff measures
// no bathroom or ensuite dimensions, so only these are offered (each labelled "Imported from
// Takeoff" in the room and always editable):
// - ceiling height per level (Job Setup, from Takeoff);
// - measured floor areas of outdoor areas (Alfresco, Patio, Porch, Balcony);
// - openings (doors / windows) whose Takeoff Room / Location names the room.
import { resolveOpeningRoom } from "../../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js";
import { openingDimensions, openingQuantity } from "../construction-estimation/takeoffMaterialQuantities.js";

const rowValue = (rows, key) => {
  const value = Number(rows?.[key]?.value ?? rows?.[key]);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
const slug = (value = "") => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function tilingTakeoffData(workbook = {}) {
  const rows = workbook?.data?.inputDataSheet?.rows || {};
  const metres = (value) => (value > 20 ? value / 1000 : value);
  const sum = (...keys) => keys.reduce((total, key) => total + rowValue(rows, key), 0);
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const openings = (Array.isArray(job?.placedOpenings) ? job.placedOpenings : []).map((opening) => {
    const room = resolveOpeningRoom(opening);
    const { widthMm, heightMm } = openingDimensions(opening);
    return {
      id: String(opening.id || ""),
      roomLabel: room.roomLabel || "",
      type: String(opening.type || "").toLowerCase() === "window" ? "window" : "door",
      widthMm,
      heightMm,
      quantity: openingQuantity(opening) || 1,
      source: "takeoff",
    };
  }).filter((opening) => opening.roomLabel && opening.widthMm > 0 && opening.heightMm > 0);
  return {
    ceilingHeightM: metres(rowValue(rows, "lowerCeilingHeight")),
    ceilingHeightByLevelM: { lower: metres(rowValue(rows, "lowerCeilingHeight")), upper: metres(rowValue(rows, "upperCeilingHeight")), third: metres(rowValue(rows, "thirdCeilingHeight")) },
    floorAreaByRoomType: {
      alfresco: sum("lowerAlfrescoAreaM2", "upperAlfrescoAreaM2", "thirdAlfrescoAreaM2"),
      patio: sum("lowerPatioAreaM2", "upperPatioAreaM2", "thirdPatioAreaM2"),
      balcony: sum("balconyAreaM2", "upperBalconyAreaM2"),
      porch: sum("lowerPorchAreaM2", "upperPorchAreaM2", "thirdPorchAreaM2"),
      entry: 0,
    },
    openings,
  };
}

// Takeoff openings tagged to this room ("Ensuite" matches an Ensuite room named "Ensuite").
export function takeoffOpeningsForRoom(takeoff = {}, room = {}) {
  return (takeoff.openings || []).filter((opening) => slug(opening.roomLabel) === slug(room.name));
}
