import { useMemo, useState } from "react";
import { resolveAssemblies } from "../../lib/construction-estimation/assemblyEngine.js";
import { generateMaterialTakeoff } from "../../lib/construction-estimation/takeoffEngine.js";
import { generateProcurementPlan } from "../../lib/construction-estimation/procurementEngine.js";
import { estimateContractDuration } from "../../lib/construction-estimation/durationEngine.js";
import { V2_WORKSHEET_SECTIONS } from "../../lib/construction-estimation/estimateWorksheetV2Schema.js";
import { createEstimateWorksheetV2Defaults } from "../../lib/construction-estimation/estimateWorksheetV2Defaults.js";
import { buildWorksheetV2Preview } from "../../lib/construction-estimation/finalQuantityEngine.js";

export function useEstimateWorksheetV2(plannerAnswers = {}) {
  const [worksheet, setWorksheet] = useState(() => createEstimateWorksheetV2Defaults(plannerAnswers));
  const preview = useMemo(() => buildWorksheetV2Preview(worksheet), [worksheet]);
  const engineInputs = useMemo(() => buildEngineInputs(worksheet, preview), [worksheet, preview]);
  const engineQuantities = useMemo(() => buildEngineQuantities(worksheet, preview), [worksheet, preview]);
  const assemblies = useMemo(() => resolveAssemblies(engineInputs), [engineInputs]);
  const takeoffGroups = useMemo(() => generateMaterialTakeoff(assemblies, engineQuantities), [assemblies, engineQuantities]);
  const procurementItems = useMemo(() => generateProcurementPlan(takeoffGroups, assemblies), [takeoffGroups, assemblies]);
  const contractDuration = useMemo(() => estimateContractDuration(engineInputs, procurementItems), [engineInputs, procurementItems]);

  function setActivePage(activePage) {
    setWorksheet((current) => ({ ...current, activePage }));
  }

  function setActiveSection(activeSection) {
    setWorksheet((current) => ({ ...current, activeSection, activePage: "rawInputs" }));
  }

  function updateRow(sectionKey, rowKey, fieldKey, value) {
    setWorksheet((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: {
          ...current.sections[sectionKey],
          rows: {
            ...current.sections[sectionKey].rows,
            [rowKey]: {
              ...current.sections[sectionKey].rows[rowKey],
              [fieldKey]: value,
            },
          },
        },
      },
    }));
  }

  function updateWindowDoor(id, key, value) {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.map((row) => row.id === id ? { ...row, [key]: value } : row),
    }));
  }

  function addWindowDoorRow() {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: [...current.windowsDoors, {
        id: `wd-${Date.now()}`,
        itemName: "New Opening",
        type: "Window",
        quantity: 1,
        height: 1.2,
        width: 1.2,
        notes: "",
      }],
    }));
  }

  function deleteWindowDoorRow(id) {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.filter((row) => row.id !== id),
    }));
  }

  return {
    sections: V2_WORKSHEET_SECTIONS,
    worksheet,
    preview,
    engineInputs,
    engineQuantities,
    assemblies,
    takeoffGroups,
    procurementItems,
    contractDuration,
    setActivePage,
    setActiveSection,
    updateRow,
    updateWindowDoor,
    addWindowDoorRow,
    deleteWindowDoorRow,
  };
}

function buildEngineInputs(worksheet, preview) {
  const get = (section, row) => preview.finalQuantities[row]?.finalQuantity || worksheet.sections?.[section]?.rows?.[row]?.inputValue;
  return {
    projectType: get("projectBasics", "projectType") || "Single Storey Home",
    siteConditions: get("siteworks", "siteSlope") || "Flat Site",
    slabType: get("slab", "slabType") || "Waffle Pod",
    wallConstruction: get("exteriorWalls", "wallSystem") || "Brick Veneer",
    roofType: get("roof", "roofType") || "Colorbond",
    retainingWalls: Number(get("siteworks", "retainingWallLm")) > 0 ? "Engineered Retaining" : "None",
    siteAccess: get("siteworks", "accessDifficulty") || "Easy",
    additionalFeatures: Number(get("interiorWalls", "structuralSteelTonnes")) > 0 ? ["Structural Steel"] : [],
    floorAreaM2: preview.summaryQuantities.totalFloorAreaM2,
    wallHeightM: Number(get("exteriorWalls", "wallHeightM")) || 2.7,
    roofPitchDegrees: Number(get("roof", "roofPitchDegrees")) || 22.5,
  };
}

function buildEngineQuantities(worksheet, preview) {
  const q = preview.summaryQuantities;
  const get = (key) => Number(preview.finalQuantities[key]?.finalQuantity) || 0;
  return {
    siteItem: 1,
    floorAreaM2: q.totalFloorAreaM2,
    footprintM2: get("groundFloorM2"),
    slabM2: q.slabAreaM2,
    roofM2: q.roofAreaM2,
    roofPerimeterLm: get("guttersLm"),
    externalWallM2: q.netExternalWallM2,
    upperExternalWallM2: get("lightweightCladdingM2") || q.netExternalWallM2,
    internalWallLm: get("internalWallLm"),
    frameLm: get("internalWallLm") + get("externalWallLm"),
    plasterboardM2: get("plasterboardWallM2"),
    insulationM2: get("insulationM2"),
    wetAreaM2: get("showers") * 6 + get("baths") * 3,
    paintM2: get("internalPaintM2"),
    flooringM2: q.totalFloorAreaM2,
    cabinetryLm: get("cabinetryLm"),
    windowDoorItems: preview.areas.windowDoor.totals.itemCount,
    plumbingPoints: get("vanities") + get("toilets") + get("showers") + get("baths") + get("tapwareSets"),
    electricalPoints: get("powerPoints") + get("lights") + get("downlights") + get("fans") + get("smokeAlarms") + get("dataPoints") + get("tvPoints"),
    earthworksM3: get("cutFillM3"),
    structuralSteelT: get("structuralSteelTonnes"),
    drivewayM2: get("drivewayM2"),
    landscapingM2: get("landscapingM2"),
    retainingWallLm: get("retainingWallLm"),
    detailed: {
      windowDoorAreaM2: q.windowDoorAreaM2,
      architraveLm: q.architraveLm,
      skirtingLm: q.skirtingLm,
      corniceLm: q.corniceLm,
      pcItemCount: get("pcItemCount"),
      provisionalSumCount: get("provisionalSumCount"),
    },
  };
}
