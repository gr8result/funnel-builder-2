import { formatLength, formatArea } from "../takeoff/units.js";
import { validateCalibrationShape } from "../takeoff/scaleCalibration.js";
import { validatePerimeterForArea } from "../takeoff/areaCalculation.js";

const AREA_ORDER = ["Garage", "Patio", "Alfresco", "Balcony"];

export default function ResultsPanel({ page, tools, onZoomToGeometry }) {
  const exteriorWalls = page?.exteriorWalls || null;
  const interiorWalls = page?.internalWalls || null;
  const areas = page?.areas || [];
  const openings = page?.openings || [];
  const windowRecords = page?.windowRecords || [];
  const windowOrderLines = page?.windowOrderLines || [];
  const quoteWindowLines = page?.quotationBuilderModel?.windowLineItems || [];

  const openingCounts = openings.reduce((acc, opening) => {
    if (opening.openingType === "window") acc.windows += 1;
    else if (opening.openingType === "opening" || opening.openingType === "open-opening") acc.openings += 1;
    else acc.doors += 1;
    return acc;
  }, { windows: 0, doors: 0, openings: 0 });

  const includedAreas = areas.filter((area) => area.included !== false);
  const externalFootprintM2 = includedAreas.reduce((total, area) => total + (area.externalFootprintM2 ?? 0), 0);
  const internalFloorAreaM2 = includedAreas.reduce((total, area) => total + (area.internalFloorAreaM2 ?? 0), 0);
  const areaRollup = AREA_ORDER.reduce((acc, areaType) => {
    acc[areaType] = includedAreas
      .filter((area) => area.areaType === areaType)
      .reduce((total, area) => total + (area.confirmedAreaM2 ?? area.calculatedAreaM2 ?? 0), 0);
    return acc;
  }, {});
  const scaleStatus = validateCalibrationShape(page?.calibration);
  const detectedWallSummary = tools?.detectedWallSummary || { total: 0, exterior: 0, interior: 0, unknown: 0, lowConfidence: 0, averageConfidence: 0 };
  const activeExteriorClosed = Boolean(tools?.activeExteriorWallsClosed);
  const activeExteriorCount = tools?.activeExteriorWallSegmentCount || 0;
  const activeInternalCount = tools?.activeInternalWallSegmentCount || 0;
  const manualWallMode = tools?.activeTool === "exterior-wall" || tools?.activeTool === "internal-wall";
  const exteriorStats = tools?.exteriorCandidateStats || {};
  const confirmedExteriorLengthMm = tools?.totalConfirmedExteriorWallLengthMm || 0;
  const candidateExteriorLengthMm = Math.max(0, (tools?.totalExteriorWallLengthMm || 0) - confirmedExteriorLengthMm);
  const canShowConfirmedExteriorQuantity = Boolean(scaleStatus.valid && confirmedExteriorLengthMm > 0);
  const canShowInternalQuantity = Boolean(scaleStatus.valid && activeInternalCount > 0);
  const perimeterAreaValidation = validatePerimeterForArea(page);
  const canTrustArea = Boolean(scaleStatus.valid && perimeterAreaValidation.valid);

  const zoomToGraph = (graph) => {
    if (!graph?.vertices?.length) return;
    onZoomToGeometry?.(graph.vertices);
  };
  const zoomToArea = (area) => onZoomToGeometry?.(area.vertices || []);
  const zoomToOpening = (opening) => onZoomToGeometry?.([opening.start, opening.end].filter(Boolean));

  return (
    <div style={S.panel} data-testid="results-panel">
      {!manualWallMode && (
        <SummarySection title="DETECTED WALLS">
          <Metric label="Total" value={detectedWallSummary.total || 0} />
          <Metric label="Exterior" value={detectedWallSummary.exterior || 0} />
          <Metric label="Interior" value={detectedWallSummary.interior || 0} />
          <Metric label="Unknown" value={detectedWallSummary.unknown || 0} />
          <Metric label="Low Confidence" value={detectedWallSummary.lowConfidence || 0} />
        </SummarySection>
      )}

      <SummarySection title="EXTERIOR WALLS" onSelect={() => zoomToGraph(exteriorWalls)}>
        {activeExteriorCount > 0 || exteriorStats.corners > 0 ? (
          <>
            <Metric label="Status" value={exteriorWalls?.confirmed ? "Confirmed" : (exteriorStats.missingSections > 0 ? "Needs completion" : "Needs review")} />
            {manualWallMode ? (
              <Metric label="Manual corners" value={exteriorWalls?.vertices?.length || 0} />
            ) : (
              <Metric label="Boundary corners" value={exteriorStats.corners || exteriorWalls?.vertices?.length || 0} />
            )}
            {manualWallMode ? (
              <Metric label="Manual segments" value={activeExteriorCount} />
            ) : (
              <Metric label={exteriorWalls?.confirmed ? "Segments" : "Detected segments"} value={activeExteriorCount} />
            )}
            {!manualWallMode && !exteriorWalls?.confirmed && <Metric label="Missing sections" value={exteriorStats.missingSections || 0} />}
            <Metric label="Confirmed Length" value={canShowConfirmedExteriorQuantity ? formatLength(confirmedExteriorLengthMm) : "0 mm"} />
            <Metric label="Candidate Length" value={scaleStatus.valid ? formatLength(candidateExteriorLengthMm) : "Set scale"} />
            <Metric label="Outline Status" value={exteriorWalls?.confirmed ? "Approved outline" : (activeExteriorClosed ? "Closed - needs approval" : "Incomplete")} />
          </>
        ) : (
          <Metric label="Status" value="Not started" />
        )}
        {!manualWallMode && tools?.automaticCandidateCount > 0 && (
          <Metric label="Candidate Segments" value={tools.automaticCandidateCount} />
        )}
      </SummarySection>

      <SummarySection title="INTERIOR WALLS" onSelect={() => zoomToGraph(interiorWalls)}>
        <Metric label="Segments" value={activeInternalCount} />
        <Metric label="Total Length" value={canShowInternalQuantity ? formatLength(tools?.totalInternalWallLengthMm || 0) : "Set scale and select a wall"} />
      </SummarySection>

      <SummarySection title="WINDOWS" onSelect={() => zoomFirst(openings, "window", zoomToOpening)}>
        <Metric label="Count" value={openingCounts.windows} />
        <Metric label="Records" value={windowRecords.length} />
        <Metric label="Order Lines" value={windowOrderLines.length} />
        <Metric label="Quote Lines" value={quoteWindowLines.length} />
        {page?.windowReconciliation && <Metric label="Reconciliation" value={page.windowReconciliation.status || "Needs review"} />}
      </SummarySection>

      {page?.windowReconciliation && (
        <SummarySection title="WINDOW RECONCILIATION">
          <Metric label="Plan detected" value={page.windowReconciliation.planDetected || 0} />
          <Metric label="Manual" value={page.windowReconciliation.manuallyAdded || 0} />
          <Metric label="Matched" value={page.windowReconciliation.matched || 0} />
          <Metric label="Unmatched" value={(page.windowReconciliation.unmatched || []).length} />
          <Metric label="Duplicates" value={(page.windowReconciliation.possibleDuplicates || []).length} />
          <Metric label="Missing Specs" value={(page.windowReconciliation.missingSpecs || []).length} />
          <Metric label="Final Order Qty" value={page.windowReconciliation.finalOrderQty || 0} />
          <Metric label="Approval" value={page.windowReconciliation.approved ? "Approved" : "Needs approval"} />
          {!page.windowReconciliation.approved && (
            <button type="button" style={S.miniButton} onClick={tools?.approveWindowReconciliation} data-testid="window-reconciliation-approve">
              Approve window order lines
            </button>
          )}
        </SummarySection>
      )}

      <SummarySection title="DOORS" onSelect={() => zoomFirstDoor(openings, zoomToOpening)}>
        <Metric label="Count" value={openingCounts.doors} />
      </SummarySection>

      <SummarySection title="OPENINGS" onSelect={() => zoomFirstOpening(openings, zoomToOpening)}>
        <Metric label="Count" value={openingCounts.openings} />
      </SummarySection>

      <div style={S.section}>
        <div style={S.sectionTitle}>AREAS</div>
        <Metric label="External Footprint" value={canTrustArea && externalFootprintM2 > 0 ? formatArea(externalFootprintM2) : "Area unavailable"} />
        <Metric label="Internal Floor Area" value={canTrustArea && internalFloorAreaM2 > 0 ? formatArea(internalFloorAreaM2) : "Area unavailable"} />
        {AREA_ORDER.map((areaType) => (
          <Metric key={areaType} label={areaType} value={areaRollup[areaType] > 0 ? formatArea(areaRollup[areaType]) : formatArea(0)} />
        ))}
        {areas.length > 0 && (
          <div style={S.itemList} data-testid="results-area-list">
            {areas.map((area) => (
              <button key={area.id} type="button" style={S.itemButton} onClick={() => zoomToArea(area)} data-testid="results-area-row">
                <span style={S.itemName}>{area.name}</span>
                <span style={S.itemMeta}>{area.areaType} - {formatArea(area.confirmedAreaM2 ?? area.calculatedAreaM2 ?? 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {areas.length > 0 && (
        <div style={S.section} data-testid="results-room-areas">
          <div style={S.sectionTitle}>ROOM AREAS</div>
          <div style={S.itemList}>
            {areas.map((area) => {
              const gross = area.grossAreaM2 ?? area.calculatedAreaM2 ?? 0;
              const excluded = area.excludedAreaM2 ?? 0;
              const net = area.netAreaM2 ?? area.confirmedAreaM2 ?? area.calculatedAreaM2 ?? 0;
              const intrusions = (area.holes || []).filter((hole) => hole.overrideable);
              return (
                <div key={area.id} style={S.roomItem} data-testid="results-room-area-item">
                  <button type="button" style={S.itemButton} onClick={() => zoomToArea(area)} data-testid="results-room-area-row">
                    <span style={S.itemName}>{area.name}</span>
                    {excluded > 0 ? (
                      <>
                        <span style={S.itemMeta}>Gross: {formatArea(gross)}</span>
                        <span style={S.itemMeta}>Excluded: {formatArea(excluded)}</span>
                        <span style={S.itemMeta}>Net: {formatArea(net)}</span>
                      </>
                    ) : (
                      <span style={S.itemMeta}>Net: {formatArea(net)}</span>
                    )}
                  </button>
                  {intrusions.map((hole) => (
                    <div key={hole.id} style={S.intrusionRow} data-testid="room-intrusion-override">
                      <span style={S.itemMeta}>{hole.label || "Intrusion"}: {hole.included === false ? "Excluded" : "Included"}</span>
                      <button type="button" style={S.miniButton} onClick={() => tools?.setAreaIntrusionIncluded?.(area.id, hole.id, true)} data-testid="room-intrusion-include">
                        Include intrusion in area
                      </button>
                      <button type="button" style={S.miniButton} onClick={() => tools?.setAreaIntrusionIncluded?.(area.id, hole.id, false)} data-testid="room-intrusion-exclude">
                        Exclude intrusion from area
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({ title, children, onSelect }) {
  if (!onSelect) {
    return (
      <div style={S.sectionButton} data-testid={`results-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <span style={S.sectionTitle}>{title}</span>
        <span style={S.metricWrap}>{children}</span>
      </div>
    );
  }
  return (
    <button type="button" style={S.sectionButton} onClick={onSelect} data-testid={`results-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <span style={S.sectionTitle}>{title}</span>
      <span style={S.metricWrap}>{children}</span>
    </button>
  );
}

function Metric({ label, value }) {
  return (
    <span style={S.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function zoomFirst(openings, type, zoomToOpening) {
  const opening = openings.find((item) => item.openingType === type);
  if (opening) zoomToOpening(opening);
}

function zoomFirstDoor(openings, zoomToOpening) {
  const opening = openings.find((item) => item.openingType !== "window" && item.openingType !== "opening" && item.openingType !== "open-opening");
  if (opening) zoomToOpening(opening);
}

function zoomFirstOpening(openings, zoomToOpening) {
  const opening = openings.find((item) => item.openingType === "opening" || item.openingType === "open-opening");
  if (opening) zoomToOpening(opening);
}

const S = {
  panel: { display: "flex", flexDirection: "column", gap: 10, padding: 10, background: "#f8fafc", fontFamily: "system-ui, sans-serif", fontSize: 12 },
  section: { display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid #e2e8f0" },
  sectionButton: { display: "flex", flexDirection: "column", gap: 4, width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #e2e8f0", background: "transparent", padding: "8px 0", cursor: "pointer" },
  sectionTitle: { fontWeight: 900, color: "#0f172a", fontSize: 12, letterSpacing: 0 },
  metricWrap: { display: "flex", flexDirection: "column", gap: 3 },
  metric: { display: "flex", justifyContent: "space-between", gap: 10, color: "#334155" },
  itemList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  roomItem: { display: "flex", flexDirection: "column", gap: 4 },
  itemButton: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2, width: "100%", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", textAlign: "left", cursor: "pointer" },
  itemName: { fontWeight: 800, color: "#0f172a" },
  itemMeta: { color: "#64748b", fontSize: 11 },
  intrusionRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "4px 6px", borderLeft: "3px solid #f97316", background: "#fff7ed" },
  miniButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};
