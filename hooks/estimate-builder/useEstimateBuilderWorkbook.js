import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { V4_DATA_SECTIONS, V4_WINDOW_TYPES } from "../../lib/construction-estimation/estimateWorksheetV4Schema.js";
import { createEstimateBuilderWorkbookDefaults } from "../../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from "../../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { withWindowDoorApproximateRate } from "../../lib/construction-estimation/windowDoorApproximatePricing.js";
import { doorScheduleRangeOptions, humeEntryDoorRows, humeEntryDoorSize, isDoorScheduleRangeRow, isHumeEntryDoorRow, isLegacyEntryDoorScheduleRow, supplementalEntryDoorRows, withDoorScheduleSelection, withHumeEntryDoorSelection } from "../../lib/construction-estimation/humeEntryDoorPricing.js";

const ESTIMATE_BUILDER_PAGES = [
  { key: "dataInput", label: "Data Input" },
  { key: "windowsDoors", label: "Windows & Doors" },
  { key: "formulaSheet", label: "Formula Sheet" },
  { key: "quotation", label: "Quotation" },
  { key: "summary", label: "Summary" },
  { key: "clientPage", label: "Client Page" },
];

const REMOVED_QUOTE_SECTION_NAMES = new Set(["upper level framing", "roof cover - colourbond", "lock up materials", "quick render estimate", "project management", "entry doors", "entry doors - complete", "standard 820 entrace door", "plasterer", "fixout", "fix out", "specials", "internal door complete", "internal cavity sliding door complete", "internal doors"]);
const JOB_SET_OUT_LABOUR_ROW_IDS = new Set(["quote-245", "quote-246", "quote-247"]);
const JOB_SET_OUT_LABOUR_SOURCE_ROWS = new Set([245, 246, 247]);
const REMOVED_IMPORTED_QUOTE_SOURCE_ROWS = new Set([1248, 1250, 1251, 1350, 1351]);
const QUOTE_ROWS_WITHOUT_IMPORTED_DATA = new Set([1272, 1373, 1374, 1380, 1381, 1382]);
const STANDARD_THREE_DOOR_ROBE_SECTION = "STANDARD 3 DOOR ROBE UP TO 3.6M WIDE";
const STANDARD_TWO_DOOR_LINEN_SECTION = "STANDARD 2 DOOR LINEN UP TO 2.4M WIDE";
const STANDARD_THREE_DOOR_LINEN_SECTION = "STANDARD 3 DOOR LINEN UP TO 3.6M WIDE";
const CABINET_MAKER_SECTION = "CABINET MAKER";
const CABINET_MAKER_BUTLERS_PANTRY_SECTION = "BUTLERS PANTRY";
const CABINET_MAKER_LAUNDRY_SECTION = "LAUNDRY";
const CABINET_MAKER_BATHROOMS_SECTION = "BATHROOMS";
const CABINET_MAKER_WARDROBES_SECTION = "WARDROBES";
const OLD_LINEN_AND_ROBE_DOOR_SECTIONS = new Set([
  "space saver sling robe doors",
  "standard linen complete (2.4m wide)",
  "1800 wide 2 door x 2100 high",
  "3000 wide 3 door x 2100 high",
  "1800 wide 2 door x 2400 high",
  "3000 wide 3 door x 2400 high",
]);
const OLD_CABINET_MAKER_SECTIONS = new Set([
  "cabinet maker",
  "misc cabinetry",
  "whitegoods",
  "arc",
  "euromaid",
  "ariston",
  "omega",
  "blanco",
  "blanco upgrade options",
  "smeg",
  "smeg upgrade options",
]);
const BLANK_INPUT_QUOTE_SECTION_NAMES = new Set(["roof framing"]);
const BLANK_QTY_QUOTE_SECTION_NAMES = new Set(["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials", "renderers labour", "misc rendering"]);
const BLANK_VALUE_QUOTE_SECTION_NAMES = new Set(["hourly rate"]);
const TILING_MANUAL_QUOTE_SECTION_NAMES = new Set(["tiling", "toilet", "other room/s", "kitchen", "tile layer", "plumbing fittings & tapwear", "kitchen sinks", "kitchen taps", "vanity basins"]);
const EDITABLE_LINKED_QUOTE_KEYS = new Set([
  "quoteFaceBricksBaseRange",
  "quoteCommonSingleHeights",
  "quoteCommonTwinHeights",
  "quoteBrickSillBricks",
  "quoteBricklayerFaceBricks",
  "quoteBricklayerSingleHeight",
  "quoteBricklayerDoubleHeights",
  "quoteBricklayerSillsLm",
  "quoteRenderingNetWallAreaM2",
  "quoteRenderingSillsLm",
  "quoteFrameInstallWindows",
  "quoteFrameSecondStoreyWindows",
  "quoteFrameThirdStoreyWindows",
  "quoteFrameRoofTrusses",
  "quoteFrameSecondStoreyTrusses",
  "quoteFrameThirdStoreyTrusses",
  "quoteFrameCeilingBattensGroundM2",
  "quoteFrameCeilingBattensSecondM2",
  "quoteFrameCeilingBattensThirdM2",
  "quoteFrameTieDownSheetBracingGroundM2",
  "quoteFrameTieDownSheetBracingSecondM2",
  "quoteFrameTieDownSheetBracingThirdM2",
  "quoteFrameExteriorWallsGroundLm",
  "quoteFrameExteriorWallsSecondLm",
  "quoteFrameExteriorWallsThirdLm",
  "quoteFrameInteriorWallsGroundLm",
  "quoteFrameInteriorWallsSecondLm",
  "quoteFrameInteriorWallsThirdLm",
  "quoteFrameFloorJoistsSecondM2",
  "quoteFrameSheetFlooringSecondM2",
  "quoteFrameFloorJoistsThirdM2",
  "quoteFrameSheetFlooringThirdM2",
  "totalBalconyAreaM2",
  "roofAreaM2",
  "quoteLightweightCladdingM2",
  "quote150LineaBoardLengths",
  "quote180LineaBoardLengths",
  "quote405StriaCladdingLengths",
  "quoteCeilingInsulationFlatM2",
  "quoteSisalationInstallGroundM2",
  "quoteSisalationInstallSecondM2",
  "quoteSisalationInstallThirdM2",
  "quoteWallBattsInstallGroundM2",
  "quoteWallBattsInstallSecondM2",
  "quoteWallBattsInstallThirdM2",
  "quoteLightweightCladdingInstallGroundM2",
  "quoteLightweightCladdingInstallSecondM2",
  "quoteLightweightCladdingInstallThirdM2",
  "cutFillM3",
  "lowerSlabAreaM2",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "quoteFloorSystemGround300M2",
  "quoteFloorSystemGround360M2",
  "quoteFloorSystemSecond300M2",
  "quoteFloorSystemSecond360M2",
  "quoteFloorSystemThird300M2",
  "quoteFloorSystemThird360M2",
  "plasterboardWallM2",
  "totalCeilingAreasM2",
  "corniceLm",
  "windowDoorArchitraveLm",
]);
const FORCED_LINKED_QUOTE_KEYS = new Set(["roofAreaM2"]);
const RENAMED_QUOTE_SECTION_NAMES = new Map([
  ["ungrouped", "PRELIMINARIES"],
  ["ground floor framing", "WALL FRAMES"],
  ["misc.", "TIMBER AND TRIMS"],
  ["entrance doors", "DOORS"],
  ["skirting & architraves", "FIX OUT MATERIALS"],
]);

