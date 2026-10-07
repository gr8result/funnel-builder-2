// MANAGE ROOMS: add, rename, merge or remove a room of the project. This edits the project's ONE
// room list (lib/builders/projectRoomModel.js over projectLocations.js), so every Client Selections
// module - Electrical, Lighting, Paint, Flooring, Tiles, ... - shows the corrected house. It is
// opened from a module but it is never that module's own list.
// Readable text is never below 16px.
import { useEffect, useState } from "react";
import { ROOM_SOURCE_LABELS } from "../../lib/builders/projectRoomModel.js";

export default function ProjectRoomManager({ rooms = [], removed = [], levels = [], roomTypes = [], usageFor = () => [], onAdd, onRename, onUpdate, onRemove, onMerge, onRestore, onClose }) {
  const [action, setAction] = useState(null); // { kind: "rename" | "merge" | "remove", id }
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", level: "", roomType: "" });
  const [message, setMessage] = useState({ state: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const typeLabel = (key) => roomTypes.find((type) => type.key === key)?.label || "";
  // Two sources often name one room differently (the takeoff's "Pantry", cabinetry's "Butler's
  // Pantry"). Where every word of one name is in another room's name, Merge is offered ready-made.
  // It is only a suggestion: nothing is merged until the user says so.
  const words = (name) => String(name || "").toLowerCase().replace(/['’]s/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const likelySameRoom = (room) => rooms.find((other) => other.id !== room.id && other.source !== room.source && words(other.name).length > words(room.name).length && words(room.name).every((word) => words(other.name).includes(word))) || null;
  const beginMerge = (room, into) => { setAction({ kind: "merge", id: room.id }); setValue(into.id); setMessage({ state: "idle", text: "" }); };
  const begin = (kind, room) => { setAction({ kind, id: room.id }); setValue(kind === "rename" ? room.name : ""); setMessage({ state: "idle", text: "" }); };
  const cancel = () => { setAction(null); setValue(""); };
  async function run(task, done) {
    setBusy(true);
    let result = null;
    try { result = await task(); } catch { result = { ok: false, error: "The room list could not be saved to the job." }; }
    setBusy(false);
    if (result?.ok) { setMessage({ state: "saved", text: done }); cancel(); return true; }
    setMessage({ state: "failed", text: result?.error || "The room list could not be saved to the job." });
    return false;
  }
  async function submitAdd() {
    if (await run(() => onAdd(draft), `${draft.name.trim()} added to the project.`)) { setDraft({ name: "", level: draft.level, roomType: "" }); setAdding(false); }
  }

  return (
    <div className="prm-overlay" role="dialog" aria-modal="true" aria-label="Manage rooms" data-testid="project-room-manager" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <style>{ROOM_MANAGER_CSS}</style>
      <div className="prm-modal">
        <div className="prm-head">
          <div>
            <h3>Project rooms</h3>
            <p>This is the room list for the whole project. A change here applies to every selection: Electrical, Lighting, Paint, Flooring, Tiles and the rest.</p>
          </div>
          <button type="button" className="prm-close" onClick={onClose} aria-label="Close" data-testid="room-manager-close">×</button>
        </div>
        {message.state !== "idle" ? <p className={`prm-message ${message.state}`} role="status" data-testid="room-manager-message">{message.text}</p> : null}

        {rooms.length ? (
          <ul className="prm-rooms" data-testid="room-manager-list">
            {rooms.map((room) => {
              const open = action?.id === room.id ? action.kind : "";
              const usage = open === "remove" || open === "merge" ? usageFor(room) : [];
              const same = open ? null : likelySameRoom(room);
              return (
                <li key={room.id} className={open ? "open" : ""} data-testid="room-manager-room" data-room={room.name} data-room-id={room.id} data-source={room.source}>
                  <div className="prm-row">
                    <div className="prm-rowText">
                      <strong>{room.name}</strong>
                      <span>{[typeLabel(room.roomType), room.level, `Source: ${ROOM_SOURCE_LABELS[room.source] || room.source || "Project"}`].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="prm-rowActions">
                      <button type="button" className="prm-secondary" onClick={() => begin("rename", room)} data-testid="room-rename">Rename</button>
                      {rooms.length > 1 ? <button type="button" className="prm-secondary" onClick={() => begin("merge", room)} data-testid="room-merge">Merge</button> : null}
                      <button type="button" className="prm-secondary danger" onClick={() => begin("remove", room)} data-testid="room-remove">Remove</button>
                    </div>
                  </div>
                  {same ? <p className="prm-suggest" data-testid="room-merge-suggestion">Looks like the same room as {same.name}. <button type="button" className="prm-link" onClick={() => beginMerge(room, same)} data-testid="room-merge-suggested">Merge into {same.name}</button></p> : null}

                  {open === "rename" ? (
                    <div className="prm-panel">
                      <div className="prm-fields">
                        <label><span>Room name</span><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} data-testid="room-rename-input" /></label>
                        <label><span>Room type</span>
                          <select value={room.roomType || ""} onChange={(event) => run(() => onUpdate(room, { roomType: event.target.value }), `${room.name} updated.`)} data-testid="room-type-input">
                            <option value="">Not set</option>
                            {roomTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <p>Renaming keeps everything already selected for this room.</p>
                      <div className="prm-panelActions">
                        <button type="button" className="prm-secondary" onClick={cancel}>Cancel</button>
                        <button type="button" className="prm-primary" disabled={busy || !value.trim() || value.trim() === room.name} onClick={() => run(() => onRename(room, value), `${room.name} renamed to ${value.trim()}.`)} data-testid="room-rename-save">Save name</button>
                      </div>
                    </div>
                  ) : null}

                  {open === "merge" ? (
                    <div className="prm-panel">
                      <label><span>Merge {room.name} into</span>
                        <select value={value} onChange={(event) => setValue(event.target.value)} data-testid="room-merge-target">
                          <option value="">Choose the room to keep…</option>
                          {rooms.filter((other) => other.id !== room.id).map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}
                        </select>
                      </label>
                      <p>Use this when two names are the same room. {usage.length ? `${room.name} has ${usage.join(", ")} attached: these move to the room you keep, without counting anything twice.` : `${room.name} has nothing attached yet.`} {room.name} is then removed from the list.</p>
                      <div className="prm-panelActions">
                        <button type="button" className="prm-secondary" onClick={cancel}>Cancel</button>
                        <button type="button" className="prm-primary" disabled={busy || !value} onClick={() => { const into = rooms.find((other) => other.id === value); return run(() => onMerge(room, into), `${room.name} merged into ${into.name}.`); }} data-testid="room-merge-save">Merge rooms</button>
                      </div>
                    </div>
                  ) : null}

                  {open === "remove" ? (
                    <div className={`prm-panel ${usage.length ? "warn" : ""}`} data-testid="room-remove-confirm" data-has-data={usage.length ? "true" : "false"}>
                      {usage.length ? (
                        <>
                          <p><strong>{room.name} has project data attached:</strong></p>
                          <ul className="prm-usage" data-testid="room-remove-usage">{usage.map((item) => <li key={item}>{item}</li>)}</ul>
                          <p>Removing this room removes its electrical points and leaves the other records without a room. If {room.name} is really another room under a different name, use Merge instead.</p>
                        </>
                      ) : <p>Nothing is attached to {room.name}. It will be taken out of the room list for every selection.</p>}
                      <div className="prm-panelActions">
                        <button type="button" className="prm-secondary" onClick={cancel} data-testid="room-remove-cancel">Cancel</button>
                        <button type="button" className="prm-primary danger" disabled={busy} onClick={() => run(() => onRemove(room), `${room.name} removed from the project.`)} data-testid="room-remove-confirm-button">Remove room</button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="prm-empty">No rooms are recorded for this project yet. Add the rooms the house has, or read them from the plans in AI Plan Takeoff.</p>}

        {adding ? (
          <div className="prm-panel add" data-testid="room-add-form">
            <div className="prm-fields three">
              <label><span>Room name</span><input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Media Room" data-testid="room-add-name" /></label>
              <label><span>Level</span>
                <input list="prm-levels" value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} placeholder="e.g. Ground Floor" data-testid="room-add-level" />
                <datalist id="prm-levels">{levels.map((level) => <option key={level} value={level} />)}</datalist>
              </label>
              <label><span>Room type</span>
                <select value={draft.roomType} onChange={(event) => setDraft({ ...draft, roomType: event.target.value })} data-testid="room-add-type">
                  <option value="">Choose a type…</option>
                  {roomTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                </select>
              </label>
            </div>
            <div className="prm-panelActions">
              <button type="button" className="prm-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button type="button" className="prm-primary" disabled={busy || !draft.name.trim()} onClick={submitAdd} data-testid="room-add-save">Add room</button>
            </div>
          </div>
        ) : <button type="button" className="prm-primary add" onClick={() => { setAdding(true); cancel(); }} data-testid="room-add">+ Add room</button>}

        {removed.length ? (
          <div className="prm-removed" data-testid="room-manager-removed">
            <strong>Removed from this project</strong>
            <ul>
              {removed.map((entry) => (
                <li key={entry.id}><span>{entry.name}</span><button type="button" className="prm-link" disabled={busy} onClick={() => run(() => onRestore(entry), `${entry.name} restored.`)} data-testid="room-restore">Restore</button></li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ROOM_MANAGER_CSS = `
.prm-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(15, 23, 42, .55); display: grid; place-items: start center; padding: 4vh 16px; overflow-y: auto; }
.prm-modal { width: min(940px, 100%); background: #fff; border-radius: 16px; padding: 22px 24px 24px; display: grid; gap: 16px; font-size: 16px; color: #0f172a; }
.prm-modal h3, .prm-modal p, .prm-modal ul { margin: 0; }
.prm-modal button, .prm-modal input, .prm-modal select { font-size: 16px; font-family: inherit; }
.prm-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.prm-head h3 { font-size: 24px; font-weight: 900; } .prm-head p { color: #334155; margin-top: 4px; max-width: 64ch; }
.prm-modal .prm-close { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-size: 26px; line-height: 1; cursor: pointer; }
.prm-message { padding: 10px 14px; border-radius: 10px; font-weight: 700; }
.prm-message.saved { background: #dcfce7; color: #14532d; } .prm-message.failed { background: #fee2e2; color: #991b1b; }
.prm-rooms { list-style: none; padding: 0; display: grid; gap: 10px; }
.prm-rooms > li { border: 1px solid #d7deea; border-radius: 12px; padding: 12px 16px; display: grid; gap: 12px; }
.prm-rooms > li.open { border-color: #0f766e; }
.prm-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.prm-rowText { display: grid; gap: 2px; } .prm-rowText strong { font-size: 19px; font-weight: 900; } .prm-rowText span { color: #475569; }
.prm-rowActions, .prm-panelActions { display: flex; gap: 10px; flex-wrap: wrap; }
.prm-panelActions { justify-content: flex-end; }
.prm-primary, .prm-secondary { min-height: 44px; padding: 8px 18px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.prm-primary { background: #0f766e; color: #fff; border: 0; } .prm-primary.danger { background: #b91c1c; } .prm-primary:disabled { background: #94a3b8; cursor: default; }
.prm-primary.add { justify-self: start; }
.prm-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; } .prm-secondary.danger { color: #b91c1c; border-color: #fca5a5; }
.prm-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; }
.prm-panel { border-top: 1px solid #e2e8f0; padding-top: 12px; display: grid; gap: 12px; }
.prm-panel.add { border: 1px solid #0f766e; border-radius: 12px; padding: 16px; }
.prm-panel.warn { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 16px; }
.prm-panel p { color: #334155; } .prm-panel.warn p { color: #78350f; }
.prm-usage { padding-left: 22px; color: #78350f; font-weight: 700; }
.prm-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } .prm-fields.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.prm-modal label { display: grid; gap: 6px; font-weight: 700; }
.prm-modal label input, .prm-modal label select { min-height: 46px; font-weight: 400; }
.prm-empty { color: #475569; }
.prm-suggest { color: #78350f; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 8px 14px; }
.prm-removed { border-top: 1px solid #e2e8f0; padding-top: 14px; display: grid; gap: 8px; }
.prm-removed ul { list-style: none; padding: 0; display: flex; gap: 10px 22px; flex-wrap: wrap; } .prm-removed li { display: flex; gap: 10px; align-items: center; color: #475569; }
@media (max-width: 720px) { .prm-fields, .prm-fields.three { grid-template-columns: 1fr; } }
`;
