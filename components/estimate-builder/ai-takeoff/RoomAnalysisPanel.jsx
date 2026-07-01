// RoomAnalysisPanel.jsx
// Displays room labels detected by AI vision analysis.
// For each room: name, location, matched polygon (if drawn), floor finish, area, notes.

import { FLOOR_FINISHES } from "./takeoffTypes";
import { fmtM2 } from "./takeoffUtils";

export default function RoomAnalysisPanel({
  roomAnalysis,   // { rooms: [], analyzedAt }
  overlays,       // Overlay[] from the current page
  measurements,   // { rooms: [] } from computeMeasurements
  onUpdateRoom,   // (roomId, patch) => void
}) {
  if (!roomAnalysis) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
        <div style={S.emptyTitle}>No room analysis yet</div>
        <div style={S.emptyText}>
          Click <strong>Analyse Plan</strong> in the toolbar to detect room labels from the plan image.
        </div>
      </div>
    );
  }

  const { rooms, analyzedAt } = roomAnalysis;

  if (!rooms || rooms.length === 0) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
        <div style={S.emptyTitle}>No rooms detected</div>
        <div style={S.emptyText}>
          The AI did not detect any room labels in this plan.
          Check the scale is set and the plan is a floor plan, not a site plan.
        </div>
        {analyzedAt && (
          <div style={S.timestamp}>Analysed {new Date(analyzedAt).toLocaleTimeString()}</div>
        )}
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.heading}>Room Analysis</span>
        <span style={S.count}>{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
      </div>

      {analyzedAt && (
        <div style={S.timestamp}>Analysed {new Date(analyzedAt).toLocaleTimeString()}</div>
      )}

      <div style={S.list}>
        {rooms.map((room) => {
          // Find a matching drawn polygon by label
          const matchedPolygon = overlays.find(
            (o) => (o.type === "room" || o.type === "wetArea") &&
                   (o.label?.toLowerCase().includes(room.name.toLowerCase()) ||
                    room.name.toLowerCase().includes(o.label?.toLowerCase() || ""))
          );
          const measuredRoom = measurements?.rooms?.find((r) => r.id === matchedPolygon?.id);

          return (
            <RoomCard
              key={room.id}
              room={room}
              matchedPolygon={matchedPolygon}
              measuredRoom={measuredRoom}
              onUpdate={(patch) => onUpdateRoom?.(room.id, patch)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────

function RoomCard({ room, matchedPolygon, measuredRoom, onUpdate }) {
  return (
    <div style={{ ...S.card, ...(matchedPolygon ? S.cardMatched : {}) }}>
      <div style={S.cardHead}>
        <div style={S.roomName}>{room.name}</div>
        {matchedPolygon ? (
          <span style={S.matchBadge}>✓ Polygon drawn</span>
        ) : (
          <span style={S.noMatchBadge}>No polygon</span>
        )}
      </div>

      {/* Location indicator */}
      <div style={S.location}>
        Position: {room.xPct?.toFixed(0)}% across, {room.yPct?.toFixed(0)}% down the plan
      </div>

      {/* Area from matched polygon */}
      {measuredRoom && (
        <div style={S.areaRow}>
          <span style={S.areaLabel}>Area</span>
          <span style={S.areaValue}>{fmtM2(measuredRoom.floorAreaM2)}</span>
          <span style={S.perimLabel}>Perimeter</span>
          <span style={S.areaValue}>{measuredRoom.perimeterM?.toFixed(2)} m</span>
        </div>
      )}

      {/* Floor finish */}
      <div style={S.finishRow}>
        <label style={S.finishLabel}>Floor finish</label>
        <select
          value={room.finishType || ""}
          onChange={(e) => onUpdate({ finishType: e.target.value })}
          style={S.finishSelect}
        >
          {FLOOR_FINISHES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <input
        type="text"
        placeholder="Notes…"
        value={room.notes || ""}
        onChange={(e) => onUpdate({ notes: e.target.value })}
        style={S.notesInput}
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  wrap:         { display: "flex", flexDirection: "column", gap: 8 },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between" },
  heading:      { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  count:        { fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#dbeafe", color: "#1d4ed8" },
  timestamp:    { fontSize: 11, color: "#94a3b8" },
  list:         { display: "flex", flexDirection: "column", gap: 8 },

  card:         { border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 6 },
  cardMatched:  { borderColor: "#86efac", background: "#f0fdf4" },
  cardHead:     { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  roomName:     { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  matchBadge:   { fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#dcfce7", color: "#15803d" },
  noMatchBadge: { fontSize: 11, color: "#94a3b8" },

  location:     { fontSize: 11, color: "#64748b" },

  areaRow:      { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 6, padding: "4px 8px" },
  areaLabel:    { fontSize: 11, color: "#64748b", fontWeight: 600 },
  areaValue:    { fontSize: 12, fontWeight: 700, color: "#0f172a" },
  perimLabel:   { fontSize: 11, color: "#64748b", fontWeight: 600, marginLeft: 4 },

  finishRow:    { display: "flex", alignItems: "center", gap: 8 },
  finishLabel:  { fontSize: 12, color: "#64748b", fontWeight: 600, minWidth: 72 },
  finishSelect: { flex: 1, padding: "4px 7px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#334155", cursor: "pointer" },

  notesInput:   { padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#334155", outline: "none" },

  empty:        { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "24px 12px", textAlign: "center" },
  emptyTitle:   { fontSize: 14, fontWeight: 700, color: "#334155" },
  emptyText:    { fontSize: 13, color: "#64748b", lineHeight: 1.5, maxWidth: 220 },
};
