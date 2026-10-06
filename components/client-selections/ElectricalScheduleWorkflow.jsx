// Client Selections > Electrical. One continuous room-by-room schedule of electrical POINT
// QUANTITIES: the rooms the project actually has (projectLocations.js), a stepper per point type,
// notes, then Save / Next Room. There are no products, brands or prices here - the Quotation
// Builder prices each point from its own electrical rates. The rules live in
// lib/builders/electricalSchedule.js; this component only collects quantities.
// Light fittings and ceiling fans are chosen in Lighting & Ceiling Fans, never here.
// Readable text is never below 16px.
import { useEffect, useMemo, useRef, useState } from "react";
import ProjectRoomManager from "./ProjectRoomManager.jsx";
import { ROOM_LOCATION_OPTIONS } from "../construction-estimation/ai-plan-takeoff/takeoffRunData.js";
import {
  ELECTRICAL_ROOM_STATUS, electricalEstimateCounts, electricalInclusionBaseline, electricalPointsForRoom, electricalQuoteRates,
  electricalRoomQuantities, electricalRoomState, electricalRoomSummary, electricalScheduleProgress, normaliseElectricalSchedule,
} from "../../lib/builders/electricalSchedule.js";

const STATE_LABELS = { complete: "✓ Complete", in_progress: "In progress", not_started: "Not started" };
const clamp = (value) => Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
const ROOM_TYPES = ROOM_LOCATION_OPTIONS.filter((type) => type.key !== "exterior");

