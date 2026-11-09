import assert from "node:assert/strict";
import { approveCabinetryRoom, cabinetryProjectRoomOptions, cabinetryRoomSequence, cabinetrySpecificationRevision, isCabinetryRoomApproved, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";
import { selectionAttention } from "../lib/builders/selectionAttention.js";
import { guidedRequirementByKey, statusForRequirement } from "../lib/builders/clientSelectionWorkflow.js";

const colour = { id: "oak", colourName: "Oak", finish: "Matt", supplier: "Polytec", productCode: "OAK", clientPrice: 24 };
const room = (id, location) => ({ id, location, name: location, included: true, status: "complete", confirmedAt: "legacy-confirmation", enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: { lowerDoorsDrawers: colour }, benchtop: { productName: "Existing top" }, handles: { base: { productName: "Existing handle" } } });
const model = { confirmedAt: "saved-room-confirmation", rooms: [
  { id: "kitchen-identity", name: "Kitchen", sourceKeys: ["kitchen"] },
  { id: "main-bathroom-identity", name: "Main Bathroom", sourceKeys: ["bathroom", "main-bathroom"] },
  { id: "ensuite-identity", name: "Ensuite", sourceKeys: ["ensuite"] },
  { id: "location-bedroom-2-ensuite@upper", name: "B2 Ensuite", sourceKeys: ["bedroom-2-ensuite"], roomType: "other" },
] };
const jobId = "protected-job";
const selection = normaliseCabinetrySelection({ projectId: jobId, locations: [room("cabinetry-kitchen", "Kitchen")], schedule: [{ componentId: "existing-line", location: "Kitchen", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 2, handleQuantity: 2 }] }, model);
const kitchen = selection.locations[0];
assert.equal(kitchen.projectRoomId, "kitchen-identity");
assert(!isCabinetryRoomApproved(kitchen, selection.schedule, jobId), "legacy Complete does not imply explicit approval");
const options = cabinetryProjectRoomOptions(selection, model);
assert(options.some(room => room.id === "location-bedroom-2-ensuite@upper" && room.name === "B2 Ensuite"));
assert(!options.some(room => room.name === "Bathroom" || room.name === "Other"));
assert(options.some(room => room.id === "ensuite-identity"), "independent ensuites remain independent");
// Landing cards follow the cabinetry sequence, not the order rooms were added to the project.
const shuffled = { ...model, rooms: [model.rooms[3], model.rooms[1], model.rooms[2], model.rooms[0]] };
assert.deepEqual(cabinetryProjectRoomOptions(selection, shuffled).map(room => room.name), ["Kitchen", "Main Bathroom", "Ensuite", "B2 Ensuite"]);
assert.deepEqual(cabinetryRoomSequence([{ location: "Laundry" }, { location: "B2 Ensuite" }, { location: "Main Bathroom" }, { location: "Kitchen" }, { location: "Powder Room" }, { location: "Ensuite" }, { location: "Butler's Pantry" }]).map(room => room.location),
  ["Kitchen", "Butler's Pantry", "Main Bathroom", "Ensuite", "B2 Ensuite", "Powder Room", "Laundry"]);
const approved = approveCabinetryRoom(selection, kitchen.projectRoomId, jobId, "2026-11-06T00:00:00Z");
const current = approved.locations[0];
assert(isCabinetryRoomApproved(current, approved.schedule, jobId));
assert.deepEqual(approved.schedule, selection.schedule, "approval never adds products or changes quantities");
assert.deepEqual(current.areaSelections, kitchen.areaSelections, "existing products and prices remain unchanged");
assert.equal(approved.summary.approvedRoomCount, 1);
assert.equal(approved.summary.complete, true);
const repeat = approveCabinetryRoom(approved, kitchen.projectRoomId, jobId, "2026-11-07T00:00:00Z");
assert.deepEqual(repeat, approved, "reapproval is idempotent");
const reopened = normaliseCabinetrySelection(JSON.parse(JSON.stringify(approved)), model);
assert(isCabinetryRoomApproved(reopened.locations[0], reopened.schedule, jobId), "save/export/reopen retains approval");
const book = value => ({ projectRoomModel: model, rooms: [{ name: "Interior", rows: [{ id: "cabinetry-row", guidedRequirementKey: "cabinetry", status: "in_progress", guidedSelection: { requirementKey: "cabinetry", productName: "Existing cabinetry", cabinetrySelection: value } }] }] });
const attention = value => selectionAttention({ book: book(value), model }).groups.find(group => group.key === "decisions")?.items || [];
assert(attention(selection).some(item => item.title.includes("Kitchen")), "unapproved specification needs review");
assert(!attention(approved).some(item => item.title.includes("Kitchen")), "approval removes room from review immediately");
assert.equal(statusForRequirement(guidedRequirementByKey("cabinetry"), { selected_details: { cabinetrySelection: approved } }), "complete");
const modified = normaliseCabinetrySelection({ ...approved, schedule: approved.schedule.map(line => ({ ...line, quantity: 3 })) }, model);
assert(!isCabinetryRoomApproved(modified.locations[0], modified.schedule, jobId));
assert(attention(modified).some(item => item.title.includes("Kitchen")));
assert.equal(modified.summary.complete, false);
const timestampOnly = normaliseCabinetrySelection({ ...approved, locations: approved.locations.map(room => ({ ...room, updatedAt: "later", areaSelections: { ...room.areaSelections, lowerDoorsDrawers: { ...colour, clientPrice: 30, priceStatus: "current" } } })) });
assert(isCabinetryRoomApproved(timestampOnly.locations[0], timestampOnly.schedule, jobId), "price refresh and timestamps do not revoke a specification approval");
const otherJob = normaliseCabinetrySelection({ ...approved, projectId: "other-job" });
assert(!isCabinetryRoomApproved(otherJob.locations[0], otherJob.schedule, "other-job"));
const otherRoom = { ...current, id: "other-room", projectRoomId: "other-identity" };
assert(!isCabinetryRoomApproved(otherRoom, approved.schedule, jobId), "approval never leaks to another room");
assert.equal(cabinetrySpecificationRevision(current, approved.schedule), current.reviewApproval.specificationRevision);
console.log("PASS room identity, legacy completion, explicit approval, review queue, save/export/reopen, idempotence, specification change, price refresh, job isolation, room isolation, unchanged products/quantities/prices");