export function useEstimateBuilderWorkbook(initialValues = {}, options = {}) {
  const previewMode = Boolean(options.previewMode);
  const [workbook, setWorkbook] = useState(() => initialWorkbook(initialValues, { previewMode }));
  const [lineSearch, setLineSearch] = useState("");
  const [hideUnused, setHideUnused] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState("inputs");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [templateSummaries, setTemplateSummaries] = useState([]);
  const autosaveTimerRef = useRef(null);
  const autosaveIdleRef = useRef(null);
  const workbookRef = useRef(workbook);
  workbookRef.current = workbook;
  const deferredWorkbook = useDeferredValue(workbook);
  const preview = useMemo(() => calculateEstimateBuilderWorkbook(deferredWorkbook), [deferredWorkbook]);
  const quoteSections = useMemo(
    () => orderedQuoteSections(workbook.quotation || {}, workbook.quotationSectionOrder || []),
    [workbook.quotation, workbook.quotationSectionOrder],
  );
  const dataWorkbook = useMemo(() => ({ data: workbook.data || {} }), [workbook.data]);
  const dataInputSections = useMemo(() => V4_DATA_SECTIONS.map((section) => ({
    ...section,
    rows: mergeDataRows(section, dataWorkbook.data?.[section.key]?.customRows || [], dataWorkbook.data?.[section.key]?.hiddenRows || [])
      .map((row) => withDynamicDataRowLabel(row, section.key, dataWorkbook))
      .filter((row) => isRelevantForDataInput(row, dataWorkbook)),
  })), [dataWorkbook]);

  useEffect(() => {
    if (previewMode) return;
    if (deferredWorkbook !== workbookRef.current) return;
    setWorkbook((current) => syncEditableLinkedQuoteQuantities(syncWindowDoorApproximateRates(current), preview));
  }, [deferredWorkbook, preview, previewMode]);

  useEffect(() => {
    if (previewMode) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    loadLatestStoredJob().then((storedJob) => {
      if (cancelled || !storedJob?.workbook) return;
      const localDraft = loadLocalDraft();
      const storedSavedAt = String(storedJob.savedAt || storedJob.workbook?.savedAt || "");
      const localSavedAt = String(localDraft?.savedAt || "");
      if (!localDraft || storedSavedAt > localSavedAt) {
        setWorkbook(normalizeWorkbook(storedJob.workbook));
        setLastSavedAt(storedSavedAt);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (previewMode) return;
    if (typeof window === "undefined") return;
    refreshTemplateSummaries();
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return undefined;
    if (typeof window === "undefined") return undefined;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    if (autosaveIdleRef.current && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(autosaveIdleRef.current);
      autosaveIdleRef.current = null;
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const saveDraftWhenIdle = () => {
        const draft = compactWorkbookForStorage({ ...workbook, savedAt });
        try {
          window.localStorage.setItem("estimate-builder-active-draft", JSON.stringify(draft));
          setLastSavedAt(savedAt);
        } catch {
          // IndexedDB below remains the durable save path if localStorage is full.
        }
        saveStoredJob(draft, savedAt).catch(() => {});
      };
      if (typeof window.requestIdleCallback === "function") {
        autosaveIdleRef.current = window.requestIdleCallback(saveDraftWhenIdle, { timeout: 1500 });
      } else {
        saveDraftWhenIdle();
      }
    }, 2500);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      if (autosaveIdleRef.current && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(autosaveIdleRef.current);
        autosaveIdleRef.current = null;
      }
    };
  }, [workbook, previewMode]);

  function setPage(page) {
    setWorkbook((current) => ({ ...current, page }));
  }

  function toggleDataSection(section) {
    setWorkbook((current) => ({
      ...current,
      data: {
        ...current.data,
        [section]: { ...safeDataSection(current, section), collapsed: !safeDataSection(current, section).collapsed },
      },
    }));
  }

  function updateData(section, key, field, value) {
    setWorkbook((current) => {
      const dataSection = safeDataSection(current, section);
      return {
        ...current,
        data: {
          ...current.data,
          [section]: {
            ...dataSection,
            rows: {
              ...dataSection.rows,
              [key]: { ...(dataSection.rows[key] || {}), [field]: value },
            },
          },
        },
      };
    });
  }

  function updateDataRowMeta(section, key, field, value) {
    setWorkbook((current) => ({
      ...current,
      data: {
        ...current.data,
        [section]: {
          ...current.data[section],
          customRows: (current.data[section]?.customRows || []).map((row) => (
            row.key === key ? { ...row, [field]: value } : row
          )),
        },
      },
    }));
  }

  function addDataRow(section, anchorKey = null, position = "after", sourceKey = null) {
    setWorkbook((current) => {
      const sectionDef = V4_DATA_SECTIONS.find((item) => item.key === section);
      if (!sectionDef) return current;
      const dataSection = current.data[section] || { collapsed: false, rows: {}, customRows: [] };
      const rows = mergeDataRows(sectionDef, dataSection.customRows || []);
      const anchorIndex = anchorKey ? rows.findIndex((row) => row.key === anchorKey) : -1;
      const insertIndex = anchorIndex >= 0 ? anchorIndex + (position === "before" ? 0 : 1) : rows.length;
      const sourceRow = sourceKey ? rows.find((row) => row.key === sourceKey) : null;
      const key = `${section}-custom-${Date.now()}`;
      const order = orderBetween(rows[insertIndex - 1], rows[insertIndex]);
      const newRow = {
        key,
        label: sourceRow?.label ? `${sourceRow.label} copy` : "New row",
        unit: sourceRow?.unit || "",
        calculated: false,
        custom: true,
        order,
      };
      const sourceSaved = sourceKey ? dataSection.rows?.[sourceKey] || {} : {};

      return {
        ...current,
        data: {
          ...current.data,
          [section]: {
            ...dataSection,
            customRows: [...(dataSection.customRows || []), newRow],
            rows: {
              ...(dataSection.rows || {}),
              [key]: {
                value: sourceSaved.value || "",
                notes: sourceSaved.notes || "",
              },
            },
          },
        },
      };
    });
  }

  function deleteDataRow(section, key) {
    setWorkbook((current) => {
      const dataSection = current.data[section];
      const isCustom = dataSection?.customRows?.some((row) => row.key === key);
      if (!dataSection) return current;
      if (REQUIRED_DATA_INPUT_ROW_KEYS.has(key)) return current;
      if (!isCustom) {
        return {
          ...current,
          data: {
            ...current.data,
            [section]: {
              ...dataSection,
              hiddenRows: Array.from(new Set([...(dataSection.hiddenRows || []), key])),
            },
          },
        };
      }
      const { [key]: removed, ...rows } = dataSection.rows || {};
      return {
        ...current,
        data: {
          ...current.data,
          [section]: {
            ...dataSection,
            customRows: dataSection.customRows.filter((row) => row.key !== key),
            rows,
          },
        },
      };
    });
  }

  function updateFormula(key, value) {
    setWorkbook((current) => ({
      ...current,
      formulas: {
        ...(current.formulas || {}),
        [key]: value,
      },
      formulaHistory: [
        ...(current.formulaHistory || []),
        { key, value, note: current.formulaNotes?.[key] || "Edited for this estimate", changedAt: new Date().toISOString() },
      ],
    }));
  }

  function updateFormulaNote(key, note) {
    setWorkbook((current) => ({
      ...current,
      formulaNotes: {
        ...(current.formulaNotes || {}),
        [key]: note,
      },
    }));
  }

  function updateFormulaRowMeta(key, field, value) {
    setWorkbook((current) => {
      const canonicalKey = field === "label" ? formulaKeyForLabel(value) : "";
      if (canonicalKey) {
        const currentFormula = String(current.formulas?.[key] || "").trim();
        const formulas = {
          ...(current.formulas || {}),
          [canonicalKey]: currentFormula || V4_DEFAULT_FORMULAS[canonicalKey],
        };
        delete formulas[key];
        return {
          ...current,
          formulas,
          formulaRows: (current.formulaRows || []).filter((row) => row.key !== key),
        };
      }
      return {
        ...current,
        formulaRows: (current.formulaRows || []).map((row) => (
          row.key === key ? { ...row, [field]: value } : row
        )),
      };
    });
  }

  function addFormulaRow(anchorKey = null, position = "after", sourceKey = null) {
    setWorkbook((current) => {
      const rows = mergeFormulaRows(current.formulaRows || []);
      const anchorIndex = anchorKey ? rows.findIndex((row) => row.key === anchorKey) : -1;
      const insertIndex = anchorIndex >= 0 ? anchorIndex + (position === "before" ? 0 : 1) : rows.length;
      const sourceRow = sourceKey ? rows.find((row) => row.key === sourceKey) : null;
      const key = `customFormula${Date.now()}`;
      const order = orderBetween(rows[insertIndex - 1], rows[insertIndex]);
      const formula = sourceKey ? current.formulas?.[sourceKey] || "" : "";
      const note = sourceKey ? current.formulaNotes?.[sourceKey] || "" : "";

      return {
        ...current,
        formulas: {
          ...(current.formulas || {}),
          [key]: formula,
        },
        formulaNotes: {
          ...(current.formulaNotes || {}),
          [key]: note,
        },
        formulaRows: [
          ...(current.formulaRows || []),
          {
            key,
            label: sourceRow?.label ? `${sourceRow.label} copy` : "New formula",
            unit: sourceRow?.unit || "",
            calculated: true,
            custom: true,
            order,
          },
        ],
      };
    });
  }

  function deleteFormulaRow(key) {
    setWorkbook((current) => {
      if (!(current.formulaRows || []).some((row) => row.key === key)) {
        return {
          ...current,
          hiddenFormulaRows: Array.from(new Set([...(current.hiddenFormulaRows || []), key])),
        };
      }
      const { [key]: removedFormula, ...formulas } = current.formulas || {};
      const { [key]: removedNote, ...formulaNotes } = current.formulaNotes || {};
      return {
        ...current,
        formulas,
        formulaNotes,
        formulaRows: (current.formulaRows || []).filter((row) => row.key !== key),
      };
    });
  }

  function updateWindow(id, key, value) {
    setWorkbook((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    }));
  }

  function updateWindowRate(id, value) {
    setWorkbook((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.map((row) => (row.id === id ? {
        ...row,
        rate: value,
        sourceOfRate: value ? "manual window/door schedule" : "",
        notes: value ? row.notes : "",
      } : row)),
    }));
  }

  function updateWindowDoorRange(id, doorRange) {
    setWorkbook((current) => ({
      ...current,
      windowsDoors: (current.windowsDoors || []).map((row) => (
        row.id === id ? withDoorScheduleSelection({ ...row, doorRange, rate: "", sourceOfRate: "" }) : row
      )),
    }));
  }

  function updateWindowOption(id, code) {
    setWorkbook((current) => {
      const currentRow = (current.windowsDoors || []).find((row) => row.id === id);
      const match = (current.windowsDoors || []).find((row) => (
        row.id !== id &&
        String(row.section || "") === String(currentRow?.section || "") &&
        String(row.code || "") === String(code || "")
      ));
      const option = match || currentRow || {};
      return {
        ...current,
        windowsDoors: (current.windowsDoors || []).map((row) => {
          if (row.id !== id) return row;
          if (isDoorScheduleRangeRow(currentRow || row)) {
            return withDoorScheduleSelection({ ...row, code, rate: "", sourceOfRate: "" });
          }
          return withWindowDoorApproximateRate({
            ...row,
            code,
            width: option.width ?? row.width,
            height: option.height ?? row.height,
            area: option.area ?? row.area,
            type: option.type || row.type,
            rate: option.rate || row.rate,
            sourceOfRate: option.sourceOfRate || row.sourceOfRate,
            notes: row.notes || option.notes,
            values: option.values || row.values,
            formulas: option.formulas || row.formulas,
          });
        }),
      };
    });
  }

  function addWindow(anchorId = null, position = "after", sourceId = null, type = "Fixed Window", section = "Custom") {
    setWorkbook((current) => {
      const rows = current.windowsDoors || [];
      const anchorIndex = anchorId ? rows.findIndex((row) => row.id === anchorId) : -1;
      const index = anchorIndex >= 0 ? anchorIndex + (position === "before" ? 0 : 1) : rows.length;
      const source = sourceId ? rows.find((row) => row.id === sourceId) : null;
      const newRow = source
        ? { ...source, id: `wd-${Date.now()}` }
        : { id: `wd-${Date.now()}`, section, code: "NEW", type, level: "Ground Level", quantity: 1, width: 1.2, height: 1.2, notes: "" };
      return {
        ...current,
        windowsDoors: [...rows.slice(0, index), newRow, ...rows.slice(index)],
      };
    });
  }

  function deleteWindow(id) {
    setWorkbook((current) => ({ ...current, windowsDoors: current.windowsDoors.filter((row) => row.id !== id) }));
  }

  function resetWindowsDoorsFromExcel() {
    const defaults = createEstimateBuilderWorkbookDefaults();
    setWorkbook((current) => ({
      ...current,
      windowsDoors: defaults.windowsDoors,
      importedSheets: {
        ...(current.importedSheets || {}),
        windows: defaults.importedSheets?.windows || null,
      },
    }));
  }

  function toggleQuoteSection(section) {
    setWorkbook((current) => ({
      ...current,
      quotation: {
        ...current.quotation,
        [section]: { ...current.quotation[section], collapsed: !current.quotation[section].collapsed },
      },
    }));
  }

  function updateQuote(section, id, key, value) {
    setWorkbook((current) => ({
      ...current,
      quotation: {
        ...current.quotation,
        [section]: {
          ...current.quotation[section],
          rows: current.quotation[section].rows.map((row) => {
            if (row.id !== id) return row;
            if (key === "quantity" && String(value || "").trim().startsWith("=")) {
              const formula = String(value || "").trim().slice(1).trim();
              return {
                ...row,
                quantity: "",
                importedQuantity: "",
                quantityKey: "",
                autoQuantity: false,
                quantityManualOverride: false,
                formulas: {
                  ...(row.formulas || {}),
                  B: formula,
                  G: row.formulas?.G || `B${quoteRowSourceNumber(row)}*F${quoteRowSourceNumber(row)}`,
                },
              };
            }
            return {
              ...row,
              [key]: value,
              ...(key === "quantity" ? { autoQuantity: false, quantityManualOverride: true } : {}),
            };
          }),
        },
      },
      quoteHistory: shouldTrackQuoteChange(key) ? [
        ...(current.quoteHistory || []),
        { section, id, field: key, value, changedAt: new Date().toISOString() },
      ] : current.quoteHistory || [],
    }));
  }

  function updateQuoteSectionMeta(section, key, value) {
    if (!section || !key) return;
    setWorkbook((current) => ({
      ...current,
      quotation: {
        ...(current.quotation || {}),
        [section]: {
          ...(current.quotation?.[section] || {}),
          [key]: value,
        },
      },
    }));
  }

  function updateSummaryAdjustment(key, value) {
    if (!key) return;
    setWorkbook((current) => ({
      ...current,
      summaryAdjustments: {
        ...(current.summaryAdjustments || {}),
        [key]: value,
      },
    }));
  }

  function updateClientPage(key, value) {
    if (!key) return;
    setWorkbook((current) => ({
      ...current,
      clientPage: {
        ...(current.clientPage || {}),
        [key]: value,
      },
    }));
  }

  function addQuoteLine(section, anchorId = null, position = "after") {
    const newRow = {
      id: `${section}-custom-${Date.now()}`,
      item: "New item",
      quantity: "",
      quantityKey: "",
      unit: "ITEM",
      excelRate: "",
      supplierCatalogueRate: "",
      quotedSupplierRate: "",
      manualRate: "",
      supplierQuote: "",
      sourceOfRate: "manual",
      quoteRequired: false,
      lineType: "Standard rate item",
      discontinuedWarning: false,
      notes: "",
    };
    setWorkbook((current) => {
      const rows = current.quotation[section].rows;
      const anchorIndex = anchorId ? rows.findIndex((row) => row.id === anchorId) : -1;
      const index = anchorIndex >= 0 ? anchorIndex + (position === "before" ? 0 : 1) : rows.length;
      return {
        ...current,
        quotation: {
          ...current.quotation,
          [section]: {
            ...current.quotation[section],
            rows: [...rows.slice(0, index), newRow, ...rows.slice(index)],
          },
        },
      };
    });
  }

  function duplicateQuoteLine(section, id) {
    setWorkbook((current) => {
      const rows = current.quotation[section]?.rows || [];
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return current;
      const source = rows[index];
      const newRow = {
        ...source,
        id: `${section}-copy-${Date.now()}`,
        item: source.item ? `${source.item} copy` : "Copied item",
      };
      return {
        ...current,
        quotation: {
          ...current.quotation,
          [section]: {
            ...current.quotation[section],
            rows: [...rows.slice(0, index + 1), newRow, ...rows.slice(index + 1)],
          },
        },
      };
    });
  }

  function moveQuoteLine(fromSection, id, toSection, targetId = null, position = "after") {
    if (!fromSection || !id || !toSection) return;
    if (fromSection === toSection && id === targetId) return;
    setWorkbook((current) => {
      const fromRows = current.quotation[fromSection]?.rows || [];
      const movingRow = fromRows.find((row) => row.id === id);
      if (!movingRow) return current;

      const nextQuotation = { ...current.quotation };
      nextQuotation[fromSection] = {
        ...nextQuotation[fromSection],
        rows: fromRows.filter((row) => row.id !== id),
      };

      const targetRows = fromSection === toSection
        ? nextQuotation[toSection].rows
        : current.quotation[toSection]?.rows || [];
      const targetIndex = targetId ? targetRows.findIndex((row) => row.id === targetId) : -1;
      const insertIndex = targetIndex >= 0 ? targetIndex + (position === "before" ? 0 : 1) : targetRows.length;

      nextQuotation[toSection] = {
        ...current.quotation[toSection],
        rows: [...targetRows.slice(0, insertIndex), movingRow, ...targetRows.slice(insertIndex)],
      };

      return {
        ...current,
        quotation: nextQuotation,
        quoteHistory: [
          ...(current.quoteHistory || []),
          { section: toSection, id, field: "moved", value: fromSection === toSection ? "Line reordered" : `Moved from ${fromSection}`, changedAt: new Date().toISOString() },
        ],
      };
    });
  }

  function deleteQuoteLine(section, id) {
    setWorkbook((current) => ({
      ...current,
      quotation: {
        ...current.quotation,
        [section]: {
          ...current.quotation[section],
          rows: current.quotation[section].rows.filter((row) => row.id !== id),
        },
      },
      quoteHistory: [
        ...(current.quoteHistory || []),
        { section, id, field: "deleted", value: "Line deleted for this estimate", changedAt: new Date().toISOString() },
      ],
    }));
  }

  function deleteQuoteSection(section) {
    setWorkbook((current) => {
      const { [section]: removed, ...quotation } = current.quotation || {};
      return {
        ...current,
        quotation,
        quotationSectionOrder: normalizeQuoteSectionOrder(current.quotationSectionOrder || [], quotation),
      };
    });
  }

  function addQuoteSection() {
    const section = window.prompt("New section name");
    if (!section) return;
    setWorkbook((current) => {
      if (current.quotation[section]) return current;
      return {
        ...current,
        quotation: {
          ...current.quotation,
          [section]: { collapsed: false, rows: [] },
        },
        quotationSectionOrder: normalizeQuoteSectionOrder([...(current.quotationSectionOrder || []), section], {
          ...current.quotation,
          [section]: { collapsed: false, rows: [] },
        }),
      };
    });
  }

  function saveQuoteSectionOrder(nextOrder = []) {
    setWorkbook((current) => ({
      ...current,
      quotationSectionOrder: normalizeQuoteSectionOrder(nextOrder, current.quotation || {}),
    }));
  }

  function requestPromoteFormula(key) {
    setWorkbook((current) => ({
      ...current,
      formulaPromotions: {
        ...(current.formulaPromotions || {}),
        [key]: {
          formula: current.formulas?.[key] || "",
          note: current.formulaNotes?.[key] || "",
          requestedAt: new Date().toISOString(),
        },
      },
    }));
  }

  function requestPromoteRate(section, id) {
    setWorkbook((current) => {
      const row = current.quotation[section]?.rows.find((item) => item.id === id);
      if (!row) return current;
      return {
        ...current,
        ratePromotions: [
          ...(current.ratePromotions || []),
          {
            section,
            id,
            item: row.item,
            rate: row.manualRate || row.supplierQuote || row.finalRateUsed || "",
            notes: row.notes || "",
            requestedAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  function saveDraft() {
    if (typeof window === "undefined") return;
    const savedAt = new Date().toISOString();
    const draft = compactWorkbookForStorage({ ...workbook, savedAt });
    window.localStorage.setItem("estimate-builder-active-draft", JSON.stringify(draft));
    saveStoredJob(draft, savedAt).catch(() => {});
    setLastSavedAt(savedAt);
  }

  function loadDraft() {
    if (typeof window === "undefined") return;
    const draft = loadLocalDraft();
    if (!draft) return;
    setWorkbook(normalizeWorkbook(draft));
    setLastSavedAt(draft.savedAt || "");
  }

  async function saveTemplateAs(name, options = {}) {
    if (typeof window === "undefined") return { ok: false, message: "Templates are not available here." };
    const templateName = String(name || "").trim();
    if (!templateName) return { ok: false, message: "Enter a template name first." };
    const category = String((options.category ?? workbook.templateCategory) || "Builder Templates").trim();
    const tags = Array.isArray(options.tags)
      ? options.tags
      : String((options.tags ?? workbook.templateTags) || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    const savedAt = new Date().toISOString();
    const templateWorkbook = sanitizeWorkbookForTemplate(workbook, { name: templateName, savedAt, category, tags });
    try {
      await saveStoredTemplate(templateName, templateWorkbook, { createNew: true, category, tags });
      await saveStoredTemplatePointer(templateWorkbook.templateKey);
      setLastSavedAt(savedAt);
      setWorkbook((current) => normalizeWorkbook({
        ...current,
        templateKey: templateWorkbook.templateKey,
        templateName,
        templateCategory: category,
        templateTags: tags.join(", "),
        savedAt,
      }));
      await refreshTemplateSummaries();
      return { ok: true, message: "Template saved.", key: templateWorkbook.templateKey };
    } catch {
      return { ok: false, message: "Template could not be saved." };
    }
  }

  async function saveTemplate(templateKey = "") {
    if (typeof window === "undefined") return { ok: false, message: "Templates are not available here." };
    try {
      const templates = templateSummaries.length ? templateSummaries : await listStoredTemplates();
      const selectedKey = String(templateKey || workbook.templateKey || "").trim();
      if (!selectedKey) {
        return { ok: false, message: "Open or save a new template first." };
      }
      const selectedTemplate = templates.find((template) => template.key === selectedKey);
      if (!selectedTemplate) return { ok: false, message: "Template could not be found." };
      const savedAt = new Date().toISOString();
      const category = selectedTemplate.category || workbook.templateCategory || "";
      const tags = Array.isArray(selectedTemplate.tags) ? selectedTemplate.tags : parseTags(workbook.templateTags);
      const templateWorkbook = sanitizeWorkbookForTemplate(workbook, { name: selectedTemplate.name, savedAt, category, tags });
      const workbookForSave = { ...templateWorkbook, templateKey: selectedTemplate.key, templateName: selectedTemplate.name };
      await saveStoredTemplate(selectedTemplate.name, workbookForSave, { key: selectedTemplate.key, category, tags });
      await saveStoredTemplatePointer(selectedTemplate.key);
      setWorkbook((current) => normalizeWorkbook({
        ...current,
        templateKey: selectedTemplate.key,
        templateName: selectedTemplate.name,
        templateCategory: category,
        templateTags: tags.join(", "),
        savedAt,
      }));
      setLastSavedAt(savedAt);
      await refreshTemplateSummaries();
      return { ok: true, message: "Template saved.", key: selectedTemplate.key };
    } catch {
      return { ok: false, message: "Template could not be saved." };
    }
  }

  async function duplicateTemplate(templateKey = "") {
    if (typeof window === "undefined") return { ok: false, message: "Templates are not available here." };
    const sourceKey = String(templateKey || workbook.templateKey || "").trim();
    if (!sourceKey) return saveTemplateAs();
    const template = await loadStoredTemplate(sourceKey);
    if (!template) {
      return { ok: false, message: "Template could not be found." };
    }
    const sourceName = template.templateName || "Estimate template";
    const duplicateName = window.prompt("Duplicate template as", `${sourceName} Copy`);
    if (!duplicateName) return { ok: false, message: "Template was not duplicated." };
    const savedAt = new Date().toISOString();
    const duplicateWorkbook = sanitizeWorkbookForTemplate(template, {
      name: duplicateName,
      savedAt,
      category: template.templateCategory || "",
      tags: parseTags(template.templateTags),
    });
    await saveStoredTemplate(duplicateName, duplicateWorkbook, { createNew: true, category: duplicateWorkbook.templateCategory, tags: parseTags(duplicateWorkbook.templateTags) });
    await refreshTemplateSummaries();
    return { ok: true, message: "Template duplicated." };
  }

  async function renameTemplate(templateKey = "") {
    if (typeof window === "undefined") return;
    const templates = templateSummaries.length ? templateSummaries : await listStoredTemplates();
    const selectedTemplate = templates.find((template) => template.key === templateKey);
    if (!selectedTemplate) return;
    const newName = window.prompt("Rename template", selectedTemplate.name);
    if (!newName || newName === selectedTemplate.name) return;
    const template = await loadStoredTemplate(selectedTemplate.key);
    if (!template) return;
    const savedAt = new Date().toISOString();
    const renamedWorkbook = sanitizeWorkbookForTemplate(template, {
      name: newName,
      savedAt,
      category: selectedTemplate.category || template.templateCategory || "",
      tags: selectedTemplate.tags || parseTags(template.templateTags),
    });
    const nextWorkbook = { ...renamedWorkbook, templateKey: selectedTemplate.key, templateName: newName };
    await saveStoredTemplate(newName, nextWorkbook, { key: selectedTemplate.key, category: nextWorkbook.templateCategory, tags: parseTags(nextWorkbook.templateTags) });
    if (workbook.templateKey === selectedTemplate.key) {
      setWorkbook((current) => normalizeWorkbook({ ...current, templateName: newName, savedAt }));
    }
    await refreshTemplateSummaries();
  }

  async function deleteTemplate(templateKey = "") {
    if (typeof window === "undefined" || !templateKey) return { ok: false, message: "Choose a template to delete." };
    const templates = templateSummaries.length ? templateSummaries : await listStoredTemplates();
    const selectedTemplate = templates.find((template) => template.key === templateKey);
    if (!selectedTemplate) return { ok: false, message: "Template could not be found." };
    await deleteStoredTemplate(templateKey);
    if (workbook.templateKey === templateKey) {
      setWorkbook((current) => normalizeWorkbook({ ...current, templateKey: "", templateName: "" }));
    }
    await refreshTemplateSummaries();
    return { ok: true, message: "Template deleted." };
  }

  async function restoreTemplateVersion(templateKey = "", versionId = "") {
    if (typeof window === "undefined" || !templateKey || !versionId) return;
    const record = await loadStoredTemplateRecord(templateKey);
    const version = (record?.versions || []).find((item) => item.versionId === versionId);
    if (!version?.workbook) return;
    const savedAt = new Date().toISOString();
    const restoredWorkbook = sanitizeWorkbookForTemplate(version.workbook, {
      name: record.name,
      savedAt,
      category: record.category || "",
      tags: record.tags || [],
    });
    await saveStoredTemplate(record.name, { ...restoredWorkbook, templateKey, templateName: record.name }, { key: templateKey, category: record.category || "", tags: record.tags || [] });
    await refreshTemplateSummaries();
    return { ok: true, message: "Template version restored." };
  }

  async function loadTemplate(key) {
    if (typeof window === "undefined") return { ok: false, message: "Templates are not available here." };
    try {
      const templates = templateSummaries.length ? templateSummaries : await listStoredTemplates();
      if (!templates.length) {
        return { ok: false, message: "No saved templates yet." };
      }
      const selectedKey = key || promptForTemplateKey(templates);
      if (!selectedKey) return;
      const template = await loadStoredTemplate(selectedKey);
      if (!template) {
        return { ok: false, message: "Template could not be found." };
      }
      setWorkbook(normalizeWorkbook({ ...template, page: "dataInput" }));
      setLastSavedAt(template.savedAt || "");
      await saveStoredTemplatePointer(template.templateKey || selectedKey);
      await refreshTemplateSummaries();
      return { ok: true, message: "Template opened.", key: selectedKey };
    } catch {
      return { ok: false, message: "Template could not be opened." };
    }
  }

  async function refreshTemplateSummaries() {
    try {
      setTemplateSummaries(await listStoredTemplates());
    } catch {
      setTemplateSummaries([]);
    }
  }

  function loadJobFileText(text) {
    const parsed = JSON.parse(text);
    const workbookFromFile = parsed?.workbook || parsed;
    setWorkbook(normalizeWorkbook(workbookFromFile));
    setLastSavedAt(parsed?.savedAt || workbookFromFile?.savedAt || "");
  }

  const formulaRows = Array.isArray(workbook.formulaRows)
    ? workbook.formulaRows
    : createEstimateBuilderWorkbookDefaults().formulaRows || [];
  return {
    pages: ESTIMATE_BUILDER_PAGES,
    dataSections: V4_DATA_SECTIONS,
    dataInputSections,
    quoteSections,
    windowTypes: V4_WINDOW_TYPES,
    workbook,
    previewMode,
    preview,
    lineSearch,
    hideUnused,
    activeDataTab,
    lastSavedAt,
    templateSummaries,
    setLineSearch,
    setHideUnused,
    setActiveDataTab,
    setPage,
    toggleDataSection,
    updateData,
    updateDataRowMeta,
    addDataRow,
    deleteDataRow,
    updateFormula,
    updateFormulaNote,
    updateFormulaRowMeta,
    addFormulaRow,
    deleteFormulaRow,
    updateWindow,
    updateWindowRate,
    updateWindowDoorRange,
    updateWindowOption,
    doorScheduleRangeOptions,
    addWindow,
    deleteWindow,
    resetWindowsDoorsFromExcel,
    toggleQuoteSection,
    updateQuote,
    updateQuoteSectionMeta,
    updateSummaryAdjustment,
    updateClientPage,
    addQuoteLine,
    duplicateQuoteLine,
    moveQuoteLine,
    deleteQuoteLine,
    deleteQuoteSection,
    addQuoteSection,
    saveQuoteSectionOrder,
    requestPromoteFormula,
    requestPromoteRate,
    saveDraft,
    loadDraft,
    saveTemplate,
    saveTemplateAs,
    duplicateTemplate,
    renameTemplate,
    deleteTemplate,
    restoreTemplateVersion,
    refreshTemplateSummaries,
    loadTemplate,
    loadJobFileText,
  };
}

function initialWorkbook(initialValues = {}, options = {}) {
  if (options.previewMode) {
    return createBlankPreviewWorkbook(initialValues);
  }
  if (typeof window === "undefined") {
    return normalizeWorkbook(createEstimateBuilderWorkbookDefaults(initialValues));
  }
  try {
    const raw = window.localStorage.getItem("estimate-builder-active-draft");
    if (raw) return normalizeWorkbook(JSON.parse(raw));
  } catch {
    // Fall back to a clean template if the browser draft is invalid.
  }
  return normalizeWorkbook(createEstimateBuilderWorkbookDefaults(initialValues));
}

function createBlankPreviewWorkbook(initialValues = {}) {
  const workbook = normalizeWorkbook(createEstimateBuilderWorkbookDefaults(initialValues));
  return {
    ...workbook,
    page: "dataInput",
    data: Object.fromEntries(Object.entries(workbook.data || {}).map(([sectionKey, section]) => [
      sectionKey,
      {
        ...section,
        collapsed: false,
        rows: Object.fromEntries(Object.entries(section.rows || {}).map(([rowKey, row]) => [
          rowKey,
          { ...row, value: "", notes: "" },
        ])),
      },
    ])),
    windowsDoors: (workbook.windowsDoors || []).map((row) => ({
      ...row,
      code: "",
      quantity: "",
      width: "",
      height: "",
      area: "",
      totalArea: "",
      sillLength: "",
      architraveLength: "",
      rate: "",
      cost: "",
      notes: "",
    })),
    quotation: Object.fromEntries(Object.entries(workbook.quotation || {}).map(([sectionKey, section]) => [
      sectionKey,
      {
        ...section,
        collapsed: true,
        rows: (section.rows || []).map((row) => ({
          ...row,
          quantity: "",
          importedQuantity: "",
          importedCost: "",
          manualRate: "",
          supplierQuote: "",
          notes: "",
          autoQuantity: false,
          quantityManualOverride: false,
        })),
      },
    ])),
    formulaNotes: {},
    formulaHistory: [],
    quoteHistory: [],
    formulaPromotions: {},
    ratePromotions: [],
  };
}

function normalizeWorkbook(workbook = {}) {
  const defaults = createEstimateBuilderWorkbookDefaults();
  const migratedFormulaRows = normalizeFramedWallFormulaRows(workbook.formulaRows || [], workbook.formulas || {});
  const formulaRows = Array.isArray(workbook.formulaRows)
    ? ensureRequiredFormulaRows(migratedFormulaRows.rows, defaults.formulaRows || [])
    : defaults.formulaRows || [];
  const quotation = normalizeQuotation(workbook.quotation, defaults.quotation);
  return {
    ...defaults,
    ...workbook,
    data: normalizeDataSections(workbook.data, defaults.data),
    windowsDoors: normalizeWindowsDoors(workbook.windowsDoors, defaults.windowsDoors),
    quotation,
    quotationSectionOrder: normalizeQuoteSectionOrder(workbook.quotationSectionOrder || defaults.quotationSectionOrder || [], quotation),
    formulas: normalizeFormulas(defaults.formulas || {}, migratedFormulaRows.formulas),
    formulaNotes: { ...(defaults.formulaNotes || {}), ...(workbook.formulaNotes || {}) },
    formulaRows,
  };
}

function ensureRequiredFormulaRows(savedRows = [], defaultRows = []) {
  const existing = new Set(savedRows.map((row) => row?.key));
  const requiredRows = (defaultRows || []).filter((row) => row?.key && row.key.startsWith("quoteFloorSystem") && !existing.has(row.key));
  return [...savedRows, ...requiredRows];
}

function normalizeFormulas(defaultFormulas = {}, savedFormulas = {}) {
  const formulas = { ...defaultFormulas, ...savedFormulas };
  Object.entries(V4_DEFAULT_FORMULAS).forEach(([key, defaultFormula]) => {
    const saved = String(formulas[key] || "").trim();
    if (FRAMED_WALL_FORMULA_KEYS.has(key) || CORRECTED_DEFAULT_FORMULA_KEYS.has(key) || !saved || isStalePlatformFormula(key, saved)) {
      formulas[key] = defaultFormula;
    }
  });
  return formulas;
}

function normalizeFramedWallFormulaRows(rows = [], savedFormulas = {}) {
  const formulas = { ...(savedFormulas || {}) };
  const normalizedRows = [];
  rows.forEach((row) => {
    const canonicalKey = formulaKeyForLabel(row?.label);
    if (!canonicalKey) {
      normalizedRows.push(row);
      return;
    }
    const savedFormula = String(formulas[row.key] || "").trim();
    delete formulas[row.key];
    formulas[canonicalKey] = savedFormula || V4_DEFAULT_FORMULAS[canonicalKey];
  });
  FRAMED_WALL_FORMULA_KEYS.forEach((key) => {
    formulas[key] = V4_DEFAULT_FORMULAS[key];
  });
  WALL_LENGTH_TOTAL_FORMULA_KEYS.forEach((key) => {
    if (!String(formulas[key] || "").trim()) formulas[key] = V4_DEFAULT_FORMULAS[key];
  });
  PLASTERBOARD_FORMULA_KEYS.forEach((key) => {
    if (!String(formulas[key] || "").trim()) formulas[key] = V4_DEFAULT_FORMULAS[key];
  });
  return { rows: normalizedRows, formulas };
}

function formulaKeyForLabel(label) {
  return wallLengthTotalKeyForLabel(label) || plasterboardFormulaKeyForLabel(label) || framedWallFormulaKeyForLabel(label);
}

function plasterboardFormulaKeyForLabel(label) {
  const normalized = String(label || "").toLowerCase().replace(/\s+/g, " ").trim();
  return PLASTERBOARD_FORMULA_LABELS[normalized] || "";
}

function framedWallFormulaKeyForLabel(label) {
  const normalized = String(label || "").toLowerCase().replace(/\s+/g, " ").trim();
  return FRAMED_WALL_FORMULA_LABELS[normalized] || "";
}

const FRAMED_WALL_FORMULA_LABELS = {
  "total external 70mm framed wall lm": "totalExternal70mmWallsLm",
  "total external 90mm framed wall lm": "totalExternal90mmWallsLm",
  "total internal 70mm framed wall lm": "totalInternal70mmWallsLm",
  "total internal 90mm framed wall lm": "totalInternal90mmWallsLm",
};

const FRAMED_WALL_FORMULA_KEYS = new Set(Object.values(FRAMED_WALL_FORMULA_LABELS));

const CORRECTED_DEFAULT_FORMULA_KEYS = new Set([
  "lowerSlabAreaM2",
  "secondLevelFloorAreaM2",
  "thirdLevelFloorAreaM2",
  "slabFloorAreaM2",
  "groundFloorCeilingsM2",
  "secondFloorCeilingsM2",
  "thirdFloorCeilingsM2",
  "totalCeilingAreasM2",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "lowerExternalWallAreaM2",
  "upperExternalWallAreaM2",
  "thirdExternalWallAreaM2",
  "totalExternalWallAreaM2",
  "lowerWindowDoorDeductionsM2",
  "upperWindowDoorDeductionsM2",
  "thirdWindowDoorDeductionsM2",
  "lowerNetExternalWallAreaM2",
  "upperNetExternalWallAreaM2",
  "thirdNetExternalWallAreaM2",
  "netExternalWallAreaM2",
  "lowerExternalPlasterboardWallM2",
  "lowerInternalPlasterboardWallM2",
  "upperExternalPlasterboardWallM2",
  "upperInternalPlasterboardWallM2",
  "thirdExternalPlasterboardWallM2",
  "thirdInternalPlasterboardWallM2",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total90mmStudMaterialLm",
  "total90mmTimberFramingLm",
  "total90mmTimberLengthsEach",
  "lowerPlasterboardWallM2",
  "upperPlasterboardWallM2",
  "thirdPlasterboardWallM2",
  "plasterboardWallM2",
  "architraveLm",
  "architraveLengthsEach",
  "lowerSkirtingLm",
  "upperSkirtingLm",
  "thirdSkirtingLm",
  "skirtingLm",
]);

function isStalePlatformFormula(key, formula) {
  if (/\bC\d+\b/i.test(formula)) return true;
  if (/![A-Z]+\d+/i.test(formula)) return true;
  if (/\b(?:GroundLevel|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)WallsLm\b/.test(formula)) return true;
  if (/\b(?:GroundFloor|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)FramedWallLm\b/.test(formula)) return true;
  if (key === "corniceLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "skirtingLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "lowerSkirtingLm" && (formula === "lowerInternalWallsLm + lowerExternalWallsLm" || formula === "(lowerInternalWallsLm * 2) + lowerExternalWallsLm")) return true;
  if (key === "upperSkirtingLm" && (formula === "upperInternalWallsLm + upperExternalWallsLm" || formula === "(upperInternalWallsLm * 2) + upperExternalWallsLm")) return true;
  if (key === "thirdSkirtingLm" && (formula === "thirdInternalWallsLm + thirdExternalWallsLm" || formula === "(thirdInternalWallsLm * 2) + thirdExternalWallsLm")) return true;
  if (key === "skirtingLengthsEach" && formula === "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 1.15 / 5.4") return true;
  return false;
}

function normalizeWindowsDoors(savedRows, defaultRows = []) {
  if (!Array.isArray(savedRows)) return orderWindowDoorRows(normalizeHumeEntryDoorRows(defaultRows));
  const defaultById = new Map((defaultRows || []).map((row) => [String(row?.id || ""), row]));
  const defaultBySourceRow = new Map((defaultRows || []).map((row) => [String(row?.sourceRow || ""), row]));
  const normalizedSavedRows = savedRows.map((row) => {
    const fallback = defaultById.get(String(row?.id || "")) || defaultBySourceRow.get(String(row?.sourceRow || "")) || null;
    if (!fallback) return row;
    const missingCode = !String(row?.code || "").trim();
    return withWindowDoorApproximateRate(withDoorScheduleSelection({
      ...fallback,
      ...row,
      values: Array.isArray(row?.values) && row.values.some((value) => value !== "" && value !== null && value !== undefined)
        ? row.values
        : fallback.values,
      formulas: row?.formulas && Object.keys(row.formulas).length ? row.formulas : fallback.formulas,
      section: row?.section || fallback.section,
      type: row?.type || fallback.type,
      code: missingCode ? fallback.code : row.code,
      width: row?.width === "" || row?.width === undefined || row?.width === null ? fallback.width : row.width,
      height: row?.height === "" || row?.height === undefined || row?.height === null ? fallback.height : row.height,
      area: row?.area === "" || row?.area === undefined || row?.area === null ? fallback.area : row.area,
    }));
  });
  return orderWindowDoorRows(normalizeHumeEntryDoorRows(restoreMissingEntryDoorDefaults(normalizedSavedRows, defaultRows)));
}

function normalizeHumeEntryDoorRows(rows = []) {
  const legacyEntryRows = (rows || []).filter(isLegacyEntryDoorScheduleRow);
  const humeRows = (rows || []).filter((row) => isHumeEntryDoorRow(row) && !isLegacyEntryDoorScheduleRow(row));
  const remainingRows = (rows || []).filter((row) => !isLegacyEntryDoorScheduleRow(row) && !isHumeEntryDoorRow(row));
  const savedBySize = new Map(humeRows.map((row) => [humeEntryDoorSize(row), row]));
  const insertIndex = (rows || []).findIndex((row) => isLegacyEntryDoorScheduleRow(row) || isHumeEntryDoorRow(row));
  if (insertIndex < 0) return rows;
  const before = remainingRows.filter((row) => rows.indexOf(row) < insertIndex);
  const after = remainingRows.filter((row) => rows.indexOf(row) > insertIndex);
  return [
    ...before,
    ...humeEntryDoorRows(legacyEntryRows.length ? legacyEntryRows : humeRows).map((defaultRow) => withHumeEntryDoorSelection({
      ...defaultRow,
      ...(savedBySize.get(humeEntryDoorSize(defaultRow)) || {}),
      id: defaultRow.id,
      sourceRow: defaultRow.sourceRow,
      code: defaultRow.code,
      width: defaultRow.width,
      height: defaultRow.height,
      section: "Entry Doors",
      type: "Entry Door",
    })),
    ...supplementalEntryDoorRows(rows).filter((row) => !hasWindowDoorRow(after, row) && !hasWindowDoorRow(before, row)),
    ...after,
  ];
}

function restoreMissingEntryDoorDefaults(rows = [], defaultRows = []) {
  const existingRows = [...rows];
  const missingEntryDefaults = (defaultRows || []).filter((row) => (
    String(row?.section || "").toLowerCase().includes("entry doors")
    && !hasWindowDoorRow(existingRows, row)
  ));
  if (!missingEntryDefaults.length) return rows;
  const insertIndex = rows.findIndex((row) => String(row?.section || "").toLowerCase().includes("entry doors"));
  if (insertIndex < 0) return [...missingEntryDefaults, ...rows];
  return [
    ...rows.slice(0, insertIndex + 1),
    ...missingEntryDefaults,
    ...rows.slice(insertIndex + 1),
  ];
}

function hasWindowDoorRow(rows = [], target = {}) {
  const targetSource = target.sourceRow ?? target.importedWorkbookRow;
  return rows.some((row) => (
    (target.id && row?.id === target.id)
    || (targetSource !== undefined && String(row?.sourceRow ?? row?.importedWorkbookRow ?? "") === String(targetSource))
  ));
}

function windowDoorRowGroups(rows = []) {
  const groups = [];
  (rows || []).forEach((row) => {
    const label = row?.section || "Other Windows / Doors";
    let group = groups.find((item) => item.label === label);
    if (!group) {
      group = { label, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  });
  return groups;
}

function orderWindowDoorRows(rows = []) {
  return moveWindowDoorRowsAfterSource(rows, [98, 99, 100], 72);
}

function moveWindowDoorRowsAfterSource(rows = [], sourceRowsToMove = [], anchorSourceRow) {
  const moveSet = new Set(sourceRowsToMove.map((row) => String(row)));
  const movingRows = [];
  const remainingRows = [];
  (rows || []).forEach((row) => {
    const sourceRow = String(row?.sourceRow ?? row?.importedWorkbookRow ?? "");
    if (moveSet.has(sourceRow)) movingRows.push(row);
    else remainingRows.push(row);
  });
  if (!movingRows.length) return rows;
  movingRows.sort((a, b) => sourceRowsToMove.indexOf(Number(a?.sourceRow ?? a?.importedWorkbookRow)) - sourceRowsToMove.indexOf(Number(b?.sourceRow ?? b?.importedWorkbookRow)));
  const anchorIndex = remainingRows.findIndex((row) => String(row?.sourceRow ?? row?.importedWorkbookRow ?? "") === String(anchorSourceRow));
  if (anchorIndex < 0) return [...remainingRows, ...movingRows];
  return [
    ...remainingRows.slice(0, anchorIndex + 1),
    ...movingRows,
    ...remainingRows.slice(anchorIndex + 1),
  ];
}

function normalizeDataSections(savedData = {}, defaultData = {}) {
  const migratedRows = collectSavedRows(savedData);
  return Object.fromEntries(V4_DATA_SECTIONS.map((section) => {
    const savedSection = savedData?.[section.key] || {};
    const defaultSection = defaultData?.[section.key] || {};
    const savedRows = savedSection.rows && typeof savedSection.rows === "object" ? savedSection.rows : {};
    const defaultRows = defaultSection.rows && typeof defaultSection.rows === "object" ? defaultSection.rows : {};
    const customRows = Array.isArray(savedSection.customRows)
      ? savedSection.customRows.filter((row) => !formulaKeyForLabel(row?.label))
      : [];
    return [section.key, {
      ...defaultSection,
      ...savedSection,
      rows: { ...defaultRows, ...migratedRows, ...savedRows },
      customRows,
      hiddenRows: Array.isArray(savedSection.hiddenRows) ? savedSection.hiddenRows : [],
      collapsed: Boolean(savedSection.collapsed),
    }];
  }));
}

function normalizeQuotation(savedQuotation = {}, defaultQuotation = {}) {
  if (!savedQuotation || typeof savedQuotation !== "object") return defaultQuotation;
  const renamedEntries = renameRoofingMaterialsSection(Object.entries(savedQuotation));
  const mergedEntries = mergeJobSetOutLabourRows(mergeQuickRenderRowsIntoRendering(renameRoofingLabourSection(renamedEntries)));
  const orderedEntries = orderSavedQuotationSections(mergedEntries);
  const entries = insertManualLinenSections(insertCabinetMakerSection(insertStandardThreeDoorRobeSection(movePlastererQuoteRowToSupplyInstall(orderedEntries), defaultQuotation), defaultQuotation), defaultQuotation);
  const normalized = Object.fromEntries(entries
    .filter(([sectionName]) => !isRemovedQuoteSection(sectionName))
    .map(([sectionName, section]) => [normalizeSavedQuoteSectionName(sectionName), section])
    .map(([sectionName, section]) => {
    const defaultSection = defaultQuotation?.[sectionName] || defaultQuoteSectionByBaseName(defaultQuotation, sectionName) || {};
    const defaultRowsById = Object.fromEntries((defaultSection.rows || []).map((row) => [row.id, row]));
    const savedRows = quoteSectionBaseName(sectionName) === "appliance package" ? [] : section.rows || [];
    const rows = orderQuoteRows(removeRemovedImportedQuoteRows(removeRoofingMaterialsRemovedRows(sectionName, normalizeBulkEarthworksRows(sectionName, ensureRequiredDefaultQuoteRows(sectionName, removeMisplacedFloorFramingQuoteRows(sectionName, savedRows), defaultSection.rows || [])))));
    const normalizedRows = rows
      .filter((row) => !isRemovedQuoteSection(row.section))
      .map((row) => normalizeSavedQuoteRow(row, defaultRowsById));
    return [sectionName, {
      ...defaultSection,
      ...section,
      collapsed: quoteSectionBaseName(sectionName) === "face brickwork" ? true : section.collapsed,
      rows: normalizeSavedQuoteSectionRows(sectionName, normalizedRows),
    }];
  }));
  Object.entries(defaultQuotation || {}).forEach(([sectionName, section]) => {
    if (!isImportedFloorcoveringSectionName(sectionName) && !isImportedAppliancePackageSectionName(sectionName)) return;
    if (defaultQuoteSectionByBaseName(normalized, sectionName)) return;
    normalized[sectionName] = section;
  });
  return normalized;
}

function isImportedAppliancePackageSectionName(sectionName) {
  const baseName = quoteSectionBaseName(sectionName);
  return baseName === "appliance package" || baseName.startsWith("appliance package - ");
}

function isImportedFloorcoveringSectionName(sectionName) {
  return [
    "ceramic tiles",
    "porcelain tiles",
    "laminated flooring",
    "vinyl flooring",
    "hybrid flooring",
    "engeineered timber",
    "solid timber flooring",
    "carpets",
  ].includes(quoteSectionBaseName(sectionName));
}

function normalizeSavedQuoteRow(row, defaultRowsById = {}) {
  let next = normalizeSavedQuoteRowSection(row);
  next = cleanImportedQuoteValues(next);
  next = cleanImportedQuoteQuantity(next, defaultRowsById[row.id]);
  next = normalizeRenderingFirstRow(next);
  next = normalizeFrameStageLabourRow(next);
  next = normalizeLockupStageLabourRow(next);
  next = normalizeFixoutStageLabourRow(next);
  next = normalizeWafflePodSlabEstimatedCostRow(next);
  next = normalizePhysicalBarrierRow(next);
  next = normalizeWallFrameRows(next);
  next = normalizeQuoteRowsWithoutImportedData(next);
  next = normalizeBlankQuantityQuoteRow(next);
  next = normalizeDoorFurnitureRow(next);
  next = normalizePlasterSupplyInstallRow(next);
  next = normalizeCorniceSupplyInstallRow(next);
  next = normalizeWindowDoorArchitraveQuoteRow(next);
  next = normalizeSkirtingLmQuoteRow(next);
  next = normalizeFramingTimberTakeoffRow(next);
  next = normalizePainterQuoteRow(next);
  next = normalizeCleaningQuoteRow(next);
  next = normalizeAppliancePackageRow(next, defaultRowsById[row.id]);
  return normalizeFloorFramingQuoteRow(next);
}

function normalizeAppliancePackageRow(row, defaultRow = null) {
  if (!defaultRow?.applianceHeading && quoteSectionBaseName(row?.section) !== "appliance package") return row;
  return {
    ...row,
    ...(defaultRow?.applianceHeading ? {
      item: defaultRow.item,
      lineType: defaultRow.lineType,
      applianceHeading: defaultRow.applianceHeading,
      applianceHeadingLevel: defaultRow.applianceHeadingLevel,
      applianceBrand: defaultRow.applianceBrand,
      appliancePackage: defaultRow.appliancePackage,
      unit: "",
      excelRate: "",
      importedCost: "",
      sourceOfRate: "manual",
      notes: "",
    } : {
      applianceHeading: false,
      applianceHeadingLevel: 0,
      applianceBrand: defaultRow?.applianceBrand || row.applianceBrand || "",
      appliancePackage: defaultRow?.appliancePackage || row.appliancePackage || "",
    }),
  };
}

function normalizeSavedQuoteSectionRows(sectionName, rows = []) {
  if (TILING_MANUAL_QUOTE_SECTION_NAMES.has(quoteSectionBaseName(sectionName))) {
    return rows.map(normalizeQuoteRowWithoutImportedData);
  }
  if (quoteSectionBaseName(sectionName) === "waterproofing") {
    return rows.map(normalizeQuoteRowWithoutImportedData);
  }
  if (quoteSectionBaseName(sectionName) === "standard wardrobes complete (2.4m wide)") {
    return standardWardrobesCompleteRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(STANDARD_THREE_DOOR_ROBE_SECTION)) {
    return standardThreeDoorRobeRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(STANDARD_TWO_DOOR_LINEN_SECTION)) {
    return standardTwoDoorLinenRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(STANDARD_THREE_DOOR_LINEN_SECTION)) {
    return standardThreeDoorLinenRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_SECTION)) {
    return cabinetMakerRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_BUTLERS_PANTRY_SECTION)) {
    return cabinetMakerButlersPantryRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_LAUNDRY_SECTION)) {
    return cabinetMakerLaundryRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_BATHROOMS_SECTION)) {
    return cabinetMakerBathroomRows(rows, sectionName);
  }
  if (quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_WARDROBES_SECTION)) {
    return cabinetMakerWardrobeRows(rows, sectionName);
  }
  return rows;
}

function insertStandardThreeDoorRobeSection(entries = [], defaultQuotation = {}) {
  if (entries.some(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(STANDARD_THREE_DOOR_ROBE_SECTION))) return entries;
  const defaultSection = defaultQuoteSectionByBaseName(defaultQuotation, STANDARD_THREE_DOOR_ROBE_SECTION) || {
    collapsed: true,
    rows: standardThreeDoorRobeRows(),
  };
  const section = [STANDARD_THREE_DOOR_ROBE_SECTION, defaultSection];
  const wardrobeIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "standard wardrobes complete (2.4m wide)");
  if (wardrobeIndex < 0) return [...entries, section];
  return [...entries.slice(0, wardrobeIndex + 1), section, ...entries.slice(wardrobeIndex + 1)];
}

function insertManualLinenSections(entries = [], defaultQuotation = {}) {
  const filtered = entries.filter(([sectionName]) => !OLD_LINEN_AND_ROBE_DOOR_SECTIONS.has(quoteSectionBaseName(sectionName)));
  const withoutNew = filtered.filter(([sectionName]) => ![
    quoteSectionBaseName(STANDARD_TWO_DOOR_LINEN_SECTION),
    quoteSectionBaseName(STANDARD_THREE_DOOR_LINEN_SECTION),
  ].includes(quoteSectionBaseName(sectionName)));
  const twoDoorDefault = defaultQuoteSectionByBaseName(defaultQuotation, STANDARD_TWO_DOOR_LINEN_SECTION) || {
    collapsed: true,
    rows: standardTwoDoorLinenRows(),
  };
  const threeDoorDefault = defaultQuoteSectionByBaseName(defaultQuotation, STANDARD_THREE_DOOR_LINEN_SECTION) || {
    collapsed: true,
    rows: standardThreeDoorLinenRows(),
  };
  const sections = [
    [STANDARD_TWO_DOOR_LINEN_SECTION, twoDoorDefault],
    [STANDARD_THREE_DOOR_LINEN_SECTION, threeDoorDefault],
  ];
  const robeIndex = withoutNew.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(STANDARD_THREE_DOOR_ROBE_SECTION));
  if (robeIndex >= 0) return [...withoutNew.slice(0, robeIndex + 1), ...sections, ...withoutNew.slice(robeIndex + 1)];
  const wardrobeIndex = withoutNew.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "standard wardrobes complete (2.4m wide)");
  if (wardrobeIndex >= 0) return [...withoutNew.slice(0, wardrobeIndex + 1), ...sections, ...withoutNew.slice(wardrobeIndex + 1)];
  return [...withoutNew, ...sections];
}

