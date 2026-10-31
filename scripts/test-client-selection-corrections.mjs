import assert from "node:assert/strict";
import { applyConfirmedClientSelectionCorrections } from "../lib/builders/clientSelectionCorrections.js";
import { normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";

const allocation = (location, quantity, extra = {}) => ({ location, quantity, ...extra });
const line = (lineId, productId, allocations) => ({ lineId, productId, productName: productId, unit: "EACH", unitPrice: 100, allocations, quantity: allocations.reduce((sum, item) => sum + item.quantity, 0) });
const guided = (requirementKey, lines) => ({ id: requirementKey, guidedRequirementKey: requirementKey, guidedSelection: { requirementKey, plumbingAllocation: { lines } } });

const book = {
  clientSelectionCorrections: {
    version: 1,
    removeProducts: [
      { requirementKey: "toilet-suite", productId: "origin" },
      { requirementKey: "bath", productId: "chios" },
      { requirementKey: "ceiling-fan", productId: "stanza" },
    ],
    removeFloorAllocations: [
      { requirementKey: "ceiling-fan", productId: "aeroflow" },
    ],
    mergeRooms: [{ from: "Pantry", to: "Butler's Pantry" }],
  },
  projectRoomModel: {
    rooms: [
      { id: "location-pantry", key: "pantry", name: "Pantry", sourceKeys: ["pantry"] },
      { id: "location-butlers-pantry", key: "butlers-pantry", name: "Butler's Pantry", sourceKeys: ["butlers-pantry"] },
    ],
  },
  rooms: [{
    id: "selections",
    name: "Selections",
    rows: [
      guided("toilet-suite", [line("icon-line", "icon", [allocation("Main Bathroom", 4)]), line("origin-line", "origin", [allocation("Main Bathroom", 4)])]),
      guided("bath", [line("riviere-line", "riviere", [allocation("Main Bathroom", 1)]), line("chios-line", "chios", [allocation("Unallocated", 1)])]),
      {
        ...guided("ceiling-fan", [
          line("aeroflow-line", "aeroflow", [allocation("DOWNSTAIRS", 2), allocation("UPSTAIRS", 5)]),
          line("spyda-line", "spyda", [allocation("Alfresco", 1), allocation("Balcony", 1)]),
          line("stanza-line", "stanza", [allocation("Bedroom 1", 1)]),
        ]),
        description: "aeroflow: DOWNSTAIRS x2, UPSTAIRS x5",
        guidedSelection: {
          ...guided("ceiling-fan", [
            line("aeroflow-line", "aeroflow", [allocation("DOWNSTAIRS", 2), allocation("UPSTAIRS", 5)]),
            line("spyda-line", "spyda", [allocation("Alfresco", 1), allocation("Balcony", 1)]),
            line("stanza-line", "stanza", [allocation("Bedroom 1", 1)]),
          ]).guidedSelection,
          requirementLabel: "Ceiling Fans",
          locationAllocations: [allocation("DOWNSTAIRS", 2), allocation("UPSTAIRS", 5)],
          plumbingAllocation: {
            lines: [
              line("aeroflow-line", "aeroflow", [allocation("DOWNSTAIRS", 2), allocation("UPSTAIRS", 5)]),
              line("spyda-line", "spyda", [allocation("Alfresco", 1), allocation("Balcony", 1)]),
              line("stanza-line", "stanza", [allocation("Bedroom 1", 1)]),
            ],
            locationSchedule: [allocation("DOWNSTAIRS", 2), allocation("UPSTAIRS", 5)],
          },
        },
      },
      guided("balustrades", [
        line("balustrade-line", "balustrade", [allocation("Internal stairs", 3)]),
      ]),
      {
        id: "cabinetry",
        guidedRequirementKey: "cabinetry",
        guidedSelection: {
          requirementKey: "cabinetry",
          cabinetrySelection: {
            locations: [
              { id: "pantry", location: "Pantry", areaSelections: { endPanels: { productId: "pantry-panel" } } },
              { id: "butler", location: "Butler's Pantry", areaSelections: { lowerDoorsDrawers: { productId: "kitchen-master" } } },
            ],
            schedule: [{ componentId: "pantry-base", location: "Pantry", unitType: "Base cabinet", quantity: 1 }],
          },
        },
      },
    ],
  }],
};

const corrected = applyConfirmedClientSelectionCorrections(book);
const selection = key => corrected.rooms[0].rows.find(row => row.guidedRequirementKey === key).guidedSelection;
assert.deepEqual(selection("toilet-suite").plumbingAllocation.lines.map(item => item.productId), ["icon"]);
assert.deepEqual(selection("bath").plumbingAllocation.lines.map(item => item.productId), ["riviere"]);
assert.deepEqual(selection("ceiling-fan").plumbingAllocation.lines.map(item => item.productId), ["spyda"]);
assert.deepEqual(selection("ceiling-fan").plumbingAllocation.lines[0].allocations.map(item => item.location), ["Alfresco", "Balcony"]);
assert.deepEqual(selection("ceiling-fan").locationAllocations.map(item => item.location), ["Alfresco", "Balcony"]);
assert.deepEqual(selection("ceiling-fan").plumbingAllocation.locationSchedule.map(item => item.location), ["Alfresco", "Balcony"]);
assert(!corrected.rooms[0].rows.find(row => row.guidedRequirementKey === "ceiling-fan").description.match(/upstairs|downstairs/i));
assert.deepEqual(selection("balustrades").plumbingAllocation.lines[0].allocations.map(item => item.location), ["Staircase"]);
assert.deepEqual(selection("balustrades").locationAllocations.map(item => item.location), ["Staircase"]);
assert.deepEqual(selection("cabinetry").cabinetrySelection.locations.map(item => item.location), ["Butler's Pantry"]);
assert.equal(selection("cabinetry").cabinetrySelection.locations[0].areaSelections.lowerDoorsDrawers.productId, "kitchen-master");
assert.equal(selection("cabinetry").cabinetrySelection.locations[0].areaSelections.endPanels.productId, "pantry-panel");
assert(!JSON.stringify(selection("cabinetry").cabinetrySelection).match(/\"location\":\"Pantry\"/));
assert.deepEqual(applyConfirmedClientSelectionCorrections(corrected), corrected, "confirmed corrections are idempotent");

const canonicalCabinetry = normaliseCabinetrySelection({
  locations: [
    { id: "legacy-pantry", location: "Pantry", included: true, areaSelections: { lowerDoorsDrawers: { productId: "obsolete-finish" }, endPanels: { productId: "preserved-panel" } } },
    { id: "butler", location: "Butler's Pantry", included: true, areaSelections: { lowerDoorsDrawers: { productId: "kitchen-master" } } },
  ],
}, {
  rooms: [{ id: "butler", name: "Butler's Pantry", sourceKeys: ["butlers-pantry", "pantry"] }],
});
assert.deepEqual(canonicalCabinetry.locations.map(item => item.location), ["Butler's Pantry"]);
assert.equal(canonicalCabinetry.locations[0].areaSelections.lowerDoorsDrawers.productId, "kitchen-master");
assert.equal(canonicalCabinetry.locations[0].areaSelections.endPanels.productId, "preserved-panel");

console.log("Client Selection confirmed corrections: all checks passed");
