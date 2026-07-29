import { formatLength, formatArea } from "../takeoff/units.js";

const AREA_ORDER = ["Garage", "Patio", "Alfresco", "Balcony"];

export default function ResultsPanel({ page, tools, onZoomToGeometry }) {
  const exteriorWalls = page?.exteriorWalls || null;
  const interiorWalls = page?.internalWalls || null;
  const areas = page?.areas || [];
  const openings = page?.openings || [];

  const openingCounts = openings.reduce((acc, opening) => {
    if (opening.openingType === "window") acc.windows += 1;
    else if (opening.openingType === "open-opening") acc.openings += 1;
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

  const zoomToGraph = (graph) => {
    if (!graph?.vertices?.length) return;
    onZoomToGeometry?.(graph.vertices);
  };
  const zoomToArea = (area) => onZoomToGeometry?.(area.vertices || []);
  const zoomToOpening = (opening) => onZoomToGeometry?.([opening.start, opening.end].filter(Boolean));

  return (
    <div style={S.panel} data-testid="results-panel">
      <SummarySection title="EXTERIOR WALLS" onSelect={() => zoomToGraph(exteriorWalls)}>
        <Metric label="Segments" value={exteriorWalls?.segments?.length || 0} />
        <Metric label="Total Length" value={formatLength(tools?.totalExteriorWallLengthMm || 0)} />
      </SummarySection>

      <SummarySection title="INTERIOR WALLS" onSelect={() => zoomToGraph(interiorWalls)}>
        <Metric label="Segments" value={interiorWalls?.segments?.length || 0} />
        <Metric label="Total Length" value={formatLength(tools?.totalInternalWallLengthMm || 0)} />
      </SummarySection>

      <SummarySection title="WINDOWS" onSelect={() => zoomFirst(openings, "window", zoomToOpening)}>
        <Metric label="Count" value={openingCounts.windows} />
      </SummarySection>

      <SummarySection title="DOORS" onSelect={() => zoomFirstDoor(openings, zoomToOpening)}>
        <Metric label="Count" value={openingCounts.doors} />
      </SummarySection>

      <SummarySection title="OPENINGS" onSelect={() => zoomFirst(openings, "open-opening", zoomToOpening)}>
        <Metric label="Count" value={openingCounts.openings} />
      </SummarySection>

      <div style={S.section}>
        <div style={S.sectionTitle}>AREAS</div>
        <Metric label="External Footprint" value={externalFootprintM2 > 0 ? formatArea(externalFootprintM2) : "Not set"} />
        <Metric label="Internal Floor Area" value={internalFloorAreaM2 > 0 ? formatArea(internalFloorAreaM2) : "Not calculated"} />
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
    </div>
  );
}

function SummarySection({ title, children, onSelect }) {
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
  const opening = openings.find((item) => item.openingType !== "window" && item.openingType !== "open-opening");
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
  itemButton: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2, width: "100%", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", textAlign: "left", cursor: "pointer" },
  itemName: { fontWeight: 800, color: "#0f172a" },
  itemMeta: { color: "#64748b", fontSize: 11 },
};
