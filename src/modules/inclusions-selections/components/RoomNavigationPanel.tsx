import type { RequirementWorkspaceRow, RoomViewGroup } from "../services/selectionWorkspaceService";

function statusLabel(row: RequirementWorkspaceRow) {
  const status = row.selection?.selectionStatus ?? "not_started";
  if (status === "complete") return "Done";
  if (status === "needs_attention" || status === "in_progress") return "!";
  return "";
}

function roomProgressLabel(rows: RequirementWorkspaceRow[]) {
  const completed = rows.filter((row) => row.selection?.selectionStatus === "complete").length;
  if (rows.length === 0) return "No selection items";
  return `Completed: ${completed} of ${rows.length}`;
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
    <aside className="navPanel roomListPanel">
      <div className="panelHead"><h2>Rooms</h2><button type="button" onClick={onEditAreas}>Edit Areas</button></div>
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search rooms" aria-label="Search rooms and areas" />
      {groups.map((group) => (
        <details open key={group.groupId}>
          <summary>{group.groupName}</summary>
          {group.rooms.filter((room) => !needle || room.area.name.toLowerCase().includes(needle)).map((room) => {
            const roomRows = rows.filter((row) => row.area.id === room.area.id);
            return (
              <div key={room.area.id}>
                <button type="button" className={selectedAreaId === room.area.id ? "navItem selected" : "navItem"} onClick={() => onSelectArea(room.area.id)}>
                  <strong>{room.area.name}</strong>
                  <span>{roomProgressLabel(roomRows)}</span>
                </button>
                <div className={selectedAreaId === room.area.id ? "roomRequirementTree expanded" : "roomRequirementTree"}>
                  {roomRows.map((row) => (
                    <button type="button" key={row.requirement.id} className={`roomRequirementLink status-${row.selection?.selectionStatus ?? "not_started"}`} onClick={() => onSelectRequirement?.(row.requirement.id)}>
                      <span>{statusLabel(row)}</span>
                      <strong>{row.requirement.title}</strong>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </details>
      ))}
    </aside>
  );
}
