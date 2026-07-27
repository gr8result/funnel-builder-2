import { useMemo } from "react";

// Left-pane guided-selections checklist: grouped, tick-and-flick navigation.
// A group/room heading shows its own completion count; each row shows a
// filled tick when an active selection exists, an outline circle otherwise,
// and a warning mark when it's required but still missing.
export default function SelectionChecklistNav({ items, selectedByItemId, activeItemId, onSelectItem }) {
  const groups = useMemo(() => {
    const byGroup = new Map();
    items.forEach((item) => {
      const groupKey = item.selection_group || "Other";
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, new Map());
      const byRoom = byGroup.get(groupKey);
      const roomKey = item.room || "";
      if (!byRoom.has(roomKey)) byRoom.set(roomKey, []);
      byRoom.get(roomKey).push(item);
    });
    return Array.from(byGroup, ([groupName, byRoom]) => ({
      groupName,
      rooms: Array.from(byRoom, ([roomName, rows]) => ({ roomName, rows })),
    }));
  }, [items]);

  return (
    <nav className="checklistNav">
      {groups.map((group) => {
        const allRows = group.rooms.flatMap((room) => room.rows);
        const doneCount = allRows.filter((item) => selectedByItemId.has(item.id)).length;
        return (
          <div className="group" key={group.groupName}>
            <div className="groupHeader">
              <span>{group.groupName.toUpperCase()}</span>
              <span className="count">{doneCount}/{allRows.length}</span>
            </div>
            {group.rooms.map((room) => (
              <div className="roomBlock" key={room.roomName || "_"}>
                {room.roomName && <div className="roomHeading">{room.roomName}</div>}
                {room.rows.map((item) => {
                  const done = selectedByItemId.has(item.id);
                  const missingRequired = item.required && !done;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`item ${item.id === activeItemId ? "active" : ""} ${done ? "done" : ""}`}
                      onClick={() => onSelectItem(item)}
                    >
                      <span className={`mark ${done ? "done" : missingRequired ? "warn" : ""}`}>
                        {done ? "✓" : missingRequired ? "!" : "○"}
                      </span>
                      <span className="label">{item.item_label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
      {!items.length && <p className="empty">No checklist items configured for this workspace yet.</p>}

      <style jsx>{`
        .checklistNav { display: grid; gap: 4px; overflow-y: auto; height: 100%; padding-right: 4px; }
        .group { margin-bottom: 10px; }
        .groupHeader { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #93a4bd; position: sticky; top: 0; background: #0b1626; }
        .groupHeader .count { color: #7dd3fc; font-weight: 700; }
        .roomBlock { margin-bottom: 4px; }
        .roomHeading { padding: 4px 8px; font-size: 11px; font-weight: 700; color: #64748b; }
        .item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 7px 8px; border-radius: 6px; border: 0; background: transparent; color: #cbd5e1; cursor: pointer; font-size: 13px; }
        .item:hover { background: rgba(148, 163, 184, 0.12); }
        .item.active { background: rgba(56, 189, 248, 0.16); color: #e5eefb; font-weight: 700; }
        .item.done { color: #94a3b8; }
        .mark { flex-shrink: 0; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1px solid #475569; }
        .mark.done { background: #16a34a; border-color: #16a34a; color: #fff; }
        .mark.warn { border-color: #f59e0b; color: #f59e0b; }
        .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .empty { color: #64748b; font-size: 13px; padding: 12px; }
      `}</style>
    </nav>
  );
}
