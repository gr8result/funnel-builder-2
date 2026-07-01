import { useMemo, useState } from "react";
import { V4_DATA_SECTIONS, V4_PAGES, V4_QUOTE_SECTIONS, V4_WINDOW_TYPES } from "../../lib/construction-estimation/estimateWorksheetV4Schema.js";
import { createEstimateWorksheetV4Defaults } from "../../lib/construction-estimation/estimateWorksheetV4Defaults.js";
import { calculateEstimateWorksheetV4 } from "../../lib/construction-estimation/estimateWorksheetV4Calculations.js";

export function useEstimateWorksheetV4(plannerAnswers = {}) {
  const [workbook, setWorkbook] = useState(() => createEstimateWorksheetV4Defaults(plannerAnswers));
  const [lineSearch, setLineSearch] = useState("");
  const preview = useMemo(() => calculateEstimateWorksheetV4(workbook), [workbook]);

  function setPage(page) { setWorkbook((current) => ({ ...current, page })); }
  function toggleDataSection(section) {
    setWorkbook((current) => ({ ...current, data: { ...current.data, [section]: { ...current.data[section], collapsed: !current.data[section].collapsed } } }));
  }
  function updateData(section, key, value) {
    setWorkbook((current) => ({ ...current, data: { ...current.data, [section]: { ...current.data[section], rows: { ...current.data[section].rows, [key]: { ...current.data[section].rows[key], value } } } } }));
  }
  function updateFormula(key, value) {
    setWorkbook((current) => ({ ...current, formulas: { ...(current.formulas || {}), [key]: value } }));
  }
  function updateWindow(id, key, value) {
    setWorkbook((current) => ({ ...current, windowsDoors: current.windowsDoors.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  }
  function addWindow() {
    setWorkbook((current) => ({ ...current, windowsDoors: [...current.windowsDoors, { id: `wd4-${Date.now()}`, code: "NEW", type: "Fixed Window", quantity: 1, width: 1.2, height: 1.2, notes: "" }] }));
  }
  function deleteWindow(id) {
    setWorkbook((current) => ({ ...current, windowsDoors: current.windowsDoors.filter((row) => row.id !== id) }));
  }
  function toggleQuoteSection(section) {
    setWorkbook((current) => ({ ...current, quotation: { ...current.quotation, [section]: { ...current.quotation[section], collapsed: !current.quotation[section].collapsed } } }));
  }
  function updateQuote(section, id, key, value) {
    setWorkbook((current) => ({ ...current, quotation: { ...current.quotation, [section]: { ...current.quotation[section], rows: current.quotation[section].rows.map((row) => row.id === id ? { ...row, [key]: value } : row) } } }));
  }

  return {
    pages: V4_PAGES,
    dataSections: V4_DATA_SECTIONS,
    quoteSections: V4_QUOTE_SECTIONS,
    windowTypes: V4_WINDOW_TYPES,
    workbook,
    preview,
    lineSearch,
    setLineSearch,
    setPage,
    toggleDataSection,
    updateData,
    updateFormula,
    updateWindow,
    addWindow,
    deleteWindow,
    toggleQuoteSection,
    updateQuote,
  };
}