function insertCabinetMakerSection(entries = [], defaultQuotation = {}) {
  const childBaseNames = [
    quoteSectionBaseName(CABINET_MAKER_BUTLERS_PANTRY_SECTION),
    quoteSectionBaseName(CABINET_MAKER_LAUNDRY_SECTION),
    quoteSectionBaseName(CABINET_MAKER_BATHROOMS_SECTION),
    quoteSectionBaseName(CABINET_MAKER_WARDROBES_SECTION),
  ];
  const existingCabinet = entries.find(([sectionName, section]) => quoteSectionBaseName(sectionName) === "cabinet maker" && isNewCabinetMakerSection(section));
  const existingButlersPantry = entries.find(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_BUTLERS_PANTRY_SECTION));
  const existingLaundry = entries.find(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_LAUNDRY_SECTION));
  const existingBathrooms = entries.find(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_BATHROOMS_SECTION));
  const existingWardrobes = entries.find(([sectionName]) => quoteSectionBaseName(sectionName) === quoteSectionBaseName(CABINET_MAKER_WARDROBES_SECTION));
  const filtered = entries.filter(([sectionName]) => {
    const baseName = quoteSectionBaseName(sectionName);
    if (baseName === "cabinet maker" || childBaseNames.includes(baseName)) return false;
    return !OLD_CABINET_MAKER_SECTIONS.has(baseName);
  });
  const defaultCabinetSection = defaultQuoteSectionByBaseName(defaultQuotation, CABINET_MAKER_SECTION);
  const defaultSection = existingCabinet?.[1]
    ? { ...existingCabinet[1], rows: cabinetMakerRows(existingCabinet[1].rows || [], CABINET_MAKER_SECTION) }
    : defaultCabinetSection
      ? { ...defaultCabinetSection, rows: cabinetMakerRows(defaultCabinetSection.rows || [], CABINET_MAKER_SECTION) }
      : {
          collapsed: true,
          rows: cabinetMakerRows(),
        };
  const sections = [
    [CABINET_MAKER_SECTION, defaultSection],
    [CABINET_MAKER_BUTLERS_PANTRY_SECTION, existingButlersPantry?.[1] || defaultQuoteSectionByBaseName(defaultQuotation, CABINET_MAKER_BUTLERS_PANTRY_SECTION) || { collapsed: true, rows: cabinetMakerButlersPantryRows() }],
    [CABINET_MAKER_LAUNDRY_SECTION, existingLaundry?.[1] || defaultQuoteSectionByBaseName(defaultQuotation, CABINET_MAKER_LAUNDRY_SECTION) || { collapsed: true, rows: cabinetMakerLaundryRows() }],
    [CABINET_MAKER_BATHROOMS_SECTION, existingBathrooms?.[1] || defaultQuoteSectionByBaseName(defaultQuotation, CABINET_MAKER_BATHROOMS_SECTION) || { collapsed: true, rows: cabinetMakerBathroomRows() }],
    [CABINET_MAKER_WARDROBES_SECTION, existingWardrobes?.[1] || defaultQuoteSectionByBaseName(defaultQuotation, CABINET_MAKER_WARDROBES_SECTION) || { collapsed: true, rows: cabinetMakerWardrobeRows() }],
  ];
  const groupEndIndex = filtered.findLastIndex(([sectionName]) => [
    "fix out materials",
    "shelving",
    "standard wardrobes complete (2.4m wide)",
    "standard 3 door robe up to 3.6m wide",
    "standard 2 door linen up to 2.4m wide",
    "standard 3 door linen up to 3.6m wide",
  ].includes(quoteSectionBaseName(sectionName)));
  if (groupEndIndex >= 0) return [...filtered.slice(0, groupEndIndex + 1), ...sections, ...filtered.slice(groupEndIndex + 1)];
  return [...sections, ...filtered];
}

