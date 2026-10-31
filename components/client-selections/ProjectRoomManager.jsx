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
import { BUILDING_LEVEL_LABELS, groupRoomsByLevel } from "../../lib/builders/buildingLevels.js";

const CONFLICT_CHOICES = {
  "same-product": [["same", "It is the same item (keep one)"], ["both", "They are two separate items (keep both)"]],
  "different-product": [["both", "Keep both products in this room"], ["keep-target", "Keep only the product already in the room"]],
};
const isBareEnsuite = (name) => /^(?:en\s*[- ]?suite)$/i.test(String(name || "").trim());
const isNumberedEnsuite = (name) => /\bensuite\b/i.test(name) && (/\b(?:b|bed|bedroom)\s*2\b/i.test(name) || /\b(?:2nd|second)\s+bedroom\b/i.test(name));
const distinctEnsuiteRooms = (left, right) => (isBareEnsuite(left) && isNumberedEnsuite(right)) || (isBareEnsuite(right) && isNumberedEnsuite(left));

export default function ProjectRoomManager({ rooms = [], removed = [], levels = [], roomTypes = [], usageFor = () => [], possibleDuplicates = [], unlistedLocations = [], conflictsFor = () => [], confirmed = false, confirmedAt = "", requireConfirmation = false,
  onAdd, onRename, onUpdate, onRemove, onMerge, onAssignSelection, onRemoveFloorDuplicate, onKeepFloorUnallocated, onRestore, onKeepSeparate, onConfirm, onClose }) {
  const [action, setAction] = useState(null); // { kind: "rename" | "merge" | "remove", id }
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", level: "", roomType: "" });
  const [message, setMessage] = useState({ state: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  // A merge that collides on a selection waits here for the builder's answer to each collision.
  const [pendingMerge, setPendingMerge] = useState(null); // { from, into, conflicts, answers }
  const [assignTo, setAssignTo] = useState({}); // unlisted location id -> room id
  const [assignQuantity, setAssignQuantity] = useState({}); // saved allocation detail -> quantity
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
    && !distinctEnsuiteRooms(room.name, other.name)
    && !(room.levelId && other.levelId && room.levelId !== other.levelId)
    && !possibleDuplicates.some((pair) => pair.rooms.some((item) => item.id === room.id))) || null;
  // The floors a room can be set to. A level label from an older job is shown only on the room that holds it.
  const levelOptions = BUILDING_LEVEL_LABELS;
  const needFloor = rooms.filter((room) => room.levelReview);
  const fromPlans = rooms.filter((room) => room.levelSource === "takeoff-sheet").length;
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
        {rooms.length ? (
          <p className={`prm-floors ${needFloor.length ? "warn" : ""}`} data-testid="room-floor-summary" data-from-plans={fromPlans} data-need-review={needFloor.length}>
            {fromPlans ? `${fromPlans} room${fromPlans === 1 ? "" : "s"} placed on their floor automatically from the plan sheets. ` : ""}{needFloor.length ? `${needFloor.length} room${needFloor.length === 1 ? "" : "s"} need${needFloor.length === 1 ? "s" : ""} a floor chosen - only ${needFloor.length === 1 ? "that room is" : "those rooms are"} marked below.` : "Every room has a floor."}
          </p>
        ) : null}

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
            {unlistedLocations.some((location) => location.floorAllocation) ? (
              <div className="prm-reviewHeading" data-testid="room-floor-allocation-review">
                <strong>HISTORICAL FLOOR-LEVEL ALLOCATIONS AWAITING RECONCILIATION</strong>
                <p>These are saved selection allocations, not rooms. Ground Floor and Upper Floor never appear in the project room list, and this review does not block confirmation of the actual rooms.</p>
              </div>
            ) : null}
            {unlistedLocations.some((location) => !location.floorAllocation) ? (
              <div className="prm-reviewHeading">
                <strong>OTHER SAVED LOCATIONS THAT ARE NOT PROJECT ROOMS</strong>
                <p>Say which room each location is, or add it as its own applicable location. Nothing is reassigned automatically.</p>
              </div>
            ) : null}
            <ul>
              {unlistedLocations.map((location) => {
                const target = assignTo[location.id] ?? location.suggestion?.id ?? "";
                const targetRooms = location.levelId ? rooms.filter((room) => room.levelId === location.levelId) : rooms;
                if (location.floorAllocation) {
                  return (
                    <li key={location.id} data-testid="room-unlisted-location" data-location={location.name}>
                      <div><b>{location.name}</b><span>{(location.legacyNames || []).join(" / ")} is a floor label, not a room. Assign each saved selection to a real {location.name} room.</span></div>
                      {(location.details || []).map((detail) => {
                        const detailKey = `${location.id}|${detail.requirementKey}|${detail.lineId}|${detail.productId}`;
                        const detailTarget = assignTo[detailKey] || "";
                        const quantity = Math.min(detail.quantity, Math.max(1, Number(assignQuantity[detailKey]) || 1));
                        const targetRoom = rooms.find((room) => room.id === detailTarget);
                        return (
                          <div className="prm-allocationAssignment" key={detailKey} data-testid="room-floor-allocation">
                            <div><strong>{detail.productName}</strong> × {detail.quantity}{detail.unitPrice === null ? " · Quote Required" : ` · $${Number(detail.unitPrice).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${detail.priceIncludesGst === true ? " inc GST" : detail.priceIncludesGst === false ? " ex GST" : " · GST basis unconfirmed"}`}</div>
                            <div className={`prm-duplicateEvidence ${detail.duplicateProven ? "proven" : "review"}`} data-testid="room-floor-duplicate-evidence" data-proven={detail.duplicateProven ? "true" : "false"}>
                              <strong>{detail.duplicateProven ? "Duplicate summary verified by stable product identity and quantity." : "This floor summary cannot be proven as a duplicate automatically."}</strong>
                              {detail.roomEvidence?.length ? (
                                <ul>{detail.roomEvidence.map((item) => <li key={`${item.roomId}|${item.lineId}|${item.productId}`}>{item.roomName}: {item.productName} × {item.quantity}{item.sameStableProduct ? " · same stable product" : " · different stable product"}</li>)}</ul>
                              ) : <span>No saved room-level fan allocation was found on this floor.</span>}
                            </div>
                            <div className="prm-floorChoices">
                              <button type="button" className="prm-secondary" disabled={busy} onClick={() => run(
                                () => onKeepFloorUnallocated(location, detail),
                                `${detail.quantity} × ${detail.productName} kept as additional unallocated fans for ${location.name}.`,
                              )} data-testid="room-floor-keep-unallocated">Keep as additional unallocated fans</button>
                              <button type="button" className="prm-secondary danger" disabled={busy} onClick={() => run(
                                () => onRemoveFloorDuplicate(location, detail),
                                `${detail.quantity} redundant floor-level ${detail.productName} removed. Existing room fans were preserved.`,
                              )} data-testid="room-floor-confirm-duplicate">Confirm duplicates and remove floor allocation</button>
                            </div>
                            <span>Or assign some or all of these as additional fans to a room:</span>
                            <div className="prm-rowActions">
                              <select aria-label={`Room for ${detail.productName} from ${location.name}`} value={detailTarget} onChange={(event) => setAssignTo({ ...assignTo, [detailKey]: event.target.value })} data-testid="room-floor-target">
                                <option value="">Choose the actual room…</option>
                                {targetRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                              </select>
                              <input type="number" min="1" max={detail.quantity} value={quantity} aria-label={`Quantity of ${detail.productName} to assign`} onChange={(event) => setAssignQuantity({ ...assignQuantity, [detailKey]: event.target.value })} data-testid="room-floor-quantity" />
                              <button type="button" className="prm-secondary" disabled={busy || !detailTarget} onClick={() => run(
                                () => onAssignSelection(location, targetRoom, detail, quantity),
                                `${quantity} × ${detail.productName} assigned.`,
                              )} data-testid="room-floor-assign">Assign quantity</button>
                            </div>
                          </div>
                        );
                      })}
                    </li>
                  );
                }
                return (
                  <li key={location.id} data-testid="room-unlisted-location" data-location={location.name}>
                    <div><b>{location.name}</b><span>{location.floorAllocation ? `${(location.legacyNames || []).join(" / ")} is a floor label, not a room. Assign each saved selection to a real ${location.name} room.` : `Used by: ${location.usedBy.join(", ")}${location.suggestion ? ` · Looks like ${location.suggestion.name}` : ""}`}</span>
                      {location.details?.length ? <ul className="prm-allocationDetails" data-testid="room-unlisted-details">{location.details.map((detail) => <li key={`${detail.lineId}|${detail.productId}`}><strong>{detail.productName}</strong> × {detail.quantity}{detail.unitPrice === null ? " · Quote Required" : ` · $${Number(detail.unitPrice).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${detail.priceIncludesGst === true ? " inc GST" : detail.priceIncludesGst === false ? " ex GST" : " · GST basis unconfirmed"}`}</li>)}</ul> : null}
                    </div>
                    <div className="prm-rowActions">
                      <select aria-label={`Room that ${location.name} is`} value={target} onChange={(event) => setAssignTo({ ...assignTo, [location.id]: event.target.value })} data-testid="room-unlisted-target">
                        <option value="">This is the room…</option>
                        {targetRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                      </select>
                      <button type="button" className="prm-secondary" disabled={busy || !target} onClick={() => requestMerge(location, rooms.find((room) => room.id === target))} data-testid="room-unlisted-assign">Use that room</button>
                      {!location.floorAllocation ? <button type="button" className="prm-secondary" disabled={busy} onClick={() => run(() => onAdd({ name: location.name, level: "", roomType: "" }), `${location.name} added as its own room.`)} data-testid="room-unlisted-add">Add as its own room</button> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {rooms.length ? (
          <div className="prm-groups" data-testid="room-manager-list">
            {groupRoomsByLevel(rooms).map((group) => (
            <section key={group.levelId || "unset"} className="prm-group" data-testid="room-level-group" data-level={group.levelId || "unset"}>
            <h4>{group.level} <span>{group.rooms.length} room{group.rooms.length === 1 ? "" : "s"}</span></h4>
          <ul className="prm-rooms">
            {group.rooms.map((room) => {
              const open = action?.id === room.id ? action.kind : "";
              const usage = open === "remove" || open === "merge" ? usageFor(room) : [];
              const same = open || pendingMerge ? null : likelySameRoom(room);
              return (
                <li key={room.id} className={`${open ? "open" : ""} ${room.levelReview ? "needs-floor" : ""}`.trim()} data-testid="room-manager-room" data-room={room.name} data-room-id={room.id} data-source={room.source} data-level={room.levelId || ""} data-level-source={room.levelSource || ""}>
                  <div className="prm-row">
                    <div className="prm-rowText">
                      <strong>{room.name}</strong>
                      <span>{[typeLabel(room.roomType), `Source: ${ROOM_SOURCE_LABELS[room.source] || room.source || "Project"}`, room.levelSource === "takeoff-sheet" ? `Floor from plan sheet ${(room.levelSheets || []).join(", ")}` : ""].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="prm-rowActions">
                      <select aria-label={`Floor of ${room.name}`} value={room.level || ""} disabled={busy} onChange={(event) => run(() => onUpdate(room, { level: event.target.value }), `${room.name} set to ${event.target.value || "no floor"}.`)} data-testid="room-level">
                        <option value="">Choose floor…</option>
                        {[...new Set([...levelOptions, room.level].filter(Boolean))].map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                      <button type="button" className="prm-secondary" onClick={() => begin("rename", room)} data-testid="room-rename">Rename</button>
                      {rooms.length > 1 ? <button type="button" className="prm-secondary" onClick={() => begin("merge", room)} data-testid="room-merge">Merge</button> : null}
                      <button type="button" className="prm-secondary danger" onClick={() => begin("remove", room)} data-testid="room-remove">Remove</button>
                    </div>
                  </div>
                  {room.levelReview ? <p className="prm-floorReview" data-testid="room-level-review"><strong>Needs a floor.</strong> {room.levelReview}</p> : null}
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
                          {rooms.filter((other) => other.id !== room.id).map((other) => { const otherFloor = room.levelId && other.levelId && room.levelId !== other.levelId; return <option key={other.id} value={other.id} disabled={otherFloor}>{other.name}{other.level ? ` (${other.level})` : ""}{otherFloor ? " - different floor" : ""}</option>; })}
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
            </section>
            ))}
          </div>
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
.prm-groups { display: grid; gap: 18px; } .prm-group { display: grid; gap: 8px; }
.prm-group > h4 { margin: 0; font-size: 20px; font-weight: 900; color: #0f766e; display: flex; gap: 10px; align-items: baseline; } .prm-group > h4 span { font-size: 16px; font-weight: 700; color: #475569; }
.prm-floors { background: #ecfdf5; border: 1px solid #99f6e4; border-radius: 10px; padding: 10px 14px; color: #134e4a; font-weight: 700; } .prm-floors.warn { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
.prm-floorReview { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 8px 14px; color: #78350f; }
.prm-rooms > li.needs-floor { border-color: #f59e0b; }
.prm-rooms > li { border: 1px solid #d7deea; border-radius: 12px; padding: 12px 16px; display: grid; gap: 12px; }
.prm-rooms > li.open { border-color: #0f766e; }
.prm-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.prm-rowText { display: grid; gap: 2px; } .prm-rowText strong { font-size: 19px; font-weight: 900; } .prm-rowText span { color: #475569; }
.prm-rowActions, .prm-panelActions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.prm-allocationDetails { margin-top: 8px !important; padding-left: 20px; color: #334155; }
.prm-allocationAssignment { display: grid; gap: 8px; margin-top: 10px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
.prm-allocationAssignment input { width: 88px; min-height: 46px; padding: 8px 10px; border: 1px solid #94a3b8; border-radius: 8px; }
.prm-duplicateEvidence { display: grid; gap: 6px; padding: 10px 12px; border-radius: 8px; border: 1px solid #f59e0b; background: #fffbeb; color: #78350f; }
.prm-duplicateEvidence.proven { border-color: #22c55e; background: #f0fdf4; color: #14532d; }
.prm-duplicateEvidence ul { margin: 0; padding-left: 20px; }
.prm-floorChoices { display: flex; gap: 10px; flex-wrap: wrap; }
.prm-secondary.danger { border-color: #dc2626; color: #991b1b; }
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
