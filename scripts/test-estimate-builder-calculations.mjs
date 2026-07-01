import assert from "node:assert/strict";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { V4_DATA_SECTIONS } from "../lib/construction-estimation/estimateWorksheetV4Schema.js";

function minimalWorkbook({ rows, formulas = {}, quotation = {}, windowsDoors = [] }) {
  return {
    data: {
      inputDataSheet: {
        rows: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, { value }])),
      },
    },
    windowsDoors,
    formulas,
    quotation,
  };
}

const preview = calculateEstimateBuilderWorkbook(minimalWorkbook({
  rows: {
    lowerFloorAreaM2: 235,
    lowerGarageAreaM2: 36,
    lowerAlfrescoAreaM2: 0,
    lowerPorchAreaM2: 0,
    lowerOtherAreaM2: 0,
    upperFloorAreaM2: 100,
    upperGarageAreaM2: 10,
    upperAlfrescoAreaM2: 20,
    upperPorchAreaM2: 5,
    upperOtherAreaM2: 2,
    balconyAreaM2: 3,
    thirdFloorAreaM2: 50,
    thirdGarageAreaM2: 4,
    thirdAlfrescoAreaM2: 6,
    thirdPorchAreaM2: 7,
    upperBalconyAreaM2: 8,
    eavesWidthM: 0.45,
    lowerEavesLm: 10,
    upperEavesLm: 20,
    thirdEavesLm: 30,
    internalDoors: 7,
    roofPlanAreaM2: 200,
    roofPitchDegrees: 0,
  },
  formulas: {
    lowerSlabAreaM2: "lowerFloorAreaM2",
    secondLevelFloorAreaM2: "upperFloorAreaM2",
  },
  quotation: {
    "CONCRETE SLAB": {
      rows: [{
        id: "quote-30044",
        section: "CONCRETE SLAB",
        item: "TOTAL GROUND FLOOR AREA",
        quantity: "235",
        quantityKey: "lowerSlabAreaM2",
        unit: "M2",
        excelRate: "$125.00",
        sourceOfRate: "workbook",
        active: true,
      }],
    },
    "FLOORING": {
      rows: [{
        id: "quote-629",
        sourceRow: 629,
        section: "FLOORING",
        item: "SECURA FLOORING TO ALFRESCO AND BALCONY",
        quantity: "",
        unit: "M2",
        excelRate: "$89.89",
        sourceOfRate: "workbook",
        active: true,
      }],
    },
    "ROOF FRAMING": {
      rows: [
        {
          id: "quote-726",
          sourceRow: 726,
          section: "ROOF FRAMING",
          item: "ROOF TRUSSES",
          quantity: "",
          unit: "QUOTE",
          excelRate: "$3,690.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-727",
          sourceRow: 727,
          section: "ROOF FRAMING",
          item: "ROOF TRUSSES",
          quantity: "",
          unit: "M2",
          excelRate: "$85.00",
          sourceOfRate: "workbook",
          active: true,
        },
      ],
    },
    "LOCK-UP STAGE LABOUR": {
      rows: [
        {
          id: "quote-115",
          sourceRow: 115,
          section: "Lock-up Stage Labour",
          item: "LINE EAVES - FLAT",
          quantity: "1",
          quantityManualOverride: true,
          unit: "LM",
          excelRate: "$15.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-116",
          sourceRow: 116,
          section: "Lock-up Stage Labour",
          item: "INSTALL WINDOW ARCHITRAVES",
          quantity: "",
          unit: "LM",
          excelRate: "$10.00",
          sourceOfRate: "workbook",
          notes: "",
          formulas: { B: "architraveLengthsEach*5.4" },
          active: true,
        },
      ],
    },
    "FRAME STAGE LABOUR": {
      rows: [
        {
          id: "quote-104",
          sourceRow: 104,
          section: "Frame Stage Labour",
          item: "INSTALL CAVITY DOOR CAGE",
          quantity: "2",
          unit: "ITEM",
          excelRate: "$35.00",
          sourceOfRate: "workbook",
          active: true,
        },
      ],
    },
    "FIX-OUT STAGE LABOUR": {
      rows: [
        {
          id: "quote-150",
          sourceRow: 150,
          section: "Fix-out Stage Labour",
          item: "HANG DOOR IN CAVITY SLIDER UNIT",
          quantity: "99",
          unit: "ITEM",
          excelRate: "$50.00",
          sourceOfRate: "workbook",
          formulas: { B: "B104", G: "B150*F150" },
          active: true,
        },
        {
          id: "quote-151",
          sourceRow: 151,
          section: "Fix-out Stage Labour",
          item: "HANG FOW SLIDING DOOR",
          quantity: "",
          unit: "ITEM",
          excelRate: "$30.00",
          sourceOfRate: "workbook",
          formulas: { G: "B151*F151" },
          active: true,
        },
        {
          id: "quote-152",
          sourceRow: 152,
          section: "Fix-out Stage Labour",
          item: "HANG SINGLE DOOR INC. JAMB/ARCH/FURNITURE",
          quantity: "",
          unit: "ITEM",
          excelRate: "$35.00",
          sourceOfRate: "workbook",
          formulas: { B: "internalDoors-B150", G: "B152*F152" },
          active: true,
        },
      ],
    },
    "ROOFING MATERIALS": {
      rows: [
        {
          id: "quote-803",
          sourceRow: 803,
          section: "ROOFING MATERIALS",
          item: "M2 RATE (BATTENS, FASCIA, GUTTER, ROOF & INS)",
          quantity: "",
          quantityManualOverride: true,
          unit: "M2",
          excelRate: "$85.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1129",
          sourceRow: 1129,
          section: "ROOFING MATERIALS",
          item: "KEEP BEFORE REMOVED RANGE",
          quantity: "",
          unit: "EA",
          excelRate: "$1.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1130",
          sourceRow: 1130,
          section: "ROOFING MATERIALS",
          item: "REMOVE START",
          quantity: "",
          unit: "EA",
          excelRate: "$1.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1266",
          sourceRow: 1266,
          section: "ROOFING MATERIALS",
          item: "REMOVE END",
          quantity: "",
          unit: "EA",
          excelRate: "$1.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1267",
          sourceRow: 1267,
          section: "ROOFING MATERIALS",
          item: "KEEP AFTER REMOVED RANGE",
          quantity: "",
          unit: "EA",
          excelRate: "$1.00",
          sourceOfRate: "workbook",
          active: true,
        },
      ],
    },
    "ROOFING LABOUR": {
      rows: [
        {
          id: "quote-825",
          sourceRow: 825,
          section: "ROOFING LABOUR",
          item: "INSTALL ROOFING",
          quantity: "",
          importedQuantity: "322.55",
          quantityKey: "roofAreaM2",
          unit: "M2",
          excelRate: "$3.85",
          sourceOfRate: "workbook",
          formulas: { G: "B825*F825" },
          active: true,
        },
      ],
    },
    "WINDOWS": {
      rows: [
        {
          id: "quote-750",
          sourceRow: 750,
          section: "WINDOWS",
          item: "WINDOWS QUOTE",
          quantity: "",
          unit: "QUOTE",
          excelRate: "$8,032.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-753",
          sourceRow: 753,
          section: "WINDOWS",
          item: "WINDOWS SILLS",
          quantity: "",
          unit: "LM",
          excelRate: "$18.00",
          sourceOfRate: "workbook",
          active: true,
        },
      ],
    },
    "DOORS": {
      rows: [
        {
          id: "quote-71-static",
          sourceRow: 71,
          section: "DOORS",
          item: "STATIC IMPORTED ENTRANCE DOOR ROW SHOULD BE REMOVED",
          quantity: "99",
          unit: "EACH",
          excelRate: "$99.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1350",
          sourceRow: 1350,
          section: "DOOR JAMBS",
          item: "92 X 19 FJ PINE DOOR JAMBS (2100 HIGH)",
          quantity: "2",
          unit: "EACH",
          excelRate: "$18.00",
          sourceOfRate: "workbook",
          active: true,
        },
        {
          id: "quote-1351",
          sourceRow: 1351,
          section: "DOOR JAMBS",
          item: "92 X 19 FJ PINE DOOR JAMBS (2400 HIGH)",
          quantity: "2",
          unit: "EACH",
          excelRate: "$18.00",
          sourceOfRate: "workbook",
          active: true,
        },
      ],
    },
  },
  windowsDoors: [
    {
      id: "wd-window-1",
      section: "Windows",
      code: "1810 x 1810 2A",
      type: "Window",
      quantity: 2,
      width: 1.81,
      height: 1.81,
      level: "Ground Level",
      rate: "$500.00",
    },
    {
      id: "wd-sliding-door-1",
      section: "Sliding Doors",
      code: "2143 x 4330 6C",
      type: "Sliding Door",
      quantity: 1,
      width: 4.33,
      height: 2.143,
      level: "Second Level",
      rate: "$1,500.00",
    },
    {
      id: "wd-entry-door-1",
      section: "Entry Doors",
      code: "ENTRY DOOR",
      type: "Entry Door",
      quantity: 1,
      width: 1,
      height: 2.1,
      level: "Ground Level",
      rate: "$900.00",
    },
    {
      id: "wd-blank-rate-window",
      section: "Windows - Aluminium Fixed",
      code: "1200 x 850 1L",
      type: "Windows - Aluminium Fixed",
      quantity: 1,
      width: 0.85,
      height: 1.2,
      level: "Third Level",
      rate: "",
    },
  ],
}));