function isNewCabinetMakerSection(section) {
  return (section?.rows || []).some((row) => {
    const rowNumber = quoteRowSourceNumber(row);
    return rowNumber >= 1424 && rowNumber < 1425;
  });
}

function movePlastererQuoteRowToSupplyInstall(entries = []) {
  return entries.map(([sectionName, section]) => {
    if (quoteSectionBaseName(sectionName) !== "plasterer - supply and install") return [sectionName, section];
    return [sectionName, {
      ...section,
      rows: insertRowsBefore(
        (section.rows || []).filter((row) => row?.id !== "quote-plaster-supply-install"),
        [plasterSupplyInstallQuoteRow()],
        "quote-1269"
      ),
    }];
  });
}

function plasterSupplyInstallQuoteRow() {
  return {
    id: "quote-plaster-supply-install",
    excelRow: 1268.9,
    importedWorkbookRow: false,
    section: "PLASTERER - SUPPLY AND INSTALL",
    values: ["PLASTER - SUPPLY AND INSTALL", "", "", "QUOTE", "", "", ""],
    formulas: {},
    item: "PLASTER - SUPPLY AND INSTALL",
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "QUOTE",
    excelRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "manual",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "PLASTER - SUPPLY AND INSTALL",
    notes: "",
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function standardWardrobesCompleteRows(existingRows = [], sectionName = "STANDARD WARDROBES COMPLETE (2.4M WIDE)") {
  const rows = [
    { sourceRow: 1371, item: "COMPLETE ROBE UP TO 2.4 WIDE", quantity: "", unit: "EACH", rate: "$723.47" },
    { sourceRow: 1372, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1373, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1374, item: "1 SHELF @ 1700 WITH HANGING RAIL", quantity: "", unit: "EACH", rate: "$89.10" },
    { sourceRow: 1375, item: "2 DOORS SPACE SAVER MIRROR DOORS", quantity: "", unit: "EACH", rate: "$389.00" },
    { sourceRow: 1376, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$199.00" },
    { sourceRow: 1377, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$247.00" },
    { sourceRow: 1378, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => standardWardrobesCompleteRow(existingRows, sectionName, row));
}

function standardWardrobesCompleteRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, row);
}

function cabinetMakerRows(existingRows = [], sectionName = CABINET_MAKER_SECTION) {
  const rows = [
    { sourceRow: 1424.01, item: "KITCHEN", heading: true },
    { sourceRow: 1424.02, item: "KITCHEN CABINETS BASE - STD COLOUR BOARD - LAMINATED TOPS", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.03, item: "1200mm SINK CUPBOARD - STD COLOUR BOARD", unit: "LM", rate: "$1,800.00" },
    { sourceRow: 1424.04, item: "600mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.05, item: "900mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,000.00" },
    { sourceRow: 1424.06, item: "ISLAND CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,700.00" },
    { sourceRow: 1424.07, item: "CORNER BASE CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.08, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.09, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.091, item: "STANDARD 600mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.092, item: "STANDARD 900mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.093, item: "SPECIALTY CANOPY RANGEHOOD CUPBOARD", unit: "ITEM", rate: "" },
    { sourceRow: 1424.094, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.095, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.096, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.1, item: "KITCHEN OVEN TOWER", unit: "ITEM", rate: "$1,700.00" },
    { sourceRow: 1424.11, item: "MICROWAVE UNDERBENCH CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,300.00" },
    { sourceRow: 1424.12, item: "POT DRAWS SET OF 2 - STD COLOURBOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.13, item: "900mm 3 DRAWER CUPBOARD 2 LGE & 1 SML - STD COLOUR BRD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.14, item: "4 DRAWER CUTLERY CUPBOARD - STD COLOURBOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.15, item: "600mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.16, item: "900mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.17, item: "1200mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.18, item: "1200mm CORNER WALK IN PANTRY - STD COLOURBOARD", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.19, item: "1500mm HIDE AWAY PANTRY - STD COLOURBOARD", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.2, item: "FRIDGE OVERHEAD CUPBOARD INC SIDE PANELS - STD COLOUR BRD", unit: "ITEM", rate: "$900.00" },
    { sourceRow: 1424.21, item: "RAISED SERVERY BACK PANEL AND TOP - STD COLOUR BOARD", unit: "LM", rate: "$200.00" },
    { sourceRow: 1424.22, item: "BASE CUPBOARD END PANELS", unit: "ITEM", rate: "$80.00" },
    { sourceRow: 1424.23, item: "TALL END PANELS", unit: "ITEM", rate: "$160.00" },
    { sourceRow: 1424.24, item: "UPGRADE TO SOFT CLOSE DRAWERS", unit: "EACH", rate: "$100.00" },
    { sourceRow: 1424.25, item: "UPGRADE TO 20mm STONE TOPS", unit: "ITEM", rate: "$120.00" },
    { sourceRow: 1424.26, item: "UPGRADE TO 40mm STONE TOPS", unit: "ITEM", rate: "$200.00" },
    { sourceRow: 1424.27, item: "UPGRADE TO SPECIALTY STONE FEATURE", unit: "ITEM", rate: "" },
    { sourceRow: 1424.28, item: "20mm WATERFALL ENDS", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.29, item: "40mm WATERFALL ENDS", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.3, item: "SPECIALTY ISLAND CUPBOARD FEATURES", unit: "ITEM", rate: "" },
    { sourceRow: 1424.31, item: "300mm DEEP 900mm BACK OF ISLAND BENCH CUPBOARDS", unit: "ITEM", rate: "$700.00" },
    { sourceRow: 1424.32, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.33, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.34, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.35, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.48, item: "BATHROOMS", heading: true }, { sourceRow: 1424.49, item: "VANITY UNITS 900mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,000.00" }, { sourceRow: 1424.5, item: "VANITY UNITS 1200mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,200.00" }, { sourceRow: 1424.51, item: "VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,500.00" }, { sourceRow: 1424.52, item: "DOUBLE VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,800.00" }, { sourceRow: 1424.53, item: "DOUBLE VANITY UNITS 1800mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,000.00" }, { sourceRow: 1424.54, item: "DOUBLE VANITY UNITS 2100mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,100.00" }, { sourceRow: 1424.55, item: "DOUBLE VANITY UNITS 2400mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,400.00" }, { sourceRow: 1424.56, item: "EXTEND VANITY TOP OVER BATH", unit: "ITEM", rate: "$80.00" }, { sourceRow: 1424.57, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" }, { sourceRow: 1424.58, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" }, { sourceRow: 1424.59, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" }, { sourceRow: 1424.6, item: "MISC CABINETRY", unit: "ITEM", rate: "" }, { sourceRow: 1424.61, item: "TOTAL BATHOOM COSTS", total: true },
    { sourceRow: 1424.62, item: "WARDROBES", heading: true }, { sourceRow: 1424.63, item: "MELAMINE TOP SHELF WITH HANGING RAIL", unit: "LM", rate: "$120.00" }, { sourceRow: 1424.64, item: "BANK OF 3 DRAWERS AND 3 SHELVES", unit: "ITEM", rate: "$800.00" }, { sourceRow: 1424.65, item: "WIR STD DOUBLE HANGING RAIL CUPBOAD (NO KICK)", unit: "LM", rate: "$150.00" }, { sourceRow: 1424.66, item: "WIR DOUBLE HANGING RAIL CUPBOAD w KICK AND BOTTOM SHELF", unit: "LM", rate: "$320.00" }, { sourceRow: 1424.67, item: "1700mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$1,500.00" }, { sourceRow: 1424.68, item: "2000mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$2,000.00" }, { sourceRow: 1424.69, item: "CORNER ROBE CUPBOARD", unit: "ITEM", rate: "$1,200.00" }, { sourceRow: 1424.7, item: "STAND ALONE DISPLAY CABINET - SOLID TOPS", unit: "ITEM", rate: "$2,500.00" }, { sourceRow: 1424.71, item: "STAND ALONE DISPLAY CABINET - GLASS CUT-OUT TOPS", unit: "ITEM", rate: "$3,000.00" }, { sourceRow: 1424.72, item: "ALLOWANCE FOR LED LIGHTING", unit: "LM", rate: "$90.00" }, { sourceRow: 1424.73, item: "MISC EXTRAS", unit: "ITEM", rate: "" }, { sourceRow: 1424.74, item: "TOTAL WARDROBES COSTS", total: true }, { sourceRow: 1424.75, item: "MISCELLANEOUS CABINETRY", heading: true }, { sourceRow: 1424.76, item: "EXTRA MISC CABINETRY - ALLOWANCE", unit: "ITEM", rate: "" }, { sourceRow: 1424.77, item: "TOTAL CABINET MAKER COSTS", total: true },
  ];
  const kitchenRows = rows.filter((row) => row.sourceRow < 1424.37 || row.sourceRow >= 1424.75);
  return kitchenRows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerButlersPantryRows(existingRows = [], sectionName = CABINET_MAKER_BUTLERS_PANTRY_SECTION) {
  const rows = [
    { sourceRow: 1424.36, item: "BUTLERS PANTRY", heading: true },
    { sourceRow: 1424.361, item: "KITCHEN CABINETS BASE - STD COLOUR BOARD - LAMINATED TOPS", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.362, item: "1200mm SINK CUPBOARD - STD COLOUR BOARD", unit: "LM", rate: "$1,800.00" },
    { sourceRow: 1424.363, item: "600mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.364, item: "900mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,000.00" },
    { sourceRow: 1424.365, item: "CORNER BASE CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.366, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.367, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.368, item: "STANDARD 600mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.369, item: "STANDARD 900mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.3701, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.371, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.372, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.373, item: "MICROWAVE UNDERBENCH CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,300.00" },
    { sourceRow: 1424.374, item: "POT DRAWS SET OF 2 - STD COLOURBOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.375, item: "900mm 3 DRAWER CUPBOARD 2 LGE & 1 SML - STD COLOUR BRD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.376, item: "4 DRAWER CUTLERY CUPBOARD - STD COLOURBOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.377, item: "600mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.378, item: "900mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.379, item: "1200mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.3801, item: "5 SHELF OPEN SHELVES CABIENTRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.381, item: "5 SHELF MELAMINE OPEN SHELVES CLEATED", unit: "ITEM", rate: "" },
    { sourceRow: 1424.382, item: "UPGRADE TO SOFT CLOSE DRAWERS", unit: "EACH", rate: "$100.00" },
    { sourceRow: 1424.383, item: "UPGRADE TO 20mm STONE TOPS", unit: "ITEM", rate: "$120.00" },
    { sourceRow: 1424.384, item: "UPGRADE TO 40mm STONE TOPS", unit: "ITEM", rate: "$200.00" },
    { sourceRow: 1424.385, item: "UPGRADE TO SPECIALTY STONE FEATURE", unit: "ITEM", rate: "" },
    { sourceRow: 1424.386, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.387, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.388, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.389, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerLaundryRows(existingRows = [], sectionName = CABINET_MAKER_LAUNDRY_SECTION) {
  const rows = [
    { sourceRow: 1424.37, item: "LAUNDRY", heading: true },
    { sourceRow: 1424.38, item: "LAUNDRY CABINETS BASE - STD COLOUR BOARD", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.39, item: "1000mm TUB CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.4, item: "LAUNDRY BROOM CLOSET 900mm - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.41, item: "LAUNDRY BROOM CLOSET 1200mm - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.42, item: "TOPS OVER UB WASHER AND DRYER", unit: "LM", rate: "$80.00" },
    { sourceRow: 1424.43, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.44, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.45, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.46, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.47, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.471, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.472, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.473, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.474, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerBathroomRows(existingRows = [], sectionName = CABINET_MAKER_BATHROOMS_SECTION) {
  const rows = [
    { sourceRow: 1424.48, item: "BATHROOMS", heading: true },
    { sourceRow: 1424.49, item: "VANITY UNITS 900mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,000.00" },
    { sourceRow: 1424.5, item: "VANITY UNITS 1200mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,200.00" },
    { sourceRow: 1424.51, item: "VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,500.00" },
    { sourceRow: 1424.52, item: "DOUBLE VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,800.00" },
    { sourceRow: 1424.53, item: "DOUBLE VANITY UNITS 1800mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,000.00" },
    { sourceRow: 1424.54, item: "DOUBLE VANITY UNITS 2100mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,100.00" },
    { sourceRow: 1424.55, item: "DOUBLE VANITY UNITS 2400mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,400.00" },
    { sourceRow: 1424.56, item: "EXTEND VANITY TOP OVER BATH", unit: "ITEM", rate: "$80.00" },
    { sourceRow: 1424.57, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.58, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.59, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.6, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.61, item: "TOTAL BATHOOM COSTS", total: true },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerWardrobeRows(existingRows = [], sectionName = CABINET_MAKER_WARDROBES_SECTION) {
  const rows = [
    { sourceRow: 1424.62, item: "WARDROBES", heading: true },
    { sourceRow: 1424.63, item: "MELAMINE TOP SHELF WITH HANGING RAIL", unit: "LM", rate: "$120.00" },
    { sourceRow: 1424.64, item: "BANK OF 3 DRAWERS AND 3 SHELVES", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.65, item: "WIR STD DOUBLE HANGING RAIL CUPBOAD (NO KICK)", unit: "LM", rate: "$150.00" },
    { sourceRow: 1424.66, item: "WIR DOUBLE HANGING RAIL CUPBOAD w KICK AND BOTTOM SHELF", unit: "LM", rate: "$320.00" },
    { sourceRow: 1424.67, item: "1700mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.68, item: "2000mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.69, item: "CORNER ROBE CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.7, item: "STAND ALONE DISPLAY CABINET - SOLID TOPS", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.71, item: "STAND ALONE DISPLAY CABINET - GLASS CUT-OUT TOPS", unit: "ITEM", rate: "$3,000.00" },
    { sourceRow: 1424.72, item: "ALLOWANCE FOR LED LIGHTING", unit: "LM", rate: "$90.00" },
    { sourceRow: 1424.73, item: "MISC EXTRAS", unit: "ITEM", rate: "" },
    { sourceRow: 1424.74, item: "TOTAL WARDROBES COSTS", total: true },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, { ...row, quantity: "", unit: row.heading || row.total ? "" : row.unit, rate: row.heading || row.total ? "" : row.rate, forceItem: true, cabinetMakerTotalRow: Boolean(row.total) });
}

function standardTwoDoorLinenRows(existingRows = [], sectionName = STANDARD_TWO_DOOR_LINEN_SECTION) {
  const rows = [
    { sourceRow: 1379, item: "COMPLETE LINEN UP TO 2.4 WIDE", quantity: "", unit: "EACH", rate: "$730.35" },
    { sourceRow: 1380, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1381, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1382, item: "4 STANDARD SHELVES", quantity: "", unit: "EACH", rate: "$201.60" },
    { sourceRow: 1383, item: "VINYL", quantity: "", unit: "EACH", rate: "$389.00", forceItem: true },
    { sourceRow: 1384, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$199.00" },
    { sourceRow: 1385, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$247.00" },
    { sourceRow: 1386, item: "1 X EXTRA SHELF", quantity: "", unit: "EACH", rate: "$50.40" },
    { sourceRow: 1387, item: "BROOM PARTITION", quantity: "", unit: "EACH", rate: "$39.75" },
  ];
  return rows.map((row) => manualReplacementQuoteRow(existingRows, sectionName, row));
}

function standardThreeDoorLinenRows(existingRows = [], sectionName = STANDARD_THREE_DOOR_LINEN_SECTION) {
  const rows = [
    { sourceRow: 1388, item: "COMPLETE LINEN UP TO 3.6M WIDE", quantity: "", unit: "EACH", rate: "$1,004.27" },
    { sourceRow: 1389, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1390, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1391, item: "4 STANDARD SHELVES", quantity: "", unit: "EACH", rate: "$302.40" },
    { sourceRow: 1392, item: "VINYL", quantity: "", unit: "EACH", rate: "$583.50", forceItem: true },
    { sourceRow: 1393, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$298.50" },
    { sourceRow: 1394, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$370.50" },
    { sourceRow: 1395, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => manualReplacementQuoteRow(existingRows, sectionName, row));
}

function manualReplacementQuoteRow(existingRows, sectionName, row) {
  const existing = existingRows.find((candidate) => quoteRowSourceNumber(candidate) === row.sourceRow) || {};
  const preserve = canPreserveManualReplacement(existing);
  const item = row.forceItem ? row.item : (preserve ? (existing.item || existing.values?.[0] || row.item) : row.item);
  const quantity = preserve ? (existing.quantity ?? existing.values?.[1] ?? "") : row.quantity;
  const unit = preserve ? (existing.unit || existing.values?.[3] || row.unit) : row.unit;
  const excelRate = preserve ? (existing.excelRate || existing.values?.[5] || row.rate) : row.rate;
  const manualRate = preserve ? (existing.manualRate || "") : "";
  const supplierQuote = preserve ? (existing.supplierQuote || "") : "";
  const notes = preserve ? (existing.notes || "") : "";
  return {
    ...existing,
    id: `quote-${row.sourceRow}`,
    excelRow: row.sourceRow,
    importedWorkbookRow: false,
    section: sectionName,
    values: [item, quantity, "", unit, "", excelRate, ""],
    formulas: { G: `B${row.sourceRow}*F${row.sourceRow}` },
    item,
    quantity,
    importedQuantity: "",
    quantityKey: "",
    unit,
    excelRate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate,
    supplierQuote,
    sourceOfRate: manualRate ? "manual" : (excelRate ? "workbook" : "manual"),
    quoteRequired: false,
    autoQuantity: false,
    quantityManualOverride: false,
    cabinetMakerTotalRow: Boolean(row.cabinetMakerTotalRow),
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes,
  };
}

function canPreserveManualReplacement(existing) {
  return Boolean(
    existing?.id
    && existing.importedWorkbookRow === false
    && !existing.importedQuantity
    && !existing.quantityKey
    && !String(existing.notes || "").toUpperCase().includes("IMPORTED DATA")
  );
}

function standardThreeDoorRobeRows(existingRows = [], sectionName = STANDARD_THREE_DOOR_ROBE_SECTION) {
  const rows = [
    { sourceRow: 1378.1, item: "COMPLETE ROBE UP TO 3.6M WIDE", quantity: "", unit: "EACH", rate: "$943.55" },
    { sourceRow: 1378.2, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1378.3, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1378.4, item: "1 SHELF @ 1700 WITH HANGING RAIL", quantity: "", unit: "EACH", rate: "$114.60" },
    { sourceRow: 1378.5, item: "3 DOORS SPACE SAVER MIRROR DOORS", quantity: "", unit: "EACH", rate: "$562.20" },
    { sourceRow: 1378.6, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$298.50" },
    { sourceRow: 1378.7, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$370.50" },
    { sourceRow: 1378.8, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => standardThreeDoorRobeRow(existingRows, sectionName, row));
}

function standardThreeDoorRobeRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, row);
}

function normalizeFloorFramingQuoteRow(row) {
  const specs = {
    "quote-593.1": ["GROUND FLOOR FRAMING QUOTE", "QUOTE", "", ""],
    "quote-593.2": ["SECOND FLOOR FRAMING QUOTE", "QUOTE", "", ""],
    "quote-593.3": ["THIRD FLOOR FRAMING QUOTE", "QUOTE", "", ""],
    "quote-593.4": ["GROUND FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", "M2", "$180.00", "quoteFloorSystemGround300M2"],
    "quote-593.5": ["GROUND FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", "M2", "$220.00", "quoteFloorSystemGround360M2"],
    "quote-593.6": ["SECOND FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", "M2", "$180.00", "quoteFloorSystemSecond300M2"],
    "quote-593.7": ["SECOND FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", "M2", "$220.00", "quoteFloorSystemSecond360M2"],
    "quote-593.8": ["THIRD FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", "M2", "$180.00", "quoteFloorSystemThird300M2"],
    "quote-593.9": ["THIRD FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", "M2", "$220.00", "quoteFloorSystemThird360M2"],
  };
  const spec = specs[String(row?.id || "")];
  if (!spec) return row;
  const [item, unit, rate, quantityKey] = spec;
  return {
    ...row,
    item,
    rawText: item,
    values: [item, "", "", unit, "", rate, ""],
    formulas: {},
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit,
    excelRate: rate,
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? "workbook" : "rate missing",
    notes: quantityKey ? "IMPORTED DATA" : "",
    autoQuantity: Boolean(quantityKey),
    quantityManualOverride: false,
  };
}

function normalizeFramingTimberTakeoffRow(row) {
  const specs = {
    "quote-492.1": ["70 x 35 MPG 12 STUD MATERIAL 5.4 LENGTHS", "ceil(TotalStudMaterial70mmLm / 5.4)", "$35.65"],
    "quote-492.2": ["90 x 35 MPG 12 STUD MATERIAL 5.4 LENGTHS", "ceil(TotalStudMaterial90mmLm / 5.4)", "$45.90"],
    "quote-492.3": ["70 x 35 MPG 12 PLATE MATERIAL 5.4 LENGTHS", "ceil(TotalPlatesNogginsMaterial70mmLm / 5.4)", "$35.65"],
    "quote-492.4": ["90 x 35 MPG 12 PLATE MATERIAL 5.4 LENGTHS", "ceil(TotalPlatesNogginsMaterial90mmLm / 5.4)", "$45.90"],
  };
  const spec = specs[String(row?.id || "")];
  if (!spec) return row;
  const [item, quantityFormula, rate] = spec;
  return {
    ...row,
    item,
    rawText: item,
    values: [item, "", "", "LENGTHS", "", rate, ""],
    formulas: { ...(row.formulas || {}), B: quantityFormula },
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "LENGTHS",
    excelRate: rate,
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    notes: "IMPORTED DATA",
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function normalizeWallFrameRows(row) {
  if (String(row?.id || "") === "quote-489") {
    return normalizeWallFrameQuoteRow(row, "70mm EXTERIOR WALLS FRAMES", "totalExternal70mmWallsLm", "$55.00");
  }
  if (String(row?.id || "") === "quote-490") {
    return normalizeWallFrameQuoteRow(row, "90MM EXTERIOR WALLS FRAMES", "totalExternal90mmWallsLm", "$68.00");
  }
  if (String(row?.id || "") === "quote-642") {
    return normalizeWallFrameQuoteRow(row, "70mm INTERNAL WALL FRAMES", "totalInternal70mmWallsLm", "$42.00");
  }
  if (String(row?.id || "") === "quote-643") {
    return normalizeWallFrameQuoteRow(row, "90mm INTERNAL WALL FRAMES", "totalInternal90mmWallsLm", "$52.00");
  }
  return row;
}

function normalizeWallFrameQuoteRow(row, item, quantityKey, excelRate) {
  return {
    ...normalizeLinkedQuoteRowItem(row, item, quantityKey),
    unit: "LM",
    excelRate,
    manualRate: "",
    sourceOfRate: "workbook",
    values: Array.isArray(row.values) ? [item, "", "", "LM", "", excelRate, ""] : row.values,
  };
}

function normalizePhysicalBarrierRow(row) {
  const item = String(row?.item || row?.values?.[0] || "").trim().toLowerCase();
  if (String(row?.id || "") !== "quote-474" && !item.includes("physical barrier")) return row;
  return {
    ...normalizeQuoteRowItem(row, row?.item || "PEREMETER PHYSICAL BARRIER"),
    quantity: "",
    importedQuantity: "",
    quantityKey: "lowerExternalWallsLm",
    unit: "LM",
    autoQuantity: true,
    quantityManualOverride: false,
    values: Array.isArray(row.values) ? [row.item || row.values[0] || "PEREMETER PHYSICAL BARRIER", "", "", "LM", "", row.excelRate || row.values[5] || "", ""] : row.values,
  };
}

function normalizeWafflePodSlabEstimatedCostRow(row) {
  const item = String(row?.item || row?.values?.[0] || "").trim();
  if (item.toLowerCase() !== "estimated cost for waffle pod slab") return row;
  return {
    ...normalizeQuoteRowItem(row, "ESTIMATED COST FOR WAFFLE POD SLAB"),
    quantity: "",
    importedQuantity: "",
    quantityKey: "lowerSlabAreaM2",
    unit: "M2",
    excelRate: "",
    manualRate: "",
    supplierQuote: "",
    importedCost: "",
    sourceOfRate: "manual",
    autoQuantity: true,
    quantityManualOverride: false,
    values: ["ESTIMATED COST FOR WAFFLE POD SLAB", "", "", "M2", "", "", ""],
  };
}

function normalizeFrameStageLabourRow(row) {
  if (quoteSectionBaseName(row?.section) !== "frame stage labour") return row;
  if (String(row?.id || "") === "quote-80") return normalizeQuoteRowItem(row, "INSTALL CEILING BATTENS GROUND FLOOR");
  if (String(row?.id || "") === "quote-30039") return normalizeLinkedQuoteRowItem(row, "ADD FOR THIRD STOREY WINDOWS", "quoteFrameThirdStoreyWindows");
  if (String(row?.id || "") === "quote-78") return normalizeLinkedQuoteRowItem(row, "ADD FOR SECOND STOREY TRUSSES", "quoteFrameSecondStoreyTrusses");
  if (String(row?.id || "") === "quote-30040") return normalizeLinkedQuoteRowItem(row, "ADD FOR THIRD STOREY TRUSSES", "quoteFrameThirdStoreyTrusses");
  if (String(row?.id || "") === "quote-88") return normalizeQuoteRowItem(row, "TIE DOWN & SHEET BRACING GROUND LEVEL");
  if (String(row?.id || "") === "quote-90") return normalizeQuoteRowItem(row, "LABOUR - STAND EXTERIOR WALLS - GROUND FLOOR");
  if (String(row?.id || "") === "quote-91") return normalizeQuoteRowItem(row, "LABOUR - EXTERIOR WALLS - SECOND LEVEL");
  if (String(row?.id || "") === "quote-93") return normalizeQuoteRowItem(row, "LABOUR - INTERIOR WALLS - SECOND LEVEL");
  if (String(row?.id || "") === "quote-98") return { ...normalizeLinkedQuoteRowItem(row, "LABOUR TO INSTALL FLOOR JOISTS", "quoteFrameFloorJoistsSecondM2"), unit: "M2" };
  if (String(row?.id || "") === "quote-99") return normalizeLinkedQuoteRowItem(row, "LABOUR TO LAY SHEET FLOORING", "quoteFrameSheetFlooringSecondM2");
  if (String(row?.id || "") === "quote-30041") return normalizeLinkedQuoteRowItem(row, "LABOUR TO INSTALL FLOOR JOISTS THIRD LEVEL", "quoteFrameFloorJoistsThirdM2");
  if (String(row?.id || "") === "quote-30042") return normalizeLinkedQuoteRowItem(row, "LABOUR TO LAY SHEET FLOORING THIRD LEVEL", "quoteFrameSheetFlooringThirdM2");
  return row;
}

function normalizeLockupStageLabourRow(row) {
  if (quoteSectionBaseName(row?.section) !== "lock-up stage labour") return row;
  if (String(row?.id || "") === "quote-115" || quoteRowSourceNumber(row) === 115) return normalizeLinkedQuoteRowItem(row, "LINE EAVES - FLAT", "totalEavesLm");
  if (quoteRowSourceNumber(row) === 116) return normalizeArchitraveLmQuoteRow(row);
  if (String(row?.id || "") === "quote-118") return normalizeLinkedQuoteRowItem(row, "LABOUR TO INSTALL SISALATION GROUND LEVEL", "quoteSisalationInstallGroundM2");
  if (String(row?.id || "") === "quote-119") return normalizeLinkedQuoteRowItem(row, "LABOUR TO INSTALL SISALATION SECOND LEVEL", "quoteSisalationInstallSecondM2");
  if (String(row?.id || "") === "quote-120") return normalizeLinkedQuoteRowItem(row, "LABOUR TO INSTALL WALL INSULATION BATTS GROUND LEVEL", "quoteWallBattsInstallGroundM2");
  if (String(row?.id || "") === "quote-128") return normalizeLinkedQuoteRowRate(row, "INSTALL LIGHTWEIGHT CLADDING GROUND FLOOR", "quoteLightweightCladdingInstallGroundM2", "$22.00");
  if (String(row?.id || "") === "quote-30037") return normalizeLinkedQuoteRowRate(row, "INSTALL LIGHTWEIGHT CLADDING SECOND LEVEL", "quoteLightweightCladdingInstallSecondM2", "$28.00");
  if (String(row?.id || "") === "quote-30038") return normalizeLinkedQuoteRowRate(row, "INSTALL LIGHTWEIGHT CLADDING THIRD LEVEL", "quoteLightweightCladdingInstallThirdM2", "$42.00");
  return row;
}

function normalizeArchitraveLmQuoteRow(row) {
  const item = row.item || row.values?.[0] || "INSTALL WINDOW ARCHITRAVES";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...normalizeQuoteRowItem(row, item),
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    formulas: {},
    unit,
    notes: "",
    values: Array.isArray(row.values)
      ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", ""]
      : row.values,
  };
}

function normalizeFixoutStageLabourRow(row) {
  if (quoteSectionBaseName(row?.section) !== "fix-out stage labour") return row;
  if (String(row?.id || "") === "quote-159" || quoteRowSourceNumber(row) === 159) {
    return normalizeFormulaQuoteRow(row, "INSTALL SKIRTING", "skirtingLm", "B159*F159");
  }
  if (String(row?.id || "") === "quote-160" || quoteRowSourceNumber(row) === 160) {
    return normalizeFormulaQuoteRow(row, "INTERNAL FINAL FIX-OUT", "slabFloorAreaM2", "B160*F160");
  }
  if (String(row?.id || "") === "quote-150" || quoteRowSourceNumber(row) === 150) {
    return {
      ...normalizeFormulaQuoteRow(row, "HANG DOOR IN CAVITY SLIDER UNIT", "B104", "B150*F150"),
      notes: "Formula: =B104",
    };
  }
  if (String(row?.id || "") === "quote-152" || quoteRowSourceNumber(row) === 152) {
    return normalizeFormulaQuoteRow(row, "HANG SINGLE DOOR INC. JAMB/ARCH/FURNITURE", "internalDoors-B150", "B152*F152");
  }
  return row;
}

function normalizeDoorFurnitureRow(row) {
  if (String(row?.id || "") !== "quote-1344") return row;
  return normalizeFormulaQuoteRow(row, "CAVITY SLIDING DOOR UNIT", "B104", "B1344*F1344");
}

function normalizePlasterSupplyInstallRow(row) {
  if (quoteSectionBaseName(row?.section) !== "plasterer - supply and install") return row;
  if (String(row?.id || "") === "quote-1270") {
    return {
      ...normalizeLinkedQuoteRowItem(row, "GYPROCK SUPPLY & FIX - INTERNAL WALLS", "plasterboardWallM2"),
      unit: "M2",
      sourceOfRate: "workbook",
      notes: "IMPORTED DATA",
      values: ["GYPROCK SUPPLY & FIX - INTERNAL WALLS", "", "", "M2", "", row.excelRate || "$14.00", ""],
    };
  }
  if (String(row?.id || "") === "quote-1271") {
    return {
      ...normalizeLinkedQuoteRowItem(row, "GYPROCK SUPPLY & FIX - CEILINGS", "totalCeilingAreasM2"),
      unit: "M2",
      sourceOfRate: "workbook",
      notes: "IMPORTED DATA",
      values: ["GYPROCK SUPPLY & FIX - CEILINGS", "", "", "M2", "", row.excelRate || "$14.00", ""],
    };
  }
  return row;
}

function normalizeCorniceSupplyInstallRow(row) {
  const text = normalizedQuoteItem(row).toLowerCase();
  if (!text.includes("cornice") || !text.includes("supply") || !text.includes("install")) return row;
  const item = row.item || row.values?.[0] || "CEILINGS SUPPLY AND INSTALL CORNICES";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...normalizeLinkedQuoteRowItem(row, item, "corniceLm"),
    unit,
    notes: "IMPORTED DATA",
    values: Array.isArray(row.values)
      ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""]
      : row.values,
  };
}

function normalizeWindowDoorArchitraveQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 1356) return row;
  const item = row.item || row.values?.[0] || "INSTALL EXTERIOR DOOR AND WINDOW ARCHITRAVES";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...normalizeFormulaQuoteRow(row, item, "architraveLengthsEach*5.4", "B1356*F1356"),
    unit,
    notes: "IMPORTED DATA",
    values: Array.isArray(row.values)
      ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""]
      : row.values,
  };
}

function normalizeSkirtingLmQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 1363) return row;
  const item = row.item || row.values?.[0] || "SKIRTING";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...normalizeFormulaQuoteRow(row, item, "skirtingLengthsEach*5.4", "B1363*F1363"),
    unit,
    notes: "IMPORTED DATA",
    values: Array.isArray(row.values)
      ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""]
      : row.values,
  };
}

function normalizeQuoteRowsWithoutImportedData(row) {
  const rowNumber = quoteRowSourceNumber(row);
  if (!isNoImportedDataQuoteRow(row)) return row;
  return normalizeQuoteRowWithoutImportedData(row);
}

function normalizePainterQuoteRow(row) {
  const formula = painterQuoteFormula(row);
  if (!formula) return row;
  const item = row.item || row.values?.[0] || "";
  const unit = formula === "eavesAreaM2" ? "M2" : (row.unit || row.values?.[3] || "M2");
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: `Formula: ${formula}`,
    formulas: { ...(row.formulas || {}), B: formula, G: `B${quoteRowSourceNumber(row)}*F${quoteRowSourceNumber(row)}` },
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function painterQuoteFormula(row) {
  if (quoteSectionBaseName(row?.section) !== "painter") return "";
  if (row?.id === "quote-1963.1") return "thirdLevelFloorAreaM2";
  if (row?.id === "quote-1965.1") return "thirdExternalWallAreaM2";
  const rowNumber = quoteRowSourceNumber(row);
  if (rowNumber === 1962) return "lowerSlabAreaM2";
  if (rowNumber === 1963) return "secondLevelFloorAreaM2";
  if (rowNumber === 1964) return "lowerExternalWallAreaM2";
  if (rowNumber === 1965) return "upperExternalWallAreaM2";
  if (rowNumber === 1967) return "eavesAreaM2";
  if (rowNumber === 1968) return "lowerAlfrescoAreaM2 + lowerPorchAreaM2";
  return "";
}

function normalizeCleaningQuoteRow(row) {
  const formula = cleaningQuoteFormula(row);
  if (!formula) return row;
  const item = row.item || row.values?.[0] || "";
  const unit = row.unit || row.values?.[3] || "M2";
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: `Formula: ${formula}`,
    formulas: { ...(row.formulas || {}), B: formula, G: `B${quoteRowSourceNumber(row)}*F${quoteRowSourceNumber(row)}` },
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function cleaningQuoteFormula(row) {
  if (quoteSectionBaseName(row?.section) !== "cleaning") return "";
  const rowNumber = quoteRowSourceNumber(row);
  return rowNumber === 1978 || rowNumber === 1979 ? "slabFloorAreaM2" : "";
}

function normalizeQuoteRowWithoutImportedData(row) {
  const item = row.item || row.values?.[0] || "";
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: removeImportedDataNote(row.notes),
    formulas: row.formulas?.B ? { ...row.formulas, B: "" } : row.formulas,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", row.values[3] || row.unit || "", row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function removeImportedDataNote(notes) {
  return String(notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && part.toUpperCase() !== "IMPORTED DATA")
    .join(" | ");
}

function normalizeBlankQuantityQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 1210) return row;
  const item = row.item || row.values?.[0] || "DOUBLE WEATHERPROOF POWER POINT";
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", row.values[3] || "ITEM", row.values[4] || "", row.values[5] || row.excelRate || "$85.00", row.values[6] || ""] : row.values,
    formulas: {
      ...(row.formulas || {}),
      G: "B1210*F1210",
    },
  };
}

function normalizeFormulaQuoteRow(row, item, quantityFormula, costFormula) {
  return {
    ...normalizeQuoteRowItem(row, item),
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    formulas: {
      ...(row.formulas || {}),
      B: quantityFormula,
      G: costFormula,
    },
  };
}

function normalizeQuoteRowItem(row, item) {
  return {
    ...row,
    item,
    rawText: item,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", row.values[3] || "", row.values[4] || "", row.values[5] || "", row.values[6] || ""] : row.values,
  };
}

function normalizeLinkedQuoteRowItem(row, item, quantityKey) {
  return {
    ...normalizeQuoteRowItem(row, item),
    quantity: "",
    importedQuantity: "",
    quantityKey,
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function normalizeLinkedQuoteRowRate(row, item, quantityKey, excelRate) {
  return {
    ...normalizeLinkedQuoteRowItem(row, item, quantityKey),
    unit: "M2",
    excelRate,
    sourceOfRate: "workbook",
    values: Array.isArray(row.values) ? [item, "", "", "M2", "", excelRate, ""] : row.values,
  };
}

function normalizeRenderingFirstRow(row) {
  const item = normalizedQuoteItem(row);
  if (quoteSectionBaseName(row?.section) !== "rendering" || String(item || "").trim().toLowerCase() !== "item") return row;
  return {
    ...row,
    item,
    unit: "M2",
    excelRate: "$60.00",
    sourceOfRate: "workbook",
    values: [item, "", "", "M2", "", "$60.00", ""],
  };
}

function mergeQuickRenderRowsIntoRendering(entries) {
  const quickIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "quick render estimate");
  if (quickIndex < 0) return entries;
  const renderingIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "rendering");
  const [, quickSection] = entries[quickIndex];
  const rowsToMove = (quickSection?.rows || [])
    .filter((row) => isMovedQuickRenderRow(row))
    .map((row) => ({
      ...row,
      section: "RENDERING",
      values: Array.isArray(row.values) ? [row.values[0] || row.item || "", "", row.values[2] || "", row.values[3] || "", row.values[4] || "", row.values[5] || "", row.values[6] || ""] : row.values,
      quantity: "",
      importedQuantity: "",
      quantityKey: "",
    }));
  entries.splice(quickIndex, 1);
  if (!rowsToMove.length) return entries;
  if (renderingIndex < 0) {
    entries.push(["RENDERING", { collapsed: true, rows: rowsToMove }]);
    return entries;
  }
  const adjustedRenderingIndex = quickIndex < renderingIndex ? renderingIndex - 1 : renderingIndex;
  const [sectionName, renderingSection] = entries[adjustedRenderingIndex];
  const existingIds = new Set((renderingSection?.rows || []).map((row) => row.id));
  entries[adjustedRenderingIndex] = [sectionName, {
    ...renderingSection,
    rows: [
      ...(renderingSection?.rows || []),
      ...rowsToMove.filter((row) => !existingIds.has(row.id)),
    ],
  }];
  return entries;
}

function isMovedQuickRenderRow(row) {
  const text = `${row?.item || ""} ${(row?.values || []).join(" ")}`.toLowerCase();
  return text.includes("add extra area for piers") || text.includes("add for sills");
}

function mergeJobSetOutLabourRows(entries) {
  const labourIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "labour costs");
  const jobIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "job set-out");
  const labourSection = labourIndex >= 0 ? entries[labourIndex]?.[1] : null;
  const jobSection = jobIndex >= 0 ? entries[jobIndex]?.[1] : null;
  const labourRows = Array.isArray(labourSection?.rows) ? labourSection.rows : [];
  const jobRows = Array.isArray(jobSection?.rows) ? jobSection.rows : [];
  const rowsToMove = uniqueQuoteRowsByIdentity([
    ...jobRows.filter(isJobSetOutLabourRow),
    ...labourRows.filter(isJobSetOutLabourRow),
  ]).map((row) => ({ ...row, section: "JOB SET-OUT" }));
  if (!rowsToMove.length && labourIndex < 0) return entries;

  const nextEntries = [...entries];
  if (labourIndex >= 0) {
    const remainingLabourRows = labourRows.filter((row) => !isJobSetOutLabourRow(row));
    if (remainingLabourRows.length) {
      nextEntries[labourIndex] = [entries[labourIndex][0], { ...labourSection, rows: remainingLabourRows }];
    } else {
      nextEntries.splice(labourIndex, 1);
    }
  }

  if (!rowsToMove.length) return nextEntries;
  const adjustedJobIndex = nextEntries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "job set-out");
  if (adjustedJobIndex < 0) {
    nextEntries.push(["JOB SET-OUT", { collapsed: Boolean(jobSection?.collapsed), rows: rowsToMove }]);
    return nextEntries;
  }
  const [sectionName, currentJobSection] = nextEntries[adjustedJobIndex];
  const currentRows = Array.isArray(currentJobSection?.rows) ? currentJobSection.rows : [];
  nextEntries[adjustedJobIndex] = [sectionName, {
    ...currentJobSection,
    rows: insertRowsBefore(currentRows.filter((row) => !isJobSetOutLabourRow(row)), rowsToMove, "quote-234"),
  }];
  return nextEntries;
}

function isJobSetOutLabourRow(row) {
  return JOB_SET_OUT_LABOUR_ROW_IDS.has(String(row?.id || "")) || JOB_SET_OUT_LABOUR_SOURCE_ROWS.has(quoteRowSourceNumber(row));
}

function quoteRowSourceNumber(row) {
  const direct = row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow;
  const idMatch = String(row?.id || "").match(/^quote-(\d+)$/);
  const value = direct ?? idMatch?.[1];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniqueQuoteRowsByIdentity(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id || quoteRowSourceNumber(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function syncWindowDoorApproximateRates(workbook) {
  if (!Array.isArray(workbook?.windowsDoors)) return workbook;
  let changed = false;
  const defaults = createEstimateBuilderWorkbookDefaults().windowsDoors || [];
  const restoredRows = normalizeHumeEntryDoorRows(restoreMissingEntryDoorDefaults(workbook.windowsDoors, defaults));
  const orderedRows = orderWindowDoorRows(restoredRows);
  if (restoredRows.length !== workbook.windowsDoors.length || !sameWindowDoorOrder(orderedRows, workbook.windowsDoors)) changed = true;
  const windowsDoors = orderedRows.map((row) => {
    const priced = withWindowDoorApproximateRate(withDoorScheduleSelection(row));
    if (
      priced === row
      || (priced.rate === row.rate && priced.sourceOfRate === row.sourceOfRate && priced.notes === row.notes)
    ) {
      return row;
    }
    changed = true;
    return priced;
  });
  return changed ? { ...workbook, windowsDoors } : workbook;
}

function sameWindowDoorOrder(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => String(row?.id || row?.sourceRow || "") === String(b[index]?.id || b[index]?.sourceRow || ""));
}

function syncEditableLinkedQuoteQuantities(workbook, preview) {
  if (!preview?.quotation || !workbook?.quotation) return workbook;
  let changed = false;
  const quotation = Object.fromEntries(Object.entries(workbook.quotation).map(([sectionName, section]) => {
    const previewRowsById = Object.fromEntries((preview.quotation?.[sectionName]?.rows || []).map((row) => [row.id, row]));
    const rows = (section.rows || []).map((row) => {
      const previewRow = previewRowsById[row.id];
      const quantityKey = previewRow?.quantityKey || row.quantityKey || "";
      if (!EDITABLE_LINKED_QUOTE_KEYS.has(quantityKey)) {
        if (row.autoQuantity) {
          changed = true;
          return { ...row, autoQuantity: false };
        }
        return row;
      }
      const linkedQuantity = previewRow?.qty ? String(previewRow.qty) : "";
      if (FORCED_LINKED_QUOTE_KEYS.has(quantityKey)) {
        if (String(row.quantity || "") === linkedQuantity && row.autoQuantity === Boolean(linkedQuantity) && row.quantityKey === quantityKey && row.quantityManualOverride === false) return row;
        changed = true;
        return {
          ...row,
          quantity: linkedQuantity,
          importedQuantity: "",
          quantityKey,
          autoQuantity: Boolean(linkedQuantity),
          quantityManualOverride: false,
        };
      }
      if (String(quantityKey || "").startsWith("quoteFloorSystem")) {
        if (String(row.quantity || "") === linkedQuantity && row.autoQuantity === Boolean(linkedQuantity) && row.quantityKey === quantityKey && row.quantityManualOverride === false) return row;
        changed = true;
        return {
          ...row,
          quantity: linkedQuantity,
          importedQuantity: "",
          quantityKey,
          autoQuantity: Boolean(linkedQuantity),
          quantityManualOverride: false,
        };
      }
      if (row.quantityManualOverride) return row;
      if (row.autoQuantity === false && String(row.quantity || "") !== "") return row;
      if (String(row.quantity || "") === linkedQuantity && row.autoQuantity === Boolean(linkedQuantity) && row.quantityKey === quantityKey) return row;
      changed = true;
      return {
        ...row,
        quantity: linkedQuantity,
        importedQuantity: "",
        quantityKey,
        autoQuantity: Boolean(linkedQuantity),
        quantityManualOverride: false,
      };
    });
    return [sectionName, { ...section, rows }];
  }));
  return changed ? { ...workbook, quotation } : workbook;
}

function defaultQuoteSectionByBaseName(defaultQuotation = {}, sectionName) {
  const targetBaseName = quoteSectionBaseName(sectionName);
  return Object.entries(defaultQuotation).find(([defaultSectionName]) => quoteSectionBaseName(defaultSectionName) === targetBaseName)?.[1];
}

function removeMisplacedFloorFramingQuoteRows(sectionName, rows = []) {
  if (quoteSectionBaseName(sectionName) !== "ground level timber flooring") return rows;
  return rows.filter((row) => !FLOOR_FRAMING_QUOTE_ROW_IDS.has(String(row?.id || "")));
}

function removeRoofingMaterialsRemovedRows(sectionName, rows = []) {
  if (quoteSectionBaseName(sectionName) !== "roofing materials") return rows;
  return rows.filter((row) => {
    const rowNumber = quoteRowSourceNumber(row);
    return rowNumber < 1130 || rowNumber > 1266;
  });
}

function removeRemovedImportedQuoteRows(rows = []) {
  return rows.filter((row) => !REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(quoteRowSourceNumber(row)));
}

function orderQuoteRows(rows = []) {
  return moveQuoteRowsAfterSource(rows, [98, 99, 100], 73);
}

function moveQuoteRowsAfterSource(rows = [], sourceRowsToMove = [], anchorSourceRow) {
  const moveSet = new Set(sourceRowsToMove.map((row) => String(row)));
  const movingRows = [];
  const remainingRows = [];
  (rows || []).forEach((row) => {
    const sourceRow = String(row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow ?? "");
    if (moveSet.has(sourceRow)) movingRows.push(row);
    else remainingRows.push(row);
  });
  if (!movingRows.length) return rows;
  movingRows.sort((a, b) => sourceRowsToMove.indexOf(quoteRowSourceNumber(a)) - sourceRowsToMove.indexOf(quoteRowSourceNumber(b)));
  const anchorIndex = remainingRows.findIndex((row) => String(row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow ?? "") === String(anchorSourceRow));
  if (anchorIndex < 0) return [...remainingRows, ...movingRows];
  return [
    ...remainingRows.slice(0, anchorIndex + 1),
    ...movingRows,
    ...remainingRows.slice(anchorIndex + 1),
  ];
}

function ensureRequiredDefaultQuoteRows(sectionName, savedRows = [], defaultRows = []) {
  const sectionBaseName = quoteSectionBaseName(sectionName);
  const requiredIds = new Set(
    sectionBaseName === "external cladding"
      ? ["quote-1026", "quote-1027"]
      : sectionBaseName === "rendering"
        ? ["quote-1126", "quote-1127"]
      : sectionBaseName === "insulation"
        ? ["quote-30010", "quote-30011", "quote-30012", "quote-30013", "quote-30014", "quote-30015", "quote-30016", "quote-30017", "quote-30018", "quote-30025", "quote-30026", "quote-30027", "quote-30028", "quote-30029", "quote-30030", "quote-30031", "quote-30032", "quote-30033"]
      : sectionBaseName === "frame stage labour"
        ? ["quote-30019", "quote-30020", "quote-30021", "quote-30022", "quote-30023", "quote-30024", "quote-30039", "quote-30040", "quote-30041", "quote-30042"]
      : sectionBaseName === "concrete slab"
        ? ["quote-30044"]
      : sectionBaseName === "lock-up stage labour"
        ? ["quote-30034", "quote-30035", "quote-30036", "quote-30037", "quote-30038"]
      : sectionBaseName === "framing timber"
        ? ["quote-492.1", "quote-492.2", "quote-492.3", "quote-492.4"]
      : sectionBaseName === "upper level timber flooring"
        ? ["quote-593.1", "quote-593.2", "quote-593.3", "quote-593.4", "quote-593.5", "quote-593.6", "quote-593.7", "quote-593.8", "quote-593.9"]
      : sectionBaseName === "painter"
        ? ["quote-1963.1", "quote-1965.1"]
      : sectionBaseName === "timber and trims"
        ? ["quote-20002", "quote-20003", "quote-20004", "quote-20005"]
        : []
  );
  if (!requiredIds.size) return savedRows;
  const existingIds = new Set(savedRows.map((row) => row?.id));
  const missingRows = defaultRows.filter((row) => requiredIds.has(row?.id) && !existingIds.has(row.id));
  if (!missingRows.length) return savedRows;
  if (sectionBaseName === "frame stage labour") {
    const thirdStoreyWindowRows = missingRows.filter((row) => row.id === "quote-30039");
    const thirdStoreyTrussRows = missingRows.filter((row) => row.id === "quote-30040");
    const thirdFloorRows = missingRows.filter((row) => ["quote-30041", "quote-30042"].includes(row.id));
    const ceilingBattenRows = missingRows.filter((row) => ["quote-30023", "quote-30024"].includes(row.id));
    const tieDownRows = missingRows.filter((row) => ["quote-30020", "quote-30021"].includes(row.id));
    const exteriorRows = missingRows.filter((row) => row.id === "quote-30019");
    const interiorRows = missingRows.filter((row) => row.id === "quote-30022");
    return insertRowsAfter(insertRowsAfter(insertRowsAfter(insertRowsAfter(insertRowsAfter(insertRowsAfter(insertRowsAfter(savedRows, thirdStoreyWindowRows, "quote-74"), thirdStoreyTrussRows, "quote-78"), ceilingBattenRows, "quote-80"), tieDownRows, "quote-88"), exteriorRows, "quote-91"), interiorRows, "quote-93"), thirdFloorRows, "quote-99");
  }
  if (sectionBaseName === "painter") {
    const interiorRows = missingRows.filter((row) => row.id === "quote-1963.1");
    const exteriorRows = missingRows.filter((row) => row.id === "quote-1965.1");
    return insertRowsAfter(insertRowsAfter(savedRows, interiorRows, "quote-1963"), exteriorRows, "quote-1965");
  }
  if (sectionBaseName === "concrete slab") {
    return insertRowsAfter(savedRows, missingRows, "quote-315");
  }
  if (sectionBaseName === "lock-up stage labour") {
    const sisalationRows = missingRows.filter((row) => row.id === "quote-30034");
    const wallBattRows = missingRows.filter((row) => ["quote-30035", "quote-30036"].includes(row.id));
    const lightweightCladdingRows = missingRows.filter((row) => ["quote-30037", "quote-30038"].includes(row.id));
    return insertRowsAfter(insertRowsAfter(insertRowsAfter(savedRows, sisalationRows, "quote-119"), wallBattRows, "quote-120"), lightweightCladdingRows, "quote-128");
  }
  if (sectionBaseName === "framing timber") {
    return insertRowsBefore(savedRows, missingRows, "quote-493");
  }
  if (sectionBaseName === "upper level timber flooring") {
    return insertRowsAfter(savedRows, missingRows, "quote-593");
  }
  return [...missingRows, ...savedRows];
}

const FLOOR_FRAMING_QUOTE_ROW_IDS = new Set([
  "quote-593.1",
  "quote-593.2",
  "quote-593.3",
  "quote-593.4",
  "quote-593.5",
  "quote-593.6",
  "quote-593.7",
  "quote-593.8",
  "quote-593.9",
]);

function insertRowsAfter(rows = [], rowsToInsert = [], afterId = "") {
  const index = rows.findIndex((row) => row?.id === afterId);
  if (index < 0) return [...rows, ...rowsToInsert];
  return [...rows.slice(0, index + 1), ...rowsToInsert, ...rows.slice(index + 1)];
}

function insertRowsBefore(rows = [], rowsToInsert = [], beforeId = "") {
  const index = rows.findIndex((row) => row?.id === beforeId || quoteRowSourceNumber(row) === quoteRowSourceNumber({ id: beforeId }));
  if (index < 0) return [...rowsToInsert, ...rows];
  return [...rows.slice(0, index), ...rowsToInsert, ...rows.slice(index)];
}

function normalizeBulkEarthworksRows(sectionName, rows = []) {
  if (quoteSectionBaseName(sectionName) !== "bulk earthworks") return rows;
  const header = rows.find((row) => row?.id === "quote-250" || quoteRowSourceNumber(row) === 250) || {
    id: "quote-250",
    excelRow: 250,
    importedWorkbookRow: true,
    section: "BULK EARTHWORKS",
    values: ["ITEM", "QTY", "", "UNIT", "", "RATE", "COST"],
    formulas: {},
    item: "ITEM",
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "UNIT",
    excelRate: "RATE",
    sourceOfRate: "workbook",
    importedCost: "COST",
    rawText: "ITEM | QTY | UNIT | RATE | COST",
    active: true,
  };
  const manualRows = [
    { sourceRow: 30043, item: "CUT/FILL", unit: "M3", quantityKey: "cutFillM3", rate: "$30.00" },
    { sourceRow: 251, item: "BASIC SITE VEGETATION SCRAPE AND LEVEL", unit: "ITEM" },
    { sourceRow: 252, item: "EXCAVATOR HIRE", unit: "HR" },
    { sourceRow: 253, item: "BOBCAT HIRE", unit: "HR" },
    { sourceRow: 254, item: "BACKHOE HIRE", unit: "HR" },
    { sourceRow: 255, item: "TIP TRUCK HIRE", unit: "HR" },
    { sourceRow: 256, item: "DROTT HIRE", unit: "HR" },
    { sourceRow: 257, item: "BULLDOZER", unit: "HR" },
    { sourceRow: 258, item: "FLOAT COSTS", unit: "ITEM" },
    { sourceRow: 259, item: "BULLDOZER - MIN CHARGE", unit: "ITEM" },
    { sourceRow: 260, item: "REMOVAL OF ROCK", unit: "M3" },
    { sourceRow: 261, item: "SITE EXCAVATION", unit: "M3" },
    { sourceRow: 262, item: "SOIL REMOVAL - IMPORT FROM - TO SITE", unit: "M3" },
  ];
  return [header, ...manualRows.map((row) => normalizeBulkEarthworksManualRow(rows, row))];
}

function normalizeBulkEarthworksManualRow(rows, { sourceRow, item, unit, quantityKey = "", rate = "" }) {
  const existing = rows.find((row) => row?.id === `quote-${sourceRow}` || quoteRowSourceNumber(row) === sourceRow) || {};
  return {
    ...existing,
    id: `quote-${sourceRow}`,
    excelRow: sourceRow,
    importedWorkbookRow: false,
    section: "BULK EARTHWORKS",
    values: [item, "", "", unit, "", rate || existing.excelRate || "", ""],
    formulas: {},
    item,
    quantity: existing.quantity || "",
    importedQuantity: "",
    quantityKey,
    unit,
    excelRate: rate || existing.excelRate || "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? "workbook" : "manual",
    quoteRequired: false,
    autoQuantity: Boolean(quantityKey),
    quantityManualOverride: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes: existing.notes || "",
  };
}

function orderSavedQuotationSections(entries) {
  const steelIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "structural steel");
  if (steelIndex >= 0) {
    const [steel] = entries.splice(steelIndex, 1);
    const termiteIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "termite protection");
    if (termiteIndex < 0) entries.push(steel);
    else entries.splice(termiteIndex + 1, 0, steel);
  }
  entries = moveSavedSectionAfter(entries, "ceiling battens", "roof framing");
  entries = moveSavedSectionAfter(entries, "roofing labour", "roofing materials");
  entries = moveSavedSectionAfter(entries, "bricklayers labour", "face brickwork");
  entries = moveSavedSectionsAfter(entries, [
    "exterior cladding",
    "blue board",
    "hardiflex",
    "styrofoam exterior cladding",
    "j beads",
    "weather boards",
    "soffits",
    "soffits - lineal",
    "misc.",
    "timber and trims",
  ], "external cladding");
  entries = moveSavedSectionsAfter(entries, [
    "renderers labour",
    "misc rendering",
  ], "rendering");
  entries = moveSavedSectionsAfter(entries, [
    "plastering extras",
  ], "plasterer - supply and install");
  entries = moveSavedSectionAfter(entries, "skirting & architraves", "stairs");
  entries = moveSavedSectionAfter(entries, "fix out materials", "stairs");
  entries = moveSavedSectionsAfter(entries, [
    "shelving",
    "standard wardrobes complete (2.4m wide)",
    "standard 3 door robe up to 3.6m wide",
    "standard 2 door linen up to 2.4m wide",
    "standard 3 door linen up to 3.6m wide",
  ], ["fix out materials", "skirting & architraves"]);
  entries = moveSavedSectionsAfter(entries, ["cabinet maker"], "standard 3 door linen up to 3.6m wide");
  entries = moveSavedSectionsAfter(entries, ["butlers pantry", "laundry", "bathrooms", "wardrobes"], "cabinet maker");
  entries = moveSavedSectionsAfter(entries, [
    "double entry doors",
    "pivot door",
    "laundry/garage 820 1/3 panel glass door",
    "door jambs",
    "side lights",
    "door furniture",
    "garage door jambs",
    "garage doors - sectional panel lift",
    "garage doors - manual roll-a-door",
  ], "doors");
  entries = moveSavedSectionsAfter(entries, [
    "bathroom",
    "ensuite",
    "toilet",
    "other room/s",
    "kitchen",
    "tile layer",
  ], "tiling");
  entries = moveSavedSectionsAfter(entries, [
    "kitchen sinks",
    "kitchen taps",
    "vanity basins",
    "wall mixers",
    "bath spouts",
    "showers",
    "toilets",
    "baths",
    "spa baths",
    "laundry tubs",
    "laundry taps",
    "washing machine taps",
    "projix",
    "lucerne",
    "singulier",
    "filtered water taps",
    "insinkerators",
    "plumbing fixtures",
  ], "plumbing fittings & tapwear");
  entries = moveSavedSectionsAfter(entries, [
    "electrical fixtures",
    "lightfittings",
    "ceiling fans",
    "misc electrical fittings",
  ], "electrical");
  entries = moveSavedSectionsAfter(entries, [
    "cleaning",
    "landscaping",
  ], "painter");
  entries = moveSavedSectionsAfter(entries, [
    "floorcoverings",
  ], "painter");
  entries = moveSavedSectionsAfter(entries, [
    "ceramic tiles",
    "porcelain tiles",
    "laminated flooring",
    "vinyl flooring",
    "hybrid flooring",
    "engeineered timber",
    "solid timber flooring",
    "carpets",
    "misc flooring",
  ], "floorcoverings");
  entries = moveSavedSectionsAfter(entries, [
    "mirrors",
    "softline - framed 1870 high",
    "grange -semi frameless",
  ], "mirrors & shower screens");
  entries = moveSavedSectionAfter(entries, "appliance package", "cabinet maker");
  return moveSavedSectionsAfter(entries, [
    "bolts nuts & screws",
    "couplings",
    "nails",
    "adhesives",
    "misc",
  ], "hardware");
}

function renameRoofingMaterialsSection(entries) {
  const roofCoverIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName).startsWith("roof cover"));
  if (roofCoverIndex < 0) return entries;
  const materialsIndex = entries.findIndex(([sectionName], index) => index > roofCoverIndex && quoteSectionBaseName(sectionName) === "materials");
  if (materialsIndex < 0) return entries;
  const [sectionName, section] = entries[materialsIndex];
  const suffix = String(sectionName || "").match(/\s*\(\d+\)\s*$/)?.[0] || "";
  entries[materialsIndex] = [`ROOFING MATERIALS${suffix}`, {
    ...section,
    rows: (section?.rows || []).map((row) => (
      quoteSectionBaseName(row?.section) === "materials" ? { ...row, section: "ROOFING MATERIALS" } : row
    )),
  }];
  return entries;
}

function renameRoofingLabourSection(entries) {
  const roofingMaterialsIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === "roofing materials");
  if (roofingMaterialsIndex < 0) return entries;
  const labourIndex = entries.findIndex(([sectionName], index) => index > roofingMaterialsIndex && quoteSectionBaseName(sectionName) === "labour");
  if (labourIndex < 0) return entries;
  const [sectionName, section] = entries[labourIndex];
  const suffix = String(sectionName || "").match(/\s*\(\d+\)\s*$/)?.[0] || "";
  entries[labourIndex] = [`ROOFING LABOUR${suffix}`, {
    ...section,
    rows: (section?.rows || []).map((row) => (
      quoteSectionBaseName(row?.section) === "labour" ? { ...row, section: "ROOFING LABOUR" } : row
    )),
  }];
  return entries;
}

function moveSavedSectionAfter(entries, sectionBaseName, afterBaseName) {
  const sectionIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === sectionBaseName);
  if (sectionIndex < 0) return entries;
  const [section] = entries.splice(sectionIndex, 1);
  const afterIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === afterBaseName);
  if (afterIndex < 0) return [...entries, section];
  entries.splice(afterIndex + 1, 0, section);
  return entries;
}

function moveSavedSectionsAfter(entries, sectionBaseNames, afterBaseName) {
  const sections = [];
  sectionBaseNames.forEach((sectionBaseName) => {
    const sectionIndex = entries.findIndex(([sectionName]) => quoteSectionBaseName(sectionName) === sectionBaseName);
    if (sectionIndex >= 0) sections.push(entries.splice(sectionIndex, 1)[0]);
  });
  if (!sections.length) return entries;
  const afterBaseNames = Array.isArray(afterBaseName) ? afterBaseName : [afterBaseName];
  const afterIndex = entries.findIndex(([sectionName]) => afterBaseNames.includes(quoteSectionBaseName(sectionName)));
  if (afterIndex < 0) return [...entries, ...sections];
  entries.splice(afterIndex + 1, 0, ...sections);
  return entries;
}

function isRemovedQuoteSection(section) {
  return REMOVED_QUOTE_SECTION_NAMES.has(quoteSectionBaseName(section));
}

function isBlankInputQuoteSection(section) {
  return BLANK_INPUT_QUOTE_SECTION_NAMES.has(quoteSectionBaseName(section));
}

function isRoofTrussesRoofAreaQuoteRow(row) {
  const rowNumber = quoteRowSourceNumber(row);
  return rowNumber === 727 || rowNumber === 803;
}

function isBlankQtyQuoteSection(section) {
  const name = quoteSectionBaseName(section);
  return BLANK_QTY_QUOTE_SECTION_NAMES.has(name) || name.startsWith("roof cover");
}

function isBlankValueQuoteSection(section) {
  return BLANK_VALUE_QUOTE_SECTION_NAMES.has(quoteSectionBaseName(section));
}

function normalizeSavedQuoteSectionName(section) {
  const text = String(section || "");
  const suffix = text.match(/\s*\(\d+\)\s*$/)?.[0] || "";
  const base = text.replace(/\s*\(\d+\)\s*$/, "").trim();
  const replacement = RENAMED_QUOTE_SECTION_NAMES.get(quoteSectionBaseName(base));
  return replacement ? `${replacement}${suffix}` : text;
}

function normalizeSavedQuoteRowSection(row) {
  const replacement = RENAMED_QUOTE_SECTION_NAMES.get(quoteSectionBaseName(row?.section));
  return replacement ? { ...row, section: replacement } : row;
}

function cleanImportedQuoteQuantity(row, defaultRow) {
  if (!row?.importedWorkbookRow) return row;
  const item = normalizedQuoteItem(row);
  if (isBlankValueQuoteSection(row.section)) return { ...cleanImportedQuoteValues(row), item };
  const importedQuantity = row.importedQuantity ?? defaultRow?.importedQuantity ?? "";
  const currentQuantity = row.quantity ?? "";
  const quantityKey = normalizedQuoteQuantityKey({ ...row, item });
  const feeType = quoteFeeType(row);
  const hidden = isHiddenQuoteRow({ ...row, item });
  if (isFoundationsHeaderQty280(row, item)) {
    return { ...row, item, quantity: "", importedQuantity: "", quantityKey: "", feeType, hiddenQuoteRow: hidden };
  }
  if (isBlankInputQuoteSection(row.section) && !isRoofTrussesRoofAreaQuoteRow(row)) {
    const roofItem = item || row.values?.[0] || defaultRow?.item || defaultRow?.values?.[0] || "";
    const roofUnit = row.unit || row.values?.[3] || defaultRow?.unit || defaultRow?.values?.[3] || "";
    const roofRate = row.excelRate || row.values?.[5] || defaultRow?.excelRate || defaultRow?.values?.[5] || "";
    return {
      ...row,
      item: roofItem,
      values: [roofItem, "", "", roofUnit, "", roofRate, ""],
      rawText: roofItem,
      quantity: "",
      importedQuantity: "",
      quantityKey: "",
      unit: roofUnit,
      excelRate: roofRate,
      supplierCatalogueRate: "",
      quotedSupplierRate: "",
      manualRate: "",
      supplierQuote: "",
      sourceOfRate: roofRate ? "workbook" : "rate missing",
      importedCost: "",
      notes: "",
      formulas: {},
      feeType,
      hiddenQuoteRow: hidden,
    };
  }
  if (isBlankQtyQuoteSection(row.section)) {
    return { ...row, item, quantity: "", importedQuantity: "", quantityKey: "", feeType, hiddenQuoteRow: hidden };
  }
  if (isBlankQuoteQtyRow({ ...row, item }) || hidden) {
    const userQuantity = currentQuantity !== "" && (importedQuantity === "" || String(currentQuantity) !== String(importedQuantity))
      ? currentQuantity
      : "";
    return { ...row, item, quantity: hidden ? "" : userQuantity, importedQuantity, quantityKey, feeType, hiddenQuoteRow: hidden };
  }
  if (currentQuantity === "" || (importedQuantity !== "" && String(currentQuantity) === String(importedQuantity))) {
    return { ...row, item, quantity: "", importedQuantity, quantityKey, feeType, hiddenQuoteRow: hidden };
  }
  return { ...row, item, importedQuantity, quantityKey, feeType, hiddenQuoteRow: hidden };
}

function cleanImportedQuoteValues(row) {
  if (!row?.importedWorkbookRow || !isBlankValueQuoteSection(row.section)) return row;
  const item = normalizedQuoteItem(row);
  const unit = row.unit || row.values?.[3] || "";
  return {
    ...row,
    item,
    values: Array.isArray(row.values) ? [item, "", "", unit, "", "", ""] : row.values,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    excelRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "rate missing",
    importedCost: "",
    notes: "",
    formulas: {},
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function isFoundationsHeaderQty280(row, item) {
  return quoteSectionBaseName(row?.section) === "foundations"
    && String(item || row?.values?.[0] || "").trim().toLowerCase() === "item"
    && String(row?.quantity ?? "").trim() === "280";
}

function normalizedQuoteQuantityKey(row) {
  const floorSystemQuantityKey = floorSystemQuoteQuantityKey(row);
  if (floorSystemQuantityKey) return floorSystemQuantityKey;
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (isNoImportedDataQuoteRow(row)) return "";
  if (isBlankQuoteQtyRow(row)) return "";
  if (text.includes("cut/fill") || text.includes("cut fill")) return "cutFillM3";
  if (text.includes("total ground floor area")) return "lowerSlabAreaM2";
  if (text.includes("cornice") && text.includes("supply") && text.includes("install")) return "corniceLm";
  if (isRoofTrussesRoofAreaQuoteRow(row)) return "roofAreaM2";
  if (quoteRowSourceNumber(row) === 629 && quoteSectionBaseName(row?.section) === "flooring") return "totalBalconyAreaM2";
  if (quoteSectionBaseName(row?.section) === "flooring" && text.includes("secura flooring") && text.includes("balcony")) return "totalBalconyAreaM2";
  if (quoteSectionBaseName(row?.section) === "concretors labour" && text.includes("concretor - prep, pour & dress")) return "lowerSlabAreaM2";
  if (String(row?.id || "") === "quote-489" || text.includes("70mm exterior walls frames")) return "totalExternal70mmWallsLm";
  if (String(row?.id || "") === "quote-490" || text.includes("90mm exterior walls frames")) return "totalExternal90mmWallsLm";
  if (String(row?.id || "") === "quote-642" || text.includes("70mm internal wall frames")) return "totalInternal70mmWallsLm";
  if (String(row?.id || "") === "quote-643" || text.includes("90mm internal wall frames")) return "totalInternal90mmWallsLm";
  if (quoteSectionBaseName(row?.section) === "face brickwork" && text.includes("face bricks - base range")) return "quoteFaceBricksBaseRange";
  if (quoteSectionBaseName(row?.section) === "face brickwork" && text.includes("common single heights")) return "quoteCommonSingleHeights";
  if (quoteSectionBaseName(row?.section) === "face brickwork" && text.includes("common twin heights")) return "quoteCommonTwinHeights";
  if (quoteSectionBaseName(row?.section) === "face brickwork" && text.includes("add bricks for sills")) return "quoteBrickSillBricks";
  if (quoteSectionBaseName(row?.section) === "bricklayers labour" && text.includes("bricklayer single height")) return "quoteBricklayerSingleHeight";
  if (quoteSectionBaseName(row?.section) === "bricklayers labour" && text.includes("bricklayer double heights")) return "quoteBricklayerDoubleHeights";
  if (quoteSectionBaseName(row?.section) === "bricklayers labour" && text.includes("brick sills")) return "quoteBricklayerSillsLm";
  if (quoteSectionBaseName(row?.section) === "bricklayers labour" && text.includes("brick window sills required")) return "quoteBricklayerSillsLm";
  if (quoteSectionBaseName(row?.section) === "bricklayers labour" && text.includes("bricklayer")) return "quoteBricklayerFaceBricks";
  if (quoteSectionBaseName(row?.section) === "rendering" && String(row?.item || "").trim().toLowerCase() === "item") return "quoteRenderingNetWallAreaM2";
  if (quoteSectionBaseName(row?.section) === "rendering" && text.includes("add for sills")) return "quoteRenderingSillsLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install windows")) return "quoteFrameInstallWindows";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("second storey windows")) return "quoteFrameSecondStoreyWindows";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("third storey windows")) return "quoteFrameThirdStoreyWindows";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("stand & install roof trusses")) return "quoteFrameRoofTrusses";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("second storey trusses")) return "quoteFrameSecondStoreyTrusses";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("third storey trusses")) return "quoteFrameThirdStoreyTrusses";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install ceiling battens ground floor")) return "quoteFrameCeilingBattensGroundM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install ceiling battens second level")) return "quoteFrameCeilingBattensSecondM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install ceiling battens third level")) return "quoteFrameCeilingBattensThirdM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install ceiling battens")) return "quoteFrameCeilingBattensGroundM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("line eaves")) return "totalEavesLm";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && text.includes("ground")) return "quoteSisalationInstallGroundM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && (text.includes("second") || text.includes("upper"))) return "quoteSisalationInstallSecondM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && text.includes("third")) return "quoteSisalationInstallThirdM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && text.includes("ground")) return "quoteWallBattsInstallGroundM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && (text.includes("second") || text.includes("upper"))) return "quoteWallBattsInstallSecondM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && text.includes("third")) return "quoteWallBattsInstallThirdM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install insulation ceiling batts")) return "quoteCeilingInsulationFlatM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && text.includes("batts to ceilings")) return "quoteCeilingInsulationFlatM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("ground level")) return "quoteSisalationInstallGroundM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("second level")) return "quoteSisalationInstallSecondM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("third level")) return "quoteSisalationInstallThirdM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("ground level")) return "quoteWallBattsInstallGroundM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("second level")) return "quoteWallBattsInstallSecondM2";
  if (quoteSectionBaseName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("third level")) return "quoteWallBattsInstallThirdM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing ground level")) return "quoteFrameTieDownSheetBracingGroundM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing second level")) return "quoteFrameTieDownSheetBracingSecondM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing third level")) return "quoteFrameTieDownSheetBracingThirdM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("exterior walls - ground floor")) return "quoteFrameExteriorWallsGroundLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("exterior walls - second level")) return "quoteFrameExteriorWallsSecondLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("exterior walls - third level")) return "quoteFrameExteriorWallsThirdLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("interior walls - lower")) return "quoteFrameInteriorWallsGroundLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("interior walls - second level")) return "quoteFrameInteriorWallsSecondLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("interior walls - third level")) return "quoteFrameInteriorWallsThirdLm";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install floor joists") && text.includes("third")) return "quoteFrameFloorJoistsThirdM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("install floor joists")) return "quoteFrameFloorJoistsSecondM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("lay sheet flooring") && text.includes("third")) return "quoteFrameSheetFlooringThirdM2";
  if (quoteSectionBaseName(row?.section) === "frame stage labour" && text.includes("lay sheet flooring")) return "quoteFrameSheetFlooringSecondM2";
  if (quoteSectionBaseName(row?.section) === "external cladding" && text.includes("150mm linea board")) return "quote150LineaBoardLengths";
  if (quoteSectionBaseName(row?.section) === "external cladding" && text.includes("180mm linea board")) return "quote180LineaBoardLengths";
  if (quoteSectionBaseName(row?.section) === "external cladding" && text.includes("stria")) return "quote405StriaCladdingLengths";
  if (quoteSectionBaseName(row?.section) === "external cladding" && text.includes("matrix")) return "quoteLightweightCladdingM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && text.includes("ground")) return "quoteLightweightCladdingInstallGroundM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && (text.includes("second") || text.includes("upper"))) return "quoteLightweightCladdingInstallSecondM2";
  if (quoteSectionBaseName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && text.includes("third")) return "quoteLightweightCladdingInstallThirdM2";
  if (text.includes("rolled window flashing")) return "lightweightCladdingWindowCount";
  if (row?.quantityKey === "windowDoorCount" && text.includes("window")) return "windowCount";
  return row?.quantityKey || "";
}

