import { useMemo, useState } from "react";
import { V3_DATA_SECTIONS, V3_PAGES, V3_QUOTATION_SECTIONS, V3_WINDOW_DOOR_TYPES } from "../../lib/construction-estimation/estimateWorksheetV3Schema.js";
import { createEstimateWorksheetV3Defaults } from "../../lib/construction-estimation/estimateWorksheetV3Defaults.js";
import { calculateEstimateWorksheetV3 } from "../../lib/construction-estimation/estimateWorksheetV3Calculations.js";

export function useEstimateWorksheetV3(plannerAnswers = {}) {
  const [worksheet, setWorksheet] = useState(() => createEstimateWorksheetV3Defaults(plannerAnswers));
  const preview = useMemo(() => calculateEstimateWorksheetV3(worksheet), [worksheet]);

  function setPage(page) {
    setWorksheet((current) => ({ ...current, page }));
  }

  function setActiveSection(activeSection) {
    setWorksheet((current) => ({ ...current, page: "dataInput", activeSection }));
  }

  function toggleDataSection(sectionKey) {
    setWorksheet((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: { ...current.sections[sectionKey], collapsed: !current.sections[sectionKey].collapsed },
      },
    }));
  }

  function updateDataRow(sectionKey, rowKey, field, value) {
    setWorksheet((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: {
          ...current.sections[sectionKey],
          rows: {
            ...current.sections[sectionKey].rows,
            [rowKey]: { ...current.sections[sectionKey].rows[rowKey], [field]: value },
          },
        },
      },
    }));
  }

  function updateWindowDoor(id, field, value) {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.map((row) => row.id === id ? { ...row, [field]: value } : row),
    }));
  }

  function addWindowDoor() {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: [...current.windowsDoors, {
        id: `wd-v3-${Date.now()}`,
        code: "NEW",
        type: "Fixed Window",
        quantity: 1,
        width: 1.2,
        height: 1.2,
        notes: "",
      }],
    }));
  }

  function deleteWindowDoor(id) {
    setWorksheet((current) => ({
      ...current,
      windowsDoors: current.windowsDoors.filter((row) => row.id !== id),
    }));
  }

  function toggleQuotationSection(section) {
    setWorksheet((current) => ({
      ...current,
      quotation: {
        ...current.quotation,
        [section]: { ...current.quotation[section], collapsed: !current.quotation[section].collapsed },
      },
    }));
  }

  function updateQuotationRow(section, rowId, field, value) {
    setWorksheet((current) => ({
      ...current,
      quotation: {
        ...current.quotation,
        [section]: {
          ...current.quotation[section],
          rows: current.quotation[section].rows.map((row) => row.id === rowId ? { ...row, [field]: value } : row),
        },
      },
    }));
  }

  return {
    pages: V3_PAGES,
    dataSections: V3_DATA_SECTIONS,
    quotationSections: V3_QUOTATION_SECTIONS,
    windowDoorTypes: V3_WINDOW_DOOR_TYPES,
    worksheet,
    preview,
    setPage,
    setActiveSection,
    toggleDataSection,
    updateDataRow,
    updateWindowDoor,
    addWindowDoor,
    deleteWindowDoor,
    toggleQuotationSection,
    updateQuotationRow,
  };
}
