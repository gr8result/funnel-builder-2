import { formatLength, formatArea } from "../takeoff/units.js";

// Read-only workflow summary: exterior walls (segments/perimeter/status/
// confirmed) and areas (each area's own figure, plus — for any area
// generated from a closed exterior perimeter — the external-footprint vs
// internal-floor-area distinction, never collapsed into one number). A
// per-classification rollup (e.g. total Garage, total Patio) sits below the
// per-area list so "how much garage do we have" doesn't require manual
// addition.
export default function ResultsPanel({ page, tools }) {
  const exteriorWalls = page?.exteriorWalls;
  const areas = page?.areas || [];

  const rollup = areas.reduce((acc, area) => {
    if (area.included === false) return acc;
    const value = area.confirmedAreaM2 ?? area.calculatedAreaM2 ?? 0;
    acc[area.areaType] = (acc[area.areaType] || 0) + value;
    return acc;
  }, {});

  return (
    <div style={S.panel} data-testid="results-panel">
      <div style={S.section}>
        <div style={S.sectionTitle}>Exterior Walls</div>
        {exteriorWalls ? (
          <div style={S.body}>
            <div>Segments: {exteriorWalls.segments.length}</div>
            <div>
              Perimeter: {formatLength(exteriorWalls.confirmed ? (tools?.totalPerimeterMm || 0) : (tools?.totalExteriorWallLengthMm || 0))}
            </div>
            <div>Status: {exteriorWalls.isClosed ? "Closed" : "Open"}</div>
            <div>Confirmed: {exteriorWalls.confirmed ? "Yes" : "No"}</div>
            {exteriorWalls.detectionConfidence != null && <div>Detection confidence: {exteriorWalls.detectionConfidence}%</div>}
          </div>
        ) : (
          <div style={S.empty}>No exterior walls yet — use Auto Detect Exterior or Draw Exterior.</div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>Areas</div>
        {areas.length === 0 ? (
          <div style={S.empty}>No areas confirmed yet.</div>
        ) : (
          <div style={S.body} data-testid="results-area-list">
            {areas.map((area) => (
              <div key={area.id} style={S.areaRow} data-testid="results-area-row">
                <div style={S.areaName}>{area.name} <span style={S.areaType}>({area.areaType})</span></div>
                {area.externalFootprintM2 != null || area.internalFloorAreaM2 != null ? (
                  <>
                    <div>External footprint: {formatArea(area.externalFootprintM2 ?? area.confirmedAreaM2 ?? 0)}</div>
                    <div>
                      Internal floor area: {area.internalFloorAreaM2 != null ? formatArea(area.internalFloorAreaM2) : "Not calculated"}
                    </div>
                  </>
                ) : (
                  <div>Area: {formatArea(area.confirmedAreaM2 ?? area.calculatedAreaM2 ?? 0)}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {Object.keys(rollup).length > 0 && (
          <div style={S.rollup} data-testid="results-area-rollup">
            {Object.entries(rollup).map(([areaType, total]) => (
              <div key={areaType}>{areaType}: {formatArea(total)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  panel: { display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontFamily: "system-ui, sans-serif", fontSize: 12, minWidth: 220 },
  section: { display: "flex", flexDirection: "column", gap: 4 },
  sectionTitle: { fontWeight: 800, color: "#0f172a", fontSize: 13, marginBottom: 2 },
  body: { display: "flex", flexDirection: "column", gap: 2, color: "#334155" },
  empty: { color: "#94a3b8", fontStyle: "italic" },
  areaRow: { borderTop: "1px solid #e2e8f0", paddingTop: 6, marginTop: 4, color: "#334155" },
  areaName: { fontWeight: 700, color: "#0f172a" },
  areaType: { fontWeight: 400, color: "#64748b" },
  rollup: { borderTop: "1px dashed #cbd5e1", marginTop: 6, paddingTop: 6, display: "flex", flexDirection: "column", gap: 2, fontWeight: 700, color: "#166534" },
};