function floorSystemQuoteQuantityKey(row) {
  const byId = {
    "quote-593.4": "quoteFloorSystemGround300M2",
    "quote-593.5": "quoteFloorSystemGround360M2",
    "quote-593.6": "quoteFloorSystemSecond300M2",
    "quote-593.7": "quoteFloorSystemSecond360M2",
    "quote-593.8": "quoteFloorSystemThird300M2",
    "quote-593.9": "quoteFloorSystemThird360M2",
  };
  const id = String(row?.id || "").trim();
  if (byId[id]) return byId[id];
  const rowNumber = quoteRowSourceNumber(row);
  if (rowNumber === 593.4) return "quoteFloorSystemGround300M2";
  if (rowNumber === 593.5) return "quoteFloorSystemGround360M2";
  if (rowNumber === 593.6) return "quoteFloorSystemSecond300M2";
  if (rowNumber === 593.7) return "quoteFloorSystemSecond360M2";
  if (rowNumber === 593.8) return "quoteFloorSystemThird300M2";
  if (rowNumber === 593.9) return "quoteFloorSystemThird360M2";
  const item = normalizedFloorSystemText(row?.item || row?.rawText || row?.values?.[0] || "");
  if (!item.includes("floor system")) return "";
  if (item.includes("ground") && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemGround300M2";
  if (item.includes("ground") && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemGround360M2";
  if ((item.includes("second") || item.includes("upper")) && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemSecond300M2";
  if ((item.includes("second") || item.includes("upper")) && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemSecond360M2";
  if (item.includes("third") && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemThird300M2";
  if (item.includes("third") && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemThird360M2";
  return "";
}

function normalizedFloorSystemText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBlankQuoteQtyRow(row) {
  if (quoteRowSourceNumber(row) === 116) return false;
  if (quoteRowSourceNumber(row) === 1356) return false;
  if (quoteRowSourceNumber(row) === 1363) return false;
  const itemText = String(row?.item || "").trim().toLowerCase();
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if ([
    "install window infills to gables",
    "window infills",
    "additional height walls (window infills)",
    "fabricate entry door jamb",
    "install single entry door inc. jamb/furn",
    "install window architraves",
    "install exterior door and window architraves",
    "install skirting",
    "wall studs 70 x 35 mpg 12",
    "70 x 35 mpg 12",
    "plates and noggins 70 x 35 mpg 12",
    "tie down plates",
  ].includes(itemText)) return true;
  return [
    "title search",
    "titles search",
    "add for tile roof trusses",
    "porch/verandah roof & ceiling framework",
  ].some((item) => text.includes(item));
}

function isNoImportedDataQuoteRow(row) {
  const rowNumber = quoteRowSourceNumber(row);
  return quoteSectionBaseName(row?.section) === "hot water" || QUOTE_ROWS_WITHOUT_IMPORTED_DATA.has(rowNumber) || (rowNumber >= 1275 && rowNumber <= 1283) || (rowNumber >= 1357 && rowNumber <= 1362);
}

function normalizedQuoteItem(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  if (itemText === "install window architraves") return "INSTALL EXTERIOR DOOR AND WINDOW ARCHITRAVES";
  if (itemText === "70 x 35 mpg 12") return "PLATES AND NOGGINS 70 X 35 MPG 12";
  if (itemText === "brick window sills required (add y for yes)") return "BRICK SILLS";
  return row?.item || "";
}

function isHiddenQuoteRow(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  return itemText === "install exterior door architraves";
}

function quoteFeeType(row) {
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (text.includes("qbsa registration")) return "qbsaRegistration";
  if (text.includes("q leave fees")) return "qLeaveFees";
  return "";
}

function orderedQuoteSections(quotation = {}, savedOrder = []) {
  const sections = normalizeQuoteSectionOrder(savedOrder, quotation);
  if (Array.isArray(savedOrder) && savedOrder.length) return sections;
  const bricklayer = sections.find((section) => quoteSectionBaseName(section) === "bricklayers labour");
  const hasFaceBricks = sections.some((section) => isFaceBricksSection(section));
  if (!bricklayer || !hasFaceBricks) return sections;
  const withoutBricklayer = sections.filter((section) => section !== bricklayer);
  const insertAfter = withoutBricklayer.findIndex((section) => isFaceBricksSection(section));
  return [
    ...withoutBricklayer.slice(0, insertAfter + 1),
    bricklayer,
    ...withoutBricklayer.slice(insertAfter + 1),
  ];
}

function normalizeQuoteSectionOrder(savedOrder = [], quotation = {}) {
  const sections = Object.keys(quotation || {});
  const byBaseName = new Map(sections.map((section) => [quoteSectionBaseName(section), section]));
  const ordered = [];
  const seen = new Set();
  (Array.isArray(savedOrder) ? savedOrder : []).forEach((section) => {
    const resolved = sections.includes(section) ? section : byBaseName.get(quoteSectionBaseName(section));
    if (!resolved || seen.has(resolved)) return;
    ordered.push(resolved);
    seen.add(resolved);
  });
  sections.forEach((section) => {
    if (!seen.has(section)) ordered.push(section);
  });
  return moveFixOutMaterialsGroupAfterStairs(moveQuoteSectionNamesAfter(ordered, ["appliance package"], "cabinet maker"));
}

function moveQuoteSectionNamesAfter(sections = [], sectionBaseNames = [], afterBaseName = "") {
  const moveSet = new Set(sectionBaseNames);
  const moving = [];
  const remaining = [];
  sections.forEach((section) => {
    if (moveSet.has(quoteSectionBaseName(section))) moving.push(section);
    else remaining.push(section);
  });
  if (!moving.length) return sections;
  moving.sort((a, b) => sectionBaseNames.indexOf(quoteSectionBaseName(a)) - sectionBaseNames.indexOf(quoteSectionBaseName(b)));
  const afterIndex = remaining.findIndex((section) => quoteSectionBaseName(section) === afterBaseName || quoteSectionBaseName(section) === "skirting & architraves");
  if (afterIndex < 0) return [...remaining, ...moving];
  return [...remaining.slice(0, afterIndex + 1), ...moving, ...remaining.slice(afterIndex + 1)];
}

function moveFixOutMaterialsGroupAfterStairs(sections = []) {
  const parent = sections.find((section) => ["fix out materials", "skirting & architraves"].includes(quoteSectionBaseName(section)));
  if (!parent) return sections;
  const childBaseNames = [
    "shelving",
    "standard wardrobes complete (2.4m wide)",
    "standard 3 door robe up to 3.6m wide",
    "standard 2 door linen up to 2.4m wide",
    "standard 3 door linen up to 3.6m wide",
  ];
  const groupBaseNames = new Set([quoteSectionBaseName(parent), ...childBaseNames]);
  const group = [
    parent,
    ...childBaseNames.map((baseName) => sections.find((section) => quoteSectionBaseName(section) === baseName)).filter(Boolean),
  ];
  const remaining = sections.filter((section) => !groupBaseNames.has(quoteSectionBaseName(section)));
  const stairsIndex = remaining.findIndex((section) => quoteSectionBaseName(section) === "stairs");
  if (stairsIndex < 0) return [...remaining, ...group];
  return [...remaining.slice(0, stairsIndex + 1), ...group, ...remaining.slice(stairsIndex + 1)];
}

function isFaceBricksSection(section) {
  const name = quoteSectionBaseName(section);
  return name === "face brickwork" || name === "face bricks" || name.includes("face brick");
}

function quoteSectionBaseName(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSectionName(section) {
  return String(section || "").toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim();
}

function collectSavedRows(savedData = {}) {
  return Object.values(savedData || {}).reduce((allRows, section) => {
    if (!section?.rows || typeof section.rows !== "object") return allRows;
    Object.entries(section.rows).forEach(([key, row]) => {
      if (!allRows[key]) allRows[key] = row;
    });
    return allRows;
  }, {});
}

function safeDataSection(workbook, section) {
  const fallback = createEstimateBuilderWorkbookDefaults().data?.[section] || { collapsed: false, rows: {}, customRows: [], hiddenRows: [] };
  const current = workbook.data?.[section] || {};
  return {
    ...fallback,
    ...current,
    rows: current.rows && typeof current.rows === "object" ? current.rows : fallback.rows || {},
    customRows: Array.isArray(current.customRows) ? current.customRows : [],
    hiddenRows: Array.isArray(current.hiddenRows) ? current.hiddenRows : [],
  };
}

function mergeDataRows(section, customRows = [], hiddenRows = []) {
  const hidden = new Set(hiddenRows.filter((key) => !REQUIRED_DATA_INPUT_ROW_KEYS.has(key)));
  return [
    ...section.rows.map((row, index) => ({ ...row, order: index * 1000 })),
    ...customRows.map((row) => ({ ...row, calculated: false, custom: true })),
  ].filter((row) => !hidden.has(row.key)).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function mergeFormulaRows(customRows = []) {
  return [
    ...V4_DATA_SECTIONS.flatMap((section) => section.rows.filter((row) => row.calculated)).map((row, index) => ({ ...row, order: index * 1000 })),
    ...customRows.map((row) => ({ ...row, calculated: true, custom: true })),
  ].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function orderBetween(previous, next) {
  const previousOrder = previous?.order;
  const nextOrder = next?.order;
  if (typeof previousOrder === "number" && typeof nextOrder === "number") {
    return previousOrder + ((nextOrder - previousOrder) / 2);
  }
  if (typeof previousOrder === "number") return previousOrder + 1000;
  if (typeof nextOrder === "number") return nextOrder - 1000;
  return 0;
}

function isRelevantForDataInput(row, workbook) {
  if (HIDDEN_DATA_INPUT_ROW_KEYS.has(String(row?.key || ""))) return false;
  if (!isRelevantForWallThicknessSelection(row, workbook)) return false;
  return isRelevantForFloorCount(row, dataValue(workbook, "floorCount") || "Single storey");
}

function isRelevantForWallThicknessSelection(row, workbook) {
  const key = wallLengthTotalKeyForLabel(row?.label) || String(row?.key || "");
  if (ALWAYS_VISIBLE_TOTAL_MATERIAL_KEYS.has(key)) return true;
  if (key === "totalExternal70mmWallsLm") return true;
  if (key === "totalExternal90mmWallsLm") return true;
  if (key === "totalInternal70mmWallsLm") return true;
  if (key === "totalInternal90mmWallsLm") return hasSelectedWallLengthThickness(workbook, "internal", "90");
  if (key === "total70mmWallsLm") return hasSelectedWallThickness(workbook, "70");
  if (key === "total90mmWallsLm") return hasSelectedWallThickness(workbook, "90");
  if (WALL_THICKNESS_SPECIFIC_RESULT_ROWS[key]) {
    return hasSelectedThicknessForRows(workbook, WALL_THICKNESS_SPECIFIC_RESULT_ROWS[key].thickness, WALL_THICKNESS_SPECIFIC_RESULT_ROWS[key].pairs);
  }
  if (WALL_THICKNESS_70MM_RESULT_KEYS.has(key)) return hasSelectedWallThickness(workbook, "70");
  if (WALL_THICKNESS_90MM_RESULT_KEYS.has(key)) return hasSelectedWallThickness(workbook, "90");
  return true;
}

function wallLengthTotalKeyForLabel(label) {
  const normalized = String(label || "").toLowerCase().replace(/\s+/g, " ").trim();
  return WALL_LENGTH_TOTAL_LABELS[normalized] || "";
}

const WALL_LENGTH_TOTAL_LABELS = {
  "total external 70mm framed wall lm": "totalExternal70mmWallsLm",
  "total external 90mm framed wall lm": "totalExternal90mmWallsLm",
  "total internal 70mm framed wall lm": "totalInternal70mmWallsLm",
  "total internal 90mm framed wall lm": "totalInternal90mmWallsLm",
};

const WALL_LENGTH_TOTAL_FORMULA_KEYS = new Set(Object.values(WALL_LENGTH_TOTAL_LABELS));

const ALWAYS_VISIBLE_TOTAL_MATERIAL_KEYS = new Set([
  "total70mmStudMaterialLm",
  "total90mmStudMaterialLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
]);

const PLASTERBOARD_FORMULA_LABELS = {
  "ground level external plasterboard wall m2": "lowerExternalPlasterboardWallM2",
  "ground level internal plasterboard wall m2": "lowerInternalPlasterboardWallM2",
  "ground level plasterboard wall m2": "lowerPlasterboardWallM2",
  "second level external plasterboard wall m2": "upperExternalPlasterboardWallM2",
  "second level internal plasterboard wall m2": "upperInternalPlasterboardWallM2",
  "second level plasterboard wall m2": "upperPlasterboardWallM2",
  "third level external plasterboard wall m2": "thirdExternalPlasterboardWallM2",
  "third level internal plasterboard wall m2": "thirdInternalPlasterboardWallM2",
  "third level plasterboard wall m2": "thirdPlasterboardWallM2",
  "total plasterboard walls m2": "plasterboardWallM2",
};

const PLASTERBOARD_FORMULA_KEYS = new Set(Object.values(PLASTERBOARD_FORMULA_LABELS));

function hasSelectedThicknessForRows(workbook, thickness, pairs) {
  return pairs.some(([thicknessKey, wallLmKey]) => (
    String(dataValue(workbook, thicknessKey) || "").replace(/\D/g, "") === thickness
  ));
}

function hasSelectedWallThickness(workbook, thickness) {
  return [
    "lowerWallThicknessMm",
    "upperWallThicknessMm",
    "thirdWallThicknessMm",
    "lowerInternalWallThicknessMm",
    "upperInternalWallThicknessMm",
    "thirdInternalWallThicknessMm",
  ].some((key) => String(dataValue(workbook, key) || "").replace(/\D/g, "") === thickness);
}

function hasSelectedWallLengthThickness(workbook, wallType, thickness) {
  const levels = floorCountToLevels(dataValue(workbook, "floorCount") || "Single storey");
  const keys = wallType === "external"
    ? [["lowerWallThicknessMm", 1], ["upperWallThicknessMm", 2], ["thirdWallThicknessMm", 3]]
    : [["lowerInternalWallThicknessMm", 1], ["upperInternalWallThicknessMm", 2], ["thirdInternalWallThicknessMm", 3]];
  return keys.some(([key, level]) => level <= levels && String(dataValue(workbook, key) || "").replace(/\D/g, "") === thickness);
}

function isRelevantForFloorCount(row, floorCount) {
  const levels = floorCountToLevels(floorCount);
  const rowLevel = levelForDataRow(row);
  if (rowLevel > levels) return false;
  return true;
}

function floorCountToLevels(floorCount) {
  const text = String(floorCount || "").toLowerCase();
  if (text.includes("three") || text.includes("3")) return 3;
  if (text.includes("two") || text.includes("2") || text.includes("double")) return 2;
  return 1;
}

function levelForDataRow(row) {
  const key = String(row.key || "");
  const text = `${row.section || ""} ${row.label || ""}`.toLowerCase();
  if (
    key.startsWith("third") ||
    key === "upperBalconyAreaM2" ||
    text.includes("third level") ||
    text.includes("third storey")
  ) {
    return 3;
  }
  if (
    key.startsWith("upper") ||
    key.startsWith("second") ||
    key === "balconyAreaM2" ||
    text.includes("second level") ||
    text.includes("second storey") ||
    text.includes("upper level")
  ) {
    return 2;
  }
  return 1;
}

function withDynamicDataRowLabel(row, section, workbook) {
  if (section !== "inputDataSheet" && section !== "walls") return row;
  const thicknessLabels = {
    lowerExternalWallsLm: ["Ground Level external wall LM", "lowerWallThicknessMm"],
    upperExternalWallsLm: ["Second Level external wall LM", "upperWallThicknessMm"],
    thirdExternalWallsLm: ["Third Level external wall LM", "thirdWallThicknessMm"],
    lowerInternalWallsLm: ["Ground Level internal wall LM", "lowerInternalWallThicknessMm"],
    upperInternalWallsLm: ["Second Level internal wall LM", "upperInternalWallThicknessMm"],
    thirdInternalWallsLm: ["Third Level internal wall LM", "thirdInternalWallThicknessMm"],
  };
  const thicknessLabel = thicknessLabels[row.key];
  if (thicknessLabel) {
    const thickness = String(dataValue(workbook, thicknessLabel[1]) || "").trim();
    return { ...row, label: thickness ? `${thicknessLabel[0]} ${thickness}mm` : thicknessLabel[0] };
  }
  const wallRows = workbook.data?.inputDataSheet?.rows || workbook.data?.walls?.rows || {};
  const labels = {
    lowerSelectedWallSystemAreaM2: ["Ground Level", wallRows.lowerWallSystem?.value],
    upperSelectedWallSystemAreaM2: ["Second Level", wallRows.upperWallSystem?.value],
    thirdSelectedWallSystemAreaM2: ["Third Level", wallRows.thirdWallSystem?.value],
  };
  const label = labels[row.key];
  if (!label) return row;
  const system = String(label[1] || "selected wall system").trim();
  return { ...row, label: `${label[0]} ${system} area` };
}

function dataValue(workbook, key) {
  for (const section of Object.values(workbook.data || {})) {
    const value = section?.rows?.[key]?.value;
    if (value !== undefined) return value;
  }
  return "";
}

function shouldTrackQuoteChange(key) {
  return ["active", "quantity", "unit", "manualRate", "supplierQuote", "lineType", "quoteRequired", "notes", "item"].includes(key);
}

const WALL_THICKNESS_70MM_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "internalFramedWall70mmLm",
  "studs70mmEach",
  "wallPlatesNoggins70mmExternalWallsLm",
  "wallPlatesNoggins70mmInternalWallsLm",
  "wallPlatesNoggins70mmLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial70mmLm",
  "upperStudMaterial70mmLm",
  "thirdStudMaterial70mmLm",
  "total70mmStudMaterialLm",
  "total70mmTimberFramingLm",
  "total70mmTimberLengthsEach",
]);

const REQUIRED_DATA_INPUT_ROW_KEYS = new Set([
  "totalExternalWallsLm",
  "totalInternalWallsLm",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "externalFramedWall70mmLm",
  "externalFramedWall90mmLm",
  "internalFramedWall70mmLm",
  "internalFramedWall90mmLm",
  "studs70mmEach",
  "studs90mmEach",
  "wallPlatesNoggins70mmExternalWallsLm",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins70mmInternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial70mmLm",
  "upperStudMaterial70mmLm",
  "thirdStudMaterial70mmLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total70mmStudMaterialLm",
  "total90mmStudMaterialLm",
  "total70mmTimberFramingLm",
  "total90mmTimberFramingLm",
  "total70mmTimberLengthsEach",
  "total90mmTimberLengthsEach",
]);

const WALL_THICKNESS_90MM_RESULT_KEYS = new Set([
  "externalFramedWall90mmLm",
  "internalFramedWall90mmLm",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "wallPlatesNoggins90mmLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total90mmStudMaterialLm",
  "total90mmTimberFramingLm",
  "total90mmTimberLengthsEach",
]);

const WALL_THICKNESS_SPECIFIC_RESULT_ROWS = {
  externalFramedWall70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["upperWallThicknessMm", "upperExternalWallsLm"], ["thirdWallThicknessMm", "thirdExternalWallsLm"]] },
  externalFramedWall90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["upperWallThicknessMm", "upperExternalWallsLm"], ["thirdWallThicknessMm", "thirdExternalWallsLm"]] },
  internalFramedWall70mmLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm", "lowerInternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
  internalFramedWall90mmLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm", "lowerInternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
  wallPlatesNoggins70mmExternalWallsLm: { thickness: "70", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["upperWallThicknessMm", "upperExternalWallsLm"], ["thirdWallThicknessMm", "thirdExternalWallsLm"]] },
  wallPlatesNoggins90mmExternalWallsLm: { thickness: "90", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["upperWallThicknessMm", "upperExternalWallsLm"], ["thirdWallThicknessMm", "thirdExternalWallsLm"]] },
  wallPlatesNoggins70mmInternalWallsLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm", "lowerInternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
  wallPlatesNoggins90mmInternalWallsLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm", "lowerInternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
  lowerStudMaterial70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["lowerInternalWallThicknessMm", "lowerInternalWallsLm"]] },
  upperStudMaterial70mmLm: { thickness: "70", pairs: [["upperWallThicknessMm", "upperExternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"]] },
  thirdStudMaterial70mmLm: { thickness: "70", pairs: [["thirdWallThicknessMm", "thirdExternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
  lowerStudMaterial90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm", "lowerExternalWallsLm"], ["lowerInternalWallThicknessMm", "lowerInternalWallsLm"]] },
  upperStudMaterial90mmLm: { thickness: "90", pairs: [["upperWallThicknessMm", "upperExternalWallsLm"], ["upperInternalWallThicknessMm", "upperInternalWallsLm"]] },
  thirdStudMaterial90mmLm: { thickness: "90", pairs: [["thirdWallThicknessMm", "thirdExternalWallsLm"], ["thirdInternalWallThicknessMm", "thirdInternalWallsLm"]] },
};

const HIDDEN_DATA_INPUT_ROW_KEYS = new Set([
  "ceilingAreaM2",
  "totalExternalWallsLm",
  "totalInternalWallsLm",
  "total70mmWallsLm",
  "total90mmWallsLm",
  "externalFramedWallLm",
  "internalFramedWallLm",
  "studsEach",
  "externalWallPlatesLm",
  "internalWallPlatesLm",
  "wallPlatesNoggins70mmLm",
  "wallPlatesNoggins90mmLm",
  "lowerStudMaterialLm",
  "upperStudMaterialLm",
  "thirdStudMaterialLm",
  "totalStudMaterialLm",
  "totalTimberFramingLm",
  "totalTimberLengthsEach",
]);

const TEMPLATE_SETUP_DATA_KEYS = new Set([
  "floorCount",
  "frameMethod",
  "lowerFloorType",
  "upperFloorType",
  "thirdFloorType",
  "lowerFloorDepthMm",
  "upperFloorDepthMm",
  "thirdFloorDepthMm",
  "lowerCeilingHeight",
  "upperCeilingHeight",
  "thirdCeilingHeight",
  "lowerWallSystem",
  "upperWallSystem",
  "thirdWallSystem",
  "lowerWallThicknessMm",
  "upperWallThicknessMm",
  "thirdWallThicknessMm",
  "lowerInternalWallThicknessMm",
  "upperInternalWallThicknessMm",
  "thirdInternalWallThicknessMm",
  "lowerExternalWallLining",
  "lowerInternalWallSystem",
  "upperExternalWallLining",
  "upperInternalWallSystem",
  "thirdExternalWallLining",
  "thirdInternalWallSystem",
  "roofPitchDegrees",
  "roofType",
  "roofStyle",
  "eavesWidthM",
  "salesCommissionPercent",
  "overheadsPercent",
  "marginPercent",
  "profitPercent",
]);

function sanitizeWorkbookForTemplate(sourceWorkbook = {}, options = {}) {
  const savedAt = options.savedAt || new Date().toISOString();
  const name = String(options.name || sourceWorkbook.templateName || suggestedTemplateName(sourceWorkbook)).trim();
  const templateKey = templateStorageKey(name);
  const category = String(options.category ?? sourceWorkbook.templateCategory ?? "").trim();
  const tags = Array.isArray(options.tags) ? options.tags : parseTags(options.tags ?? sourceWorkbook.templateTags);
  const workbook = normalizeWorkbook(sourceWorkbook);
  return compactWorkbookForStorage(normalizeWorkbook({
    ...workbook,
    page: "dataInput",
    savedAt,
    templateName: name,
    templateKey,
    templateCategory: category,
    templateTags: tags.join(", "),
    activeSection: "inputDataSheet",
    data: sanitizeTemplateData(workbook.data),
    windowsDoors: sanitizeTemplateWindows(workbook.windowsDoors),
    quotation: sanitizeTemplateQuotation(workbook.quotation),
    formulaHistory: [],
    quoteHistory: [],
    formulaPromotions: {},
    ratePromotions: [],
  }));
}

function compactWorkbookForStorage(workbook = {}) {
  const {
    importedWorkbook,
    importedSheets,
    importReport,
    ...compact
  } = workbook;
  return compact;
}

function sanitizeTemplateData(data = {}) {
  const rowDefinitions = Object.fromEntries(V4_DATA_SECTIONS.flatMap((section) => section.rows.map((row) => [row.key, row])));
  return Object.fromEntries(Object.entries(data || {}).map(([sectionKey, section]) => [
    sectionKey,
    {
      ...section,
      collapsed: false,
      rows: Object.fromEntries(Object.entries(section?.rows || {}).map(([rowKey, row]) => {
        const definition = rowDefinitions[rowKey] || {};
        const keepValue = shouldKeepTemplateDataValue(rowKey, definition);
        return [rowKey, {
          ...row,
          value: keepValue ? row?.value ?? "" : "",
          notes: "",
        }];
      })),
    },
  ]));
}

function shouldKeepTemplateDataValue(rowKey, definition = {}) {
  return TEMPLATE_SETUP_DATA_KEYS.has(rowKey) || Array.isArray(definition.options);
}

function sanitizeTemplateWindows(rows = []) {
  return (rows || []).map((row) => ({
    ...row,
    rate: "",
    cost: "",
    notes: "",
  }));
}

function sanitizeTemplateQuotation(quotation = {}) {
  return Object.fromEntries(Object.entries(quotation || {}).map(([sectionName, section]) => [
    sectionName,
    {
      ...section,
      rows: (section?.rows || []).map((row) => ({
        ...row,
        quantity: "",
        importedQuantity: "",
        quantityManualOverride: false,
        autoQuantity: false,
        supplierQuote: "",
        importedCost: "",
        notes: "",
      })),
    },
  ]));
}

function suggestedTemplateName(workbook = {}) {
  const floorCount = dataValue(workbook, "floorCount") || "Estimate";
  const lowerFloorType = dataValue(workbook, "lowerFloorType");
  const roofType = dataValue(workbook, "roofType");
  return [floorCount, lowerFloorType, roofType].filter(Boolean).join(" - ") || "Estimate template";
}

function promptForTemplateKey(templates = []) {
  const labels = templates.map((template, index) => `${index + 1}. ${template.name}`).join("\n");
  const answer = window.prompt(`Load which template?\n${labels}`, templates[0]?.name || "");
  const text = String(answer || "").trim();
  if (!text) return "";
  const byIndex = Number(text);
  if (Number.isInteger(byIndex) && templates[byIndex - 1]) return templates[byIndex - 1].key;
  return templates.find((template) => template.name.toLowerCase() === text.toLowerCase())?.key || "";
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function currentTemplateOwnerId() {
  if (typeof window === "undefined") return "server";
  const storageKey = "estimate-builder-template-owner-id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `local:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return "local:unavailable";
  }
}

const TEMPLATE_DB_NAME = "estimate-builder-template-db";
const TEMPLATE_STORE_NAME = "templates";
const TEMPLATE_KEY = "current";
const TEMPLATE_POINTER_KEY = "active-template-key";
const JOB_STORE_NAME = "jobs";
const ACTIVE_JOB_KEY = "active-job";

function openTemplateDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = window.indexedDB.open(TEMPLATE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
        db.createObjectStore(TEMPLATE_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(JOB_STORE_NAME)) {
        db.createObjectStore(JOB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open template storage"));
  });
}

function loadLocalDraft() {
  try {
    const raw = window.localStorage.getItem("estimate-builder-active-draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function workbookJobKey(workbook = {}) {
  const registeredId = String(workbook?.registeredJob?.jobId || "").trim();
  if (registeredId) return `job:${registeredId}`;
  const projectName = dataValue(workbook, "projectName") || workbook?.registeredJob?.jobName || workbook?.templateName || "active-estimate-job";
  const slugged = slug(projectName) || "active-estimate-job";
  return `job:${slugged}`;
}

function workbookJobName(workbook = {}) {
  return dataValue(workbook, "projectName") || workbook?.registeredJob?.jobName || workbook?.templateName || "Estimate job";
}

function slug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function saveStoredJob(workbook, savedAt = new Date().toISOString()) {
  const savedWorkbook = compactWorkbookForStorage({ ...workbook, savedAt });
  const key = workbookJobKey(savedWorkbook);
  const record = {
    type: "job",
    key,
    name: workbookJobName(savedWorkbook),
    savedAt,
    workbook: savedWorkbook,
  };
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE_NAME, "readwrite");
    const store = transaction.objectStore(JOB_STORE_NAME);
    store.put(record, key);
    store.put(record, ACTIVE_JOB_KEY);
    store.put({ ...record, key: `${key}:snapshot:${savedAt}` }, `${key}:snapshot:${savedAt}`);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error("Could not save estimate job");
      db.close();
      reject(error);
    };
  });
}

