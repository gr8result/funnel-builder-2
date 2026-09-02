import { formatLength } from "../takeoff/units.js";

const CONFIDENCE_LABEL = { high: "High", medium: "Medium", low: "Low" };

// Compact selected-item panel for the generic wall Edit tool. Deliberately
// pinned to a fixed corner of the viewport (a sibling of the pan/zoom
// transform, not inside it — see PlanViewer.jsx) so it never overlaps the
// wall segment or vertex actually being edited, regardless of where that
// item is on screen.
export default function WallContextPanel({ page, tools }) {
  if (tools.selectedOpeningId) {
    const opening = (page?.openings || []).find((candidate) => candidate.id === tools.selectedOpeningId);
    if (!opening) return null;
    const isWindow = opening.openingType === "window";
    const roomOptions = Array.from(new Set((page?.areas || []).map((area) => area.name || area.room || area.roomName).filter(Boolean)));
    const floorOptions = Array.from(new Set([
      "Ground Level",
      "Second Level",
      "Third Level",
      ...(page?.projectLevels || []),
      ...(page?.areas || []).map((area) => area.level || area.floor).filter(Boolean),
    ].filter(Boolean)));
    return (
      <div style={{ ...S.panel, ...S.openingPanel }} data-testid="opening-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>{isWindow ? "Window" : "Opening"} editor</div>
        <OpeningCombo label="Window type" value={opening.windowType || opening.openingType || "window"} options={["window", "awning", "sliding", "fixed", "louvre", "casement", "double-hung", "door", "garage-door", "other-opening"]} onChange={(value) => tools.updateOpening(opening.id, { windowType: value, openingType: ["window", "awning", "sliding", "fixed", "louvre", "casement", "double-hung"].includes(value) ? "window" : value })} />
        <OpeningInput label="Window mark/code" value={opening.code || opening.mark || ""} onChange={(value) => tools.updateOpening(opening.id, { code: value, mark: value })} />
        <OpeningNumber label="Width" value={opening.widthMm ?? ""} suffix="mm" onChange={(value) => tools.updateOpening(opening.id, { widthMm: value })} />
        <OpeningNumber label="Height" value={opening.heightMm ?? ""} suffix="mm" onChange={(value) => tools.updateOpening(opening.id, { heightMm: value })} />
        <OpeningNumber label="Quantity" value={opening.quantity ?? 1} onChange={(value) => tools.updateOpening(opening.id, { quantity: value || 1 })} />
        <OpeningCombo label="Floor/level" value={opening.level || opening.floor || ""} options={floorOptions} onChange={(value) => tools.updateOpening(opening.id, { level: value, floor: value })} />
        <OpeningCombo label="Room" value={opening.room || ""} options={roomOptions} onChange={(value) => tools.updateOpening(opening.id, { room: value })} />
        <OpeningCombo label="Elevation/location" value={opening.elevation || opening.exteriorWallElevation || ""} options={["North", "South", "East", "West", "Front", "Rear", "Left", "Right"]} onChange={(value) => tools.updateOpening(opening.id, { elevation: value, exteriorWallElevation: value })} />
        <OpeningCombo label="Frame material" value={opening.frameMaterial || ""} options={["Aluminium", "Timber", "uPVC", "Steel", "Composite"]} onChange={(value) => tools.updateOpening(opening.id, { frameMaterial: value })} />
        <OpeningCombo label="Frame colour" value={opening.frameColour || opening.frameColor || ""} options={["Monument", "Surfmist", "White", "Black", "Woodland Grey", "Custom"]} onChange={(value) => tools.updateOpening(opening.id, { frameColour: value, frameColor: value })} />
        <OpeningCombo label="Glazing type" value={opening.glazingType || opening.glassType || ""} options={["Clear", "Low-E", "Tinted", "Double glazed", "Laminated", "Toughened"]} onChange={(value) => tools.updateOpening(opening.id, { glazingType: value, glassType: value })} />
        <OpeningCombo label="Glass thickness" value={opening.glassThickness || ""} options={["4 mm", "5 mm", "6 mm", "10 mm", "12 mm"]} onChange={(value) => tools.updateOpening(opening.id, { glassThickness: value })} />
        <OpeningCheckbox label="Obscure glass" checked={Boolean(opening.obscureGlass)} onChange={(value) => tools.updateOpening(opening.id, { obscureGlass: value })} />
        <OpeningCheckbox label="Safety glass" checked={Boolean(opening.safetyGlass)} onChange={(value) => tools.updateOpening(opening.id, { safetyGlass: value })} />
        <OpeningInput label="Energy rating" value={opening.energyRatingRequirements || ""} onChange={(value) => tools.updateOpening(opening.id, { energyRatingRequirements: value })} />
        <OpeningCombo label="Flyscreen" value={opening.flyscreen || opening.screenRequirements || ""} options={["None", "Standard", "Yes", "No", "By supplier"]} onChange={(value) => tools.updateOpening(opening.id, { flyscreen: value, screenRequirements: value })} />
        <OpeningCombo label="Security screen" value={opening.securityScreen || ""} options={["None", "Required", "Crimsafe", "Barrier screen", "By supplier"]} onChange={(value) => tools.updateOpening(opening.id, { securityScreen: value })} />
        <OpeningCombo label="Opening direction" value={opening.openingDirection || ""} options={["Fixed", "Left hand", "Right hand", "Sliding left", "Sliding right", "Awning out", "Inward", "Outward"]} onChange={(value) => tools.updateOpening(opening.id, { openingDirection: value })} />
        <OpeningInput label="Supplier" value={opening.supplier || ""} onChange={(value) => tools.updateOpening(opening.id, { supplier: value })} />
        <OpeningInput label="Product/model" value={opening.productModel || opening.product || opening.model || ""} onChange={(value) => tools.updateOpening(opening.id, { productModel: value, product: value, model: value })} />
        <OpeningInput label="Installation notes" value={opening.installationNotes || ""} onChange={(value) => tools.updateOpening(opening.id, { installationNotes: value })} multiline />
        <OpeningInput label="General notes" value={opening.generalNotes || opening.notes || ""} onChange={(value) => tools.updateOpening(opening.id, { generalNotes: value, notes: value })} multiline />
        <Field label="Order line" value={(page?.windowOrderLines || []).find((line) => (line.records || []).includes(opening.windowRecordId || opening.id))?.status || "Pending save"} />
        <Field label="Quote model" value={(page?.quotationBuilderModel?.windowLineItems || []).length ? "Linked" : "Pending"} />
        <Field label="Source" value={opening.source || "manual"} />
        <Field label="Approval" value={opening.confirmed === false ? "Needs review" : "Approved"} />
        <div style={S.actions}>
          <button type="button" style={S.button} onClick={() => tools.updateOpening(opening.id, { confirmed: true })} data-testid="opening-context-approve">Approve</button>
          <button type="button" style={S.button} onClick={tools.duplicateSelectedOpening} data-testid="opening-context-duplicate">Duplicate</button>
          <button type="button" style={S.buttonDanger} onClick={tools.deleteSelectedOpening} data-testid="opening-context-delete">Delete</button>
        </div>
      </div>
    );
  }

  const field = tools.selectedField || "exteriorWalls";
  if (field === "exteriorHighlightedWalls" && tools.selectedVertexId) {
    return (
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>Exterior highlighted corner</div>
        <Field label="State" value="Editable" />
      </div>
    );
  }
  const graph = page?.[field];
  if (!graph) return null;

  if (tools.selectedSegmentId) {
    const segment = graph.segments.find((s) => s.id === tools.selectedSegmentId);
    if (!segment) return null;
    const view = tools.segmentToWallSegment(graph, segment, page?.calibration?.mmPerDocumentUnit || null);
    const isExterior = field === "exteriorWalls";
    const label = isExterior ? "Exterior wall segment" : "Interior wall segment";
    const thickness = segment.thicknessMm ?? graph.wallThicknessMm ?? "";
    const locked = Boolean(segment.locked);
    return (
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>{label}</div>
        <Field label="Wall type" value={view.wallType === "internal" ? "Interior" : "Exterior"} />
        <Field label="Status" value={segment.geometryStatus === "resolved" ? "Resolved" : "Unresolved"} />
        {segment.resolutionFailure && <Field label="Reason" value={segment.resolutionFailure} />}
        <Field label="Length" value={view.lengthMm != null ? formatLength(view.lengthMm) : "Set scale to see length"} />
        <Field label="Source" value={segment.source === "automatic" ? "Automatic" : "Manual"} />
        {segment.confidence != null && (
          <Field label="Confidence" value={CONFIDENCE_LABEL[segment.confidence] || segment.confidence} />
        )}
        {segment.wallConstructionType && <Field label="Construction" value={segment.wallConstructionType} />}
        {segment.thicknessSource && <Field label="Thickness source" value={segment.thicknessSource} />}
        {segment.selectedPathRelation && <Field label="Path fit" value={segment.selectedPathRelation} />}
        {segment.faceASupport && segment.faceBSupport && <Field label="Face support" value={`${segment.faceASupport} / ${segment.faceBSupport}`} />}
        {segment.reviewMessage && <Field label="Review" value={segment.reviewMessage} />}
        {segment.physicalBandDiagnostics && <WallBandDiagnostics diagnostics={segment.physicalBandDiagnostics} />}
        <label style={S.label}>
          Thickness
          <input
            type="number"
            min="0"
            step="10"
            value={thickness}
            disabled={locked}
            onChange={(event) => {
              const value = Number(event.target.value);
              tools.setSelectedSegmentThickness(Number.isFinite(value) && value > 0 ? value : null);
            }}
            style={S.input}
            data-testid="wall-context-thickness"
          />
          <span style={S.unit}>mm</span>
        </label>
        <Field label="State" value={locked ? "Locked" : "Unlocked"} />
        <div style={S.actions}>
          <button type="button" style={S.button} disabled={locked} onClick={tools.insertPointOnSelectedSegment} data-testid="wall-context-split">Insert Point</button>
          <button type="button" style={S.buttonDanger} disabled={locked} onClick={tools.deleteSelectedWallSegment} data-testid="wall-context-delete">Delete</button>
          <button
            type="button"
            style={S.button}
            disabled={locked}
            onClick={() => tools.moveSelectedSegmentToWallGraph(isExterior ? "internalWalls" : "exteriorWalls")}
            data-testid="wall-context-convert-type"
          >
            {isExterior ? "Convert to Interior" : "Convert to Exterior"}
          </button>
          {segment.source === "automatic" && (
            <button type="button" style={S.button} disabled={locked} onClick={tools.convertSelectedSegmentToManual} data-testid="wall-context-convert-manual">
              Convert to Manual
            </button>
          )}
          {locked ? (
            <button type="button" style={S.button} onClick={() => tools.setSelectedSegmentLocked(false)} data-testid="wall-context-unlock">Unlock</button>
          ) : (
            <button type="button" style={S.button} onClick={() => tools.setSelectedSegmentLocked(true)} data-testid="wall-context-lock">Lock</button>
          )}
        </div>
      </div>
    );
  }

  if (tools.selectedVertexId) {
    const vertex = graph.vertices.find((v) => v.id === tools.selectedVertexId);
    if (!vertex) return null;
    const label = field === "exteriorWalls" ? "Exterior wall corner" : "Internal wall corner";
    return (
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>{label}</div>
        <div style={S.actions}>
          <button type="button" style={S.buttonDanger} onClick={tools.deleteSelectedWallVertex} data-testid="wall-context-delete-vertex">
            Delete Point
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Field({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function OpeningInput({ label, value, onChange, multiline = false }) {
  const Input = multiline ? "textarea" : "input";
  return (
    <label style={S.openingLabel}>
      <span>{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={multiline ? { ...S.input, ...S.textarea } : S.input}
        data-testid={`opening-field-${fieldTestId(label)}`}
      />
    </label>
  );
}

function OpeningNumber({ label, value, onChange, suffix = "" }) {
  return (
    <label style={S.openingLabel}>
      <span>{label}</span>
      <span style={S.inlineInput}>
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? next : null);
          }}
          style={S.input}
          data-testid={`opening-field-${fieldTestId(label)}`}
        />
        {suffix && <span style={S.unit}>{suffix}</span>}
      </span>
    </label>
  );
}

function OpeningSelect({ label, value, options, onChange }) {
  return (
    <label style={S.openingLabel}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={S.input} data-testid={`opening-field-${fieldTestId(label)}`}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function OpeningCombo({ label, value, options = [], onChange }) {
  const id = `opening-options-${fieldTestId(label)}`;
  return (
    <label style={S.openingLabel}>
      <span>{label}</span>
      <span>
        <input
          list={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={S.input}
          data-testid={`opening-field-${fieldTestId(label)}`}
        />
        <datalist id={id}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      </span>
    </label>
  );
}

function OpeningCheckbox({ label, checked, onChange }) {
  return (
    <label style={S.openingLabel}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={S.checkbox}
        data-testid={`opening-field-${fieldTestId(label)}`}
      />
    </label>
  );
}

function fieldTestId(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function WallBandDiagnostics({ diagnostics }) {
  const rejected = diagnostics.rejectedCandidates || [];
  return (
    <div style={S.diagnostics} data-testid="wall-band-diagnostics">
      <div style={S.diagnosticsTitle}>Wall band</div>
      {diagnostics.selectedSegment && (
        <div style={S.sampleLine} data-testid="wall-band-selected-path">
          Path {formatPoint(diagnostics.selectedSegment.start)} {"->"} {formatPoint(diagnostics.selectedSegment.end)}
        </div>
      )}
      {(diagnostics.crossSectionOffsets || []).slice(0, 5).map((sample) => (
        <div key={sample.label} style={S.sampleLine} data-testid="wall-band-cross-section-sample">
          {sample.label}: {sample.offsetsMm?.length ? sample.offsetsMm.map(formatOffset).join(", ") : "none"}
        </div>
      ))}
      {diagnostics.chosen && (
        <>
          <Field label="Outer" value={formatOffset(diagnostics.chosen.outerFaceOffsetMm)} />
          <Field label="Inner" value={formatOffset(diagnostics.chosen.innerFaceOffsetMm)} />
          <Field label="Thickness" value={diagnostics.chosen.thicknessMm != null ? `${Math.round(diagnostics.chosen.thicknessMm)} mm` : "Unknown"} />
        </>
      )}
      {diagnostics.unresolvedReason && <Field label="Unresolved" value={diagnostics.unresolvedReason} />}
      {rejected.slice(0, 3).map((entry, index) => (
        <div key={`${entry.reason}-${index}`} style={S.rejected} data-testid="wall-band-rejected-candidate">
          {entry.reason}
        </div>
      ))}
    </div>
  );
}

function formatOffset(value) {
  return value == null ? "n/a" : `${value > 0 ? "+" : ""}${Math.round(value)} mm`;
}

function formatPoint(point) {
  if (!point) return "n/a";
  return `${Math.round(point.x)},${Math.round(point.y)}`;
}

function stopPanelEvent(event) {
  event.stopPropagation();
}

const S = {
  panel: {
    position: "absolute", top: 10, right: 10, zIndex: 20,
    background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "10px 12px", minWidth: 190, boxShadow: "0 6px 16px rgba(15,23,42,0.18)",
    fontFamily: "system-ui, sans-serif", fontSize: 12, pointerEvents: "auto",
  },
  openingPanel: { minWidth: 310, maxWidth: 360, maxHeight: "calc(100vh - 28px)", overflowY: "auto" },
  title: { fontWeight: 800, color: "#0f172a", marginBottom: 6, fontSize: 13 },
  row: { display: "flex", justifyContent: "space-between", gap: 14, color: "#334155", marginBottom: 3 },
  rowLabel: { color: "#64748b", fontWeight: 700 },
  label: { display: "grid", gridTemplateColumns: "1fr 72px 24px", alignItems: "center", gap: 6, color: "#64748b", fontWeight: 700, marginTop: 8 },
  input: { border: "1px solid #cbd5e1", borderRadius: 5, padding: "4px 6px", fontSize: 12, color: "#0f172a" },
  textarea: { minHeight: 54, resize: "vertical", fontFamily: "inherit" },
  openingLabel: { display: "grid", gridTemplateColumns: "126px 1fr", alignItems: "center", gap: 7, color: "#64748b", fontWeight: 700, marginTop: 6 },
  checkbox: { width: 18, height: 18 },
  inlineInput: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 5 },
  unit: { color: "#64748b", fontWeight: 700 },
  diagnostics: { borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 6 },
  diagnosticsTitle: { color: "#334155", fontWeight: 800, marginBottom: 4 },
  sampleLine: { color: "#475569", fontSize: 11, lineHeight: 1.25, marginBottom: 2 },
  rejected: { color: "#991b1b", fontSize: 11, lineHeight: 1.25, marginTop: 2 },
  actions: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" },
  button: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  buttonDanger: { border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};
