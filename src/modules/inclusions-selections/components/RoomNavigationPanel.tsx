import type { RoomViewGroup } from "../services/selectionWorkspaceService";

export function RoomNavigationPanel({ groups, selectedAreaId, search, onSearch, onSelectArea, onEditAreas }: { groups: RoomViewGroup[]; selectedAreaId?: string; search: string; onSearch: (value: string) => void; onSelectArea: (areaId: string) => void; onEditAreas: () => void }) {
  const needle = search.toLowerCase();
  return (
    <aside className="navPanel">
      <div className="panelHead"><h2>Rooms</h2><button type="button" onClick={onEditAreas}>Edit Project Areas</button></div>
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search rooms" aria-label="Search ProjectAreas" />
      {groups.map((group) => (
        <details open key={group.groupId}>
          <summary>{group.groupName}</summary>
          {group.rooms.filter((room) => !needle || room.area.name.toLowerCase().includes(needle)).map((room) => (
            <button type="button" key={room.area.id} className={selectedAreaId === room.area.id ? "navItem selected" : "navItem"} onClick={() => onSelectArea(room.area.id)}>
              <strong>{room.area.name}</strong>
              <span>{room.completionPercent}% · {room.outstandingCount} outstanding · ${room.variationTotal.toFixed(2)}</span>
            </button>
          ))}
        </details>
      ))}
    </aside>
  );
}
