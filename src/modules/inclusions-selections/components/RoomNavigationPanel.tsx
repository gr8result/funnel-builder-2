import type { RequirementWorkspaceRow, RoomViewGroup } from "../services/selectionWorkspaceService";

function statusGlyph(row: RequirementWorkspaceRow) {
  const status = row.selection?.selectionStatus ?? "not_started";
  if (status === "complete") return "✓";
  if (status === "needs_attention" || status === "in_progress") return "!";
  return "○";
}

export function RoomNavigationPanel({
  groups,
  rows = [],
  selectedAreaId,
  search,
  onSearch,
  onSelectArea,
  onSelectRequirement,
  onEditAreas,
}: {
  groups: RoomViewGroup[];
  rows?: RequirementWorkspaceRow[];
  selectedAreaId?: string;
  search: string;
  onSearch: (value: string) => void;
  onSelectArea: (areaId: string) => void;
  onSelectRequirement?: (requirementId: string) => void;
  onEditAreas: () => void;
}) {
  const needle = search.toLowerCase();
  return (
    <aside className="navPanel">
      <div className="panelHead"><h2>Rooms</h2><button type="button" onClick={onEditAreas}>Edit Areas</button></div>
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search rooms" aria-label="Search rooms and areas" />
      {groups.map((group) => (
        <details open key={group.groupId}>
          <summary>{group.groupName}</summary>
          {group.rooms.filter((room) => !needle || room.area.name.toLowerCase().includes(needle)).map((room) => (
            <div key={room.area.id}>
              <button type="button" className={selectedAreaId === room.area.id ? "navItem selected" : "navItem"} onClick={() => onSelectArea(room.area.id)}>
                <strong>{room.area.name}</strong>
                <span>{room.completionPercent}% / {room.outstandingCount} outstanding / ${room.variationTotal.toFixed(2)}</span>
              </button>
              {selectedAreaId === room.area.id ? (
                <div className="roomRequirementTree">
                  {rows.filter((row) => row.area.id === room.area.id).map((row) => (
                    <button type="button" key={row.requirement.id} className={`roomRequirementLink status-${row.selection?.selectionStatus ?? "not_started"}`} onClick={() => onSelectRequirement?.(row.requirement.id)}>
                      <span>{statusGlyph(row)}</span>
                      <strong>{row.requirement.title}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </details>
      ))}
    </aside>
  );
}