async function loadLatestStoredJob() {
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE_NAME, "readonly");
    const request = transaction.objectStore(JOB_STORE_NAME).get(ACTIVE_JOB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not load saved estimate job"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not read estimate jobs"));
    };
  });
}

async function saveStoredTemplate(name, workbook, options = {}) {
  const ownerId = currentTemplateOwnerId();
  const key = options.key || workbook?.templateKey || (options.createNew ? uniqueTemplateStorageKey(name) : templateStorageKey(name));
  const existing = await loadStoredTemplateRecord(key).catch(() => null);
  const savedAt = workbook?.savedAt || new Date().toISOString();
  const previousVersion = existing?.workbook ? {
    versionId: `version:${existing.savedAt || existing.modifiedAt || Date.now()}`,
    savedAt: existing.savedAt || existing.modifiedAt || savedAt,
    name: existing.name,
    workbook: existing.workbook,
  } : null;
  const versions = [
    ...(Array.isArray(existing?.versions) ? existing.versions : []),
    ...(previousVersion ? [previousVersion] : []),
  ].slice(-25);
  const templateName = String(name || workbook?.templateName || "Estimate template").trim();
  const category = String(options.category ?? workbook?.templateCategory ?? existing?.category ?? "").trim();
  const tags = Array.isArray(options.tags) ? options.tags : parseTags(options.tags ?? workbook?.templateTags ?? existing?.tags);
  const createdAt = existing?.createdAt || savedAt;
  const savedWorkbook = compactWorkbookForStorage({
    ...workbook,
    templateKey: key,
    templateName,
    templateCategory: category,
    templateTags: tags.join(", "),
    savedAt,
  });
  const record = {
    type: "template",
    key,
    id: key,
    owner_id: ownerId,
    name: templateName,
    category,
    tags,
    thumbnail: options.thumbnail || existing?.thumbnail || "",
    createdAt,
    modifiedAt: savedAt,
    savedAt,
    versions,
    workbook: savedWorkbook,
  };
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TEMPLATE_STORE_NAME);
    store.put(record, key);
    store.put(record.workbook, TEMPLATE_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error("Could not save template");
      db.close();
      reject(error);
    };
  });
}

