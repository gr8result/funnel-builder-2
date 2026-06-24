import { useEffect, useRef, useState } from "react";
import { useEstimateBuilderWorkbook } from "../../hooks/estimate-builder/useEstimateBuilderWorkbook";
import { V4_DEFAULT_FORMULAS } from "../../lib/construction-estimation/estimateBuilderWorkbookCalculations";
import { V4_DATA_SECTIONS } from "../../lib/construction-estimation/estimateWorksheetV4Schema";

const DATA_INPUT_SECTIONS_FOR_LOOKUP = V4_DATA_SECTIONS || [];

export default function EstimateBuilderWorkbook({ previewMode = false } = {}) {
  const sheet = useEstimateBuilderWorkbook({}, { previewMode });
  const jobFileInputRef = useRef(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [formulaTarget, setFormulaTarget] = useState(null);
  const currentPage = sheet.pages.find((page) => page.key === sheet.workbook.page);
  const openFileName = openWorkbookFileName(sheet.workbook);
  const lockHandlers = previewMode ? previewProtectionHandlers : {};

  return (
    <div style={{ ...styles.shell, ...(previewMode ? styles.previewShell : {}) }} {...lockHandlers}>
      <aside style={styles.nav}>
        <div style={styles.eyebrow}>Estimate Builder</div>
        <h2 style={styles.navTitle}>{previewMode ? "Preview" : "Workbook"}</h2>
        {sheet.pages.map((page) => (
          <button
            key={page.key}
            style={{ ...styles.navButton, ...(sheet.workbook.page === page.key ? styles.navButtonActive : {}) }}
            onClick={() => sheet.setPage(page.key)}
          >
            {page.label}
          </button>
        ))}
        <div style={styles.navNote}>
          {previewMode
            ? "Preview mode is blank and locked. Data entry, editing, copying, saving, and exports are disabled."
            : "Data Input feeds calculations, quotation rows, subtotals, margin, GST, and final quote total. Rates stay editable in the quotation sheet."}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.eyebrow}>Clean workbook import</div>
            <h1 style={styles.pageTitle}>{currentPage?.label}</h1>
          </div>
          <div style={styles.openFileBanner}>
            <span style={styles.openFileLabel}>Open file</span>
            <span style={styles.openFileName}>{previewMode ? "Preview - blank locked estimator" : openFileName}</span>
          </div>
          <div style={styles.topControls}>
            {previewMode ? (
              <span style={styles.lockedBadge}>Locked Preview</span>
            ) : (
              <>
            <FileMenu
              open={fileMenuOpen}
              onToggle={() => setFileMenuOpen((current) => !current)}
              onClose={() => setFileMenuOpen(false)}
              items={[
                { label: "Save", action: sheet.saveDraft, primary: true },
                { label: "Save As Job File", action: () => saveJobFile(sheet) },
                { label: "Open Job File", action: () => jobFileInputRef.current?.click() },
                { label: "Load Saved Draft", action: sheet.loadDraft },
                { label: "Export CSV", action: () => exportCurrentPageCsv(sheet) },
              ]}
            />
            <TemplateFileMenu
              sheet={sheet}
              open={templateMenuOpen}
              onToggle={() => setTemplateMenuOpen((current) => !current)}
              onClose={() => setTemplateMenuOpen(false)}
            />
            <input
              ref={jobFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(event) => openJobFile(event, sheet)}
            />
            {sheet.lastSavedAt && <span style={styles.savedText}>Saved {new Date(sheet.lastSavedAt).toLocaleTimeString()}</span>}
            {sheet.workbook.page === "quotation" && (
              <>
                <input
                  style={styles.searchInput}
                  placeholder="Search line item"
                  value={sheet.lineSearch}
                  onChange={(event) => sheet.setLineSearch(event.target.value)}
                />
                <label style={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={sheet.hideUnused}
                    onChange={(event) => sheet.setHideUnused(event.target.checked)}
                  />
                  Hide unused
                </label>
              </>
            )}
              </>
            )}
          </div>
        </div>

        <fieldset disabled={previewMode} style={styles.previewFieldset}>
          {sheet.workbook.page === "dataInput" && (
            <DataInputSheet
              sheet={sheet}
              formulaTarget={formulaTarget}
              onPickFormulaReference={(key) => insertQuoteQuantityReference(sheet, formulaTarget, key)}
            />
          )}
          {sheet.workbook.page === "windowsDoors" && <WindowsDoorsSheet sheet={sheet} />}
          {sheet.workbook.page === "formulaSheet" && (
            <FormulaSheet
              sheet={sheet}
              formulaTarget={formulaTarget}
              onPickFormulaReference={(key) => insertQuoteQuantityReference(sheet, formulaTarget, key)}
            />
          )}
          {sheet.workbook.page === "quotation" && <QuotationSheet sheet={sheet} onFormulaTarget={setFormulaTarget} />}
          {sheet.workbook.page === "summary" && <SummarySheet sheet={sheet} />}
          {sheet.workbook.page === "clientPage" && <ClientPageSheet sheet={sheet} />}
        </fieldset>
      </main>

      <aside style={styles.summary}>
        {sheet.workbook.page === "clientPage" ? (
          <>
            <div style={styles.eyebrow}>Client Quote</div>
            <h2 style={styles.navTitle}>Presentation Total</h2>
            <div style={styles.finalBox}>
              <span>Total quoted price</span>
              <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
            </div>
          </>
        ) : (
          <>
            <div style={styles.eyebrow}>Live Summary</div>
            <h2 style={styles.navTitle}>Quote Totals</h2>
            <SummaryRow label="Base line item subtotal" value={money(sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin)} />
            <SummaryRow label={`Preliminaries ${sheet.preview.summary.preliminaryCostsPercent || 0}%`} value={money(sheet.preview.summary.preliminaryCostsAmount)} />
            <SummaryRow label={`Overheads ${sheet.preview.summary.overheadsPercent}%`} value={money(sheet.preview.summary.overheadsAmount)} />
            <SummaryRow label={`Materials & labour margin ${sheet.preview.summary.marginPercent}%`} value={money(sheet.preview.summary.marginAmount)} />
            <SummaryRow label={`Profit ${sheet.preview.summary.profitPercent}%`} value={money(sheet.preview.summary.profitAmount)} />
            <SummaryRow label={`GST ${sheet.preview.summary.gstPercent || 10}%`} value={money(sheet.preview.summary.gst)} />
            <SummaryRow label="QBSA registration" value={money(sheet.preview.summary.qbsaRegistration)} />
            <SummaryRow label="Q Leave fees" value={money(sheet.preview.summary.qLeaveFees)} />
            <SummaryRow label={`Sales commission ${sheet.preview.summary.salesCommissionPercent}%`} value={money(sheet.preview.summary.salesCommissionAmount)} />
            <div style={styles.finalBox}>
              <span>Final quote total</span>
              <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
            </div>
          </>
        )}
        {sheet.workbook.page !== "clientPage" && (
          <>
            <Panel title="Missing Required Inputs">
              {sheet.preview.missingRequired.length ? (
                sheet.preview.missingRequired.map((item) => (
                  <span key={`${item.section}-${item.key}`} style={styles.warningPill}>
                    {pretty(item.key)}
                  </span>
                ))
              ) : (
                <span style={styles.okPill}>Required inputs complete</span>
              )}
            </Panel>
            <Panel title="Quote / Rate Review">
              {quoteReviewRows(sheet).slice(0, 10).map((row) => (
                <SummaryRow key={`${row.item}-${row.sourceOfRate}`} label={row.item} value={row.sourceOfRate} />
              ))}
            </Panel>
          </>
        )}
      </aside>
    </div>
  );
}

function DataInputSheet({ sheet, formulaTarget, onPickFormulaReference }) {
  const readonly = sheet.previewMode;
  return (
    <div style={styles.pageStack}>
      {sheet.dataInputSections.map((section) => (
        <section key={section.key} style={styles.section}>
          <button style={styles.sectionHeader} onClick={() => sheet.toggleDataSection(section.key)}>
            <span>{section.label}</span>
            <span>{sheet.workbook.data?.[section.key]?.collapsed ? "Show" : "Hide"}</span>
          </button>
          {!sheet.workbook.data?.[section.key]?.collapsed && (
            <>
            {!readonly && <button style={styles.addLineButton} onClick={() => sheet.addDataRow(section.key)}>Add new row</button>}
            <Spreadsheet
              headers={readonly ? ["#", "Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result"] : ["#", "Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result", "Actions"]}
              compactColumns={[0]}
            >
              {section.rows.map((row, rowIndex) => {
                const saved = sheet.workbook.data?.[section.key]?.rows?.[row.key] || {};
                const calculated = row.calculated;
                const tone = levelTone(row);
                const editId = rowDomId("data-edit", section.key, row.key);
                if (row.heading) {
                  const subheading = row.subheading;
                  return (
                    <tr key={row.key}>
                      <Cell compact heading={!subheading} subheading={subheading} tone={tone}>
                        <span style={styles.dataRowNumber}>{dataInputRowNumber(row, rowIndex)}</span>
                      </Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone}>{row.label}</Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      <Cell heading={!subheading} subheading={subheading} tone={tone}>{row.userNote || ""}</Cell>
                      <Cell heading={!subheading} subheading={subheading} tone={tone} />
                      {!readonly && <Cell heading={!subheading} subheading={subheading} tone={tone} />}
                    </tr>
                  );
                }
                return (
                  <tr key={row.key}>
                    <Cell compact tone={tone}>
                      <span style={styles.dataRowNumber}>{dataInputRowNumber(row, rowIndex)}</span>
                    </Cell>
                    <Cell tone={tone}>{row.sectionLabel}</Cell>
                    <Cell strong tone={tone}>
                      {row.custom ? (
                        <BufferedInput
                          id={editId}
                          style={styles.itemInput}
                          value={row.label || ""}
                          onCommit={(next) => sheet.updateDataRowMeta(section.key, row.key, "label", next)}
                        />
                      ) : row.label}
                    </Cell>
                    <Cell tone={tone}>
                      {calculated ? (
                        <span style={styles.readOnly}>{value(sheet.preview.quantities[row.key])}</span>
                      ) : row.options ? (
                        <select
                          id={editId}
                          style={styles.input}
                          value={selectInputValue(row, saved)}
                          onChange={(event) => sheet.updateData(section.key, row.key, "value", event.target.value)}
                        >
                          {row.options.map((option) => <option key={option}>{option}</option>)}
                        </select>
                      ) : (
                        <BufferedInput
                          id={editId}
                          style={styles.input}
                          value={editableInputValue(sheet, row, saved)}
                          onCommit={(next) => sheet.updateData(section.key, row.key, "value", next)}
                        />
                      )}
                    </Cell>
                    <Cell tone={tone}>
                      {row.custom ? (
                        <BufferedInput
                          style={styles.unitInput}
                          value={row.unit || ""}
                          onCommit={(next) => sheet.updateDataRowMeta(section.key, row.key, "unit", next)}
                        />
                      ) : row.unit}
                    </Cell>
                    <Cell tone={tone}>
                      {calculated && !readonly ? (
                        <BufferedInput
                          id={editId}
                          style={styles.formulaInput}
                          value={dataInputFormulaForRow(sheet, row) || formulaForRow(sheet, row)}
                          onCommit={(next) => sheet.updateFormula(row.key, next)}
                        />
                      ) : calculated || row.formula || dataInputFormulaForRow(sheet, row) ? (
                        <span id={editId} tabIndex={-1} style={styles.formulaText}>{dataInputFormulaForRow(sheet, row) || formulaForRow(sheet, row)}</span>
                      ) : (
                        <BufferedInput style={styles.input} value={saved.notes || row.userNote || ""} onCommit={(next) => sheet.updateData(section.key, row.key, "notes", next)} />
                      )}
                    </Cell>
                    <Cell final={calculated} tone={tone}>
                      {calculated ? (
                        <button
                          style={formulaPickButtonStyle(formulaTarget)}
                          title={formulaTarget ? `Insert ${row.key}` : row.key}
                          onClick={() => formulaTarget && onPickFormulaReference(row.key)}
                        >
                          {value(sheet.preview.quantities[row.key])}
                        </button>
                      ) : ""}
                    </Cell>
                    {!readonly && <Cell tone={tone}>
                      <div style={styles.rowActions}>
                        <button style={styles.smallButton} onClick={() => focusRowEditor(editId)}>Edit</button>
                        <button style={styles.smallButton} onClick={() => sheet.addDataRow(section.key, row.key, "after")}>Insert below</button>
                        {!isRequiredDataInputRow(row.key) && <button style={styles.dangerButton} onClick={() => sheet.deleteDataRow(section.key, row.key)}>Delete</button>}
                      </div>
                    </Cell>}
                  </tr>
                );
              })}
            </Spreadsheet>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function WindowsDoorsSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const [openGroups, setOpenGroups] = useState({});
  const groups = windowDoorGroups(sheet.preview.windowsDoors.rows);
  const levelWarning = windowDoorLevelWarning(sheet.preview.windowsDoors.rows);
  const toggleGroup = (key) => setOpenGroups((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div style={styles.pageStack}>
      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>
          <span>Windows & Doors Schedule</span>
          {!readonly && <button style={styles.headerButton} onClick={sheet.resetWindowsDoorsFromExcel}>Reset from Excel sheet</button>}
        </div>
        {groups.map((group) => (
          <div key={group.key} style={styles.subSection}>
            <button style={styles.subSectionHeader} onClick={() => toggleGroup(group.key)}>
              <span>{group.label}</span>
              <span>{group.rows.length} lines - {openGroups[group.key] ? "Hide" : "Show"}</span>
            </button>
            {openGroups[group.key] && (
              <>
                {!readonly && <button style={styles.addLineButton} onClick={() => sheet.addWindow(group.rows[group.rows.length - 1]?.id || null, "after", null, group.defaultType, group.label)}>Add new row</button>}
                <Spreadsheet headers={readonly ? ["SIZE", "RANGE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE"] : ["SIZE", "RANGE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE", "Actions"]}>
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <Cell>
                        <select
                          id={rowDomId("window-edit", row.id)}
                          style={styles.itemInput}
                          value={row.code || ""}
                          onChange={(event) => (
                            sheet.updateWindowOption
                              ? sheet.updateWindowOption(row.id, event.target.value)
                              : sheet.updateWindow(row.id, "code", event.target.value)
                          )}
                        >
                          {windowSizeOptions(group.rows, row.code, row).map((option) => (
                            <option key={option} value={option}>{option || "Select size"}</option>
                          ))}
                        </select>
                      </Cell>
                      <Cell>
                        {(sheet.doorScheduleRangeOptions?.(row) || []).length ? (
                          <select
                            style={styles.itemInput}
                            value={row.doorRange || ""}
                            onChange={(event) => sheet.updateWindowDoorRange(row.id, event.target.value)}
                          >
                            {(sheet.doorScheduleRangeOptions?.(row) || []).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : ""}
                      </Cell>
                      <Cell><BufferedInput style={styles.numberInput} value={value(row.quantity)} onCommit={(next) => sheet.updateWindow(row.id, "quantity", next)} /></Cell>
                      <Cell>
                        <select style={styles.unitInput} value={levelDisplayValue(row.level)} onChange={(event) => sheet.updateWindow(row.id, "level", event.target.value)}>
                          <option value="">Level</option>
                          {["Ground Level", "Second Level", "Third Level"].map((level) => <option key={level} value={level}>{level}</option>)}
                        </select>
                      </Cell>
                      <Cell><BufferedInput inputMode="decimal" style={styles.numberInput} value={value(row.height)} onCommit={(next) => sheet.updateWindow(row.id, "height", next)} /></Cell>
                      <Cell><BufferedInput inputMode="decimal" style={styles.numberInput} value={value(row.width)} onCommit={(next) => sheet.updateWindow(row.id, "width", next)} /></Cell>
                      <Cell final>{value(row.totalArea)}</Cell>
                      <Cell final>{value(row.sillLength)}</Cell>
                      <Cell final>{value(row.architraveLength)}</Cell>
                      <Cell>
                        {readonly
                          ? value(row.rate)
                          : <BufferedInput style={styles.rateInput} value={value(row.rate)} onCommit={(next) => sheet.updateWindowRate(row.id, next)} />}
                      </Cell>
                      {!readonly && <Cell>
                        <div style={styles.rowActions}>
                          <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("window-edit", row.id))}>Edit</button>
                          <button style={styles.smallButton} onClick={() => sheet.addWindow(row.id, "after", row.id, group.defaultType, group.label)}>Insert below</button>
                          <button style={styles.dangerButton} onClick={() => sheet.deleteWindow(row.id)}>Delete</button>
                        </div>
                      </Cell>}
                    </tr>
                  ))}
                </Spreadsheet>
              </>
            )}
          </div>
        ))}
        <Spreadsheet headers={readonly ? ["Total", "RANGE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE"] : ["Total", "RANGE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "PRICE", "Actions"]}>
          <tr>
            <Cell strong>Total Area</Cell>
            <Cell />
            <Cell final>{value(sheet.preview.windowsDoors.totals.windowCount)}</Cell>
            <Cell />
            <Cell />
            <Cell />
            <Cell final>{value(sheet.preview.windowsDoors.totals.totalArea)}</Cell>
            <Cell final>{value(sheet.preview.windowsDoors.totals.sillLength)}</Cell>
            <Cell final>{value(sheet.preview.windowsDoors.totals.architraveLength)}</Cell>
            <Cell />
            {!readonly && <Cell />}
          </tr>
        </Spreadsheet>
        <Spreadsheet headers={["Level", "Opening Area"]}>
          <tr><Cell strong>Ground Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.groundFloorArea)}</Cell></tr>
          <tr><Cell strong>Second Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.secondLevelArea)}</Cell></tr>
          <tr><Cell strong>Third Level openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.thirdLevelArea)}</Cell></tr>
          <tr><Cell strong>Total openings</Cell><Cell final>{value(sheet.preview.windowsDoors.totals.totalArea)}</Cell></tr>
        </Spreadsheet>
        {levelWarning && (
          <div style={styles.windowLevelWarning}>
            <strong>Level check warning</strong>
            <span>{levelWarning}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function FormulaSheet({ sheet, formulaTarget, onPickFormulaReference }) {
  const rows = formulaRows(sheet);
  const readonly = sheet.previewMode;
  return (
    <div style={styles.pageStack}>
      {!readonly && <button style={styles.addLineButton} onClick={() => sheet.addFormulaRow()}>Add new row</button>}
      <Spreadsheet headers={readonly ? ["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note"] : ["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note", "Actions"]}>
        {rows.map((row) => (
          <tr key={row.key}>
            <Cell strong>
              {row.custom ? (
                <BufferedInput
                  style={styles.itemInput}
                  value={row.label || ""}
                  onCommit={(next) => sheet.updateFormulaRowMeta(row.key, "label", next)}
                />
              ) : row.label}
            </Cell>
            <Cell>
              <BufferedInput
                id={rowDomId("formula-edit", row.key)}
                style={styles.formulaInput}
                value={formulaForRow(sheet, row)}
                onCommit={(next) => sheet.updateFormula(row.key, next)}
              />
            </Cell>
            <Cell final>
              <button
                style={formulaPickButtonStyle(formulaTarget)}
                title={formulaTarget ? `Insert ${row.key}` : row.key}
                onClick={() => formulaTarget && onPickFormulaReference(row.key)}
              >
                {value(sheet.preview.quantities[row.key])}
              </button>
            </Cell>
            <Cell>
              {row.custom ? (
                <BufferedInput
                  style={styles.unitInput}
                  value={row.unit || ""}
                  onCommit={(next) => sheet.updateFormulaRowMeta(row.key, "unit", next)}
                />
              ) : row.unit}
            </Cell>
            <Cell>
              <BufferedInput
                style={styles.input}
                placeholder="Why this formula changed for this job"
                value={sheet.workbook.formulaNotes?.[row.key] || ""}
                onCommit={(next) => sheet.updateFormulaNote(row.key, next)}
              />
            </Cell>
            {!readonly && <Cell>
              <div style={styles.rowActions}>
                <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("formula-edit", row.key))}>Edit</button>
                <button style={styles.smallButton} onClick={() => sheet.addFormulaRow(row.key, "after")}>Insert below</button>
                {!row.custom && <button style={styles.smallButton} onClick={() => sheet.requestPromoteFormula(row.key)}>Promote Later</button>}
                <button style={styles.dangerButton} onClick={() => sheet.deleteFormulaRow(row.key)}>Delete</button>
              </div>
            </Cell>}
          </tr>
        ))}
      </Spreadsheet>
      <HistoryPanel title="Formula Change History" rows={sheet.workbook.formulaHistory || []} />
    </div>
  );
}

function CalculatedQuantitiesSheet({ sheet }) {
  const floorCount = workbookDataValue(sheet.workbook, "floorCount") || "Single storey";
  return (
    <div style={styles.pageStack}>
      {sheet.dataSections.map((section) => {
        const rows = section.rows.filter((row) => row.calculated && isCalculatedRowVisible(row, sheet.workbook, floorCount));
        if (!rows.length) return null;
        return (
          <section key={section.key} style={styles.section}>
            <div style={styles.staticSectionHeader}>{section.label}</div>
            <Spreadsheet headers={["Quantity", "Result", "Unit", "Formula"]}>
              {rows.map((row) => (
                <tr key={row.key}>
                  <Cell strong>{row.label}</Cell>
                  <Cell final>{value(sheet.preview.quantities[row.key])}</Cell>
                  <Cell>{row.unit}</Cell>
                  <Cell><span style={styles.formulaText}>{formulaForRow(sheet, row)}</span></Cell>
                </tr>
              ))}
            </Spreadsheet>
          </section>
        );
      })}
    </div>
  );
}

function QuotationSheet({ sheet, onFormulaTarget }) {
  const readonly = sheet.previewMode;
  const search = sheet.lineSearch.trim().toLowerCase();
  const [orderManagerOpen, setOrderManagerOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [moveSectionNumber, setMoveSectionNumber] = useState("");
  const [moveAfterNumber, setMoveAfterNumber] = useState("");
  const [openApplianceBrands, setOpenApplianceBrands] = useState({});

  function openOrderManager() {
    setDraftOrder(topLevelQuoteSections(sheet.quoteSections));
    setMoveSectionNumber("");
    setMoveAfterNumber("");
    setOrderManagerOpen(true);
  }

  function closeOrderManager() {
    setOrderManagerOpen(false);
  }

  function moveDraftSection(section, direction) {
    setDraftOrder((current) => {
      const index = current.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moving] = next.splice(index, 1);
      next.splice(nextIndex, 0, moving);
      return next;
    });
  }

  function dragOrderStart(event, section) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", section);
  }

  function dropOrderSection(event, targetSection) {
    event.preventDefault();
    const movingSection = event.dataTransfer.getData("text/plain");
    if (!movingSection || movingSection === targetSection) return;
    setDraftOrder((current) => moveSectionBefore(current, movingSection, targetSection));
  }

  function moveBySectionNumber() {
    const section = findSectionByNumber(draftOrder, moveSectionNumber, sheet);
    const afterSection = findSectionByNumber(draftOrder, moveAfterNumber, sheet);
    if (!section || !afterSection || section === afterSection) return;
    setDraftOrder((current) => moveSectionAfter(current, section, afterSection));
  }

  function saveSectionOrder() {
    sheet.saveQuoteSectionOrder(expandManagedQuoteSectionOrder(draftOrder, sheet.quoteSections));
    setOrderManagerOpen(false);
  }

  function dragStart(event, section, id) {
    if (readonly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify({ section, id }));
  }

  function dropLine(event, toSection, targetId, position = "after") {
    if (readonly) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    let dragged = null;
    try {
      dragged = JSON.parse(raw);
    } catch {
      return;
    }
    sheet.moveQuoteLine(dragged.section, dragged.id, toSection, targetId, position);
  }

  function toggleApplianceBrand(brandKey) {
    setOpenApplianceBrands((current) => ({ ...current, [brandKey]: !current[brandKey] }));
  }

  function renderQuoteSection(section, options = {}) {
    const previewSection = sheet.preview.quotation[section];
    const savedSection = sheet.workbook.quotation?.[section] || {};
    const sectionTotal = options.total ?? previewSection?.subtotal ?? 0;
    const rows = (previewSection?.rows || []).filter((row) => {
      if (quoteFeeType(row)) return false;
      if (isHiddenQuoteRow(row)) return false;
      if (isApplianceHeadingQuoteRow(row)) return true;
      const haystack = `${row.item || ""} ${row.rawText || ""}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (sheet.hideUnused && !row.qty && !row.finalRateUsed && !row.cost) return false;
      return true;
    });
    const renderedRows = isAppliancePackageSection(section) ? visibleApplianceRows(rows, openApplianceBrands) : rows;
    const showQuoteRows = renderedRows.length > 0 || !isAppliancePackageSection(section);
    return (
      <section key={section} style={options.nested ? styles.nestedQuoteSection : styles.section}>
        <div
          style={options.nested ? styles.nestedSectionHeader : styles.sectionHeader}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropLine(event, section, null)}
        >
          <input
            aria-label={`${section} group number`}
            disabled={readonly}
            style={styles.sectionGroupInput}
            value={savedSection.groupNumber || ""}
            onChange={(event) => sheet.updateQuoteSectionMeta(section, "groupNumber", event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            style={styles.sectionHeaderButton}
            onClick={() => sheet.toggleQuoteSection(section)}
          >
            <span>{options.label || section}</span>
            <span style={styles.sectionTotalStack}>
              <strong>{money(sectionTotal)}</strong>
              <small>{quotePercentOfTotal(sectionTotal, sheet.preview.summary.finalQuoteTotal)}</small>
            </span>
          </button>
        </div>
        {!sheet.workbook.quotation?.[section]?.collapsed && showQuoteRows && (
        <>
        <Spreadsheet
          headers={readonly ? ["Row", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"] : ["Move", "Row", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes", "Actions"]}
          compactColumns={readonly ? [0] : [0, 1]}
        >
          {renderedRows.map((row, rowIndex) => {
            if (isApplianceHeadingQuoteRow(row)) {
              const isBrandHeading = row.applianceHeadingLevel === 1;
              const brandKey = applianceBrandKey(row);
              const brandOpen = Boolean(openApplianceBrands[brandKey]);
              const brandRows = isBrandHeading ? applianceRowsForBrand(rows, brandKey) : [];
              return (
                <tr key={row.id}>
                  {!readonly && <Cell compact />}
                  <Cell compact />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1}>
                    {isBrandHeading ? (
                      <button
                        type="button"
                        style={styles.applianceBrandToggle}
                        onClick={() => toggleApplianceBrand(brandKey)}
                      >
                        <span>{brandOpen ? "v" : ">"} {quoteItem(row)}</span>
                        <span style={styles.applianceBrandMeta}>{brandRows.length} rows | {money(sumQuoteRows(brandRows))}</span>
                      </button>
                    ) : (
                      <span style={styles.appliancePackageHeading}>{quoteItem(row)}</span>
                    )}
                  </Cell>
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />
                  {!readonly && <Cell subheading={row.applianceHeadingLevel !== 1} heading={row.applianceHeadingLevel === 1} />}
                </tr>
              );
            }
            return (
              <tr
                key={row.id}
                draggable={!readonly}
                onDragStart={(event) => dragStart(event, section, row.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropLine(event, section, row.id, "before")}
                style={styles.draggableRow}
              >
                {!readonly && <Cell compact><span style={styles.dragHandle} title="Drag row">::</span></Cell>}
                <Cell compact><span style={styles.rowNumber}>{quoteRowNumber(row, rowIndex)}</span></Cell>
                <Cell>
                  <BufferedInput
                    id={rowDomId("quote-edit", row.id)}
                    style={styles.itemInput}
                    value={quoteItem(row)}
                    onCommit={(next) => sheet.updateQuote(section, row.id, "item", next)}
                  />
                </Cell>
                <Cell>
                  {isBlankQuoteQtyRow(row) ? (
                    <BufferedInput style={styles.numberInput} value={quoteInputQty(row, sheet)} onFocus={() => onFormulaTarget({ section, id: row.id })} onCommit={(next) => sheet.updateQuote(section, row.id, "quantity", next)} />
                  ) : isLinkedQuoteQty(row) && !isEditableLinkedQuoteQty(row) ? (
                    <span style={styles.readOnly}>{value(row.qty)}</span>
                  ) : (
                    <BufferedInput style={styles.numberInput} value={quoteInputQty(row, sheet)} onFocus={() => onFormulaTarget({ section, id: row.id })} onCommit={(next) => sheet.updateQuote(section, row.id, "quantity", next)} />
                  )}
                </Cell>
                <Cell><BufferedInput style={styles.unitInput} value={row.unit || ""} onCommit={(next) => sheet.updateQuote(section, row.id, "unit", next)} /></Cell>
                <Cell><BufferedInput style={styles.rateInput} value={value(row.manualRate || row.excelRate)} onCommit={(next) => sheet.updateQuote(section, row.id, "manualRate", next)} /></Cell>
                <Cell final>{quoteCost(row)}</Cell>
                <Cell>{row.sourceOfRate}</Cell>
                <Cell>
                  <BufferedInput
                    style={styles.input}
                    value={row.notes || ""}
                    onCommit={(next) => sheet.updateQuote(section, row.id, "notes", next)}
                  />
                </Cell>
                {!readonly && <Cell>
                  <div style={styles.rowActions}>
                    <button style={styles.smallButton} onClick={() => focusRowEditor(rowDomId("quote-edit", row.id))}>Edit</button>
                    <button style={styles.smallButton} onClick={() => sheet.addQuoteLine(section, row.id, "after")}>Insert below</button>
                    <button style={styles.dangerButton} onClick={() => sheet.deleteQuoteLine(section, row.id)}>Delete</button>
                  </div>
                </Cell>}
              </tr>
            );
          })}
          {readonly ? (
            <tr><Cell /><Cell strong>Section total</Cell><Cell /><Cell /><Cell /><Cell final>{money(previewSection?.subtotal || 0)}</Cell><Cell /><Cell /></tr>
          ) : (
            <tr><Cell /><Cell /><Cell strong>Section total</Cell><Cell /><Cell /><Cell /><Cell final>{money(previewSection?.subtotal || 0)}</Cell><Cell /><Cell /><Cell /></tr>
          )}
        </Spreadsheet>
        {!readonly && (
          <div style={styles.sectionFooterActions}>
            <button style={styles.addLineButton} onClick={() => sheet.addQuoteLine(section)}>Add line</button>
            <button style={styles.closeSectionButton} onClick={() => sheet.toggleQuoteSection(section)}>Close section</button>
          </div>
        )}
        </>
        )}
      </section>
    );
  }

  return (
    <div style={styles.pageStack}>
      {!readonly && (
        <div style={styles.tabBar}>
          <button style={styles.primaryButton} onClick={openOrderManager}>Manage Section Order</button>
        </div>
      )}
      {orderManagerOpen && (
        <div style={styles.orderPanel}>
          <div style={styles.orderPanelHeader}>
            <div>
              <div style={styles.orderPanelTitle}>Manage Section Order</div>
              <div style={styles.orderPanelNote}>Drag sections, use move buttons, or move one section after another by section number.</div>
            </div>
            <button style={styles.secondaryButton} onClick={closeOrderManager}>Close</button>
          </div>
          <div style={styles.orderToolRow}>
            <input
              style={styles.shortInput}
              value={moveSectionNumber}
              onChange={(event) => setMoveSectionNumber(event.target.value)}
              placeholder="Move #"
            />
            <span style={styles.orderToolText}>after</span>
            <input
              style={styles.shortInput}
              value={moveAfterNumber}
              onChange={(event) => setMoveAfterNumber(event.target.value)}
              placeholder="After #"
            />
            <button style={styles.secondaryButton} onClick={moveBySectionNumber}>Move section after section number</button>
          </div>
          <div style={styles.orderList}>
            {draftOrder.map((section, index) => (
              <div
                key={section}
                draggable
                onDragStart={(event) => dragOrderStart(event, section)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOrderSection(event, section)}
                style={styles.orderItem}
              >
                <span style={styles.dragHandle} title="Drag section">::</span>
                <span style={styles.orderItemNumber}>{quoteSectionNumber(section, sheet) || index + 1}</span>
                <input
                  aria-label={`${section} group number`}
                  style={styles.orderGroupInput}
                  value={sheet.workbook.quotation?.[section]?.groupNumber || ""}
                  onChange={(event) => sheet.updateQuoteSectionMeta(section, "groupNumber", event.target.value)}
                />
                <span style={styles.orderItemName}>{section}</span>
                <button style={styles.smallButton} onClick={() => moveDraftSection(section, -1)} disabled={index === 0}>Move Up</button>
                <button style={styles.smallButton} onClick={() => moveDraftSection(section, 1)} disabled={index === draftOrder.length - 1}>Move Down</button>
              </div>
            ))}
          </div>
          <div style={styles.orderActions}>
            <button style={styles.primaryButton} onClick={saveSectionOrder}>Save Order</button>
            <button style={styles.secondaryButton} onClick={() => setDraftOrder(topLevelQuoteSections(sheet.quoteSections))}>Reset</button>
          </div>
        </div>
      )}
      {topLevelQuoteSections(sheet.quoteSections).map((section) => {
        const wallFramesParent = sheet.quoteSections.find((item) => isWallFramesSection(item));
        const roofFramingParent = sheet.quoteSections.find((item) => isRoofFramingSection(item));
        const hardwareParent = sheet.quoteSections.find((item) => isHardwareSection(item));
        const roofingMaterialsParent = sheet.quoteSections.find((item) => isRoofingMaterialsSection(item));
        const externalCladdingParent = sheet.quoteSections.find((item) => isExternalCladdingSection(item));
        const entryDoorsParent = sheet.quoteSections.find((item) => isEntryDoorsSection(item));
        const tilingParent = sheet.quoteSections.find((item) => isTilingSection(item));
        const plumbingFittingsParent = sheet.quoteSections.find((item) => isPlumbingFittingsSection(item));
        const electricalParent = sheet.quoteSections.find((item) => isElectricalSection(item));
        const painterParent = sheet.quoteSections.find((item) => isPainterSection(item));
        const floorcoveringsParent = sheet.quoteSections.find((item) => isFloorcoveringsSection(item));
        const mirrorsShowerScreensParent = sheet.quoteSections.find((item) => isMirrorsShowerScreensSection(item));
        const faceBrickworkParent = sheet.quoteSections.find((item) => isFaceBrickworkSection(item));
        const renderingParent = sheet.quoteSections.find((item) => isRenderingSection(item));
        const plasterSupplyInstallParent = sheet.quoteSections.find((item) => isPlasterSupplyInstallSection(item));
        const fixOutMaterialsParent = sheet.quoteSections.find((item) => isFixOutMaterialsSection(item));
        const cabinetMakerParent = sheet.quoteSections.find((item) => isCabinetMakerSection(item));
        const appliancePackageParent = sheet.quoteSections.find((item) => isAppliancePackageSection(item));
        if (isConcreteSlabSubsection(section)) return null;
        if (wallFramesParent && isWallFramesSubsection(section)) return null;
        if (roofFramingParent && isRoofFramingSubsection(section)) return null;
        if (hardwareParent && isHardwareSubsection(section)) return null;
        if (roofingMaterialsParent && isRoofingMaterialsSubsection(section)) return null;
        if (externalCladdingParent && isExternalCladdingSubsection(section)) return null;
        if (entryDoorsParent && isEntryDoorsSubsection(section)) return null;
        if (tilingParent && isTilingSubsection(section)) return null;
        if (plumbingFittingsParent && isPlumbingFittingsSubsection(section)) return null;
        if (electricalParent && isElectricalSubsection(section)) return null;
        if (painterParent && isPainterSubsection(section)) return null;
        if (floorcoveringsParent && isFloorcoveringsSubsection(section)) return null;
        if (mirrorsShowerScreensParent && isMirrorsShowerScreensSubsection(section)) return null;
        if (faceBrickworkParent && isFaceBrickworkSubsection(section)) return null;
        if (renderingParent && isRenderingSubsection(section)) return null;
        if (plasterSupplyInstallParent && isPlasterSupplyInstallSubsection(section)) return null;
        if (fixOutMaterialsParent && isFixOutMaterialsSubsection(section)) return null;
        if (cabinetMakerParent && isCabinetMakerSubsection(section)) return null;
        if (appliancePackageParent && isApplianceBrandSubsection(section)) return null;
        const childSections = isConcreteSlabSection(section)
          ? sheet.quoteSections.filter((item) => isConcreteSlabSubsection(item))
          : isWallFramesSection(section)
            ? sheet.quoteSections.filter((item) => isWallFramesSubsection(item))
            : isRoofFramingSection(section)
              ? sheet.quoteSections.filter((item) => isRoofFramingSubsection(item))
              : isHardwareSection(section)
                ? sheet.quoteSections.filter((item) => isHardwareSubsection(item))
                : isRoofingMaterialsSection(section)
                  ? sheet.quoteSections.filter((item) => isRoofingMaterialsSubsection(item))
                  : isExternalCladdingSection(section)
                    ? sheet.quoteSections.filter((item) => isExternalCladdingSubsection(item))
                    : isEntryDoorsSection(section)
                      ? sheet.quoteSections.filter((item) => isEntryDoorsSubsection(item))
                      : isTilingSection(section)
                        ? orderedTilingSubsections(sheet.quoteSections.filter((item) => isTilingSubsection(item)))
                        : isPlumbingFittingsSection(section)
                          ? orderedPlumbingFittingsSubsections(sheet.quoteSections.filter((item) => isPlumbingFittingsSubsection(item)))
                          : isElectricalSection(section)
                            ? orderedElectricalSubsections(sheet.quoteSections.filter((item) => isElectricalSubsection(item)))
                            : isPainterSection(section)
                              ? orderedPainterSubsections(sheet.quoteSections.filter((item) => isPainterSubsection(item)))
                              : isFloorcoveringsSection(section)
                                ? orderedFloorcoveringsSubsections(sheet.quoteSections.filter((item) => isFloorcoveringsSubsection(item)))
                                : isMirrorsShowerScreensSection(section)
                                  ? orderedMirrorsShowerScreensSubsections(sheet.quoteSections.filter((item) => isMirrorsShowerScreensSubsection(item)))
                                  : isFaceBrickworkSection(section)
                                    ? sheet.quoteSections.filter((item) => isFaceBrickworkSubsection(item))
                                    : isRenderingSection(section)
                                      ? sheet.quoteSections.filter((item) => isRenderingSubsection(item))
                                      : isPlasterSupplyInstallSection(section)
                                        ? sheet.quoteSections.filter((item) => isPlasterSupplyInstallSubsection(item))
                                        : isFixOutMaterialsSection(section)
                                          ? sheet.quoteSections.filter((item) => isFixOutMaterialsSubsection(item))
                                          : isCabinetMakerSection(section)
                                            ? orderedCabinetMakerSubsections(sheet.quoteSections.filter((item) => isCabinetMakerSubsection(item)))
                                            : isAppliancePackageSection(section)
                                              ? sheet.quoteSections.filter((item) => isApplianceBrandSubsection(item))
                                              : [];
        const sectionTotal = childSections.length
          ? childSections.reduce((sum, item) => sum + (sheet.preview.quotation[item]?.subtotal || 0), sheet.preview.quotation[section]?.subtotal || 0)
          : undefined;
        return (
          <div key={section} style={styles.quoteGroup}>
            {renderQuoteSection(section, { total: sectionTotal, label: wallFramesDisplayLabel(section) })}
            {childSections.length > 0 && !sheet.workbook.quotation?.[section]?.collapsed && (
              <div style={styles.nestedQuoteStack}>
                {childSections.map((child) => renderQuoteSection(child, { nested: true, label: quoteSectionDisplayLabel(child) }))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummarySheet({ sheet }) {
  const readonly = sheet.previewMode;
  const [expandedStages, setExpandedStages] = useState({});
  const stageGroups = summaryBuildStageGroups(sheet);
  const toggleStage = (stageNumber) => setExpandedStages((current) => ({ ...current, [stageNumber]: !current[stageNumber] }));
  const collapseAllRows = () => setExpandedStages({});
  const headers = ["Stage / Section", "Section Name", "Item Name", "Qty", "Unit", "Rate", "Total / Cost", "Notes"];
  return (
    <div style={styles.pageStack}>
      <div style={styles.summaryToolbar}>
        <button style={styles.secondaryButton} onClick={collapseAllRows}>Collapse All Rows</button>
        {!readonly && <button style={styles.addLineButton} onClick={sheet.addQuoteSection}>Add new row</button>}
      </div>
      <Spreadsheet headers={headers}>
        {stageGroups.flatMap((group) => {
          const mainOpen = Boolean(expandedStages[group.stageNumber]);
          const rows = [
            <tr key={`stage-${group.stageNumber}`}>
              <Cell strong>
                <button style={styles.summaryToggleButton} onClick={() => toggleStage(group.stageNumber)}>
                  <span>{mainOpen ? "v" : ">"}</span>
                  <span>{group.stageNumber} {group.label}</span>
                </button>
              </Cell>
              <Cell />
              <Cell />
              <Cell />
              <Cell />
              <Cell />
              <Cell final>{money(group.total)}</Cell>
              <Cell>{summaryStagePercentOfTotal(group.total, sheet.preview.summary.finalQuoteTotal)}</Cell>
            </tr>,
          ];
          if (!mainOpen) return rows;
          group.rows.forEach((item, rowIndex) => {
            const sectionNumber = quoteSectionNumber(item.section, sheet);
            const sectionDisplayName = summarySectionDisplayName(item.section, sheet);
            rows.push(
              <tr key={`stage-line-${group.stageNumber}-${item.section}-${item.row.id || rowIndex}`}>
                <Cell>{sectionNumber ? `${sectionNumber}` : ""}</Cell>
                <Cell>
                  <BufferedInput
                    commitOnChange
                    style={styles.summarySectionInput}
                    disabled={readonly}
                    value={sectionDisplayName}
                    onCommit={(next) => sheet.updateQuoteSectionMeta(item.section, "displayName", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    commitOnChange
                    style={styles.itemInput}
                    disabled={readonly}
                    value={quoteItem(item.row)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "item", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    inputMode="decimal"
                    commitOnChange
                    style={styles.numberInput}
                    disabled={readonly}
                    value={value(item.row.qty || item.row.quantity)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "quantity", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    commitOnChange
                    style={styles.unitInput}
                    disabled={readonly}
                    value={item.row.unit || ""}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "unit", next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    inputMode="decimal"
                    commitOnChange
                    style={styles.rateInput}
                    disabled={readonly}
                    value={value(item.row.finalRateUsed || item.row.manualRate || item.row.excelRate)}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "manualRate", next)}
                  />
                </Cell>
                <Cell final>
                  <BufferedInput
                    inputMode="decimal"
                    commitOnChange
                    style={styles.rateInput}
                    disabled={readonly}
                    value={summaryLineTotal(item.row)}
                    onCommit={(next) => updateSummaryLineTotal(sheet, item.section, item.row, next)}
                  />
                </Cell>
                <Cell>
                  <BufferedInput
                    commitOnChange
                    style={styles.input}
                    disabled={readonly}
                    value={item.row.notes || ""}
                    onCommit={(next) => sheet.updateQuote(item.section, item.row.id, "notes", next)}
                  />
                </Cell>
              </tr>
            );
          });
          return rows;
        })}
        {summaryTotalRow("Base line item subtotal", sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin, sheet.preview.summary.finalQuoteTotal)}
        {SUMMARY_TABLE_ADJUSTMENT_ROWS.map((field) => summaryAdjustmentRow(sheet, field, readonly))}
        {summaryFinalTotalRow(sheet.preview.summary.finalQuoteTotal)}
      </Spreadsheet>
      <section style={styles.section}>
        <div style={styles.staticSectionHeader}>Template Promotion Requests</div>
        <Spreadsheet headers={["Type", "Item", "Value", "Notes"]}>
          {Object.entries(sheet.workbook.formulaPromotions || {}).map(([key, item]) => (
            <tr key={key}><Cell strong>Formula</Cell><Cell>{pretty(key)}</Cell><Cell>{item.formula}</Cell><Cell>{item.note}</Cell></tr>
          ))}
          {(sheet.workbook.ratePromotions || []).map((item) => (
            <tr key={`${item.id}-${item.requestedAt}`}><Cell strong>Rate</Cell><Cell>{item.item}</Cell><Cell>{item.rate}</Cell><Cell>{item.notes}</Cell></tr>
          ))}
        </Spreadsheet>
      </section>
    </div>
  );
}

function ClientPageSheet({ sheet }) {
  const readonly = sheet.previewMode;
  const logoFileInputRef = useRef(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(null);
  const [printingClientPage, setPrintingClientPage] = useState(false);
  const client = clientPageValues(sheet);
  const clientGroups = clientBuildStageGroups(sheet);
  const sectionKeys = [
    "introduction",
    "scopeOfWorks",
    "quotedWorks",
    ...clientGroups.map((group) => `stage-${group.stageNumber}`),
    "exclusions",
    "terms",
    "acceptance",
    "signature",
  ];
  const allClientSectionsCollapsed = () => Object.fromEntries(sectionKeys.map((key) => [key, true]));
  const visibleCollapsedSections = collapsedSections || allClientSectionsCollapsed();
  const reportCollapsedSections = () => ({
    ...allClientSectionsCollapsed(),
    quotedWorks: false,
  });
  const toggleClientSection = (key) => setCollapsedSections((current) => {
    const base = current || allClientSectionsCollapsed();
    return { ...base, [key]: !base[key] };
  });
  const collapseAllClientSections = () => setCollapsedSections(allClientSectionsCollapsed());
  const expandAllClientSections = () => setCollapsedSections({});
  const printClientPage = () => {
    setCollapsedSections(reportCollapsedSections());
    setPrintingClientPage(true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.print();
        window.setTimeout(() => setPrintingClientPage(false), 500);
      }, 0);
    }
  };
  const saveClientPage = () => {
    sheet.saveDraft?.();
  };
  const uploadLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      sheet.updateClientPage("logoUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };
  return (
    <div style={styles.clientPageShell}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .estimate-client-print, .estimate-client-print * { visibility: visible; }
          .estimate-client-print { position: absolute; inset: 0; width: 100%; background: #ffffff; }
          .estimate-client-tools, .estimate-client-editor, .estimate-client-stage-print { display: none !important; }
          .estimate-client-stage-toggle { display: grid !important; }
        }
      `}</style>
      <div className="estimate-client-tools" style={styles.clientToolbar}>
        <button style={styles.secondaryButton} onClick={() => setPreviewMode((current) => !current)}>Preview Client Page</button>
        <button style={styles.secondaryButton} onClick={collapseAllClientSections}>Collapse All Sections</button>
        <button style={styles.secondaryButton} onClick={expandAllClientSections}>Expand All Sections</button>
        <button style={styles.secondaryButton} onClick={printClientPage}>Print</button>
        <button style={styles.secondaryButton} onClick={printClientPage}>Download PDF</button>
        {!readonly && <button style={styles.primaryButton} onClick={saveClientPage}>Save Client Page</button>}
      </div>
      {!previewMode && (
        <section className="estimate-client-editor" style={styles.clientEditor}>
          <div style={styles.clientLogoEditor}>
            <div style={styles.clientLogoPreview}>
              {client.logoUrl ? <img src={client.logoUrl} alt="Company logo preview" style={styles.clientLogoImage} /> : <span>LOGO</span>}
            </div>
            <div style={styles.clientLogoActions}>
              <div style={styles.adjustmentLabel}>Company logo</div>
              <div style={styles.clientLogoHint}>Upload a PNG, JPG, WebP, or SVG logo for the client-facing quote.</div>
              <div style={styles.rowActions}>
                <button type="button" style={styles.secondaryButton} disabled={readonly} onClick={() => logoFileInputRef.current?.click()}>Upload Logo</button>
                {client.logoUrl && <button type="button" style={styles.dangerButton} disabled={readonly} onClick={() => sheet.updateClientPage("logoUrl", "")}>Remove</button>}
              </div>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: "none" }}
                onChange={uploadLogo}
              />
            </div>
          </div>
          <div style={styles.clientEditorGrid}>
            {CLIENT_HEADER_FIELDS.map((field) => (
              <label key={field.key} style={styles.adjustmentField}>
                <span style={styles.adjustmentLabel}>{field.label}</span>
                <BufferedInput
                  commitOnChange
                  disabled={readonly}
                  style={styles.input}
                  value={client[field.key] || ""}
                  onCommit={(next) => sheet.updateClientPage(field.key, next)}
                />
              </label>
            ))}
          </div>
          {CLIENT_TEXT_FIELDS.map((field) => (
            <label key={field.key} style={styles.adjustmentField}>
              <span style={styles.adjustmentLabel}>{field.label}</span>
              <BufferedTextarea
                disabled={readonly}
                style={styles.clientTextarea}
                value={client[field.key] || ""}
                onCommit={(next) => sheet.updateClientPage(field.key, next)}
              />
            </label>
          ))}
        </section>
      )}
      <article className="estimate-client-print" style={styles.clientDocument}>
        <header style={styles.clientHeader}>
          <div style={styles.clientBrand}>
            {client.logoUrl ? <img src={client.logoUrl} alt="Company logo" style={styles.clientLogoImage} /> : <div style={styles.clientLogoMark}>LOGO</div>}
            <div>
              <div style={styles.clientCompanyName}>{client.companyName || "Company Name"}</div>
              <div style={styles.clientDocumentTitle}>{client.estimateTitle || "Estimate / Quote"}</div>
            </div>
          </div>
          <div style={styles.clientMetaGrid}>
            <ClientMeta label="Client" value={client.clientName} />
            <ClientMeta label="Project address" value={client.projectAddress} />
            <ClientMeta label="Quote number" value={client.quoteNumber} />
            <ClientMeta label="Quote date" value={client.quoteDate} />
            <ClientMeta label="Expiry date" value={client.expiryDate} />
          </div>
        </header>

        <ClientTextBlock title="Introduction" value={client.introduction} summary={CLIENT_BLOCK_SUMMARIES.introduction} collapsed={visibleCollapsedSections.introduction} onToggle={() => toggleClientSection("introduction")} />
        <ClientTextBlock title="Scope of works" value={client.scopeOfWorks} summary={CLIENT_BLOCK_SUMMARIES.scopeOfWorks} collapsed={visibleCollapsedSections.scopeOfWorks} onToggle={() => toggleClientSection("scopeOfWorks")} />

        <section style={styles.clientSection}>
          <button style={styles.clientSectionToggle} onClick={() => toggleClientSection("quotedWorks")}>
            <span>{visibleCollapsedSections.quotedWorks ? ">" : "v"} Quoted Works</span>
            <small style={styles.clientBlockSummary}>{clientGroups.length} stages priced with all internal allowances built into the visible totals.</small>
          </button>
          {!visibleCollapsedSections.quotedWorks && clientGroups.map((group) => (
            <div key={group.stageNumber} style={styles.clientStage}>
              <button className="estimate-client-stage-toggle" style={styles.clientStageHeader} onClick={() => toggleClientSection(`stage-${group.stageNumber}`)}>
                <span>{visibleCollapsedSections[`stage-${group.stageNumber}`] ? ">" : "v"} {group.stageNumber} - {group.label}</span>
                <small style={styles.clientStageSummary}>{clientStageSummary(group)}</small>
                <strong>{money(group.total)}</strong>
              </button>
              {!visibleCollapsedSections[`stage-${group.stageNumber}`] && (
              <>
              <div className="estimate-client-stage-print" style={styles.clientStageHeaderPrint}>
                <span>{group.stageNumber} - {group.label}</span>
                <strong>{money(group.total)}</strong>
              </div>
              <table style={styles.clientTable}>
                <thead>
                  <tr>
                    <th style={styles.clientTh}>Description</th>
                    <th style={styles.clientTh}>Qty</th>
                    <th style={styles.clientTh}>Unit</th>
                    <th style={styles.clientTh}>Rate</th>
                    <th style={styles.clientTh}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((item) => (
                    <tr key={`${item.section}-${item.id}`}>
                      <td style={styles.clientTd}>{item.description}</td>
                      <td style={styles.clientTdNumber}>{value(item.qty)}</td>
                      <td style={styles.clientTdNumber}>{item.unit || ""}</td>
                      <td style={styles.clientTdNumber}>{money(item.loadedRate)}</td>
                      <td style={styles.clientTdFinal}>{money(item.loadedTotal)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={styles.clientTdStrong}>Stage subtotal</td>
                    <td style={styles.clientTd} />
                    <td style={styles.clientTd} />
                    <td style={styles.clientTd} />
                    <td style={styles.clientTdFinal}>{money(group.total)}</td>
                  </tr>
                </tbody>
              </table>
              </>
              )}
            </div>
          ))}
          {!visibleCollapsedSections.quotedWorks && <div style={styles.clientGrandTotal}>
            <span>Total quoted price</span>
            <strong>{money(sheet.preview.summary.finalQuoteTotal)}</strong>
          </div>}
        </section>

        <ClientTextBlock title="Exclusions" value={client.exclusions} summary={CLIENT_BLOCK_SUMMARIES.exclusions} collapsed={visibleCollapsedSections.exclusions} onToggle={() => toggleClientSection("exclusions")} />
        <ClientTextBlock title="Terms and conditions" value={client.terms} summary={CLIENT_BLOCK_SUMMARIES.terms} collapsed={visibleCollapsedSections.terms} onToggle={() => toggleClientSection("terms")} />
        <ClientTextBlock title="Acceptance" value={client.acceptance} summary={CLIENT_BLOCK_SUMMARIES.acceptance} collapsed={visibleCollapsedSections.acceptance} onToggle={() => toggleClientSection("acceptance")} />
        <section style={styles.clientSection}>
          <button style={styles.clientSectionToggle} onClick={() => toggleClientSection("signature")}>
            <span>{visibleCollapsedSections.signature ? ">" : "v"} Client signature</span>
            <small style={styles.clientBlockSummary}>Formal approval area for client sign-off and quote acceptance.</small>
          </button>
        {!visibleCollapsedSections.signature && <div style={styles.clientSignatureGrid}>
          <div style={styles.clientSignatureLine}>Client signature</div>
          <div style={styles.clientSignatureLine}>Date</div>
        </div>}
        </section>
      </article>
    </div>
  );
}

function ClientMeta({ label, value }) {
  return (
    <div style={styles.clientMetaItem}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ClientTextBlock({ title, value, summary, collapsed, onToggle }) {
  if (!String(value || "").trim()) return null;
  return (
    <section style={styles.clientSection}>
      <button style={styles.clientSectionToggle} onClick={onToggle}>
        <span>{collapsed ? ">" : "v"} {title}</span>
        <small style={styles.clientBlockSummary}>{summary}</small>
      </button>
      {!collapsed && <p style={styles.clientParagraph}>{value}</p>}
    </section>
  );
}

function summaryTotalRow(label, amount, finalQuoteTotal) {
  return (
    <tr key={label}>
      <Cell strong>{label}</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell final>{money(amount)}</Cell>
      <Cell>{summaryPercentOfTotal(amount, finalQuoteTotal)}</Cell>
    </tr>
  );
}

function summaryAdjustmentRow(sheet, field, readonly) {
  const amount = sheet.preview.summary?.[field.amountKey] || 0;
  const percent = field.percentKey ? summaryAdjustmentPercentDisplayValue(sheet, field.percentKey) : "";
  const finalQuoteTotal = sheet.preview.summary?.finalQuoteTotal || 0;
  return (
    <tr key={field.label}>
      <Cell strong>{field.label}</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell>
        {field.amountAdjustmentKey ? (
          <BufferedInput
            inputMode="decimal"
            commitOnChange
            disabled={readonly}
            style={styles.rateInput}
            value={summaryAdjustmentAmountDisplayValue(sheet, field.amountAdjustmentKey, amount)}
            onCommit={(next) => sheet.updateSummaryAdjustment(field.amountAdjustmentKey, next)}
          />
        ) : field.percentKey ? (
          <BufferedInput
            inputMode="decimal"
            commitOnChange
            disabled={readonly}
            style={styles.rateInput}
            value={`${percent}%`}
            onCommit={(next) => sheet.updateSummaryAdjustment(field.percentKey, next)}
          />
        ) : (
          ""
        )}
      </Cell>
      <Cell final>{money(amount)}</Cell>
      <Cell>{summaryPercentOfTotal(amount, finalQuoteTotal)}</Cell>
    </tr>
  );
}

function summaryFinalTotalRow(amount) {
  return (
    <tr key="Final quote total">
      <Cell strong>Final quote total</Cell>
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell />
      <Cell final>{money(amount)}</Cell>
      <Cell>100% of total</Cell>
    </tr>
  );
}

function summaryPercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0.00% of total";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent.toFixed(2)}% of total`;
}

function summaryStagePercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0.00%";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent.toFixed(2)}%`;
}

const SUMMARY_TABLE_ADJUSTMENT_ROWS = [
  { label: "Preliminaries", amountKey: "preliminaryCostsAmount", percentKey: "preliminaryCostsPercent" },
  { label: "Overheads", amountKey: "overheadsAmount", percentKey: "overheadsPercent" },
  { label: "Materials & labour margin", amountKey: "marginAmount", percentKey: "marginPercent" },
  { label: "Profit", amountKey: "profitAmount", percentKey: "profitPercent" },
  { label: "GST", amountKey: "gst", percentKey: "gstPercent" },
  { label: "QBSA registration", amountKey: "qbsaRegistration", amountAdjustmentKey: "qbsaRegistration" },
  { label: "Q Leave fees", amountKey: "qLeaveFees", amountAdjustmentKey: "qLeaveFees" },
  { label: "Sales commission", amountKey: "salesCommissionAmount", percentKey: "salesCommissionPercent" },
];

const CLIENT_HEADER_FIELDS = [
  { key: "companyName", label: "Company name" },
  { key: "estimateTitle", label: "Estimate / Quote title" },
  { key: "clientName", label: "Client name" },
  { key: "projectAddress", label: "Project address" },
  { key: "quoteNumber", label: "Quote number" },
  { key: "quoteDate", label: "Quote date" },
  { key: "expiryDate", label: "Expiry date" },
];

const CLIENT_TEXT_FIELDS = [
  { key: "introduction", label: "Introduction text" },
  { key: "scopeOfWorks", label: "Scope of works" },
  { key: "exclusions", label: "Exclusions" },
  { key: "terms", label: "Terms and conditions" },
  { key: "acceptance", label: "Acceptance section" },
];

const CLIENT_BLOCK_SUMMARIES = {
  introduction: "Sets the tone, confirms the opportunity, and frames the quote as a clear proposal.",
  scopeOfWorks: "Defines what is included so the client can see the practical extent of the works.",
  exclusions: "Clarifies boundaries early and reduces assumptions before acceptance.",
  terms: "Summarises validity, payment, and contract conditions in plain client-facing language.",
  acceptance: "Turns the quote into an actionable approval step with clear intent to proceed.",
};

const CLIENT_STAGE_SUMMARIES = {
  1: "Site readiness, approvals, setup, and early project requirements.",
  2: "Groundworks, slab/base activities, and the foundation of the build.",
  3: "Structural framing work that gives the project its shape and strength.",
  4: "External enclosure items that move the project toward weather protection.",
  5: "Internal completion work, fixtures, finishes, and service fit-off.",
  6: "Final completion items, checks, cleaning, and presentation-ready works.",
  7: "Handover-ready items that close out the project for client occupancy.",
};

function clientPageValues(sheet) {
  const saved = sheet.workbook.clientPage || {};
  return {
    companyName: saved.companyName || "",
    logoUrl: saved.logoUrl || "",
    estimateTitle: saved.estimateTitle || "Estimate / Quote",
    clientName: saved.clientName || clientWorkbookDataValue(sheet, "clientName"),
    projectAddress: saved.projectAddress || clientWorkbookDataValue(sheet, "projectAddress"),
    quoteNumber: saved.quoteNumber || "",
    quoteDate: saved.quoteDate || new Date().toLocaleDateString("en-AU"),
    expiryDate: saved.expiryDate || "",
    introduction: saved.introduction || "Thank you for the opportunity to provide this quotation.",
    scopeOfWorks: saved.scopeOfWorks || "This quote includes the works listed below.",
    exclusions: saved.exclusions || "Items not expressly included in this quotation are excluded.",
    terms: saved.terms || "This quotation is valid until the expiry date shown above and is subject to final contract documentation.",
    acceptance: saved.acceptance || "I/we accept this quotation and authorise the works to proceed.",
  };
}

function clientWorkbookDataValue(sheet, key) {
  for (const section of Object.values(sheet.workbook.data || {})) {
    const row = section?.rows?.[key];
    if (row?.value !== undefined && row?.value !== null && row.value !== "") return row.value;
  }
  return "";
}

function clientStageSummary(group) {
  const itemText = group.rows.length === 1 ? "1 included item" : `${group.rows.length} included items`;
  return `${itemText}. ${CLIENT_STAGE_SUMMARIES[group.stageNumber] || "Client-facing stage total with allowances already included."}`;
}

function quotePercentOfTotal(amount, finalQuoteTotal) {
  const total = summaryNumber(finalQuoteTotal);
  if (!total) return "0% of overall quote";
  const percent = Math.round((summaryNumber(amount) / total * 100) * 100) / 100;
  return `${percent}% of overall quote`;
}

function clientBuildStageGroups(sheet) {
  const stageGroups = summaryBuildStageGroups(sheet);
  const sourceItems = stageGroups.flatMap((group) => group.rows.map((item) => ({ ...item, stageNumber: group.stageNumber, stageLabel: group.label })));
  const baseSubtotal = roundMoney(sourceItems.reduce((sum, item) => sum + summaryLineTotal(item.row), 0));
  const finalQuoteTotal = roundMoney(sheet.preview.summary.finalQuoteTotal || 0);
  const hiddenAddons = roundMoney(finalQuoteTotal - baseSubtotal);
  let loadedItems = sourceItems.map((item) => {
    const baseTotal = roundMoney(summaryLineTotal(item.row));
    const qty = summaryNumber(item.row?.qty || item.row?.quantity || 0);
    const share = baseSubtotal > 0 ? baseTotal / baseSubtotal : 0;
    const loadedTotal = roundMoney(baseTotal + hiddenAddons * share);
    return {
      id: item.row.id,
      section: item.section,
      stageNumber: item.stageNumber,
      stageLabel: item.stageLabel,
      description: clientItemDescription(item.section, item.row, sheet),
      qty,
      unit: item.row.unit || "",
      loadedTotal,
      loadedRate: qty ? roundMoney(loadedTotal / qty) : loadedTotal,
    };
  });
  const loadedTotal = roundMoney(loadedItems.reduce((sum, item) => sum + item.loadedTotal, 0));
  const correction = roundMoney(finalQuoteTotal - loadedTotal);
  if (loadedItems.length && correction) {
    const lastIndex = loadedItems.length - 1;
    const correctedTotal = roundMoney(loadedItems[lastIndex].loadedTotal + correction);
    const qty = summaryNumber(loadedItems[lastIndex].qty);
    loadedItems[lastIndex] = {
      ...loadedItems[lastIndex],
      loadedTotal: correctedTotal,
      loadedRate: qty ? roundMoney(correctedTotal / qty) : correctedTotal,
    };
  }
  const groups = BUILD_STAGE_GROUPS.map((stage) => ({ ...stage, rows: [], total: 0 }));
  const byNumber = new Map(groups.map((group) => [group.stageNumber, group]));
  loadedItems.forEach((item) => {
    const group = byNumber.get(item.stageNumber);
    if (!group) return;
    group.rows.push(item);
    group.total = roundMoney(group.total + item.loadedTotal);
  });
  return groups.filter((group) => group.rows.length);
}

function clientItemDescription(section, row, sheet) {
  const sectionLabel = summaryLineSectionLabel(section, sheet);
  const item = quoteItem(row);
  return item ? `${sectionLabel} - ${item}` : sectionLabel;
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

const BUILD_STAGE_GROUPS = [
  { stageNumber: 1, label: "PRELIMINARIES" },
  { stageNumber: 2, label: "BASE STAGE" },
  { stageNumber: 3, label: "FRAME STAGE" },
  { stageNumber: 4, label: "LOCK UP STAGE" },
  { stageNumber: 5, label: "FIX OUT STAGE" },
  { stageNumber: 6, label: "PRACTICAL COMPLETION" },
  { stageNumber: 7, label: "HANDOVER" },
];

function summaryBuildStageGroups(sheet) {
  const parentByChild = quoteParentByChildSection(sheet.quoteSections);
  const groups = BUILD_STAGE_GROUPS.map((stage) => ({ ...stage, rows: [], total: 0 }));
  const byNumber = new Map(groups.map((group) => [group.stageNumber, group]));
  sheet.quoteSections.forEach((section) => {
    selectedSummaryRows(sheet.preview.quotation?.[section]?.rows || []).forEach((row) => {
      const rowStageNumber = summaryStageNumberForRow(row, section, sheet, parentByChild);
      const group = byNumber.get(rowStageNumber);
      if (!group) return;
      const total = summaryLineTotal(row);
      group.rows.push({ section, row, total });
      group.total += total;
    });
  });
  groups.forEach((group) => {
    group.total = Math.round(group.total * 100) / 100;
  });
  return groups;
}

function summaryStageNumberForRow(row, section, sheet, parentByChild) {
  return summaryStageNumber(row?.groupNumber)
    || summaryStageNumber(row?.stageNumber)
    || summaryStageNumber(row?.buildStage)
    || summaryStageNumber(row?.stage)
    || summaryStageNumber(row?.group)
    || summaryStageNumberForSection(section, sheet, parentByChild);
}

function summaryStageNumberForSection(section, sheet, parentByChild) {
  const ownStage = summaryStageNumber(sheet.workbook.quotation?.[section]?.groupNumber);
  if (ownStage) return ownStage;
  const parent = parentByChild.get(section);
  return parent ? summaryStageNumber(sheet.workbook.quotation?.[parent]?.groupNumber) : 0;
}

function summaryStageNumber(value) {
  const match = String(value ?? "").trim().match(/[1-7]/);
  return match ? Number(match[0]) : 0;
}

function summaryLineSectionLabel(section, sheet) {
  const number = quoteSectionNumber(section, sheet);
  const displayName = summarySectionDisplayName(section, sheet);
  return number ? `${number} ${displayName}` : displayName;
}

function summarySectionDisplayName(section, sheet) {
  return sheet.workbook.quotation?.[section]?.displayName || section;
}

function summaryAdjustmentPercentDisplayValue(sheet, key) {
  const saved = sheet.workbook.summaryAdjustments?.[key];
  if (saved !== undefined && saved !== null && saved !== "") return value(summaryNumber(saved));
  const preview = sheet.preview.summary || {};
  const fallbackByKey = {
    preliminaryCostsPercent: preview.preliminaryCostsPercent,
    overheadsPercent: preview.overheadsPercent,
    marginPercent: preview.marginPercent,
    profitPercent: preview.profitPercent,
    gstPercent: preview.gstPercent,
    salesCommissionPercent: preview.salesCommissionPercent,
  };
  return value(fallbackByKey[key]);
}

function summaryAdjustmentAmountDisplayValue(sheet, key, fallback = 0) {
  const saved = sheet.workbook.summaryAdjustments?.[key];
  if (saved !== undefined && saved !== null && saved !== "") return saved;
  return value(fallback);
}

function updateSummaryLineTotal(sheet, section, row, nextTotal) {
  const total = summaryNumber(nextTotal);
  const qty = summaryNumber(row?.qty || row?.quantity || 0);
  if (qty > 0) {
    sheet.updateQuote(section, row.id, "manualRate", total ? String(total / qty) : "");
    return;
  }
  sheet.updateQuote(section, row.id, "quantity", total ? "1" : "");
  sheet.updateQuote(section, row.id, "manualRate", total ? String(total) : "");
}

function quoteParentByChildSection(sections = []) {
  const map = new Map();
  topLevelQuoteSections(sections).forEach((parent) => {
    quoteChildSectionsForParent(parent, sections).forEach((child) => map.set(child, parent));
  });
  return map;
}

function selectedSummaryRows(rows = []) {
  return rows.filter((row) => {
    if (quoteFeeType(row)) return false;
    if (isHiddenQuoteRow(row)) return false;
    if (row.active === false) return false;
    if (Number(row.qty || 0) > 0) return true;
    if (Number(row.cost || 0) > 0) return true;
    return summaryLineTotal(row) > 0;
  });
}

function summaryLineTotal(row) {
  const cost = Number(row?.cost || 0);
  if (Number.isFinite(cost) && cost > 0) return cost;
  const qty = summaryNumber(row?.qty || row?.quantity || 0);
  const rate = summaryNumber(row?.finalRateUsed || row?.manualRate || row?.excelRate || 0);
  return Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0;
}

function summaryNumber(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Spreadsheet({ headers, children, compactColumns = [] }) {
  const compactSet = new Set(compactColumns);
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} style={{ ...styles.th, ...(compactSet.has(index) ? styles.compactColumn : {}) }}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong, heading, subheading, compact, calc, final, tone }) {
  return <td style={{ ...styles.td, ...(compact ? styles.compactColumn : {}), ...(tone ? styles[tone] : {}), ...(strong ? styles.strongCell : {}), ...(tone && strong ? styles[`${tone}Strong`] : {}), ...(heading ? styles.headingCell : {}), ...(subheading ? styles.subheadingCell : {}), ...(calc ? styles.calcCell : {}), ...(final ? styles.finalCell : {}) }}>{children}</td>;
}

function BufferedInput({ value, onCommit, onFocus, commitOnChange = false, ...props }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const next = String(draft ?? "");
    if (next !== String(value ?? "")) onCommit(next);
  };

  return (
    <input
      {...props}
      value={draft}
      onFocus={onFocus}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (commitOnChange && next !== String(value ?? "")) onCommit(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value ?? "");
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function BufferedTextarea({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const next = String(draft ?? "");
    if (next !== String(value ?? "")) onCommit(next);
  };

  return (
    <textarea
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

function Panel({ title, children }) {
  return <div style={styles.panel}><div style={styles.panelTitle}>{title}</div><div style={styles.panelBody}>{children}</div></div>;
}

function SummaryRow({ label, value }) {
  return <div style={styles.summaryRow}><span>{label}</span><strong>{value}</strong></div>;
}

const previewProtectionHandlers = {
  onCopy: blockPreviewAction,
  onCut: blockPreviewAction,
  onPaste: blockPreviewAction,
  onContextMenu: blockPreviewAction,
  onDragStart: blockPreviewAction,
  onKeyDown: (event) => {
    const key = String(event.key || "").toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ["a", "c", "p", "s", "x"].includes(key)) {
      blockPreviewAction(event);
    }
  },
};

function blockPreviewAction(event) {
  event.preventDefault();
  event.stopPropagation();
}

function insertQuoteQuantityReference(sheet, target, key) {
  if (!target?.section || !target?.id || !key) return;
  const row = sheet.workbook.quotation?.[target.section]?.rows?.find((item) => item.id === target.id);
  const current = String(row?.quantity || "").trim();
  const next = current.startsWith("=")
    ? `${current}${current === "=" ? "" : " + "}${key}`
    : `=${key}`;
  sheet.updateQuote(target.section, target.id, "quantity", next);
  sheet.setPage("quotation");
}

function TemplateFileMenu({ sheet, open, onToggle, onClose }) {
  const templates = sheet.templateSummaries || [];
  const currentTemplateName = sheet.workbook.templateName || "Untitled template";
  const [selectedKey, setSelectedKey] = useState(sheet.workbook.templateKey || templates[0]?.key || "");
  const [newTemplateName, setNewTemplateName] = useState(sheet.workbook.templateName || suggestedUiTemplateName(sheet.workbook));
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sheet.workbook.templateKey) {
      setSelectedKey(sheet.workbook.templateKey);
      return;
    }
    if (!selectedKey && templates[0]?.key) setSelectedKey(templates[0].key);
  }, [sheet.workbook.templateKey, selectedKey, templates]);

  useEffect(() => {
    if (sheet.workbook.templateName) setNewTemplateName(sheet.workbook.templateName);
  }, [sheet.workbook.templateName]);

  async function run(action, closeAfter = false) {
    setMessage("");
    const result = await action();
    await sheet.refreshTemplateSummaries?.();
    setMessage(result?.message || "");
    if (result?.key) setSelectedKey(result.key);
    if (closeAfter && result?.ok) onClose?.();
  }

  const selectedTemplate = templates.find((template) => template.key === selectedKey) || null;
  const hasCurrentTemplate = Boolean(sheet.workbook.templateKey);

  return (
    <div style={styles.templateFileWrap}>
      <button style={styles.templateFileButton} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        <span>Template File</span>
        <small>{currentTemplateName}</small>
      </button>
      {open && (
        <div style={styles.templateFileMenu} role="menu">
          <div style={styles.templateFileHeader}>
            <strong>{currentTemplateName}</strong>
            <span>Current template</span>
          </div>
          <button
            type="button"
            style={{ ...styles.templateMenuItem, ...(!hasCurrentTemplate ? styles.templateMenuItemDisabled : {}) }}
            disabled={!hasCurrentTemplate}
            onClick={() => run(() => sheet.saveTemplate(sheet.workbook.templateKey))}
          >
            Save Existing Template
          </button>
          <label style={styles.templateNameField}>
            <span>Save as</span>
            <input
              style={styles.templateNameInput}
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              placeholder="Template name"
            />
          </label>
          <button
            type="button"
            style={styles.templateMenuItem}
            onClick={() => run(() => sheet.saveTemplateAs(newTemplateName))}
          >
            Save As New Template
          </button>
          <div style={styles.templateMenuDivider} />
          <div style={styles.templateListHeading}>Open Existing Template</div>
          {templates.length ? (
            <div style={styles.templateDropdownList}>
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.key}
                  style={{ ...styles.templateDropdownItem, ...(selectedKey === template.key ? styles.templateDropdownItemActive : {}) }}
                  onClick={() => setSelectedKey(template.key)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.category || "Uncategorised"} · Modified {formatTemplateDate(template.modifiedAt || template.savedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={styles.templateEmptyInline}>No saved templates yet.</div>
          )}
          <div style={styles.templateActionRow}>
            <button
              type="button"
              style={{ ...styles.templateMenuItem, ...(!selectedTemplate ? styles.templateMenuItemDisabled : {}) }}
              disabled={!selectedTemplate}
              onClick={() => run(() => sheet.loadTemplate(selectedKey), true)}
            >
              Open Existing Template
            </button>
            <button
              type="button"
              style={{ ...styles.templateMenuDanger, ...(!selectedTemplate ? styles.templateMenuItemDisabled : {}) }}
              disabled={!selectedTemplate}
              onClick={() => run(() => sheet.deleteTemplate(selectedKey))}
            >
              Delete Template
            </button>
          </div>
          {message && <div style={styles.templateInlineMessage}>{message}</div>}
        </div>
      )}
    </div>
  );
}

function suggestedUiTemplateName(workbook) {
  return workbook?.projectName || workbook?.data?.project?.rows?.projectName?.value || "Estimate template";
}

function formatTemplateDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function FileMenu({ open, items, onToggle, onClose }) {
  return (
    <div style={styles.fileMenuWrap}>
      <button style={styles.fileMenuButton} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        File
      </button>
      {open && (
        <div style={styles.fileMenu} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              style={{ ...styles.fileMenuItem, ...(item.primary ? styles.fileMenuItemPrimary : {}) }}
              onClick={() => {
                item.action();
                onClose();
              }}
              role="menuitem"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section style={styles.section}>
      <div style={styles.staticSectionHeader}>{title}</div>
      <Spreadsheet headers={["When", "Item", "Field", "Value / Note"]}>
        {rows.slice(-12).reverse().map((row, index) => (
          <tr key={`${row.changedAt}-${index}`}>
            <Cell>{new Date(row.changedAt).toLocaleString()}</Cell>
            <Cell>{pretty(row.key || row.id || row.section || "")}</Cell>
            <Cell>{row.field || "formula"}</Cell>
            <Cell>{String(row.value || row.note || "")}</Cell>
          </tr>
        ))}
      </Spreadsheet>
    </section>
  );
}

function tabStyle(active) {
  return { ...styles.tabButton, ...(active ? styles.tabButtonActive : {}) };
}

function quoteReviewRows(sheet) {
  return Object.values(sheet.preview.quotation).flatMap((group) => group.rows).filter((row) => row.quoteRequired || row.sourceOfRate === "rate missing" || row.discontinuedWarning);
}

function exportCurrentPageCsv(sheet) {
  if (typeof window === "undefined") return;
  const page = sheet.workbook.page || "dataInput";
  const pageLabel = sheet.pages.find((item) => item.key === page)?.label || page;
  const rows = csvRowsForPage(sheet, page);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(pageLabel)}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveJobFile(sheet) {
  if (typeof window === "undefined") return;
  const savedAt = new Date().toISOString();
  const payload = {
    type: "estimate-builder-job",
    version: 1,
    savedAt,
    workbook: compactWorkbookForStorage({ ...sheet.workbook, savedAt }),
  };
  const fileName = `${jobFileName(sheet.workbook)}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Estimate Builder job file",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openJobFile(event, sheet) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      sheet.loadJobFileText(String(reader.result || ""));
    } catch {
      window.alert("That job file could not be opened. Please choose a valid Estimate Builder JSON file.");
    }
  };
  reader.readAsText(file);
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

function jobFileName(workbook) {
  const name = workbookDataValue(workbook, "projectName") || "estimate-job";
  return slug(name) || "estimate-job";
}

function openWorkbookFileName(workbook) {
  const projectName = workbookDataValue(workbook, "projectName");
  return projectName ? `${projectName}.json` : `${jobFileName(workbook)}.json`;
}

function workbookDataValue(workbook, key) {
  for (const section of Object.values(workbook.data || {})) {
    const value = section?.rows?.[key]?.value;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function csvRowsForPage(sheet, page) {
  if (page === "dataInput") return dataInputCsvRows(sheet);
  if (page === "windowsDoors") return windowsDoorsCsvRows(sheet);
  if (page === "formulaSheet") return formulaCsvRows(sheet);
  if (page === "quotation") return quotationCsvRows(sheet);
  if (page === "summary") return summaryCsvRows(sheet);
  return [["Page", "Value"], [page, "No export rows available"]];
}

function dataInputCsvRows(sheet) {
  const rows = [["Section", "Input / Quantity", "Value", "Unit", "Formula / Notes", "Result"]];
  sheet.dataInputSections.forEach((section) => {
    section.rows.forEach((row) => {
      if (row.heading) {
        rows.push([row.label, "", "", "", row.userNote || "", ""]);
        return;
      }
      const saved = sheet.workbook.data?.[section.key]?.rows?.[row.key] || {};
      const result = row.calculated ? value(sheet.preview.quantities[row.key]) : "";
      rows.push([
        row.sectionLabel || section.label,
        row.label,
        row.calculated ? result : value(saved.value),
        row.unit || "",
        row.calculated ? formulaForRow(sheet, row) : saved.notes || "",
        result,
      ]);
    });
  });
  return rows;
}

function windowsDoorsCsvRows(sheet) {
  const rows = [["Section", "Code", "Type", "Qty", "Level", "Height", "Width", "Area", "Sill", "Arch", "Notes"]];
  sheet.preview.windowsDoors.rows.forEach((row) => {
    rows.push([
      row.section || "",
      row.code || "",
      row.type || "",
      value(row.quantity),
      row.level || "",
      value(row.height),
      value(row.width),
      value(row.totalArea),
      value(row.sillLength),
      value(row.architraveLength),
      row.notes || "",
    ]);
  });
  rows.push([
    "Totals",
    "",
    "",
    value(sheet.preview.windowsDoors.totals.itemCount),
    "",
    "",
    "",
    value(sheet.preview.windowsDoors.totals.totalArea),
    value(sheet.preview.windowsDoors.totals.sillLength),
    value(sheet.preview.windowsDoors.totals.architraveLength),
    "",
  ]);
  return rows;
}

function formulaCsvRows(sheet) {
  const rows = [["Formula Name", "Formula Expression", "Formula Result", "Unit", "Change Note"]];
  formulaRows(sheet).forEach((row) => {
    rows.push([
      row.label,
      formulaForRow(sheet, row),
      value(sheet.preview.quantities[row.key]),
      row.unit || "",
      sheet.workbook.formulaNotes?.[row.key] || "",
    ]);
  });
  return rows;
}

function quotationCsvRows(sheet) {
  const rows = [["Section", "Row", "Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"]];
  sheet.quoteSections.forEach((section) => {
    const previewSection = sheet.preview.quotation[section];
    (previewSection?.rows || []).forEach((row, rowIndex) => {
      if (quoteFeeType(row)) return;
      if (isHiddenQuoteRow(row)) return;
      rows.push([
        section,
        quoteRowNumber(row, rowIndex),
        quoteItem(row),
        isLinkedQuoteQty(row) ? value(row.qty) : quoteInputQty(row, sheet),
        row.unit || "",
        value(row.finalRateUsed || row.manualRate || row.excelRate),
        quoteCost(row),
        row.sourceOfRate || "",
        row.notes || "",
      ]);
    });
    rows.push([section, "", "Section total", "", "", "", value(previewSection?.subtotal || 0), "", ""]);
  });
  return rows;
}

function summaryCsvRows(sheet) {
  const rows = [["Section", "Total"]];
  sheet.quoteSections.forEach((section) => {
    rows.push([section, value(sheet.preview.quotation[section]?.subtotal || 0)]);
  });
  rows.push(["Base line item subtotal", value(sheet.preview.summary.baseLineItemSubtotal ?? sheet.preview.summary.subtotalBeforeMargin)]);
  rows.push([`Preliminaries ${sheet.preview.summary.preliminaryCostsPercent || 0}%`, value(sheet.preview.summary.preliminaryCostsAmount)]);
  rows.push([`Overheads ${sheet.preview.summary.overheadsPercent}%`, value(sheet.preview.summary.overheadsAmount)]);
  rows.push([`Materials & labour margin ${sheet.preview.summary.marginPercent}%`, value(sheet.preview.summary.marginAmount)]);
  rows.push([`Profit ${sheet.preview.summary.profitPercent}%`, value(sheet.preview.summary.profitAmount)]);
  rows.push(["Subtotal before GST", value(sheet.preview.summary.subtotalBeforeGst)]);
  rows.push([`GST ${sheet.preview.summary.gstPercent || 10}%`, value(sheet.preview.summary.gst)]);
  rows.push(["QBSA registration", value(sheet.preview.summary.qbsaRegistration)]);
  rows.push(["Q Leave fees", value(sheet.preview.summary.qLeaveFees)]);
  rows.push([`Sales commission ${sheet.preview.summary.salesCommissionPercent}%`, value(sheet.preview.summary.salesCommissionAmount)]);
  rows.push(["Final quote total", value(sheet.preview.summary.finalQuoteTotal)]);
  return rows;
}

function csvCell(input) {
  const text = String(input ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(input) {
  return String(input || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
}

function formulaRows(sheet) {
  const defaultRows = sheet.dataSections.flatMap((section) => section.rows.filter((row) => row.calculated).map((row) => ({ ...row, section: section.label })));
  const hiddenRows = new Set(sheet.workbook.hiddenFormulaRows || []);
  const floorCount = workbookDataValue(sheet.workbook, "floorCount") || "Single storey";
  return [
    ...defaultRows.map((row, index) => ({ ...row, order: index * 1000 })),
    ...(sheet.workbook.formulaRows || [])
      .filter((row) => !framedWallFormulaKeyForLabel(row?.label) && !wallLengthTotalKeyForLabel(row?.label) && !plasterboardFormulaKeyForLabel(row?.label))
      .map((row) => ({ ...row, calculated: true, custom: true })),
  ].filter((row) => !hiddenRows.has(row.key) && isCalculatedRowVisible(row, sheet.workbook, floorCount)).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function framedWallFormulaKeyForLabel(label) {
  return FRAMED_WALL_FORMULA_LABELS[String(label || "").toLowerCase().replace(/\s+/g, " ").trim()] || "";
}

function plasterboardFormulaKeyForLabel(label) {
  return PLASTERBOARD_FORMULA_LABELS[String(label || "").toLowerCase().replace(/\s+/g, " ").trim()] || "";
}

function isCalculatedRowVisible(row, workbook, floorCount) {
  if (HIDDEN_CALCULATED_ROW_KEYS.has(String(row?.key || ""))) return false;
  if (!isFormulaRelevantForFloorCount(row, floorCount)) return false;
  if (!isRelevantForWallThicknessSelection(row, workbook)) return false;
  return true;
}

function isFormulaRelevantForFloorCount(row, floorCount) {
  return levelForDataRow(row) <= floorCountToLevels(floorCount);
}

function windowDoorGroups(rows) {
  const groups = [];
  rows.forEach((row) => {
    const label = row.section || "Other Windows / Doors";
    const key = rowDomId("window-section", label);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label, defaultType: windowDoorDefaultType(label), rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  });
  return groups;
}

function windowSizeOptions(rows = [], current = "", row = null) {
  if (isEntryDoorScheduleRow(row)) return ["820 ENTRY DOORS", "1200 ENTRY DOORS"];
  const options = Array.from(new Set([
    current,
    ...rows.map((row) => row.code),
  ].map((item) => String(item || "").trim()))).filter(Boolean);
  return options.length ? options : [""];
}

function isEntryDoorScheduleRow(row) {
  const text = `${row?.section || ""} ${row?.type || ""} ${row?.code || ""}`.toLowerCase();
  return text.includes("entry door") && !text.includes("garage") && !text.includes("internal");
}

function windowDoorDefaultType(section) {
  const text = String(section || "").toLowerCase();
  if (text.includes("entry doors")) return "Entry Door";
  if (text.includes("doors") && text.includes("sliding")) return "Sliding Door";
  if (text.includes("sliding")) return "Sliding Window";
  if (text.includes("awning")) return "Awning Window";
  if (text.includes("double hung")) return "Double Hung Window";
  if (text.includes("casement")) return "Casement Window";
  if (text.includes("louvre")) return "Louvre Window";
  if (text.includes("fixed")) return "Fixed Window";
  return "Workbook item";
}

function windowDoorLevelWarning(rows = []) {
  const validLevels = new Set(["Ground Level", "Second Level", "Third Level"]);
  const totalOpenings = rows.reduce((sum, row) => sum + summaryNumber(row?.quantity || 0), 0);
  const assignedOpenings = rows.reduce((sum, row) => (
    validLevels.has(levelDisplayValue(row?.level))
      ? sum + summaryNumber(row?.quantity || 0)
      : sum
  ), 0);
  const missingOpenings = Math.max(0, totalOpenings - assignedOpenings);
  if (!totalOpenings || missingOpenings === 0) return "";
  return `${missingOpenings} of ${totalOpenings} openings do not have a level selected. Select Ground Level, Second Level, or Third Level before finishing.`;
}

function levelTone(row) {
  const text = `${row.key || ""} ${row.label || ""}`.toLowerCase();
  if (text.includes("third")) return "thirdLevelCell";
  if (text.includes("second") || text.includes("upper")) return "upperLevelCell";
  if (text.includes("ground") || text.includes("lower")) return "lowerLevelCell";
  return "";
}

function rowDomId(...parts) {
  return parts.join("-").replace(/[^A-Za-z0-9_-]/g, "-");
}

function focusRowEditor(id) {
  if (typeof document === "undefined") return;
  const element = document.getElementById(id);
  if (!element) return;
  element.focus();
  if (typeof element.select === "function") element.select();
}

function value(v) {
  return v === "" || v === undefined || v === null ? "" : v;
}

function formulaForRow(sheet, row) {
  return userFacingFormula(internalFormulaForRow(sheet, row));
}

function internalFormulaForRow(sheet, row) {
  const dynamicFormula = dynamicDefaultFormulaForRow(sheet, row);
  const key = String(row?.key || "");
  const correctedDefaultFormula = CORRECTED_DEFAULT_FORMULA_KEYS.has(key) ? V4_DEFAULT_FORMULAS[row.key] : "";
  const defaultFormula = correctedDefaultFormula || dynamicFormula || V4_DEFAULT_FORMULAS[row.key] || row.defaultFormula || row.formula || "";
  const savedFormula = String(sheet.workbook.formulas?.[row.key] || "").trim();
  if (CORRECTED_DEFAULT_FORMULA_KEYS.has(key)) return defaultFormula;
  if (dynamicFormula && (TOTAL_WALL_LENGTH_RESULT_KEYS.has(key) || FRAMED_WALL_LENGTH_RESULT_KEYS.has(key))) return dynamicFormula;
  if (dynamicFormula && (!savedFormula || savedFormula === V4_DEFAULT_FORMULAS[row.key])) return dynamicFormula;
  if (!savedFormula || isStaleFormula(row.key, savedFormula)) return defaultFormula;
  return savedFormula;
}

function userFacingFormula(formula) {
  return String(formula || "")
    .replace(/\blower/g, "GroundLevel")
    .replace(/\bupper/g, "SecondLevel")
    .replace(/\bthird/g, "ThirdLevel")
    .replace(/\bLower/g, "GroundLevel")
    .replace(/\bUpper/g, "SecondLevel")
    .replace(/\bThird/g, "ThirdLevel");
}

function dynamicDefaultFormulaForRow(sheet, row) {
  const key = String(row?.key || "");
  const levels = floorCountToLevels(workbookDataValue(sheet.workbook, "floorCount") || "Single storey");
  const termsByKey = {
    totalExternal70mmWallsLm: wallLengthTerms(sheet.workbook, levels, "external", "70"),
    totalExternal90mmWallsLm: wallLengthTerms(sheet.workbook, levels, "external", "90"),
    totalInternal70mmWallsLm: wallLengthTerms(sheet.workbook, levels, "internal", "70"),
    totalInternal90mmWallsLm: wallLengthTerms(sheet.workbook, levels, "internal", "90"),
    total70mmWallsLm: ["totalExternal70mmWallsLm", "totalInternal70mmWallsLm"],
    total90mmWallsLm: ["totalExternal90mmWallsLm", "totalInternal90mmWallsLm"],
    externalFramedWall70mmLm: framedWallTerms(sheet.workbook, levels, "external", "70"),
    externalFramedWall90mmLm: framedWallTerms(sheet.workbook, levels, "external", "90"),
    internalFramedWall70mmLm: framedWallTerms(sheet.workbook, levels, "internal", "70"),
    internalFramedWall90mmLm: framedWallTerms(sheet.workbook, levels, "internal", "90"),
  };
  const terms = termsByKey[key];
  return terms ? terms.join(" + ") : "";
}

function dataInputFormulaForRow(sheet, row) {
  const levels = floorCountToLevels(workbookDataValue(sheet.workbook, "floorCount") || "Single storey");
  const framedWallFormulaNote = FRAMED_WALL_LENGTH_FORMULA_NOTES[row.key];
  if (framedWallFormulaNote) return framedWallFormulaNote;
  if (row.key === "lowerRoofPlanAreaM2") {
    if (levels === 1) return "Ground Level roof plan = Ground Level total floor area";
    if (levels === 2) return "Ground Level roof plan = Ground Level total floor area - Second Level roof plan";
    return "Ground Level roof plan = Ground Level total floor area - Third Level roof plan";
  }
  if (row.key === "upperRoofPlanAreaM2") return "Second Level roof plan = Second Level total floor area";
  if (row.key === "thirdRoofPlanAreaM2") return "Third Level roof plan = Third Level total floor area";
  return "";
}

function isStaleFormula(key, formula) {
  if (V4_DEFAULT_FORMULAS[key] && formula === key) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\bC\d+\b/i.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /![A-Z]+\d+/i.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\b(?:GroundLevel|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)WallsLm\b/.test(formula)) return true;
  if (V4_DEFAULT_FORMULAS[key] && /\b(?:GroundFloor|SecondLevel|ThirdLevel)(?:External|Internal)(?:70mm|90mm)FramedWallLm\b/.test(formula)) return true;
  if (key === "corniceLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "skirtingLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") return true;
  if (key === "lowerSkirtingLm" && (formula === "lowerInternalWallsLm + lowerExternalWallsLm" || formula === "(lowerInternalWallsLm * 2) + lowerExternalWallsLm")) return true;
  if (key === "upperSkirtingLm" && (formula === "upperInternalWallsLm + upperExternalWallsLm" || formula === "(upperInternalWallsLm * 2) + upperExternalWallsLm")) return true;
  if (key === "thirdSkirtingLm" && (formula === "thirdInternalWallsLm + thirdExternalWallsLm" || formula === "(thirdInternalWallsLm * 2) + thirdExternalWallsLm")) return true;
  if (key === "skirtingLengthsEach" && formula === "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 1.15 / 5.4") return true;
  if (key === "upperExternalWallAreaM2" && (formula.includes("+ 0.3") || formula === "upperExternalWallsLm * upperCeilingHeight")) return true;
  if (key === "thirdExternalWallAreaM2" && (formula.includes("+ 0.3") || formula === "thirdExternalWallsLm * thirdCeilingHeight")) return true;
  return false;
}

function isRequiredDataInputRow(key) {
  return REQUIRED_DATA_INPUT_ROW_KEYS.has(key);
}

function editableInputValue(sheet, row, saved) {
  if (saved.value !== "" && saved.value !== undefined && saved.value !== null) return saved.value;
  if (AUTO_FILLED_EDITABLE_ROWS.has(row.key)) return value(sheet.preview.quantities[row.key]);
  return "";
}

function selectInputValue(row, saved) {
  if (saved.value !== "" && saved.value !== undefined && saved.value !== null) return saved.value;
  if (["lowerFloorDepthMm", "upperFloorDepthMm", "thirdFloorDepthMm"].includes(row.key)) return row.options?.[0] || "";
  return "";
}

function floorCountToLevels(floorCount) {
  const text = String(floorCount || "").toLowerCase();
  if (text.includes("three") || text.includes("3")) return 3;
  if (text.includes("two") || text.includes("2") || text.includes("double")) return 2;
  return 1;
}

function levelForDataRow(row) {
  const key = String(row?.key || "");
  const text = `${row?.section || ""} ${row?.label || ""}`.toLowerCase();
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

function isRelevantForWallThicknessSelection(row, workbook) {
  const key = wallLengthTotalKeyForLabel(row?.label) || String(row?.key || "");
  if (ALWAYS_VISIBLE_TOTAL_MATERIAL_KEYS.has(key)) return true;
  if (key === "totalExternal70mmWallsLm") return true;
  if (key === "totalExternal90mmWallsLm") return true;
  if (key === "totalInternal70mmWallsLm") return true;
  if (key === "totalInternal90mmWallsLm") return hasSelectedWallLengthThickness(workbook, "internal", "90");
  if (key === "total70mmWallsLm") return hasSelectedWallThickness(workbook, "70");
  if (key === "total90mmWallsLm") return hasSelectedWallThickness(workbook, "90");
  const spec = WALL_THICKNESS_SPECIFIC_RESULT_ROWS[key];
  if (spec) return hasSelectedThicknessForRows(workbook, spec.thickness, spec.pairs);
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

function framedWallTerms(workbook, levels, wallType, thickness) {
  const prefix = wallType === "external" ? "External" : "Internal";
  const pairs = wallType === "external"
    ? [
        ["lowerWallThicknessMm", "lowerExternal70mmFramedWallLm", "lowerExternal90mmFramedWallLm", 1],
        ["upperWallThicknessMm", "upperExternal70mmFramedWallLm", "upperExternal90mmFramedWallLm", 2],
        ["thirdWallThicknessMm", "thirdExternal70mmFramedWallLm", "thirdExternal90mmFramedWallLm", 3],
      ]
    : [
        ["lowerInternalWallThicknessMm", "lowerInternal70mmFramedWallLm", "lowerInternal90mmFramedWallLm", 1],
        ["upperInternalWallThicknessMm", "upperInternal70mmFramedWallLm", "upperInternal90mmFramedWallLm", 2],
        ["thirdInternalWallThicknessMm", "thirdInternal70mmFramedWallLm", "thirdInternal90mmFramedWallLm", 3],
      ];
  const terms = pairs
    .filter(([thicknessKey,, , level]) => level <= levels && selectedThickness(workbook, thicknessKey) === thickness)
    .map(([, term70, term90]) => (thickness === "70" ? term70 : term90));
  return terms.length ? terms : [`No selected ${prefix.toLowerCase()} ${thickness}mm framed walls`];
}

function wallLengthTerms(workbook, levels, wallType, thickness) {
  const pairs = wallType === "external"
    ? [
        ["lowerWallThicknessMm", "lowerExternal70mmWallsLm", "lowerExternal90mmWallsLm", 1],
        ["upperWallThicknessMm", "upperExternal70mmWallsLm", "upperExternal90mmWallsLm", 2],
        ["thirdWallThicknessMm", "thirdExternal70mmWallsLm", "thirdExternal90mmWallsLm", 3],
      ]
    : [
        ["lowerInternalWallThicknessMm", "lowerInternal70mmWallsLm", "lowerInternal90mmWallsLm", 1],
        ["upperInternalWallThicknessMm", "upperInternal70mmWallsLm", "upperInternal90mmWallsLm", 2],
        ["thirdInternalWallThicknessMm", "thirdInternal70mmWallsLm", "thirdInternal90mmWallsLm", 3],
      ];
  return pairs
    .filter(([thicknessKey,, , level]) => level <= levels && selectedThickness(workbook, thicknessKey) === thickness)
    .map(([, term70, term90]) => (thickness === "70" ? term70 : term90));
}

function hasSelectedWallLengthThickness(workbook, wallType, thickness) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return wallLengthTerms(workbook, levels, wallType, thickness).length > 0;
}

function hasSelectedThicknessForRows(workbook, thickness, pairs) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return pairs.some(([thicknessKey]) => thicknessKeyLevel(thicknessKey) <= levels && selectedThickness(workbook, thicknessKey) === thickness);
}

function hasSelectedWallThickness(workbook, thickness) {
  const levels = floorCountToLevels(workbookDataValue(workbook, "floorCount") || "Single storey");
  return [
    "lowerWallThicknessMm",
    "upperWallThicknessMm",
    "thirdWallThicknessMm",
    "lowerInternalWallThicknessMm",
    "upperInternalWallThicknessMm",
    "thirdInternalWallThicknessMm",
  ].some((key) => thicknessKeyLevel(key) <= levels && selectedThickness(workbook, key) === thickness);
}

function selectedThickness(workbook, key) {
  return String(workbookDataValue(workbook, key) || "").replace(/\D/g, "");
}

function thicknessKeyLevel(key) {
  if (String(key || "").startsWith("third")) return 3;
  if (String(key || "").startsWith("upper")) return 2;
  return 1;
}

const AUTO_FILLED_EDITABLE_ROWS = new Set([
  "lowerRoofPlanAreaM2",
  "upperRoofPlanAreaM2",
  "thirdRoofPlanAreaM2",
]);

const HIDDEN_CALCULATED_ROW_KEYS = new Set([
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

const TOTAL_WALL_LENGTH_RESULT_KEYS = new Set([
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "total70mmWallsLm",
  "total90mmWallsLm",
]);

const FRAMED_WALL_LENGTH_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "externalFramedWall90mmLm",
  "internalFramedWall70mmLm",
  "internalFramedWall90mmLm",
]);

const CORRECTED_DEFAULT_FORMULA_KEYS = new Set([
  "lowerSlabAreaM2",
  "secondLevelFloorAreaM2",
  "thirdLevelFloorAreaM2",
  "slabFloorAreaM2",
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

const FRAMED_WALL_LENGTH_FORMULA_NOTES = {
  externalFramedWall70mmLm: "= ALL GROUND LEVEL 70MM EXTERNAL WALLS + SECOND LEVEL 70MM EXTERNAL WALLS + THIRD LEVEL 70MM EXTERNAL WALLS",
  externalFramedWall90mmLm: "= ALL GROUND LEVEL 90MM EXTERNAL WALLS + SECOND LEVEL 90MM EXTERNAL WALLS + THIRD LEVEL 90MM EXTERNAL WALLS",
  internalFramedWall70mmLm: "= ALL GROUND LEVEL 70MM INTERNAL WALLS + SECOND LEVEL 70MM INTERNAL WALLS + THIRD LEVEL 70MM INTERNAL WALLS",
  internalFramedWall90mmLm: "= ALL GROUND LEVEL 90MM INTERNAL WALLS + SECOND LEVEL 90MM INTERNAL WALLS + THIRD LEVEL 90MM INTERNAL WALLS",
};

const FRAMED_WALL_FORMULA_LABELS = {
  "total external 70mm framed wall lm": "totalExternal70mmWallsLm",
  "total external 90mm framed wall lm": "totalExternal90mmWallsLm",
  "total internal 70mm framed wall lm": "totalInternal70mmWallsLm",
  "total internal 90mm framed wall lm": "totalInternal90mmWallsLm",
};

const WALL_THICKNESS_70MM_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "internalFramedWall70mmLm",
  "studs70mmEach",
  "wallPlatesNoggins70mmExternalWallsLm",
  "wallPlatesNoggins70mmInternalWallsLm",
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

const WALL_THICKNESS_90MM_RESULT_KEYS = new Set([
  "externalFramedWall90mmLm",
  "internalFramedWall90mmLm",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
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
  externalFramedWall70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  externalFramedWall90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  internalFramedWall70mmLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  internalFramedWall90mmLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  wallPlatesNoggins70mmExternalWallsLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  wallPlatesNoggins90mmExternalWallsLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["upperWallThicknessMm"], ["thirdWallThicknessMm"]] },
  wallPlatesNoggins70mmInternalWallsLm: { thickness: "70", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  wallPlatesNoggins90mmInternalWallsLm: { thickness: "90", pairs: [["lowerInternalWallThicknessMm"], ["upperInternalWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  lowerStudMaterial70mmLm: { thickness: "70", pairs: [["lowerWallThicknessMm"], ["lowerInternalWallThicknessMm"]] },
  upperStudMaterial70mmLm: { thickness: "70", pairs: [["upperWallThicknessMm"], ["upperInternalWallThicknessMm"]] },
  thirdStudMaterial70mmLm: { thickness: "70", pairs: [["thirdWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
  lowerStudMaterial90mmLm: { thickness: "90", pairs: [["lowerWallThicknessMm"], ["lowerInternalWallThicknessMm"]] },
  upperStudMaterial90mmLm: { thickness: "90", pairs: [["upperWallThicknessMm"], ["upperInternalWallThicknessMm"]] },
  thirdStudMaterial90mmLm: { thickness: "90", pairs: [["thirdWallThicknessMm"], ["thirdInternalWallThicknessMm"]] },
};

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

function levelDisplayValue(level) {
  const text = String(level || "").trim().toLowerCase();
  if (["1", "ground", "ground floor", "ground level", "lower", "lower level"].includes(text)) return "Ground Level";
  if (["2", "second", "second floor", "second level", "upper", "upper level"].includes(text)) return "Second Level";
  if (["3", "third", "third floor", "third level"].includes(text)) return "Third Level";
  return level || "";
}

function money(v) {
  return v ? `$${Number(v).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

function quoteCost(row) {
  const qty = Number(row?.qty || row?.quantity || 0);
  if (!qty) return "";
  return money(row?.cost);
}

function quoteInputQty(row, sheet = null) {
  if (quoteRowNumber(row) === 1210) return "";
  const floorSystemQty = floorSystemQuoteDisplayQty(row, sheet);
  if (floorSystemQty !== "") return value(floorSystemQty);
  if (isFormulaQuoteQty(row) && (row?.quantity === "" || row?.quantity === undefined || row?.quantity === null)) {
    return row?.qty ? value(row.qty) : "";
  }
  if (isEditableLinkedQuoteQty(row) && row?.quantityManualOverride !== true) {
    return row?.qty ? value(row.qty) : "";
  }
  return value(row?.quantity);
}

function floorSystemQuoteDisplayQty(row, sheet) {
  const key = floorSystemQuoteKey(row);
  if (!key || !sheet) return "";
  const direct = sheet.preview?.quantities?.[key];
  if (Number(direct)) return direct;

  const lowerSystem = floorSystemWorkbookValue(sheet, "lowerFloorDepthMm");
  const secondSystem = floorSystemWorkbookValue(sheet, "upperFloorDepthMm");
  const thirdSystem = floorSystemWorkbookValue(sheet, "thirdFloorDepthMm");
  const groundArea = sheet.preview?.quantities?.lowerSlabAreaM2 || workbookDataValue(sheet.workbook, "lowerSlabAreaM2");
  const secondArea = sheet.preview?.quantities?.secondLevelFloorAreaM2 || workbookDataValue(sheet.workbook, "secondLevelFloorAreaM2");
  const thirdArea = sheet.preview?.quantities?.thirdLevelFloorAreaM2 || workbookDataValue(sheet.workbook, "thirdLevelFloorAreaM2");

  if (key === "quoteFloorSystemGround300M2") return isSelected300FloorSystem(lowerSystem) ? groundArea : "";
  if (key === "quoteFloorSystemGround360M2") return isSelected360FloorSystem(lowerSystem) ? groundArea : "";
  if (key === "quoteFloorSystemSecond300M2") return isSelected300FloorSystem(secondSystem) ? secondArea : "";
  if (key === "quoteFloorSystemSecond360M2") return isSelected360FloorSystem(secondSystem) ? secondArea : "";
  if (key === "quoteFloorSystemThird300M2") return isSelected300FloorSystem(thirdSystem) ? thirdArea : "";
  if (key === "quoteFloorSystemThird360M2") return isSelected360FloorSystem(thirdSystem) ? thirdArea : "";
  return "";
}

function floorSystemWorkbookValue(sheet, key) {
  const saved = workbookDataValue(sheet?.workbook, key);
  if (saved) return saved;
  const row = findDataInputRowByKey(key);
  return row?.options?.[0] || "";
}

function findDataInputRowByKey(key) {
  for (const section of DATA_INPUT_SECTIONS_FOR_LOOKUP) {
    const row = (section.rows || []).find((item) => item.key === key);
    if (row) return row;
  }
  return null;
}

function floorSystemQuoteKey(row) {
  const byId = {
    "quote-593.4": "quoteFloorSystemGround300M2",
    "quote-593.5": "quoteFloorSystemGround360M2",
    "quote-593.6": "quoteFloorSystemSecond300M2",
    "quote-593.7": "quoteFloorSystemSecond360M2",
    "quote-593.8": "quoteFloorSystemThird300M2",
    "quote-593.9": "quoteFloorSystemThird360M2",
  };
  if (byId[String(row?.id || "")]) return byId[String(row?.id || "")];
  const rowNumber = Number(row?.excelRow || row?.sourceRow || row?.values?.sourceRow || 0);
  if (rowNumber === 593.4) return "quoteFloorSystemGround300M2";
  if (rowNumber === 593.5) return "quoteFloorSystemGround360M2";
  if (rowNumber === 593.6) return "quoteFloorSystemSecond300M2";
  if (rowNumber === 593.7) return "quoteFloorSystemSecond360M2";
  if (rowNumber === 593.8) return "quoteFloorSystemThird300M2";
  if (rowNumber === 593.9) return "quoteFloorSystemThird360M2";
  return String(row?.quantityKey || "").startsWith("quoteFloorSystem") ? row.quantityKey : "";
}

function isSelected300FloorSystem(system) {
  const text = floorSystemText(system);
  return text.includes("suspended timber floor system") || text.includes("300mm i beams") || text.includes("300mm i beam") || text.startsWith("319mm");
}

function isSelected360FloorSystem(system) {
  const text = floorSystemText(system);
  return text.includes("360mm i beams") || text.includes("360mm i beam") || text.startsWith("379mm");
}

function floorSystemText(value) {
  return String(value || "").toLowerCase().replace(/[-\u2010-\u2015]/g, " ").replace(/\s+/g, " ").trim();
}

function quoteRowNumber(row, rowIndex = 0) {
  return row?.excelRow || row?.sourceRow || row?.values?.sourceRow || rowIndex + 1;
}

function quoteSectionNumber(section, sheet) {
  const override = QUOTE_SECTION_NUMBER_OVERRIDES[quoteSectionBaseName(section)];
  if (override) return override;
  const rows = sheet.preview?.quotation?.[section]?.rows || sheet.workbook?.quotation?.[section]?.rows || [];
  const firstNumberedRow = rows.find((row) => quoteRowNumber(row, 0));
  return firstNumberedRow ? quoteRowNumber(firstNumberedRow, 0) : "";
}

function findSectionByNumber(sections, number, sheet) {
  const needle = String(number || "").trim();
  if (!needle) return "";
  return sections.find((section) => String(quoteSectionNumber(section, sheet)) === needle) || "";
}

function moveSectionBefore(sections, movingSection, targetSection) {
  const withoutMoving = sections.filter((section) => section !== movingSection);
  const targetIndex = withoutMoving.indexOf(targetSection);
  if (targetIndex < 0) return sections;
  return [...withoutMoving.slice(0, targetIndex), movingSection, ...withoutMoving.slice(targetIndex)];
}

function moveSectionAfter(sections, movingSection, afterSection) {
  const withoutMoving = sections.filter((section) => section !== movingSection);
  const afterIndex = withoutMoving.indexOf(afterSection);
  if (afterIndex < 0) return sections;
  return [...withoutMoving.slice(0, afterIndex + 1), movingSection, ...withoutMoving.slice(afterIndex + 1)];
}

function dataInputRowNumber(row, rowIndex = 0) {
  return row?.sourceRow ?? rowIndex + 1;
}

function quoteItem(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  if (itemText === "install window architraves") return "INSTALL EXTERIOR DOOR AND WINDOW ARCHITRAVES";
  if (itemText === "70 x 35 mpg 12") return "PLATES AND NOGGINS 70 X 35 MPG 12";
  if (itemText === "brick window sills required (add y for yes)") return "BRICK SILLS";
  return row?.item || "";
}

function isApplianceHeadingQuoteRow(row) {
  return row?.applianceHeading === true || row?.lineType === "Appliance heading";
}

function isAppliancePackageSection(section) {
  return quoteSectionBaseName(section) === "appliance package";
}

function isApplianceBrandSubsection(section) {
  return quoteSectionBaseName(section).startsWith("appliance package - ");
}

function quoteSectionDisplayLabel(section) {
  return isApplianceBrandSubsection(section)
    ? section.replace(/^appliance package\s*-\s*/i, "")
    : section;
}

function applianceBrandKey(row) {
  return String(row?.applianceBrand || quoteItem(row) || row?.id || "").trim().toLowerCase();
}

function visibleApplianceRows(rows = [], openApplianceBrands = {}) {
  let currentBrandKey = "";
  let currentBrandOpen = true;
  return rows.filter((row) => {
    if (isApplianceHeadingQuoteRow(row) && row.applianceHeadingLevel === 1) {
      currentBrandKey = applianceBrandKey(row);
      currentBrandOpen = Boolean(openApplianceBrands[currentBrandKey]);
      return true;
    }
    if (currentBrandKey && !currentBrandOpen) return false;
    return true;
  });
}

function applianceRowsForBrand(rows = [], brandKey = "") {
  const result = [];
  let collecting = false;
  rows.forEach((row) => {
    if (isApplianceHeadingQuoteRow(row) && row.applianceHeadingLevel === 1) {
      collecting = applianceBrandKey(row) === brandKey;
      return;
    }
    if (collecting) result.push(row);
  });
  return result;
}

function sumQuoteRows(rows = []) {
  return rows.reduce((total, row) => total + Number(row?.cost || 0), 0);
}

function isLinkedQuoteQty(row) {
  if (isBlankQuoteQtyRow(row)) return false;
  return Boolean(row?.quantityKey && !row?.quantity && row?.qty);
}

function isEditableLinkedQuoteQty(row) {
  return Boolean(row?.quantityKey);
}

function isFormulaQuoteQty(row) {
  return Boolean(row?.formulas?.B);
}

function isBlankQuoteQtyRow(row) {
  if (quoteRowNumber(row) === 116) return false;
  if (quoteRowNumber(row) === 1356) return false;
  if (quoteRowNumber(row) === 1363) return false;
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

function isHiddenQuoteRow(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  return itemText === "install exterior door architraves";
}

function isConcreteSlabSection(section) {
  return quoteSectionBaseName(section) === "concrete slab";
}

function isConcreteSlabSubsection(section) {
  return CONCRETE_SLAB_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isWallFramesSection(section) {
  const name = quoteSectionBaseName(section);
  return name === "wall frames" || name === "ground floor framing";
}

function isWallFramesSubsection(section) {
  return WALL_FRAMES_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRoofFramingSection(section) {
  return quoteSectionBaseName(section) === "roof framing";
}

function isRoofFramingSubsection(section) {
  return ROOF_FRAMING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isHardwareSection(section) {
  return quoteSectionBaseName(section) === "hardware";
}

function isHardwareSubsection(section) {
  return HARDWARE_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRoofingMaterialsSection(section) {
  return quoteSectionBaseName(section) === "roofing materials";
}

function isRoofingMaterialsSubsection(section) {
  return ROOFING_MATERIALS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isExternalCladdingSection(section) {
  return quoteSectionBaseName(section) === "external cladding";
}

function isExternalCladdingSubsection(section) {
  return EXTERNAL_CLADDING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isEntryDoorsSection(section) {
  return quoteSectionBaseName(section) === "doors";
}

function isEntryDoorsSubsection(section) {
  return ENTRY_DOORS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isTilingSection(section) {
  return quoteSectionBaseName(section) === "tiling";
}

function isTilingSubsection(section) {
  return TILING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPlumbingFittingsSection(section) {
  return quoteSectionBaseName(section) === "plumbing fittings & tapwear";
}

function isPlumbingFittingsSubsection(section) {
  return PLUMBING_FITTINGS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isElectricalSection(section) {
  return quoteSectionBaseName(section) === "electrical";
}

function isElectricalSubsection(section) {
  return ELECTRICAL_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPainterSection(section) {
  return quoteSectionBaseName(section) === "painter";
}

function isPainterSubsection(section) {
  return PAINTER_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isFloorcoveringsSection(section) {
  return quoteSectionBaseName(section) === "floorcoverings";
}

function isFloorcoveringsSubsection(section) {
  return FLOORCOVERINGS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isMirrorsShowerScreensSection(section) {
  return quoteSectionBaseName(section) === "mirrors & shower screens";
}

function isMirrorsShowerScreensSubsection(section) {
  return MIRRORS_SHOWER_SCREENS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function topLevelQuoteSections(sections = []) {
  return sections.filter((section) => !isGroupedQuoteSubsection(section, sections));
}

function isGroupedQuoteSubsection(section, sections = []) {
  if (isConcreteSlabSubsection(section)) return true;
  if (sections.some((item) => isWallFramesSection(item)) && isWallFramesSubsection(section)) return true;
  if (sections.some((item) => isRoofFramingSection(item)) && isRoofFramingSubsection(section)) return true;
  if (sections.some((item) => isHardwareSection(item)) && isHardwareSubsection(section)) return true;
  if (sections.some((item) => isRoofingMaterialsSection(item)) && isRoofingMaterialsSubsection(section)) return true;
  if (sections.some((item) => isExternalCladdingSection(item)) && isExternalCladdingSubsection(section)) return true;
  if (sections.some((item) => isEntryDoorsSection(item)) && isEntryDoorsSubsection(section)) return true;
  if (sections.some((item) => isTilingSection(item)) && isTilingSubsection(section)) return true;
  if (sections.some((item) => isPlumbingFittingsSection(item)) && isPlumbingFittingsSubsection(section)) return true;
  if (sections.some((item) => isElectricalSection(item)) && isElectricalSubsection(section)) return true;
  if (sections.some((item) => isPainterSection(item)) && isPainterSubsection(section)) return true;
  if (sections.some((item) => isFloorcoveringsSection(item)) && isFloorcoveringsSubsection(section)) return true;
  if (sections.some((item) => isMirrorsShowerScreensSection(item)) && isMirrorsShowerScreensSubsection(section)) return true;
  if (sections.some((item) => isFaceBrickworkSection(item)) && isFaceBrickworkSubsection(section)) return true;
  if (sections.some((item) => isRenderingSection(item)) && isRenderingSubsection(section)) return true;
  if (sections.some((item) => isPlasterSupplyInstallSection(item)) && isPlasterSupplyInstallSubsection(section)) return true;
  if (sections.some((item) => isFixOutMaterialsSection(item)) && isFixOutMaterialsSubsection(section)) return true;
  if (sections.some((item) => isCabinetMakerSection(item)) && isCabinetMakerSubsection(section)) return true;
  if (sections.some((item) => isAppliancePackageSection(item)) && isApplianceBrandSubsection(section)) return true;
  return false;
}

function expandManagedQuoteSectionOrder(topLevelOrder = [], allSections = []) {
  const expanded = [];
  const seen = new Set();
  const add = (section) => {
    if (!section || seen.has(section) || !allSections.includes(section)) return;
    expanded.push(section);
    seen.add(section);
  };
  topLevelOrder.forEach((section) => {
    add(section);
    quoteChildSectionsForParent(section, allSections).forEach(add);
  });
  allSections.forEach(add);
  return expanded;
}

function quoteChildSectionsForParent(section, sections = []) {
  if (isConcreteSlabSection(section)) return sections.filter((item) => isConcreteSlabSubsection(item));
  if (isWallFramesSection(section)) return sections.filter((item) => isWallFramesSubsection(item));
  if (isRoofFramingSection(section)) return sections.filter((item) => isRoofFramingSubsection(item));
  if (isHardwareSection(section)) return sections.filter((item) => isHardwareSubsection(item));
  if (isRoofingMaterialsSection(section)) return sections.filter((item) => isRoofingMaterialsSubsection(item));
  if (isExternalCladdingSection(section)) return sections.filter((item) => isExternalCladdingSubsection(item));
  if (isEntryDoorsSection(section)) return sections.filter((item) => isEntryDoorsSubsection(item));
  if (isTilingSection(section)) return orderedTilingSubsections(sections.filter((item) => isTilingSubsection(item)));
  if (isPlumbingFittingsSection(section)) return orderedPlumbingFittingsSubsections(sections.filter((item) => isPlumbingFittingsSubsection(item)));
  if (isElectricalSection(section)) return orderedElectricalSubsections(sections.filter((item) => isElectricalSubsection(item)));
  if (isPainterSection(section)) return orderedPainterSubsections(sections.filter((item) => isPainterSubsection(item)));
  if (isFloorcoveringsSection(section)) return orderedFloorcoveringsSubsections(sections.filter((item) => isFloorcoveringsSubsection(item)));
  if (isMirrorsShowerScreensSection(section)) return orderedMirrorsShowerScreensSubsections(sections.filter((item) => isMirrorsShowerScreensSubsection(item)));
  if (isFaceBrickworkSection(section)) return sections.filter((item) => isFaceBrickworkSubsection(item));
  if (isRenderingSection(section)) return sections.filter((item) => isRenderingSubsection(item));
  if (isPlasterSupplyInstallSection(section)) return sections.filter((item) => isPlasterSupplyInstallSubsection(item));
  if (isFixOutMaterialsSection(section)) return sections.filter((item) => isFixOutMaterialsSubsection(item));
  if (isCabinetMakerSection(section)) return orderedCabinetMakerSubsections(sections.filter((item) => isCabinetMakerSubsection(item)));
  if (isAppliancePackageSection(section)) return sections.filter((item) => isApplianceBrandSubsection(item));
  return [];
}

function isFaceBrickworkSection(section) {
  return quoteSectionBaseName(section) === "face brickwork";
}

function isFaceBrickworkSubsection(section) {
  return FACE_BRICKWORK_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isRenderingSection(section) {
  return quoteSectionBaseName(section) === "rendering";
}

function isRenderingSubsection(section) {
  return RENDERING_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isPlasterSupplyInstallSection(section) {
  return quoteSectionBaseName(section) === "plasterer - supply and install";
}

function isPlasterSupplyInstallSubsection(section) {
  return PLASTER_SUPPLY_INSTALL_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isFixOutMaterialsSection(section) {
  return quoteSectionBaseName(section) === "fix out materials";
}

function isFixOutMaterialsSubsection(section) {
  return FIX_OUT_MATERIALS_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function isCabinetMakerSection(section) {
  return quoteSectionBaseName(section) === "cabinet maker";
}

function isCabinetMakerSubsection(section) {
  return CABINET_MAKER_SUBSECTIONS.has(quoteSectionBaseName(section));
}

function wallFramesDisplayLabel(section) {
  if (!isWallFramesSection(section)) return undefined;
  return String(section || "WALL FRAMES").replace(/ground floor framing/i, "WALL FRAMES");
}

function quoteSectionBaseName(section) {
  return String(section || "").toLowerCase().replace(/['’]/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

const CONCRETE_SLAB_SUBSECTIONS = new Set([
  "slab items cost",
  "excavations & machine hire costs",
  "trench mesh",
  "reinforcing fabric",
  "deformed bar",
  "starter bars & corner bars",
  "dowells",
  "accessories",
  "waffle pods",
  "bulk materials",
  "concrete",
  "internal beams",
  "concrete pumping",
]);

const WALL_FRAMES_SUBSECTIONS = new Set([
  "pre-fab wall frames",
  "framing timber",
  "wall frames - lineal",
  "lintels & beams",
  "misc timber",
  "bracing and tie down",
  "ply bracing sheets",
  "tie down",
]);

const ROOF_FRAMING_SUBSECTIONS = new Set([
  "ceiling battens",
]);

const HARDWARE_SUBSECTIONS = new Set([
  "bolts nuts & screws",
  "couplings",
  "nails",
  "adhesives",
  "misc",
]);

const ROOFING_MATERIALS_SUBSECTIONS = new Set([
  "roofing labour",
]);

const EXTERNAL_CLADDING_SUBSECTIONS = new Set([
  "exterior cladding",
  "blue board",
  "hardiflex",
  "styrofoam exterior cladding",
  "j beads",
  "weather boards",
  "soffits",
  "soffits - lineal",
  "timber and trims",
]);

const ENTRY_DOORS_SUBSECTIONS = new Set([
  "double entry doors",
  "pivot door",
  "laundry/garage 820 1/3 panel glass door",
  "door jambs",
  "side lights",
  "door furniture",
  "garage door jambs",
  "garage doors - sectional panel lift",
  "garage doors - manual roll-a-door",
]);

const TILING_SUBSECTIONS = new Set([
  "bathroom",
  "ensuite",
  "toilet",
  "other room/s",
  "kitchen",
  "tile layer",
]);

const TILING_SUBSECTION_ORDER = [
  "bathroom",
  "ensuite",
  "toilet",
  "other room/s",
  "kitchen",
  "tile layer",
];

function orderedTilingSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = TILING_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = TILING_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? TILING_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? TILING_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const PLUMBING_FITTINGS_SUBSECTIONS = new Set([
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
]);

const PLUMBING_FITTINGS_SUBSECTION_ORDER = [
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
];

function orderedPlumbingFittingsSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = PLUMBING_FITTINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = PLUMBING_FITTINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? PLUMBING_FITTINGS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? PLUMBING_FITTINGS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const ELECTRICAL_SUBSECTIONS = new Set([
  "electrical fixtures",
  "lightfittings",
  "ceiling fans",
  "misc electrical fittings",
]);

const ELECTRICAL_SUBSECTION_ORDER = [
  "electrical fixtures",
  "lightfittings",
  "ceiling fans",
  "misc electrical fittings",
];

function orderedElectricalSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = ELECTRICAL_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = ELECTRICAL_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? ELECTRICAL_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? ELECTRICAL_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const PAINTER_SUBSECTIONS = new Set([
  "cleaning",
  "landscaping",
]);

const PAINTER_SUBSECTION_ORDER = [
  "cleaning",
  "landscaping",
];

function orderedPainterSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = PAINTER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = PAINTER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? PAINTER_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? PAINTER_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const FLOORCOVERINGS_SUBSECTIONS = new Set([
  "ceramic tiles",
  "porcelain tiles",
  "laminated flooring",
  "vinyl flooring",
  "hybrid flooring",
  "engeineered timber",
  "solid timber flooring",
  "carpets",
  "misc flooring",
]);

const FLOORCOVERINGS_SUBSECTION_ORDER = [
  "ceramic tiles",
  "porcelain tiles",
  "laminated flooring",
  "vinyl flooring",
  "hybrid flooring",
  "engeineered timber",
  "solid timber flooring",
  "carpets",
  "misc flooring",
];

function orderedFloorcoveringsSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = FLOORCOVERINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = FLOORCOVERINGS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? FLOORCOVERINGS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? FLOORCOVERINGS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const MIRRORS_SHOWER_SCREENS_SUBSECTIONS = new Set([
  "mirrors",
  "softline - framed 1870 high",
  "grange -semi frameless",
]);

const MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER = [
  "mirrors",
  "softline - framed 1870 high",
  "grange -semi frameless",
];

function orderedMirrorsShowerScreensSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? MIRRORS_SHOWER_SCREENS_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

const QUOTE_SECTION_NUMBER_OVERRIDES = {
  "garage door jambs": 73,
  "garage doors - sectional panel lift": 74,
};

const FACE_BRICKWORK_SUBSECTIONS = new Set([
  "bricklayers labour",
]);

const RENDERING_SUBSECTIONS = new Set([
  "renderers labour",
  "misc rendering",
]);

const PLASTER_SUPPLY_INSTALL_SUBSECTIONS = new Set([
  "plastering extras",
]);

const FIX_OUT_MATERIALS_SUBSECTIONS = new Set([
  "shelving",
  "standard wardrobes complete (2.4m wide)",
  "standard 3 door robe up to 3.6m wide",
  "standard 2 door linen up to 2.4m wide",
  "standard 3 door linen up to 3.6m wide",
]);

const CABINET_MAKER_SUBSECTIONS = new Set([
  "butlers pantry",
  "laundry",
  "bathrooms",
  "wardrobes",
]);

const CABINET_MAKER_SUBSECTION_ORDER = [
  "butlers pantry",
  "laundry",
  "bathrooms",
  "wardrobes",
];

function orderedCabinetMakerSubsections(sections = []) {
  return [...sections].sort((a, b) => {
    const aIndex = CABINET_MAKER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(a));
    const bIndex = CABINET_MAKER_SUBSECTION_ORDER.indexOf(quoteSectionBaseName(b));
    const safeA = aIndex < 0 ? CABINET_MAKER_SUBSECTION_ORDER.length : aIndex;
    const safeB = bIndex < 0 ? CABINET_MAKER_SUBSECTION_ORDER.length : bIndex;
    return safeA - safeB;
  });
}

function formulaPickButtonStyle(active) {
  return active ? styles.formulaPickButtonActive : styles.formulaPickButton;
}

function quoteFeeType(row) {
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (text.includes("qbsa registration")) return "qbsaRegistration";
  if (text.includes("q leave fees")) return "qLeaveFees";
  return "";
}

function pretty(v) {
  return String(v).replace(/M2/g, " m2").replace(/Lm/g, " lm").replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

const styles = {
  shell: { display: "grid", gridTemplateColumns: "240px minmax(760px, 1fr) 310px", gap: 16, alignItems: "start", fontSize: 16 },
  previewShell: { userSelect: "none", WebkitUserSelect: "none" },
  nav: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, position: "sticky", top: 16 },
  main: { minWidth: 0 },
  summary: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, position: "sticky", top: 16 },
  eyebrow: { color: "#0f766e", fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" },
  navTitle: { margin: "4px 0 12px", color: "#0f172a", fontSize: 28, fontWeight: 600 },
  navButton: { width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 11px", marginBottom: 8, textAlign: "left", color: "#0f172a", fontWeight: 600, cursor: "pointer" },
  navButtonActive: { background: "#0f766e", borderColor: "#0f766e", color: "#ffffff" },
  navNote: { marginTop: 12, color: "#475569", fontSize: 16, lineHeight: 1.5 },
  topbar: { position: "sticky", top: 16, zIndex: 5, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "grid", gridTemplateColumns: "minmax(190px, 1fr) minmax(220px, auto) minmax(280px, 1fr)", gap: 16, alignItems: "center" },
  pageTitle: { margin: "2px 0 0", color: "#0f172a", fontSize: 48, fontWeight: 600 },
  openFileBanner: { justifySelf: "center", maxWidth: 420, minWidth: 0, textAlign: "center", border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 8, padding: "7px 12px" },
  openFileLabel: { display: "block", color: "#64748b", fontSize: 24, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
  openFileName: { display: "block", color: "#0f172a", fontSize: 24, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  topControls: { display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" },
  lockedBadge: { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 999, padding: "8px 12px", fontSize: 16, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
  previewFieldset: { border: 0, padding: 0, margin: 0, minWidth: 0 },
  fileMenuWrap: { position: "relative", display: "inline-flex" },
  fileMenuButton: { background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "9px 14px", fontWeight: 600, cursor: "pointer", minWidth: 76 },
  fileMenu: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 190, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 6 },
  fileMenuItem: { width: "100%", background: "#ffffff", color: "#0f172a", border: 0, borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 600, cursor: "pointer" },
  fileMenuItemPrimary: { background: "#ecfdf5", color: "#0f766e" },
  templateButton: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  templateFileWrap: { position: "relative", display: "inline-flex" },
  templateFileButton: { minWidth: 210, maxWidth: 280, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 12px", fontWeight: 800, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, whiteSpace: "nowrap" },
  templateFileMenu: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30, width: 360, maxWidth: "calc(100vw - 32px)", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 10 },
  templateFileHeader: { borderBottom: "1px solid #e2e8f0", padding: "2px 2px 9px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 2, color: "#0f172a" },
  templateMenuItem: { width: "100%", background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 800, cursor: "pointer" },
  templateMenuDanger: { width: "100%", background: "#fff1f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 800, cursor: "pointer" },
  templateMenuItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
  templateNameField: { display: "flex", flexDirection: "column", gap: 5, color: "#475569", fontSize: 13, fontWeight: 800, margin: "8px 0" },
  templateNameInput: { width: "100%", boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 6, padding: "8px 9px", color: "#0f172a", fontWeight: 700 },
  templateMenuDivider: { height: 1, background: "#e2e8f0", margin: "10px 0" },
  templateListHeading: { color: "#334155", fontSize: 13, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 },
  templateDropdownList: { maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  templateDropdownItem: { width: "100%", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 6, padding: 8, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, color: "#0f172a" },
  templateDropdownItemActive: { borderColor: "#0f766e", background: "#ecfdf5" },
  templateActionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  templateEmptyInline: { color: "#64748b", fontWeight: 800, padding: "10px 2px", marginBottom: 8 },
  templateInlineMessage: { marginTop: 8, background: "#ecfdf5", color: "#0f766e", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 9px", fontWeight: 800 },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 },
  templateModal: { width: "min(1120px, 96vw)", maxHeight: "92vh", overflow: "hidden", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 24px 70px rgba(15,23,42,0.28)", display: "flex", flexDirection: "column" },
  templateModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: "1px solid #e2e8f0" },
  templateModalTitle: { margin: "3px 0 0", color: "#0f172a", fontSize: 28, fontWeight: 800 },
  modalCloseButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 7, padding: "8px 12px", fontWeight: 700, cursor: "pointer" },
  templateSearch: { margin: "14px 18px", border: "1px solid #64748b", borderRadius: 7, padding: "10px 12px", fontSize: 16, fontWeight: 700, color: "#0f172a" },
  templateManagerGrid: { minHeight: 0, flex: 1, display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 0, borderTop: "1px solid #e2e8f0", overflow: "hidden" },
  templateList: { overflowY: "auto", borderRight: "1px solid #e2e8f0", padding: 10, display: "flex", flexDirection: "column", gap: 8 },
  templateListItem: { width: "100%", display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 10, alignItems: "center", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 8, padding: 8, textAlign: "left", cursor: "pointer" },
  templateListItemActive: { borderColor: "#0f766e", background: "#ecfdf5" },
  templateThumb: { width: 56, height: 46, borderRadius: 7, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, overflow: "hidden" },
  templateThumbLarge: { width: 118, height: 92, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, overflow: "hidden", flexShrink: 0 },
  templateThumbImage: { width: "100%", height: "100%", objectFit: "cover" },
  templateListText: { minWidth: 0, display: "flex", flexDirection: "column", gap: 2, color: "#475569", fontSize: 13, fontWeight: 700 },
  templateDetails: { overflowY: "auto", padding: 18 },
  templateDetailTop: { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 },
  templateDetailTitle: { margin: "0 0 8px", color: "#0f172a", fontSize: 26, fontWeight: 900 },
  templateMeta: { color: "#475569", fontSize: 15, fontWeight: 700, marginBottom: 4 },
  templateActionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, margin: "14px 0" },
  primaryActionButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  secondaryActionButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  dangerActionButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 7, padding: "9px 11px", fontWeight: 800, cursor: "pointer" },
  versionBox: { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" },
  versionTitle: { color: "#0f172a", fontWeight: 900, marginBottom: 8 },
  versionRow: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid #e2e8f0", color: "#334155", fontWeight: 700 },
  versionButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 6, padding: "5px 8px", fontWeight: 800, cursor: "pointer" },
  templateEmpty: { color: "#64748b", fontWeight: 800, padding: 16 },
  templateModalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" },
  savedText: { color: "#475569", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" },
  searchInput: { border: "1px solid #64748b", borderRadius: 7, padding: "8px 10px", color: "#0f172a", fontWeight: 600, minWidth: 220 },
  checkLabel: { color: "#334155", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  pageStack: { display: "flex", flexDirection: "column", gap: 10 },
  summaryToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  adjustmentsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, padding: 12, background: "#ffffff" },
  adjustmentField: { display: "flex", flexDirection: "column", gap: 5, color: "#334155", fontWeight: 700 },
  adjustmentLabel: { fontSize: 14, textTransform: "uppercase" },
  adjustmentInput: { width: "100%", boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "7px 8px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 700 },
  summarySectionInput: { width: "100%", minWidth: 190, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  clientPageShell: { display: "flex", flexDirection: "column", gap: 12 },
  clientToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 },
  clientEditor: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 },
  clientLogoEditor: { display: "grid", gridTemplateColumns: "104px minmax(0, 1fr)", gap: 12, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" },
  clientLogoPreview: { width: 88, height: 88, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontWeight: 800, overflow: "hidden" },
  clientLogoActions: { display: "flex", flexDirection: "column", gap: 7, minWidth: 0 },
  clientLogoHint: { color: "#475569", fontSize: 14, fontWeight: 600 },
  clientEditorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  clientTextarea: { width: "100%", minHeight: 82, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 6, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 600, fontFamily: "inherit", resize: "vertical" },
  clientDocument: { background: "#ffffff", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 10, padding: 28, display: "flex", flexDirection: "column", gap: 18 },
  clientHeader: { display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(260px, 360px)", gap: 24, borderBottom: "2px solid #0f766e", paddingBottom: 18 },
  clientBrand: { display: "flex", alignItems: "center", gap: 16 },
  clientLogoMark: { width: 88, height: 88, border: "2px solid #0f766e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontWeight: 800, fontSize: 18 },
  clientLogoImage: { width: 88, height: 88, objectFit: "contain", borderRadius: 8 },
  clientCompanyName: { fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 },
  clientDocumentTitle: { marginTop: 6, fontSize: 20, fontWeight: 700, color: "#475569", textTransform: "uppercase" },
  clientMetaGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 7 },
  clientMetaItem: { display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 10, color: "#475569", fontSize: 15 },
  clientSection: { display: "flex", flexDirection: "column", gap: 8 },
  clientSectionTitle: { margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 800, textTransform: "uppercase" },
  clientSectionToggle: { width: "100%", minHeight: 74, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start", gap: 8, background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "10px 12px", fontSize: 20, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  clientBlockSummary: { display: "block", color: "#64748b", fontSize: 13, lineHeight: 1.35, fontWeight: 700, textTransform: "none" },
  clientParagraph: { margin: 0, color: "#334155", fontSize: 16, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  clientStage: { display: "flex", flexDirection: "column", gap: 0, border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  clientStageHeader: { width: "100%", minHeight: 72, display: "grid", gridTemplateColumns: "minmax(160px, 0.8fr) minmax(220px, 1.3fr) auto", alignItems: "center", gap: 12, background: "#ecfdf5", color: "#0f172a", border: 0, padding: "10px 12px", fontWeight: 800, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  clientStageSummary: { color: "#475569", fontSize: 13, lineHeight: 1.35, fontWeight: 700, textTransform: "none" },
  clientStageHeaderPrint: { display: "none", justifyContent: "space-between", gap: 12, background: "#ecfdf5", color: "#0f172a", padding: "10px 12px", fontWeight: 800, textTransform: "uppercase" },
  clientTable: { width: "100%", borderCollapse: "collapse", fontSize: 15 },
  clientTh: { background: "#f8fafc", color: "#334155", borderBottom: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left", fontWeight: 800 },
  clientTd: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#334155", verticalAlign: "top" },
  clientTdNumber: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#334155", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" },
  clientTdFinal: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#0f172a", textAlign: "right", whiteSpace: "nowrap", fontWeight: 800, verticalAlign: "top" },
  clientTdStrong: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", color: "#0f172a", fontWeight: 800 },
  clientGrandTotal: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "13px 15px", fontSize: 22, fontWeight: 800, marginTop: 4 },
  clientSignatureGrid: { display: "grid", gridTemplateColumns: "1fr 220px", gap: 26, marginTop: 18 },
  clientSignatureLine: { borderTop: "1px solid #64748b", paddingTop: 8, color: "#334155", fontWeight: 700 },
  quoteGroup: { display: "flex", flexDirection: "column", gap: 0 },
  nestedQuoteStack: { display: "flex", flexDirection: "column", gap: 8, padding: "8px 8px 10px 22px", background: "#f8fafc", border: "1px solid #cbd5e1", borderTop: 0, borderRadius: "0 0 10px 10px" },
  nestedQuoteSection: { background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 8, overflow: "hidden" },
  orderPanel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 },
  orderPanelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  orderPanelTitle: { color: "#0f172a", fontSize: 24, fontWeight: 700 },
  orderPanelNote: { color: "#475569", fontSize: 15, fontWeight: 600, marginTop: 3 },
  orderToolRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: 10 },
  orderToolText: { color: "#334155", fontWeight: 700 },
  orderList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#f8fafc" },
  orderItem: { display: "grid", gridTemplateColumns: "32px 62px 84px minmax(220px, 1fr) auto auto", gap: 8, alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 },
  orderItemNumber: { color: "#0f766e", fontWeight: 800 },
  orderGroupInput: { width: 68, border: "1px solid #94a3b8", borderRadius: 6, padding: "6px 6px", fontSize: 14, fontWeight: 700, textAlign: "center" },
  orderItemName: { color: "#0f172a", fontWeight: 700, textTransform: "uppercase" },
  orderActions: { display: "flex", gap: 8, alignItems: "center" },
  tabBar: { display: "flex", gap: 8, alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 8 },
  tabButton: { background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 11px", fontWeight: 600, cursor: "pointer" },
  tabButtonActive: { background: "#0f766e", color: "#ffffff", borderColor: "#0f766e" },
  section: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" },
  sectionHeader: { width: "100%", display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", alignItems: "stretch", background: "#ecfdf5", border: 0, borderBottom: "1px solid #99f6e4", color: "#0f172a" },
  nestedSectionHeader: { width: "100%", display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", alignItems: "stretch", background: "#eff6ff", border: 0, borderBottom: "1px solid #bfdbfe", color: "#0f172a" },
  sectionGroupInput: { width: 68, alignSelf: "center", justifySelf: "center", border: "1px solid #94a3b8", borderRadius: 6, padding: "6px 6px", fontSize: 15, fontWeight: 800, textAlign: "center", background: "#ffffff", color: "#0f172a" },
  sectionHeaderButton: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "transparent", border: 0, color: "#0f172a", padding: "14px 16px 14px 0", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  sectionTotalStack: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, whiteSpace: "nowrap", textAlign: "right" },
  staticSectionHeader: { background: "#ecfdf5", borderBottom: "1px solid #99f6e4", color: "#0f172a", padding: "14px 16px", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headerButton: { background: "#ffffff", color: "#0f172a", border: "1px solid #99f6e4", borderRadius: 6, padding: "6px 9px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  subSection: { borderTop: "1px solid #e2e8f0", background: "#ffffff" },
  subSectionHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: 0, borderBottom: "1px solid #e2e8f0", color: "#0f172a", padding: "12px 14px", fontSize: 34, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", cursor: "pointer", textAlign: "left" },
  tableWrap: { overflow: "auto", maxHeight: "calc(100vh - 235px)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 16 },
  th: { position: "sticky", top: 0, zIndex: 2, background: "#dbeafe", color: "#0f172a", padding: "8px 9px", border: "1px solid #bfdbfe", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "5px 7px", border: "1px solid #e2e8f0", color: "#0f172a", verticalAlign: "middle", background: "#ffffff" },
  compactColumn: { width: 38, minWidth: 38, maxWidth: 38, paddingLeft: 4, paddingRight: 4, textAlign: "center", whiteSpace: "nowrap" },
  lowerLevelCell: { background: "#eef6ff" },
  upperLevelCell: { background: "#fff7e6" },
  thirdLevelCell: { background: "#f0fdf4" },
  lowerLevelCellStrong: { background: "#dbeafe" },
  upperLevelCellStrong: { background: "#ffedd5" },
  thirdLevelCellStrong: { background: "#dcfce7" },
  strongCell: { fontWeight: 600, background: "#f8fafc" },
  headingCell: { background: "#e0f2fe", color: "#0f172a", padding: "18px 12px", fontSize: 28, lineHeight: 1.15, fontWeight: 600, textTransform: "uppercase", borderTop: "2px solid #38bdf8", borderBottom: "2px solid #38bdf8" },
  subheadingCell: { background: "#f8fafc", color: "#334155", padding: "7px 10px", fontSize: 15, lineHeight: 1.2, fontWeight: 700, textTransform: "uppercase", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" },
  calcCell: { background: "#f1f5f9", fontWeight: 600, color: "#0f172a" },
  finalCell: { background: "#dcfce7", fontWeight: 600, color: "#14532d" },
  input: { width: "100%", minWidth: 95, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", background: "#ffffff", fontSize: 16, fontWeight: 600 },
  shortInput: { width: 80, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  numberInput: { width: 76, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  itemInput: { width: "100%", minWidth: 280, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  formulaInput: { width: "100%", minWidth: 260, boxSizing: "border-box", border: "1px solid #0f766e", borderRadius: 5, padding: "6px 7px", color: "#0f172a", background: "#f0fdfa", fontFamily: "Consolas, monospace", fontSize: 16, fontWeight: 600 },
  formulaText: { fontFamily: "Consolas, monospace", color: "#0f172a", fontWeight: 600 },
  formulaPickButton: { width: "100%", background: "transparent", color: "inherit", border: 0, padding: 0, textAlign: "left", font: "inherit", fontWeight: 600 },
  formulaPickButtonActive: { width: "100%", background: "#bbf7d0", color: "#14532d", border: "1px solid #86efac", borderRadius: 5, padding: "4px 6px", textAlign: "left", font: "inherit", fontWeight: 600, cursor: "pointer" },
  applianceBrandHeading: { display: "block", fontSize: 18, fontWeight: 800, letterSpacing: 0, paddingLeft: 0 },
  applianceBrandToggle: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", border: 0, color: "#0f172a", padding: 0, font: "inherit", fontSize: 18, fontWeight: 800, letterSpacing: 0, textAlign: "left", cursor: "pointer", textTransform: "uppercase" },
  applianceBrandMeta: { color: "#475569", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", textTransform: "none" },
  appliancePackageHeading: { display: "block", fontSize: 15, fontWeight: 800, letterSpacing: 0, paddingLeft: 24 },
  unitInput: { width: 86, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  lineTypeInput: { minWidth: 150, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  rateInput: { width: 86, border: "1px solid #64748b", borderRadius: 5, padding: "6px 7px", color: "#0f172a", fontSize: 16, fontWeight: 600 },
  readOnly: { color: "#475569", fontWeight: 600 },
  primaryButton: { alignSelf: "flex-start", background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer" },
  secondaryButton: { background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer" },
  smallButton: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 7px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  addLineButton: { margin: 8, background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 7, padding: "7px 10px", fontWeight: 600, cursor: "pointer" },
  sectionFooterActions: { display: "flex", alignItems: "center", gap: 8, padding: 8 },
  closeSectionButton: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 7, padding: "7px 10px", fontWeight: 600, cursor: "pointer" },
  rowActions: { display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", minWidth: 145 },
  draggableRow: { cursor: "grab" },
  dragHandle: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 24, border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", color: "#475569", fontWeight: 600, cursor: "grab", lineHeight: 1 },
  rowNumber: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, color: "#334155", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  dataRowNumber: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, color: "#64748b", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  dangerButton: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 8px", fontWeight: 600, cursor: "pointer" },
  summaryRow: { display: "flex", justifyContent: "space-between", gap: 10, color: "#334155", fontSize: 16, borderBottom: "1px solid #e2e8f0", padding: "7px 0" },
  finalBox: { background: "#0f766e", color: "#ffffff", borderRadius: 9, padding: 12, margin: "10px 0 14px", display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 600 },
  panel: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: 10, marginTop: 10 },
  panelTitle: { color: "#0f172a", fontSize: 16, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 },
  panelBody: { display: "flex", flexDirection: "column", gap: 6 },
  warningPill: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 999, padding: "5px 8px", fontSize: 16, fontWeight: 600 },
  windowLevelWarning: { margin: 10, display: "flex", flexDirection: "column", gap: 4, background: "#fff7ed", border: "1px solid #fb923c", color: "#9a3412", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontWeight: 700 },
  okPill: { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 999, padding: "5px 8px", fontSize: 16, fontWeight: 600 },
};
