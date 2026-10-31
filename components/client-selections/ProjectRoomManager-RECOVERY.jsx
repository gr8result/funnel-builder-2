// PROJECT ROOMS & LOCATIONS: Step 1 of Client Selections, and the place to correct the house at any
// time afterwards. Add, rename, merge or remove a room; review names that may be the same room;
// attach a location a selection was saved against to the room it really is. This edits the
// project's ONE room list (lib/builders/projectRoomModel.js over projectLocations.js), so every
// Client Selections module - Electrical, Lighting, Paint, Flooring, Tiles, ... - shows the corrected
// house. It is opened from a module but it is never that module's own list.
// Nothing is ever merged automatically, and a merge never changes a quantity without being told to.
// Readable text is never below 16px.
import { useEffect, useState } from "react";
import { ROOM_SOURCE_LABELS } from "../../lib/builders/projectRoomModel.js";

const CONFLICT_CHOICES = {
  "same-product": [["same", "It is the same item (keep one)"], ["both", "They are two separate items (keep both)"]],
  "different-product": [["both", "Keep both products in this room"], ["keep-target", "Keep only the product already in the room"]],
};





export default function ProjectRoomManager({ rooms = [], removed = [], levels = [], roomTypes = [], usageFor = () => [], possibleDuplicates = [], unlistedLocations = [], conflictsFor = () => [], confirmed = false, confirmedAt = "", requireConfirmation = false,
  onAdd, onRename, onUpdate, onRemove, onMerge, onRestore, onKeepSeparate, onConfirm, onClose }) {
  const [action, setAction] = useState(null); // { kind: "rename" | "merge" | "remove", id }
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", level: "", roomType: "" });
  const [message, setMessage] = useState({ state: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  // A merge that collides on a selection waits here for the builder's answer to each collision.
  const [pendingMerge, setPendingMerge] = useState(null); // { from, into, conflicts, answers }
  const [assignTo, setAssignTo] = useState({}); // unlisted location id -> room id
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") { if (!requireConfirmation || confirmed) onClose?.(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, requireConfirmation, confirmed]);

  const typeLabel = (key) => roomTypes.find((type) => type.key === key)?.label || "";
  // Two sources often name one room differently (the takeoff's "Pantry", cabinetry's "Butler's
  // Pantry"). Where every word of one name is in another room's name, Merge is offered on the row.
  const words = (name) => String(name || "").toLowerCase().replace(/['’]s/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const likelySameRoom = (room) => rooms.find((other) => other.id !== room.id && other.source !== room.source && words(other.name).length > words(room.name).length && words(room.name).every((word) => words(other.name).includes(word))
    && !possibleDuplicates.some((pair) => pair.rooms.some((item) => item.id === room.id))) || null;
  const levelOptions = [...new Set(["Ground Floor", "Upper Floor", "Third Floor", ...levels].filter(Boolean))];
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
  // Merge `from` into `into`. Where both hold the same selection the builder is asked first; with no
  // collision the merge goes straight through.
  function requestMerge(from, into) {
    if (!from || !into) return;
    const conflicts = conflictsFor(from, into);
    if (conflicts.length) { setPendingMerge({ from, into, conflicts, answers: {} }); setMessage({ state: "idle", text: "" }); return; }
    run(() => onMerge(from, into, {}), `${from.name} merged into ${into.name}.`);
  }
  async function confirmMerge() {
    const { from, into, answers } = pendingMerge;
    if (await run(() => onMerge(from, into, answers), `${from.name} merged into ${into.name}.`)) setPendingMerge(null);
  }
  const review = possibleDuplicates.length + unlistedLocations.length;
  const close = () => { if (!requireConfirmation || confirmed) onClose?.(); };

  return (
    <div className="prm-overlay" role="dialog" aria-modal="true" aria-label="Project rooms and locations" data-testid="project-room-manager" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <style>{ROOM_MANAGER_CSS}</style>
      <div className="prm-modal">
        <div className="prm-head">
          <div>
            <span className="prm-step">Step 1</span>
            <h3>Confirm project rooms &amp; locations</h3>
            <p>This is the room list for the whole project. Every selection is made against these rooms, so set them up first. A change here applies to Electrical, Lighting, Paint, Flooring, Tiles and the rest, and nothing already selected is lost.</p>
          </div>
          {(!requireConfirmation || confirmed) ? <button type="button" className="prm-close" onClick={close} aria-label="Close" data-testid="room-manager-close">×</button> : null}
        </div>
        {message.state !== "idle" ? <p className={`prm-message ${message.state}`} role="status" data-testid="room-manager-message">{message.text}</p> : null}

        {pendingMerge ? (
          <div className="prm-panel warn" data-testid="room-merge-conflicts">
            <p><strong>{pendingMerge.from.name} and {pendingMerge.into.name} both have these selections.</strong> Say what each one is before the rooms are merged. Nothing is added or removed until you choose.</p>
            <ul className="prm-conflicts">
              {pendingMerge.conflicts.map((conflict) => (
                <li key={conflict.id} data-testid="room-merge-conflict" data-conflict-kind={conflict.kind}>
                  <div><strong>{conflict.requirementLabel}</strong><span>{pendingMerge.from.name}: {conflict.from.product} × {conflict.from.quantity} · {pendingMerge.into.name}: {conflict.to.product} × {conflict.to.quantity}</span></div>
                  <div className="prm-choices">
                    {CONFLICT_CHOICES[conflict.kind].map(([key, label]) => (
                      <label key={key}><input type="radio" name={conflict.id} checked={pendingMerge.answers[conflict.id] === key} onChange={() => setPendingMerge((current) => (current ? { ...current, answers: { ...current.answers, [conflict.id]: key } } : current))} data-testid={`room-merge-answer-${key}`} /> {label}</label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="prm-panelActions">
              <button type="button" className="prm-secondary" onClick={() => setPendingMerge(null)} data-testid="room-merge-conflicts-cancel">Cancel</button>
              <button type="button" className="prm-primary" disabled={busy || pendingMerge.conflicts.some((conflict) => !pendingMerge.answers[conflict.id])} onClick={confirmMerge} data-testid="room-merge-conflicts-confirm">Merge rooms</button>
            </div>
          </div>
        ) : null}

        {!pendingMerge && possibleDuplicates.length ? (
          <div className="prm-review" data-testid="room-possible-duplicates">
            <strong>POSSIBLE DUPLICATE ROOMS — Please confirm whether these are the same location.</strong>
            <ul>
              {possibleDuplicates.map(({ rooms: [left, right], reason }) => (
                <li key={`${left.id}|${right.id}`} data-testid="room-possible-duplicate" data-rooms={`${left.name}|${right.name}`}>
                  <div><b>{left.name}</b> and <b>{right.name}</b><span>{reason}</span></div>
                  <div className="prm-rowActions">
                    <button type="button" className="prm-secondary" disabled={busy} onClick={() => requestMerge(left, right)} data-testid="room-duplicate-merge">Merge into {right.name}</button>
                    <button type="button" className="prm-secondary" disabled={busy} onClick={() => requestMerge(right, left)}>Merge into {left.name}</button>
                    <button type="button" className="prm-secondary" disabled={busy} onClick={() => run(() => onKeepSeparate(left, right), `${left.name} and ${right.name} kept as separate rooms.`)} data-testid="room-duplicate-separate">Keep as separate rooms</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!pendingMerge && unlistedLocations.length ? (
          <div className="prm-review" data-testid="room-unlisted-locations">
            <strong>LOCATIONS USED BY SELECTIONS THAT ARE NOT PROJECT ROOMS</strong>
            <p>Selections were saved against these names. Say which room each one is, or add it as its own room or location. Until then it can show as a second copy of a room.</p>
            <ul>
              {unlistedLocations.map((location) => {
                const target = assignTo[location.id] ?? location.suggestion?.id ?? "";
                return (
                  <li key={location.id} data-testid="room-unlisted-location" data-location={location.name}>
                    <div><b>{location.name}</b><span>Used by: {location.usedBy.join(", ")}{location.suggestion ? ` · Looks like ${location.suggestion.name}` : ""}</span></div>
                    <div className="prm-rowActions">
                      <select aria-label={`Room that ${location.name} is`} value={target} onChange={(event) => setAssignTo({ ...assignTo, [location.id]: event.target.value })} data-testid="room-unlisted-target">
                        <option value="">This is the room…</option>
                        {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                      </select>
                      <button type="button" className="prm-secondary" disabled={busy || !target} onClick={() => requestMerge(location, rooms.find((room) => room.id === target))} data-testid="room-unlisted-assign">Use that room</button>
                      <button type="button" className="prm-secondary" disabled={busy} onClick={() => run(() => onAdd({ name: location.name, level: "", roomType: "" }), `${location.name} added as its own room.`)} data-testid="room-unlisted-add">Add as its own room</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {rooms.length ? (
          <ul className="prm-rooms" data-testid="room-manager-list">
            {rooms.map((room) => {
              const open = action?.id === room.id ? action.kind : "";
              const usage = open === "remove" || open === "merge" ? usageFor(room) : [];
              const same = open || pendingMerge ? null : likelySameRoom(room);
              return (
                <li key={room.id} className={open ? "open" : ""} data-testid="room-manager-room" data-room={room.name} data-room-id={room.id} data-source={room.source}>
                  <div className="prm-row">
                    <div className="prm-rowText">
                      <strong>{room.name}</strong>
                      <span>{[typeLabel(room.roomType), `Source: ${ROOM_SOURCE_LABELS[room.source] || room.source || "Project"}`].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="prm-rowActions">
                      <select aria-label={`Level of ${room.name}`} value={room.level || ""} disabled={busy} onChange={(event) => run(() => onUpdate(room, { level: event.target.value }), `${room.name} set to ${event.target.value || "no level"}.`)} data-testid="room-level">
                        <option value="">Level not set</option>
                        {[...new Set([...levelOptions, room.level].filter(Boolean))].map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                      <button type="button" className="prm-secondary" onClick={() => begin("rename", room)} data-testid="room-rename">Rename</button>
                      {rooms.length > 1 ? <button type="button" className="prm-secondary" onClick={() => begin("merge", room)} data-testid="room-merge">Merge</button> : null}
                      <button type="button" className="prm-secondary danger" onClick={() => begin("remove", room)} data-testid="room-remove">Remove</button>
                    </div>
                  </div>

                  {same ? <p className="prm-suggest" data-testid="room-merge-suggestion">Looks like the same room as {same.name}. <button type="button" className="prm-link" onClick={() => { setAction({ kind: "merge", id: room.id }); setValue(same.id); setMessage({ state: "idle", text: "" }); }} data-testid="room-merge-suggested">Merge into {same.name}</button></p> : null}

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
                      <p>Use this when two names are the same room. {usage.length ? `${room.name} has ${usage.join(", ")} attached: these move to the room you keep. If both rooms hold the same selection you are asked what to do before anything changes.` : `${room.name} has nothing attached yet.`} {room.name} is then removed from the list.</p>
                      <div className="prm-panelActions">
                        <button type="button" className="prm-secondary" onClick={cancel}>Cancel</button>
                        <button type="button" className="prm-primary" disabled={busy || !value} onClick={() => requestMerge(room, rooms.find((other) => other.id === value))} data-testid="room-merge-save">Merge rooms</button>
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
                <datalist id="prm-levels">{levelOptions.map((level) => <option key={level} value={level} />)}</datalist>
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

        {onConfirm ? (
          <div className="prm-confirm" data-testid="room-setup-confirm" data-confirmed={confirmed ? "true" : "false"}>
            <p>{confirmed ? `Rooms confirmed${confirmedAt ? ` on ${new Date(confirmedAt).toLocaleDateString()}` : ""}. You can change them here at any time; existing selections are kept.` : review ? `${review} item${review === 1 ? "" : "s"} above still need${review === 1 ? "s" : ""} your answer. You can confirm now and come back to them.` : "When this is the house, confirm it and start making selections."}</p>
            <button type="button" className="prm-primary" disabled={busy || !rooms.length} onClick={async () => { if (await run(() => onConfirm(), "Project rooms confirmed.")) onClose?.(); }} data-testid="room-setup-confirm-button">{confirmed ? "Confirm rooms again" : `Confirm ${rooms.length} room${rooms.length === 1 ? "" : "s"}`}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ROOM_MANAGER_CSS = `
.prm-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(15, 23, 42, .55); display: grid; place-items: start center; padding: 4vh 16px; overflow-y: auto; }
.prm-modal { width: min(1040px, 100%); background: #fff; border-radius: 16px; padding: 22px 24px 24px; display: grid; gap: 16px; font-size: 16px; color: #0f172a; }
.prm-modal h3, .prm-modal p, .prm-modal ul { margin: 0; }
.prm-modal button, .prm-modal input, .prm-modal select { font-size: 16px; font-family: inherit; }
.prm-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.prm-step { display: inline-block; font-size: 16px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; }
.prm-head h3 { font-size: 24px; font-weight: 900; } .prm-head p { color: #334155; margin-top: 4px; max-width: 72ch; }
.prm-modal .prm-close { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-size: 26px; line-height: 1; cursor: pointer; }
.prm-message { padding: 10px 14px; border-radius: 10px; font-weight: 700; }
.prm-message.saved { background: #dcfce7; color: #14532d; } .prm-message.failed { background: #fee2e2; color: #991b1b; }
.prm-rooms { list-style: none; padding: 0; display: grid; gap: 10px; }
.prm-rooms > li { border: 1px solid #d7deea; border-radius: 12px; padding: 12px 16px; display: grid; gap: 12px; }
.prm-rooms > li.open { border-color: #0f766e; }
.prm-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.prm-rowText { display: grid; gap: 2px; } .prm-rowText strong { font-size: 19px; font-weight: 900; } .prm-rowText span { color: #475569; }
.prm-rowActions, .prm-panelActions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.prm-rowActions select { min-height: 44px; width: auto !important; margin: 0 !important; }
.prm-panelActions { justify-content: flex-end; }
.prm-primary, .prm-secondary { min-height: 44px; padding: 8px 18px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.prm-primary { background: #0f766e; color: #fff; border: 0; } .prm-primary.danger { background: #b91c1c; } .prm-primary:disabled { background: #94a3b8; cursor: default; }
.prm-primary.add { justify-self: start; }
.prm-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; } .prm-secondary.danger { color: #b91c1c; border-color: #fca5a5; } .prm-secondary:disabled { color: #94a3b8; cursor: default; }
.prm-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; }
.prm-panel { border-top: 1px solid #e2e8f0; padding-top: 12px; display: grid; gap: 12px; }
.prm-panel.add { border: 1px solid #0f766e; border-radius: 12px; padding: 16px; }
.prm-panel.warn { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 16px; }
.prm-panel p { color: #334155; } .prm-panel.warn p { color: #78350f; }
.prm-usage { padding-left: 22px; color: #78350f; font-weight: 700; }
.prm-review { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; color: #78350f; }
.prm-review > strong { font-weight: 900; } .prm-review p { color: #78350f; }
.prm-review ul, .prm-conflicts { list-style: none; padding: 0; display: grid; gap: 10px; }
.prm-review li, .prm-conflicts li { background: #fff; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; color: #0f172a; }
.prm-review li > div:first-child, .prm-conflicts li > div:first-child { display: grid; gap: 2px; } .prm-review li span, .prm-conflicts li span { color: #475569; }
.prm-conflicts li { display: grid; justify-content: stretch; }
.prm-choices { display: flex; flex-wrap: wrap; gap: 8px 24px; } .prm-choices label { display: inline-flex; flex-direction: row; gap: 8px; align-items: center; font-weight: 700; cursor: pointer; }
.prm-choices input[type=radio] { width: 20px; height: 20px; flex: none; margin: 0; }
.prm-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } .prm-fields.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.prm-modal label { display: grid; gap: 6px; font-weight: 700; }
.prm-modal label input:not([type="radio"]), .prm-modal label select { min-height: 46px; font-weight: 400; }
.prm-empty { color: #475569; }
.prm-suggest { color: #78350f; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 8px 14px; }
.prm-removed { border-top: 1px solid #e2e8f0; padding-top: 14px; display: grid; gap: 8px; }
.prm-removed ul { list-style: none; padding: 0; display: flex; gap: 10px 22px; flex-wrap: wrap; } .prm-removed li { display: flex; gap: 10px; align-items: center; color: #475569; }
.prm-confirm { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; gap: 14px; align-items: center; flex-wrap: wrap; } .prm-confirm p { color: #334155; max-width: 60ch; }
@media (max-width: 720px) { .prm-fields, .prm-fields.three { grid-template-columns: 1fr; } }
`;