assert.equal(preview.quantities.lowerSlabAreaM2, 271);
assert.equal(preview.quantities.secondLevelFloorAreaM2, 140);
assert.equal(preview.quantities.thirdLevelFloorAreaM2, 75);
assert.equal(preview.quantities.slabFloorAreaM2, 486);
assert.equal(preview.quantities.totalBalconyAreaM2, 11);
assert.equal(preview.quantities.totalEavesLm, 60);
assert.equal(preview.quantities.eavesAreaM2, 27);
assert.equal(preview.quotation["CONCRETE SLAB"].rows[0].qty, 271);
assert.equal(preview.quotation["CONCRETE SLAB"].rows[0].quantity, "271");
assert.equal(preview.quotation["CONCRETE SLAB"].rows[0].cost, 33875);
assert.equal(preview.quotation.FLOORING.rows[0].quantityKey, "totalBalconyAreaM2");
assert.equal(preview.quotation.FLOORING.rows[0].qty, 11);
assert.equal(preview.quotation.FLOORING.rows[0].quantity, "11");
assert.equal(preview.quotation.FLOORING.rows[0].cost, 988.79);
assert.equal(preview.quantities.roofAreaM2, 322.55);
assert.equal(preview.quotation["ROOF FRAMING"].rows[0].quantityKey, "");
assert.equal(preview.quotation["ROOF FRAMING"].rows[0].qty, 0);
assert.equal(preview.quotation["ROOF FRAMING"].rows[0].quantity, "");
assert.equal(preview.quotation["ROOF FRAMING"].rows[0].cost, 0);
assert.equal(preview.quotation["ROOF FRAMING"].rows[1].quantityKey, "roofAreaM2");
assert.equal(preview.quotation["ROOF FRAMING"].rows[1].qty, preview.quantities.roofAreaM2);
assert.equal(preview.quotation["ROOF FRAMING"].rows[1].quantity, String(preview.quantities.roofAreaM2));
assert.equal(preview.quotation["ROOF FRAMING"].rows[1].cost, 27416.75);
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[0].quantityKey, "totalEavesLm");
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[0].qty, 60);
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[0].quantity, "60");
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[0].cost, 900);
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].quantity, "");
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].quantityKey, "");
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].qty, 0);
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].cost, 0);
assert.equal(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].notes, "");
assert.ok(!String(preview.quotation["LOCK-UP STAGE LABOUR"].rows[1].values?.[6] || "").includes("IMPORTED DATA"));
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].item, "HANG DOOR IN CAVITY SLIDER UNIT");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].formulas.B, "B104");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].qty, 2);
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].quantity, "2");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].cost, 100);
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[0].notes, "Formula: =B104");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[1].item, "HANG FOW SLIDING DOOR");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[1].qty, 0);
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[1].cost, 0);
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[2].item, "HANG SINGLE DOOR INC. JAMB/ARCH/FURNITURE");
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[2].qty, 5);
assert.equal(preview.quotation["FIX-OUT STAGE LABOUR"].rows[2].cost, 175);
assert.equal(preview.quotation["ROOFING MATERIALS"].rows[0].quantityKey, "roofAreaM2");
assert.equal(preview.quotation["ROOFING MATERIALS"].rows[0].qty, preview.quantities.roofAreaM2);
assert.equal(preview.quotation["ROOFING MATERIALS"].rows[0].quantity, String(preview.quantities.roofAreaM2));
assert.equal(preview.quotation["ROOFING MATERIALS"].rows[0].finalRateUsed, "$85.00");
assert.equal(preview.quotation["ROOFING MATERIALS"].rows[0].cost, 27416.75);
assert.deepEqual(preview.quotation["ROOFING MATERIALS"].rows.map((row) => row.id), ["quote-803", "quote-1129", "quote-1267"]);
assert.equal(preview.quotation["ROOFING LABOUR"].rows[0].quantity, "");
assert.equal(preview.quotation["ROOFING LABOUR"].rows[0].importedQuantity, "");
assert.equal(preview.quotation["ROOFING LABOUR"].rows[0].quantityKey, "");
assert.equal(preview.quotation["ROOFING LABOUR"].rows[0].qty, 0);
assert.equal(preview.quotation["ROOFING LABOUR"].rows[0].cost, 0);
const windowQuoteRows = preview.quotation.WINDOWS.rows;
assert.deepEqual(windowQuoteRows.map((row) => row.id), [
  "quote-750",
  "quote-window-door-wd-window-1",
  "quote-window-door-wd-sliding-door-1",
  "quote-window-door-wd-blank-rate-window",
  "quote-753",
]);
assert.equal(windowQuoteRows[1].generatedWindowDoorQuoteRow, true);
assert.equal(windowQuoteRows[1].quantity, "2");
assert.equal(windowQuoteRows[1].qty, 2);
assert.equal(windowQuoteRows[1].cost, 1000);
assert.match(windowQuoteRows[2].item, /2143 x 4330 6C/);
assert.equal(windowQuoteRows[2].qty, 1);
assert.equal(windowQuoteRows[2].cost, 1500);
assert.equal(windowQuoteRows[3].qty, 1);
assert.equal(windowQuoteRows[3].finalRateUsed, "$550.00");
assert.equal(windowQuoteRows[3].cost, 550);
assert.match(windowQuoteRows[3].sourceOfRate, /approx fixed window allowance/);
assert.equal(windowQuoteRows[4].id, "quote-753");
assert.equal(windowQuoteRows[4].item, "FLYSCREENS - ALLOWANCE (10% OF WINDOWS/DOORS)");
assert.equal(windowQuoteRows[4].quantity, "1");
assert.equal(windowQuoteRows[4].qty, 1);
assert.equal(windowQuoteRows[4].finalRateUsed, "$305.00");
assert.equal(windowQuoteRows[4].cost, 305);
assert.equal(windowQuoteRows[4].sourceOfRate, "10% of selected windows/doors");
assert.equal(windowQuoteRows.some((row) => String(row.item || "").includes("ENTRY DOOR")), false);
const entranceDoorQuoteRows = preview.quotation.DOORS.rows;
assert.deepEqual(entranceDoorQuoteRows.map((row) => row.id), ["quote-window-door-wd-entry-door-1"]);
assert.equal(entranceDoorQuoteRows[0].generatedWindowDoorQuoteRow, true);
assert.match(entranceDoorQuoteRows[0].item, /820 ENTRY DOORS/);
assert.equal(entranceDoorQuoteRows[0].quantity, "1");
assert.equal(entranceDoorQuoteRows[0].qty, 1);
assert.equal(entranceDoorQuoteRows[0].finalRateUsed, "$1,950.00");
assert.equal(entranceDoorQuoteRows[0].cost, 1950);
assert.equal(entranceDoorQuoteRows.some((row) => String(row.item || "").includes("STATIC IMPORTED")), false);
assert.equal(entranceDoorQuoteRows.some((row) => row.id === "quote-1350" || row.id === "quote-1351"), false);

const dataRows = V4_DATA_SECTIONS[0].rows;
const thirdEavesIndex = dataRows.findIndex((row) => row.key === "thirdEavesLm");
assert.equal(dataRows[thirdEavesIndex + 1]?.key, "totalEavesLm");
assert.equal(dataRows[thirdEavesIndex + 1]?.label, "TOTAL LM EAVES");

console.log("Estimate Builder calculation regression checks passed.");