async function saveStoredTemplatePointer(key) {
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(TEMPLATE_STORE_NAME).put(key, TEMPLATE_POINTER_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error("Could not save template pointer");
      db.close();
      reject(error);
    };
  });
}

async function loadStoredTemplateRecord(key = "") {
  if (!key) return null;
  const db = await openTemplateDb();
  const ownerId = currentTemplateOwnerId();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(TEMPLATE_STORE_NAME).get(key);
    request.onsuccess = () => {
      const record = request.result || null;
      if (record?.type === "template" && record.owner_id && record.owner_id !== ownerId) {
        resolve(null);
        return;
      }
      resolve(record);
    };
    request.onerror = () => reject(request.error || new Error("Could not load template"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not load template"));
    };
  });
}

async function loadStoredTemplate(key = "") {
  const db = await openTemplateDb();
  const ownerId = currentTemplateOwnerId();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readonly");
    const store = transaction.objectStore(TEMPLATE_STORE_NAME);
    const request = key ? store.get(key) : store.get(TEMPLATE_POINTER_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (key) {
        if (result?.type === "template" && result.owner_id && result.owner_id !== ownerId) {
          resolve(null);
          return;
        }
        resolve(result?.workbook || result || null);
        return;
      }
      const activeKey = typeof result === "string" ? result : "";
      if (!activeKey) {
        const fallback = store.get(TEMPLATE_KEY);
        fallback.onsuccess = () => resolve(fallback.result?.workbook || fallback.result || null);
        fallback.onerror = () => reject(fallback.error || new Error("Could not load template"));
        return;
      }
      const active = store.get(activeKey);
      active.onsuccess = () => {
        const activeResult = active.result;
        if (activeResult?.type === "template" && activeResult.owner_id && activeResult.owner_id !== ownerId) {
          resolve(null);
          return;
        }
        resolve(activeResult?.workbook || activeResult || null);
      };
      active.onerror = () => reject(active.error || new Error("Could not load template"));
    };
    request.onerror = () => reject(request.error || new Error("Could not load template"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not load template"));
    };
  });
}