// projectRooms: the project's canonical rooms ({ id, name, roomType }). roomManager: the project
// room manager's actions (Manage Rooms edits the project's list, never a list kept here).
export default function ElectricalScheduleWorkflow({ savedSchedule = null, projectRooms = [], roomManager = null, inclusions = {}, workbook = {}, onSave, onBack, backLabel = "← Interior" }) {
  const roomNames = useMemo(() => projectRooms.map((room) => room.name), [projectRooms]);
  const [managingRooms, setManagingRooms] = useState(false);
  const baseline = useMemo(() => electricalInclusionBaseline(inclusions, roomNames), [inclusions, roomNames]);
  const estimate = useMemo(() => electricalEstimateCounts(workbook, roomNames), [workbook, roomNames]);
  const rates = useMemo(() => electricalQuoteRates(workbook?.quotation || {}), [workbook]);
  const [schedule, setSchedule] = useState(() => normaliseElectricalSchedule(savedSchedule, projectRooms, { baseline, estimate }));
  const [activeKey, setActiveKey] = useState("");
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [extraPoints, setExtraPoints] = useState([]);
  const [customLabel, setCustomLabel] = useState("");
  const [saveState, setSaveState] = useState({ state: "idle", message: "" });
  // The job's saved schedule and room list can arrive after this screen opens; adopt them unless
  // there are edits here. Edits made here are already in `schedule` and are laid over new rooms.
  // A room change made in Manage Rooms rewrites the saved schedule (a merge combines two rooms), so
  // the saved schedule is taken again whenever the project's rooms change.
  const edited = useRef(false);
  const roomSignature = projectRooms.map((room) => `${room.id}:${room.name}`).join("|");
  const lastSignature = useRef(roomSignature);
  useEffect(() => {
    const roomsChanged = lastSignature.current !== roomSignature;
    lastSignature.current = roomSignature;
    if (roomsChanged) edited.current = false;
    setSchedule((current) => normaliseElectricalSchedule(edited.current ? current : savedSchedule, projectRooms, { baseline, estimate }));
  }, [savedSchedule, roomSignature, baseline, estimate]); // eslint-disable-line react-hooks/exhaustive-deps

  const rooms = schedule.rooms;
  const listedRooms = rooms.filter((room) => !room.notInProject);
  const progress = electricalScheduleProgress(schedule);
  const activeIndex = listedRooms.findIndex((room) => room.roomId === activeKey);
  const scheduledTotals = useMemo(() => {
    const totals = {};
    rooms.forEach((room) => Object.entries(electricalRoomQuantities(room)).forEach(([key, value]) => { totals[key] = (totals[key] || 0) + value; }));
    return totals;
  }, [rooms]);

  function openRoom(roomKey) {
    const room = rooms.find((item) => item.roomId === roomKey);
    if (!room) return;
    setActiveKey(roomKey);
    setDraft({ ...room, points: { ...room.points }, custom: room.custom.map((item) => ({ ...item })) });
    setDirty(false);
    setExtraPoints([]);
    setCustomLabel("");
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
  }

  function closeRoom() {
    setActiveKey("");
    setDraft(null);
    setDirty(false);
  }

  async function commitRoom(room, message) {
    edited.current = true;
    const next = { ...schedule, rooms: rooms.map((item) => (item.roomId === room.roomId ? { ...room, prefilled: false } : item)) };
    setSchedule(next);
    setSaveState({ state: "saving", message: "Saving…" });
    let ok = false;
    try { ok = Boolean(await onSave?.(next)); } catch { ok = false; }
    setSaveState(ok ? { state: "saved", message } : { state: "failed", message: "This change is on screen but could not be saved to the job." });
    return ok;
  }

  const change = (patch) => { setDraft((current) => ({ ...current, ...patch })); setDirty(true); };
  const setPoint = (key, value) => change({ points: { ...draft.points, [key]: clamp(value) } });
  const setCustom = (id, value) => change({ custom: draft.custom.map((item) => (item.id === id ? { ...item, quantity: clamp(value) } : item)) });
  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    change({ custom: [...draft.custom, { id: `custom-${Date.now().toString(36)}`, label, quantity: 1 }] });
    setCustomLabel("");
  };

  // SAVE / NEXT ROOM: the room's quantities are confirmed and the next room opens. The save runs
  // behind the screen; it never navigates anywhere itself.
  function saveAndNext() {
    const confirmed = { ...draft, status: ELECTRICAL_ROOM_STATUS.confirmed, confirmedAt: new Date().toISOString() };
    const nextRoom = listedRooms[activeIndex + 1];
    commitRoom(confirmed, `${confirmed.room} confirmed.`);
    if (nextRoom) openRoom(nextRoom.roomId); else closeRoom();
  }

  function useStandard() {
    const standard = { ...draft, points: { ...draft.included }, custom: [], status: ELECTRICAL_ROOM_STATUS.standard, confirmedAt: new Date().toISOString() };
    const nextRoom = listedRooms[activeIndex + 1];
    commitRoom(standard, `${standard.room}: ${Object.keys(standard.included).length ? "standard inclusion" : "no additional electrical changes"}.`);
    if (nextRoom) openRoom(nextRoom.roomId); else closeRoom();
  }

  // Leaving a room part-way keeps what was entered, as a room still in progress.
  function leaveRoom(targetKey = "") {
    if (dirty && draft) commitRoom({ ...draft, status: ELECTRICAL_ROOM_STATUS.draft, confirmedAt: "" }, `${draft.room} saved as in progress.`);
    if (targetKey) openRoom(targetKey); else closeRoom();
  }

  const status = (
    <div className="esw-headerStatus">
      <span className={`esw-pill ${progress.allComplete ? "done" : ""}`} data-testid="electrical-progress">{progress.total ? `${progress.complete} of ${progress.total} rooms complete` : "No rooms recorded"}</span>
      {saveState.state !== "idle" ? <span className={`esw-save ${saveState.state}`} role="status" data-testid="electrical-save-state">{saveState.message}</span> : null}
    </div>
  );

  if (draft) {
    const { shown, more } = electricalPointsForRoom(draft, { rates });
    const visible = [...shown, ...more.filter((type) => extraPoints.includes(type.key) || draft.points[type.key] > 0)];
    const hidden = more.filter((type) => !visible.includes(type));
    const hasIncluded = Object.keys(draft.included || {}).length > 0;
    const previousRoom = listedRooms[activeIndex - 1];
    const isLast = activeIndex === listedRooms.length - 1;
    return (
      <section className="esw-shell" data-testid="electrical-room-editor" data-room={draft.room}>
        <style>{ELECTRICAL_CSS}</style>
        <header className="esw-header">
          <div>
            <button type="button" className="esw-link" onClick={() => leaveRoom()} data-testid="electrical-all-rooms">← All rooms</button>
            <span className="esw-eyebrow">Electrical{activeIndex >= 0 ? ` · Room ${activeIndex + 1} of ${listedRooms.length}` : ""}</span>
            <h2 data-testid="electrical-room-name">{draft.room}</h2>
            <p>Enter how many of each electrical point this room needs.</p>
          </div>
          {status}
        </header>

        <section className="esw-block">
          <div className="esw-points">
            {visible.map((type) => {
              const value = draft.points[type.key] || 0;
              const included = draft.included?.[type.key] || 0;
              return (
                <div key={type.key} className={`esw-point ${value ? "active" : ""}`} data-testid={`electrical-point-${type.key}`}>
                  <div className="esw-pointLabel">
                    <strong>{type.label}</strong>
                    {included ? <span data-testid={`electrical-included-${type.key}`}>Included: {included}{value !== included ? ` · ${value > included ? `${value - included} extra` : `${included - value} fewer`}` : ""}</span> : null}
                  </div>
                  <Stepper label={`${type.label} in ${draft.room}`} value={value} onChange={(next) => setPoint(type.key, next)} testId={`electrical-qty-${type.key}`} />
                </div>
              );
            })}
            {draft.custom.map((item) => (
              <div key={item.id} className={`esw-point ${item.quantity ? "active" : ""}`} data-testid="electrical-custom-point">
                <div className="esw-pointLabel">
                  <strong>{item.label}</strong>
                  <button type="button" className="esw-link danger" onClick={() => change({ custom: draft.custom.filter((entry) => entry.id !== item.id) })}>Remove</button>
                </div>
                <Stepper label={`${item.label} in ${draft.room}`} value={item.quantity} onChange={(next) => setCustom(item.id, next)} />
              </div>
            ))}
          </div>

          <div className="esw-add">
            {hidden.length ? (
              <label><span>Add another point</span>
                <select value="" onChange={(event) => { if (event.target.value) setExtraPoints((current) => [...current, event.target.value]); }} data-testid="electrical-add-point">
                  <option value="">Choose a point type…</option>
                  {hidden.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                </select>
              </label>
            ) : null}
            <label><span>Other / custom electrical point</span>
              <div className="esw-customRow">
                <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} placeholder="e.g. Spa power, wine fridge point" data-testid="electrical-custom-label" />
                <button type="button" className="esw-secondary" onClick={addCustom} disabled={!customLabel.trim()} data-testid="electrical-custom-add">Add</button>
              </div>
            </label>
          </div>

          <label className="esw-notes"><span>Notes</span>
            <textarea rows={3} value={draft.notes} onChange={(event) => change({ notes: event.target.value })} placeholder="Heights, positions or anything the electrician should know" data-testid="electrical-notes" />
          </label>
        </section>

        <footer className="esw-actions">
          <div className="esw-actionsLeft">
            {previousRoom ? <button type="button" className="esw-secondary" onClick={() => leaveRoom(previousRoom.roomId)} data-testid="electrical-previous-room">← {previousRoom.room}</button> : null}
            <button type="button" className="esw-secondary" onClick={useStandard} data-testid="electrical-use-standard">{hasIncluded ? "Use standard inclusion" : "No additional electrical changes"}</button>
          </div>
          <button type="button" className="esw-primary large" onClick={saveAndNext} data-testid="electrical-save-next">{isLast || activeIndex < 0 ? "Save / Finish" : `Save / Next room: ${listedRooms[activeIndex + 1].room} →`}</button>
        </footer>
      </section>
    );
  }

  const nextRoom = listedRooms.find((room) => electricalRoomState(room) !== "complete");
  return (
    <section className="esw-shell" data-testid="electrical-schedule" data-complete={progress.allComplete ? "true" : "false"}>
      <style>{ELECTRICAL_CSS}</style>
      <header className="esw-header">
        <div>
          {onBack ? <button type="button" className="esw-link" onClick={onBack} data-testid="electrical-back">{backLabel}</button> : null}
          <h2>Electrical</h2>
          <p>Go through each room and enter how many power, data, TV and appliance points it needs. Light fittings and ceiling fans are chosen in Lighting &amp; Ceiling Fans.</p>
        </div>
        {status}
      </header>

      {baseline.fromInclusions ? (
        <aside className="esw-included" data-testid="electrical-included">
          <strong>Included in your home</strong>
          <ul>{baseline.lines.map((line) => <li key={line}>{line}</li>)}</ul>
          <p>{Object.keys(baseline.byRoom).length ? "Each room starts from its included quantities. Anything above them is a variation." : "A room that needs nothing beyond the standard can be marked as using the standard inclusion."}</p>
        </aside>
      ) : null}

      {estimate.house.length ? (
        <aside className="esw-estimate" data-testid="electrical-estimate">
          <strong>Already in the estimate for the whole house</strong>
          <ul>{estimate.house.map((item) => <li key={item.pointKey} data-testid={`electrical-estimate-${item.pointKey}`}>{item.quantity} × {item.label} <span>· {scheduledTotals[item.pointKey] || 0} scheduled to rooms so far</span></li>)}</ul>
          <p>The estimate does not say which rooms these are in. Enter them in the rooms they belong to.</p>
        </aside>
      ) : null}

      <section className="esw-block">
        <div className="esw-blockHead">
          <h3>Rooms</h3>
          <div className="esw-blockActions">
          {roomManager ? <button type="button" className="esw-secondary" onClick={() => setManagingRooms(true)} data-testid="electrical-manage-rooms">Manage rooms</button> : null}
          {nextRoom ? <button type="button" className="esw-primary" onClick={() => openRoom(nextRoom.roomId)} data-testid="electrical-continue">{progress.started ? `Continue: ${nextRoom.room} →` : `Start with ${nextRoom.room} →`}</button> : null}
          </div>
        </div>
        {rooms.length ? (
          <ul className="esw-rooms" data-testid="electrical-room-list">
            {rooms.map((room) => {
              const state = electricalRoomState(room);
              const summary = electricalRoomSummary(room);
              const standard = room.status === ELECTRICAL_ROOM_STATUS.standard;
              return (
                <li key={room.roomId} className={state} data-testid="electrical-room" data-room={room.room} data-state={state}>
                  <div className="esw-roomText">
                    <strong>{room.room}</strong>
                    {room.notInProject ? <span className="esw-warn">Not in the project&apos;s current room list</span> : null}
                    {standard ? <span>{summary.length ? `Standard inclusion: ${summary.join(" · ")}` : "No additional electrical changes"}</span>
                      : summary.length ? summary.map((line) => <span key={line}>{line}</span>) : <span className="esw-muted">No points entered yet</span>}
                    {room.custom.filter((item) => item.quantity && !standard).map((item) => <span key={item.id} className="esw-muted">{item.quantity} × {item.label}</span>)}
                    {room.notes ? <span className="esw-muted">Note: {room.notes}</span> : null}
                  </div>
                  <div className="esw-roomSide">
                    <span className={`esw-tag ${state}`}>{STATE_LABELS[state]}</span>
                    <button type="button" className="esw-secondary" onClick={() => openRoom(room.roomId)} data-testid="electrical-room-edit">Edit</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="esw-muted">This project has no rooms recorded yet. Use Manage rooms to add the rooms the house has, or read them from the plans in AI Plan Takeoff.</p>}
      </section>
      {managingRooms && roomManager ? <ProjectRoomManager rooms={projectRooms} roomTypes={ROOM_TYPES} {...roomManager} onClose={() => setManagingRooms(false)} /> : null}
    </section>
  );
}

function Stepper({ label, value, onChange, testId }) {
  return (
    <div className="esw-stepper">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)} disabled={!value} data-testid={testId ? `${testId}-minus` : undefined}>−</button>
      <input type="number" inputMode="numeric" min="0" max="99" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} data-testid={testId ? `${testId}-plus` : undefined}>+</button>
    </div>
  );
}

const ELECTRICAL_CSS = `
.esw-shell { display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.esw-shell button, .esw-shell input, .esw-shell select, .esw-shell textarea { font-size: 16px; font-family: inherit; }
.esw-shell input, .esw-shell select, .esw-shell textarea { background: #fff; color: #0f172a; }
.esw-shell h2, .esw-shell h3, .esw-shell p, .esw-shell ul { margin: 0; }
.esw-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; }
.esw-header > div:first-child { display: grid; gap: 4px; justify-items: start; }
.esw-header h2 { font-size: 28px; font-weight: 900; }
.esw-header p { font-size: 17px; color: #334155; max-width: 66ch; }
.esw-eyebrow { font-size: 16px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
.esw-headerStatus { display: grid; gap: 8px; justify-items: end; }
.esw-pill { display: inline-block; padding: 8px 16px; border-radius: 999px; background: #fef3c7; color: #78350f; font-weight: 800; }
.esw-pill.done { background: #dcfce7; color: #14532d; }
.esw-save { color: #475569; } .esw-save.saved { color: #166534; } .esw-save.failed { color: #b91c1c; font-weight: 700; }
.esw-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; }
.esw-link.danger { color: #b91c1c; }
.esw-primary, .esw-secondary { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.esw-primary { background: #0f766e; color: #fff; border: 0; }
.esw-primary.large { min-height: 56px; padding: 12px 28px; font-size: 18px; }
.esw-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.esw-secondary:disabled { color: #94a3b8; cursor: default; }
.esw-included, .esw-estimate { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 12px; padding: 16px 22px; display: grid; gap: 6px; }
.esw-estimate { border-color: #e2e8f0; background: #f8fafc; }
.esw-included strong, .esw-estimate strong { font-size: 18px; }
.esw-included ul, .esw-estimate ul { padding-left: 20px; }
.esw-included p { color: #1e3a8a; font-weight: 700; } .esw-estimate p, .esw-estimate li span { color: #475569; }
.esw-block { border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; display: grid; gap: 18px; }
.esw-block h3 { font-size: 22px; font-weight: 900; }
.esw-blockActions { display: flex; gap: 12px; flex-wrap: wrap; }
.esw-blockHead { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.esw-rooms { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.esw-rooms li { border: 1px solid #d7deea; border-radius: 12px; padding: 16px 18px; display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
.esw-rooms li.complete { border-color: #0f766e; box-shadow: 0 0 0 1px #0f766e; }
.esw-roomText { display: grid; gap: 3px; } .esw-roomText strong { font-size: 20px; font-weight: 900; } .esw-roomText span { color: #334155; }
.esw-roomSide { display: grid; gap: 10px; justify-items: end; flex: 0 0 auto; }
.esw-muted, .esw-roomText .esw-muted { color: #64748b; }
.esw-warn, .esw-roomText .esw-warn { color: #b45309; font-weight: 700; }
.esw-tag { padding: 4px 12px; border-radius: 999px; font-weight: 800; background: #e2e8f0; color: #334155; white-space: nowrap; }
.esw-tag.complete { background: #dcfce7; color: #14532d; } .esw-tag.in_progress { background: #fef3c7; color: #78350f; }
.esw-points { display: grid; gap: 10px; }
.esw-point { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; }
.esw-point.active { border-color: #0f766e; background: #f0fdfa; }
.esw-pointLabel { display: grid; gap: 2px; justify-items: start; } .esw-pointLabel strong { font-size: 19px; } .esw-pointLabel span { color: #334155; }
.esw-stepper { display: flex; align-items: center; gap: 8px; }
.esw-stepper button { width: 52px; height: 52px; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-size: 26px; font-weight: 800; line-height: 1; cursor: pointer; }
.esw-stepper button:disabled { color: #cbd5e1; cursor: default; }
.esw-stepper input { width: 76px; height: 52px; border-radius: 10px; border: 1px solid #94a3b8; text-align: center; font-size: 22px; font-weight: 900; }
.esw-add { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.esw-add label, .esw-notes { display: grid; gap: 6px; font-weight: 700; }
.esw-add select, .esw-add input, .esw-notes textarea { min-height: 46px; padding: 10px 12px; border-radius: 10px; border: 1px solid #94a3b8; font-weight: 400; }
.esw-customRow { display: flex; gap: 10px; } .esw-customRow input { flex: 1 1 auto; min-width: 0; }
.esw-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 18px 22px; }
.esw-actionsLeft { display: flex; gap: 12px; flex-wrap: wrap; }
@media (max-width: 640px) { .esw-headerStatus { justify-items: start; } .esw-point { align-items: flex-start; } }
`;
