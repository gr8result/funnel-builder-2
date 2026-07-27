import { useState } from "react";

// Admin CRUD for the required-selections checklist — the checklist is real
// editable data (builder_selection_checklist_items), not a hardcoded list.
// Add / rename / reorder / mark required-or-optional / deactivate. Reordering
// is a numeric sort_order field (consistent with how categories are already
// ordered elsewhere in the Product Library) rather than drag-and-drop, kept
// deliberately simple.
export default function ChecklistAdminPanel({ open, items, categories, workspaceId, onClose, onCreate, onUpdate, onDeactivate }) {
  const [newItem, setNewItem] = useState({ selection_group: "", room: "", item_label: "", category_id: "", required: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const groupedCategories = [...categories].sort((a, b) => (a.category_name || "").localeCompare(b.category_name || ""));

  async function handleCreate() {
    if (!newItem.selection_group.trim() || !newItem.item_label.trim()) {
      setError("Group and item label are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({
        workspace_id: workspaceId,
        selection_group: newItem.selection_group.trim(),
        room: newItem.room.trim() || null,
        item_label: newItem.item_label.trim(),
        category_id: newItem.category_id || null,
        required: newItem.required,
        active: true,
        sort_order: (items[items.length - 1]?.sort_order || 0) + 1,
      });
      setNewItem({ selection_group: "", room: "", item_label: "", category_id: "", required: true });
    } catch (createError) {
      setError(createError?.message || "Could not add the checklist item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Manage Required Selections Checklist</h2>
          <button type="button" className="icon" onClick={onClose} aria-label="Close">×</button>
        </header>

        {error && <p className="error">{error}</p>}

        <section className="addForm">
          <h3>Add Checklist Item</h3>
          <div className="row">
            <input placeholder="Selection group (e.g. External)" value={newItem.selection_group} onChange={(event) => setNewItem((current) => ({ ...current, selection_group: event.target.value }))} />
            <input placeholder="Room (optional)" value={newItem.room} onChange={(event) => setNewItem((current) => ({ ...current, room: event.target.value }))} />
            <input placeholder="Item label (e.g. Roof colour)" value={newItem.item_label} onChange={(event) => setNewItem((current) => ({ ...current, item_label: event.target.value }))} />
            <select value={newItem.category_id} onChange={(event) => setNewItem((current) => ({ ...current, category_id: event.target.value }))}>
              <option value="">Link to a catalogue category (optional)</option>
              {groupedCategories.map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}
            </select>
            <label className="check">
              <input type="checkbox" checked={newItem.required} onChange={(event) => setNewItem((current) => ({ ...current, required: event.target.checked }))} />
              Required
            </label>
            <button type="button" onClick={handleCreate} disabled={saving}>{saving ? "Adding..." : "Add"}</button>
          </div>
        </section>

        <section className="list">
          <h3>Existing Items ({items.filter((item) => item.active).length} active)</h3>
          <div className="tableScroll">
          <table>
            <thead>
              <tr><th>Order</th><th>Group</th><th>Room</th><th>Item</th><th>Category</th><th>Required</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.active ? "" : "inactive"}>
                  <td>
                    <input
                      type="number"
                      className="sortInput"
                      value={item.sort_order}
                      onChange={(event) => onUpdate(item.id, { sort_order: Number(event.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input value={item.selection_group} onChange={(event) => onUpdate(item.id, { selection_group: event.target.value })} />
                  </td>
                  <td>
                    <input value={item.room || ""} onChange={(event) => onUpdate(item.id, { room: event.target.value || null })} placeholder="—" />
                  </td>
                  <td>
                    <input value={item.item_label} onChange={(event) => onUpdate(item.id, { item_label: event.target.value })} />
                  </td>
                  <td>{categories.find((category) => category.id === item.category_id)?.category_name || <span className="unmatched">Unassigned</span>}</td>
                  <td>
                    <input type="checkbox" checked={item.required} onChange={(event) => onUpdate(item.id, { required: event.target.checked })} />
                  </td>
                  <td>
                    <input type="checkbox" checked={item.active} onChange={(event) => onUpdate(item.id, { active: event.target.checked })} />
                  </td>
                  <td>
                    <button type="button" className="danger" onClick={() => onDeactivate(item.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={8} className="empty">No checklist items yet — add one above.</td></tr>}
            </tbody>
          </table>
          </div>
        </section>
      </div>

      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(2,6,23,0.6); display: grid; place-items: center; z-index: 200; padding: 24px; }
        .panel { background: #0b1626; color: #e5eefb; border-radius: 12px; width: min(1100px, 96vw); max-height: 90vh; overflow: auto; padding: 20px; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        header h2 { margin: 0; font-size: 18px; }
        button.icon { background: transparent; border: 0; color: #94a3b8; font-size: 22px; cursor: pointer; }
        .error { background: rgba(127,29,29,0.25); border: 1px solid rgba(248,113,113,0.4); color: #fecaca; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
        h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #93a4bd; margin: 16px 0 8px; }
        .addForm .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; align-items: center; }
        input, select { padding: 7px 9px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.3); background: #0f1c30; color: #e5eefb; font-size: 12px; }
        label.check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cbd5e1; white-space: nowrap; }
        button { border: 0; border-radius: 6px; padding: 8px 12px; font-weight: 800; cursor: pointer; background: #2563eb; color: #fff; font-size: 12px; }
        button.danger { background: #b91c1c; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .tableScroll { overflow-x: auto; }
        table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        th { text-align: left; padding: 6px; color: #93a4bd; border-bottom: 1px solid rgba(148,163,184,0.2); }
        td { padding: 5px 6px; border-bottom: 1px solid rgba(148,163,184,0.1); }
        tr.inactive { opacity: 0.5; }
        td input[type="text"], td input:not([type]) { width: 100%; }
        .sortInput { width: 56px; }
        .unmatched { color: #f59e0b; font-size: 11px; }
        .empty { text-align: center; color: #64748b; padding: 20px; }
      `}</style>
    </div>
  );
}