async function listStoredTemplates() {
  const db = await openTemplateDb();
  const ownerId = currentTemplateOwnerId();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(TEMPLATE_STORE_NAME).getAll();
    request.onsuccess = () => {
      const templates = (request.result || [])
        .filter((record) => record?.type === "template" && record?.key && record?.name)
        .filter((record) => !record.owner_id || record.owner_id === ownerId)
        .map((record) => ({
          key: record.key,
          id: record.id || record.key,
          owner_id: record.owner_id || ownerId,
          name: record.name,
          category: record.category || "",
          tags: Array.isArray(record.tags) ? record.tags : parseTags(record.tags),
          thumbnail: record.thumbnail || "",
          createdAt: record.createdAt || record.savedAt || "",
          modifiedAt: record.modifiedAt || record.savedAt || "",
          savedAt: record.savedAt || record.modifiedAt || "",
          versions: Array.isArray(record.versions) ? record.versions.map((version, index) => ({
            versionId: version.versionId || `version:${index + 1}`,
            savedAt: version.savedAt || "",
            name: version.name || record.name,
          })) : [],
        }))
        .sort((a, b) => String(b.modifiedAt || b.savedAt || "").localeCompare(String(a.modifiedAt || a.savedAt || "")));
      resolve(templates);
    };
    request.onerror = () => reject(request.error || new Error("Could not list templates"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not list templates"));
    };
  });
}

async function deleteStoredTemplate(key) {
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(TEMPLATE_STORE_NAME).delete(key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error("Could not delete template");
      db.close();
      reject(error);
    };
  });
}

function uniqueTemplateStorageKey(name) {
  return `${templateStorageKey(name)}:${Date.now().toString(36)}`;
}

function templateStorageKey(name) {
  const base = String(name || "estimate-template")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "estimate-template";
  return `template:${base}`;
}
