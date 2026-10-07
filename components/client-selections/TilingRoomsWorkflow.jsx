// Tiles & Stone - room-by-room tiling specification and quantities (Client Selections).
// Rooms -> tiling specification -> dimensions -> components -> openings -> calculated areas ->
// tiles (Product Library) -> floor wastes -> review. All quantities come from tilingCalculations.js;
// this component only collects the inputs. Readable text is never below 16px.
// Every linear dimension is entered and shown in millimetres; areas are m², perimeter is metres.
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateTilingRoom, formatLm, formatM2, formatMm, isFloorAreaRoom, roomIsExternal, roomFloorTiled, roomGeometry, STANDARD_BATH_SPLASHBACK_HEIGHT_MM, TILING_ROOM_TYPES, TILING_SPECS, tilingRoomInMm, tilingRoomStatus, tilingRoomType } from "../../lib/builders/tilingCalculations.js";
import { addTilingRoom, applyFloorTile, newFloorArea, renameFloorArea, takeoffExternalRoomsToAdd, tilingRoomFromTakeoff, applyTilingScheme, roomHasTileScheme, setTilingSchemeDefault, suggestedTilingRooms, TILING_PATTERNS, TILING_SLOTS, tilingProductTotals, tilingSchemeDefaultRoom, tilingSchemePreview, tilingSchemeTargets } from "../../lib/builders/tilingRooms.js";
import { takeoffOpeningsForRoom } from "../../lib/builders/tilingTakeoff.js";

const money = (value) => (value === null || value === undefined || value === "" ? "Price required" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(value)));
const num = (value) => (value === "" || value === null || value === undefined ? "" : value);
const unitPrice = (product) => { const value = Number(product?.clientPrice ?? product?.rrp); return Number.isFinite(value) && value > 0 ? value : null; };
const STATUS_LABELS = { complete: "✓ Complete", incomplete: "In progress", not_started: "Not started" };
const SPEC_LABELS = { [TILING_SPECS.standard]: "Standard tiling", [TILING_SPECS.floorToCeiling]: "Floor to ceiling" };

function stepsFor(room) {
  const type = tilingRoomType(room.type);
  const steps = type.spec
    ? [["spec", "Tiling specification & dimensions"], ["components", "Shower, bath, vanity & feature"], ["openings", "Doors & windows"]]
    : [["dimensions", "Dimensions"], ...(type.surfaces?.includes("skirting") ? [["openings", "Doors & windows"]] : [])];
  return [...steps, ["tiles", "Tiles"], ...(type.wet ? [["wastes", "Floor wastes & drains"]] : []), ["review", "Review & confirm"]];
}

export default function TilingRoomsWorkflow({ savedRooms = [], legacySelections = [], projectRoomNames = [], takeoff = {}, tileProducts = [], floorWasteProducts = [], productById = () => null, saving = false, onSave, onBack, backLabel = "← Interior", budgetDock = null }) {
  // Rooms saved before dimensions were in millimetres are converted as they are read.
  const [rooms, setRooms] = useState(() => (savedRooms.length ? savedRooms : suggestedTilingRooms(projectRoomNames)).map(tilingRoomInMm));
  const [open, setOpen] = useState(null); // { roomId, step }
  const [adding, setAdding] = useState(false);
  const [pickingFloorArea, setPickingFloorArea] = useState("");
  const [dirty, setDirty] = useState(!savedRooms.length && rooms.length > 0);
  const room = open ? rooms.find((item) => item.id === open.roomId) : null;
  // The job's saved rooms can arrive after this screen opens (the book loads asynchronously); adopt
  // them unless there are unsaved edits here.
  const lastSaved = useRef(savedRooms);
  useEffect(() => {
    if (savedRooms === lastSaved.current) return;
    lastSaved.current = savedRooms;
    if (!dirty && savedRooms.length) setRooms(savedRooms.map(tilingRoomInMm));
  }, [savedRooms, dirty]);

  const updateRoom = (roomId, patch) => {
    setRooms((current) => current.map((item) => (item.id === roomId ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) } : item)));
    setDirty(true);
  };
  const save = async (nextRooms = rooms) => { await onSave?.(nextRooms); setDirty(false); };
  // A tile scheme applied from one room changes other rooms in the same step.
  const replaceRooms = (nextRooms) => { setRooms(nextRooms); setDirty(true); };
  // Confirm room: recorded on the room, then saved. Whether that makes it COMPLETE is decided by
  // tilingRoomStatus from the surfaces that apply to it.
  const confirmRoom = async (roomId) => {
    const nextRooms = rooms.map((item) => (item.id === roomId ? { ...item, confirmed: true, confirmedAt: new Date().toISOString() } : item));
    setRooms(nextRooms);
    await save(nextRooms);
  };
  // Full rooms (bathroom, ensuite, laundry, kitchen ...) take the room workflow; simple floor-only
  // areas are rows under Additional Floor Tiling. One record each - never listed in both.
  const fullRooms = rooms.filter((item) => !isFloorAreaRoom(item));
  const completeCount = fullRooms.filter((item) => tilingRoomStatus(item, { productById }).status === "complete").length;
  const floorAreaPicking = pickingFloorArea ? rooms.find((item) => item.id === pickingFloorArea) : null;

  if (floorAreaPicking) {
    return (
      <section className="tl-shell" data-testid="tiling-floor-area-picker" data-room-id={floorAreaPicking.id}>
        <style>{CSS}</style>
        {budgetDock}
        <TilePicker slot={{ slot: "floor", label: `${floorAreaPicking.name} tile`, application: "floor" }} external={roomIsExternal(floorAreaPicking)} products={tileProducts} selectedId={floorAreaPicking.products?.floor}
          onCancel={() => setPickingFloorArea("")} onChoose={(id) => { updateRoom(floorAreaPicking.id, (current) => ({ products: { ...current.products, floor: id } })); setPickingFloorArea(""); }} />
      </section>
    );
  }
  if (room && !isFloorAreaRoom(room)) {
    return <RoomEditor room={room} rooms={rooms} onRooms={replaceRooms} step={open.step} takeoff={takeoff} tileProducts={tileProducts} floorWasteProducts={floorWasteProducts} productById={productById} saving={saving} dirty={dirty}
      onStep={(step) => setOpen({ roomId: room.id, step })} onChange={(patch) => updateRoom(room.id, patch)}
      onSave={() => save()} onConfirm={() => confirmRoom(room.id)} onClose={() => setOpen(null)} budgetDock={budgetDock} />;
  }
  return (
    <section className="tl-shell" data-testid="tiling-rooms-workflow">
      <style>{CSS}</style>
      {budgetDock}
      <header className="tl-header">
        <div>
          {onBack ? <button type="button" className="tl-link" onClick={onBack}>{backLabel}</button> : null}
          <h2>Tiles &amp; Stone</h2>
          <p>Set up each tiled room. Areas are calculated from the room&apos;s dimensions, then tiles and floor wastes are chosen for each surface.</p>
          {fullRooms.length ? <p className="tl-count" data-testid="tiling-complete-count"><strong>{completeCount} of {fullRooms.length}</strong> rooms complete</p> : null}
        </div>
        <div className="tl-header-actions">
          <button type="button" className="tl-primary" onClick={() => setAdding(true)} data-testid="tiling-add-room">+ Add room</button>
          <button type="button" className="tl-secondary" disabled={saving || !dirty} onClick={() => save()} data-testid="tiling-save">{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>
        </div>
      </header>
      {legacySelections.length ? (
        <div className="tl-note" data-testid="tiling-legacy-selections">
          <strong>Earlier tile selections kept</strong>
          <span>These were chosen before tiling was set up by room. They are kept on the job; choose each room&apos;s tiles below.</span>
          <ul>{legacySelections.map((item) => <li key={item.requirementKey}>{item.requirementKey.replace(/-/g, " ")}: {item.productName || "product"}</li>)}</ul>
        </div>
      ) : null}
      {adding ? <AddRoomPanel rooms={rooms} onCancel={() => setAdding(false)} onAdd={(result) => { setRooms(result.rooms); setDirty(true); setAdding(false); setOpen({ roomId: result.rooms.at(-1).id, step: stepsFor(result.rooms.at(-1))[0][0] }); }} /> : null}
      {!fullRooms.length ? <p className="tl-empty">No tiled rooms yet. Use “Add room” to set up the first one.</p> : null}
      <div className="tl-room-grid">
        {fullRooms.map((item) => <RoomCard key={item.id} room={item} productById={productById} onEdit={() => setOpen({ roomId: item.id, step: stepsFor(item)[0][0] })} onRemove={() => { setRooms((current) => current.filter((entry) => entry.id !== item.id)); setDirty(true); }} />)}
      </div>
      <FloorAreasSection rooms={rooms} takeoff={takeoff} productById={productById} saving={saving} onRooms={replaceRooms} onPick={setPickingFloorArea} onConfirm={confirmRoom} />
      <TileOrderSummary rooms={rooms} productById={productById} />
    </section>
  );
}

function AddRoomPanel({ rooms, onCancel, onAdd }) {
  const [type, setType] = useState("bathroom");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const defaultName = tilingRoomType(type).label;
  return (
    <div className="tl-panel" data-testid="tiling-add-room-panel">
      <h3>Add a tiled room</h3>
      <p className="tl-muted">For a floor-only area (alfresco, patio, balcony, entry, hallway) use “Add floor tiling area” under Additional floor tiling instead.</p>
      <div className="tl-fields">
        <label>Room type<select value={type} onChange={(event) => setType(event.target.value)} aria-label="Room type">{TILING_ROOM_TYPES.filter((item) => !item.floorOnly).map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
        <label>Room name<input value={name} placeholder={defaultName} onChange={(event) => setName(event.target.value)} aria-label="Room name" /></label>
      </div>
      {error ? <p className="tl-error" role="alert">{error}</p> : null}
      <div className="tl-actions">
        <button type="button" className="tl-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="tl-primary" data-testid="tiling-add-room-confirm" onClick={() => { const result = addTilingRoom(rooms, { type, name: name || defaultName }); if (result.error) setError(result.error); else onAdd(result); }}>Add room</button>
      </div>
    </div>
  );
}

function RoomCard({ room, productById, onEdit, onRemove }) {
  const type = tilingRoomType(room.type);
  const result = calculateTilingRoom(room, { productById });
  const state = tilingRoomStatus(room, { productById });
  const configured = state.status !== "not_started" && (!type.spec || room.spec);
  return (
    <article className={`tl-room-card ${state.status === "complete" ? "done" : ""}`} data-testid={`tiling-room-${room.id}`} data-status={state.status}>
      <div className="tl-room-title"><h3>{room.name}</h3><span>{type.label}</span></div>
      <p className={`tl-status tl-status-${state.status}`} data-testid="tiling-room-status">{STATUS_LABELS[state.status]}</p>
      {type.spec ? <p className="tl-spec">{SPEC_LABELS[room.spec] || "Tiling specification not chosen"}</p> : null}
      {configured ? (
        <dl className="tl-summary">
          {result.surfaces.map((item) => (
            <div key={item.key}><dt>{item.label}</dt><dd>{item.areaM2 === null ? item.pendingReason || "—" : formatM2(item.areaM2)}{item.key === "skirting" && item.lengthLm ? ` (${formatLm(item.lengthLm)})` : ""}{item.product ? <small>{item.product.brand} {item.product.productName}</small> : null}</dd></div>
          ))}
          {state.decisions.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.state}</dd></div>)}
          {type.wet ? <div><dt>Floor wastes &amp; drains</dt><dd>{result.floorWasteCount}</dd></div> : null}
        </dl>
      ) : <p className="tl-muted">Not set up yet.</p>}
      {state.status === "incomplete" ? (state.missing.length ? <ul className="tl-missing" data-testid="tiling-room-missing">{state.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="tl-source">Everything is chosen - open the room and confirm it.</p>) : null}
      <div className="tl-actions">
        <button type="button" className="tl-primary" onClick={onEdit}>{configured ? "Edit room" : "Set up room"}</button>
        <button type="button" className="tl-danger" onClick={() => { if (window.confirm(`Remove ${room.name} from tiling?`)) onRemove(); }}>Remove</button>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, unit = "", step = "0.01", testId }) {
  return <label className="tl-field">{label}<span><input type="number" min="0" step={step} value={num(value)} onChange={(event) => onChange(event.target.value)} aria-label={label} data-testid={testId} />{unit ? <em>{unit}</em> : null}</span></label>;
}

// A linear dimension: always whole millimetres (600, 900, 2400, 3000 ...).
function MmField(props) {
  return <Field {...props} unit="mm" step="1" />;
}

function RoomEditor({ room, rooms = [], onRooms = () => {}, step, takeoff, tileProducts, floorWasteProducts, productById, saving, dirty, onStep, onChange, onSave, onConfirm, onClose, budgetDock }) {
  const state = tilingRoomStatus(room, { productById });
  const floorTiled = roomFloorTiled(room);
  const type = tilingRoomType(room.type);
  const steps = stepsFor(room);
  const result = calculateTilingRoom(room, { productById });
  const index = steps.findIndex(([key]) => key === step);
  const next = steps[index + 1]?.[0];
  const geometry = room.geometry || {};
  const setGeometry = (patch) => onChange((current) => ({ geometry: { ...current.geometry, ...patch } }));
  const setComponent = (key, patch) => onChange((current) => ({ components: { ...current.components, [key]: { ...(current.components?.[key] || {}), ...patch } } }));
  const takeoffCeiling = takeoff.ceilingHeightM || 0;
  const takeoffArea = takeoff.floorAreaByRoomType?.[room.type] || 0;

  return (
    <section className="tl-shell" data-testid="tiling-room-editor" data-room-id={room.id}>
      <style>{CSS}</style>
      {budgetDock}
      <header className="tl-header">
        <div>
          <button type="button" className="tl-link" onClick={onClose}>← Tiles &amp; Stone rooms</button>
          <h2>{room.name}</h2>
          <p>{type.label}{room.spec ? ` · ${SPEC_LABELS[room.spec]}` : ""}</p>
          <p className={`tl-status tl-status-${state.status}`} data-testid="tiling-editor-status">{STATUS_LABELS[state.status]}</p>
        </div>
        <div className="tl-header-actions"><button type="button" className="tl-primary" disabled={saving} onClick={onSave} data-testid="tiling-room-save">{saving ? "Saving…" : dirty ? "Save room" : "Saved"}</button></div>
      </header>
      <div className="tl-editor">
        <nav className="tl-steps" aria-label="Room steps">
          {steps.map(([key, label], position) => <button type="button" key={key} className={key === step ? "active" : ""} onClick={() => onStep(key)}><b>{position + 1}</b>{label}</button>)}
        </nav>
        <div className="tl-main">
          {step === "spec" ? (
            <>
              <h3 className="tl-heading">Choose tiling specification</h3>
              <div className="tl-spec-grid">
                <button type="button" data-testid="tiling-spec-standard" className={`tl-spec-card ${room.spec === TILING_SPECS.standard ? "selected" : ""}`} onClick={() => onChange({ spec: TILING_SPECS.standard })}>
                  <strong>Standard tiling</strong>
                  <ul><li>2000mm shower walls</li><li>600mm bath splashback</li><li>250mm perimeter skirting</li><li>Single-row vanity splashback</li><li>Floor tiling</li></ul>
                </button>
                <button type="button" data-testid="tiling-spec-f2c" className={`tl-spec-card ${room.spec === TILING_SPECS.floorToCeiling ? "selected" : ""}`} onClick={() => onChange({ spec: TILING_SPECS.floorToCeiling })}>
                  <strong>Floor to ceiling</strong>
                  <ul><li>Full-height wall tiling</li><li>Floor tiling</li><li>Doors and windows deducted</li></ul>
                </button>
              </div>
              <Dimensions room={room} geometry={geometry} setGeometry={setGeometry} onRoomChange={onChange} takeoffCeiling={takeoffCeiling} takeoffArea={takeoffArea} result={result} />
            </>
          ) : null}
          {step === "dimensions" ? (
            <>
              {type.surfaces?.includes("floor") && type.surfaces.length > 1 ? (
                <div className="tl-block" data-testid="tiling-floor-decision">
                  <h3>Is the {type.label.toLowerCase()} floor tiled?</h3>
                  <div className="tl-toggle">
                    <button type="button" className={floorTiled ? "selected" : ""} onClick={() => onChange({ floorTiled: true })} data-testid="tiling-floor-tiled">Floor is tiled</button>
                    <button type="button" className={!floorTiled ? "selected" : ""} onClick={() => onChange({ floorTiled: false })} data-testid="tiling-floor-not-tiled">Not tiled</button>
                  </div>
                </div>
              ) : null}
              {floorTiled ? <Dimensions room={room} geometry={geometry} setGeometry={setGeometry} onRoomChange={onChange} takeoffCeiling={takeoffCeiling} takeoffArea={takeoffArea} result={result} noCeiling={!type.surfaces?.includes("skirting")} /> : null}
              {type.surfaces?.some((key) => key === "splashback" || key === "tub-splashback") ? (
                <div className="tl-block"><h4>{type.surfaces.includes("tub-splashback") ? "Laundry tub splashback" : "Splashback"}</h4>
                  <div className="tl-fields"><MmField label="Splashback length" value={room.splashback?.lengthMm} testId="tiling-splashback-length" onChange={(value) => onChange((current) => ({ splashback: { ...current.splashback, lengthMm: value } }))} /><MmField label="Splashback height" value={room.splashback?.heightMm} testId="tiling-splashback-height" onChange={(value) => onChange((current) => ({ splashback: { ...current.splashback, heightMm: value } }))} /></div>
                  {(() => { const item = result.surfaces.find((entry) => entry.key === "splashback" || entry.key === "tub-splashback"); return item ? <p className="tl-calc" data-testid="tiling-splashback-result">Splashback area: {item.areaM2 === null ? item.pendingReason : <>{item.working} = <strong>{formatM2(item.areaM2)}</strong></>}</p> : null; })()}
                </div>
              ) : null}
              {type.surfaces?.includes("skirting") && floorTiled ? (
                <div className="tl-block" data-testid="tiling-skirting-decision">
                  <h4>{type.external ? "250mm upstand / skirting tiles around the perimeter" : "250mm skirting tiles around the perimeter"}</h4>
                  <div className="tl-toggle">
                    <button type="button" className={room.skirting !== false ? "selected" : ""} onClick={() => onChange({ skirting: true })} data-testid="tiling-skirting-required">Required</button>
                    <button type="button" className={room.skirting === false ? "selected" : ""} onClick={() => onChange({ skirting: false })} data-testid="tiling-skirting-not-required">Not required</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {step === "components" ? <Components room={room} setComponent={setComponent} onChange={onChange} result={result} /> : null}
          {step === "openings" ? <Openings room={room} takeoff={takeoff} onChange={onChange} result={result} /> : null}
          {step === "tiles" ? <Tiles room={room} rooms={rooms} onRooms={onRooms} result={result} tileProducts={tileProducts} productById={productById} onChange={onChange} /> : null}
          {step === "wastes" ? <FloorWastes room={room} products={floorWasteProducts} onChange={onChange} /> : null}
          {step === "review" ? <Review room={room} rooms={rooms} onRooms={onRooms} productById={productById} result={result} state={state} /> : null}
          <div className="tl-actions tl-step-actions">
            {index > 0 ? <button type="button" className="tl-secondary" onClick={() => onStep(steps[index - 1][0])}>Back</button> : <span />}
            {next ? <button type="button" className="tl-primary" onClick={() => onStep(next)} data-testid="tiling-next">Continue</button> : <button type="button" className="tl-primary tl-choose" disabled={saving || !state.ready} onClick={async () => { await onConfirm(); onClose(); }} data-testid="tiling-confirm">{state.status === "complete" ? "✓ Room confirmed - save & close" : "Confirm room"}</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Dimensions({ room, geometry, setGeometry, onRoomChange, takeoffCeiling, takeoffArea, result, noCeiling = false }) {
  const custom = geometry.mode === "custom";
  const ceilingFromTakeoff = !geometry.ceilingHeightMm && takeoffCeiling;
  const takeoffCeilingMm = Math.round(takeoffCeiling * 1000);
  return (
    <div className="tl-block">
      <h3>Room dimensions</h3>
      {room.dimensionMigration?.keptAsMm?.length ? <p className="tl-source" data-testid="tiling-migration-note">This room was saved when dimensions were labelled in metres. Values that were clearly entered in millimetres were kept as they were - please check the dimensions below.</p> : null}
      <div className="tl-toggle">
        <button type="button" className={!custom ? "selected" : ""} onClick={() => setGeometry({ mode: "rectangle" })}>Rectangular room</button>
        <button type="button" className={custom ? "selected" : ""} onClick={() => setGeometry({ mode: "custom" })}>Custom / irregular room</button>
      </div>
      <div className="tl-fields">
        {custom ? (
          <>
            <Field label="Floor area" unit="m²" value={geometry.floorAreaM2} onChange={(value) => setGeometry({ floorAreaM2: value, source: "manual" })} testId="tiling-floor-area" />
            <MmField label="Wall / perimeter length (all edges added)" value={geometry.perimeterMm} onChange={(value) => setGeometry({ perimeterMm: value })} testId="tiling-perimeter" />
          </>
        ) : (
          <>
            <MmField label="Width" value={geometry.widthMm} onChange={(value) => setGeometry({ widthMm: value })} testId="tiling-width" />
            <MmField label="Length" value={geometry.lengthMm} onChange={(value) => setGeometry({ lengthMm: value })} testId="tiling-length" />
          </>
        )}
        {noCeiling ? null : <MmField label="Ceiling height" value={geometry.ceilingHeightMm} onChange={(value) => setGeometry({ ceilingHeightMm: value, ceilingSource: "manual" })} testId="tiling-ceiling" />}
      </div>
      {ceilingFromTakeoff && !noCeiling ? <button type="button" className="tl-secondary" onClick={() => setGeometry({ ceilingHeightMm: takeoffCeilingMm, ceilingSource: "takeoff" })}>Use Takeoff ceiling height ({takeoffCeilingMm} mm)</button> : null}
      {geometry.ceilingSource === "takeoff" ? <p className="tl-source">Ceiling height imported from Takeoff. Change it if this room differs.</p> : null}
      {takeoffArea && !geometry.floorAreaM2 ? <button type="button" className="tl-secondary" onClick={() => setGeometry({ mode: "custom", floorAreaM2: takeoffArea, source: "takeoff" })}>Use Takeoff floor area ({takeoffArea.toFixed(2)}m²)</button> : null}
      {geometry.source === "takeoff" ? <p className="tl-source">Floor area imported from Takeoff.</p> : null}
      <div className="tl-live" data-testid="tiling-geometry">
        <span>Floor area <strong data-testid="tiling-floor-result">{formatM2(result.geometry.floorAreaM2)}</strong>{!custom && geometry.widthMm && geometry.lengthMm ? <em>{formatMm(geometry.widthMm)} × {formatMm(geometry.lengthMm)}</em> : null}</span>
        <span>Perimeter <strong data-testid="tiling-perimeter-result">{formatLm(result.geometry.perimeterLm)}</strong>{!custom && geometry.widthMm && geometry.lengthMm ? <em>({formatMm(geometry.widthMm)} + {formatMm(geometry.lengthMm)}) × 2</em> : null}</span>
      </div>
      <div className="tl-fields"><Field label="Floor area not tiled (e.g. built-in bath hob)" unit="m²" value={room.floorDeductionM2} onChange={(value) => onRoomChange({ floorDeductionM2: value })} /></div>
    </div>
  );
}

function Components({ room, setComponent, onChange, result }) {
  const type = tilingRoomType(room.type);
  const components = room.components || {};
  const standard = room.spec === TILING_SPECS.standard;
  const list = [...(type.components || []), "feature"];
  const surface = (key) => result.surfaces.find((item) => item.key === key);
  const bathLengths = components.bath?.lengthsMm?.length ? components.bath.lengthsMm : [""];
  const featureWalls = components.feature?.walls?.length ? components.feature.walls : [{}];
  return (
    <div className="tl-block">
      <h3>What is in this room?</h3>
      <div className="tl-checks">
        {list.map((key) => <label key={key} className="tl-check"><input type="checkbox" data-testid={`tiling-component-${key}`} checked={Boolean(components[key]?.enabled)} onChange={(event) => setComponent(key, { enabled: event.target.checked })} /> {({ shower: "Shower", bath: "Bath", vanity: "Vanity", toilet: "Toilet", feature: "Feature wall" })[key]}</label>)}
      </div>
      {!standard && room.spec ? <p className="tl-source">Floor to ceiling: shower and bath walls are already inside the full-height wall area, so they are not added again.</p> : null}
      {components.shower?.enabled ? (
        <div className="tl-sub"><h4>Shower</h4>
          <div className="tl-fields">
            <MmField label="Shower width" value={components.shower.widthMm} onChange={(value) => setComponent("shower", { widthMm: value })} testId="tiling-shower-width" />
            <MmField label="Shower depth" value={components.shower.lengthMm} onChange={(value) => setComponent("shower", { lengthMm: value })} testId="tiling-shower-length" />
            {standard ? <MmField label="Shower tile height" value={components.shower.heightMm ?? 2000} onChange={(value) => setComponent("shower", { heightMm: value })} testId="tiling-shower-height" /> : null}
            <label className="tl-field">Tiled shower walls<select value={components.shower.tiledWalls || 2} onChange={(event) => setComponent("shower", { tiledWalls: Number(event.target.value) })} aria-label="Tiled shower walls"><option value={2}>2 walls</option><option value={3}>3 walls</option></select></label>
          </div>
          {standard ? <p className="tl-calc" data-testid="tiling-shower-result">Shower walls: {surface("shower-walls")?.working} = <strong>{formatM2(surface("shower-walls")?.areaM2)}</strong></p> : null}
        </div>
      ) : null}
      {components.bath?.enabled ? (
        <div className="tl-sub"><h4>Bath</h4>
          <div className="tl-fields">
            {bathLengths.map((length, position) => (
              <MmField key={position} label={position ? `Tiled bath length ${position + 1}` : "Tiled bath length"} value={length} testId={`tiling-bath-length-${position}`}
                onChange={(value) => setComponent("bath", { lengthsMm: bathLengths.map((item, i) => (i === position ? value : item)) })} />
            ))}
            {standard ? <MmField label="Splashback height" value={components.bath.splashbackHeightMm ?? STANDARD_BATH_SPLASHBACK_HEIGHT_MM} onChange={(value) => setComponent("bath", { splashbackHeightMm: value })} /> : null}
          </div>
          <button type="button" className="tl-link" onClick={() => setComponent("bath", { lengthsMm: [...bathLengths, ""] })}>+ Bath against another tiled wall</button>
          {standard ? <p className="tl-calc" data-testid="tiling-bath-result">Bath splashback: {surface("bath-splashback")?.working} = <strong>{formatM2(surface("bath-splashback")?.areaM2)}</strong></p> : null}
        </div>
      ) : null}
      {components.vanity?.enabled ? (
        <div className="tl-sub"><h4>Vanity</h4>
          <div className="tl-fields">
            <MmField label="Vanity width" value={components.vanity.widthMm} onChange={(value) => setComponent("vanity", { widthMm: value })} testId="tiling-vanity-width" />
            <label className="tl-field">Splashback<select value={components.vanity.splashback || "single-row"} onChange={(event) => setComponent("vanity", { splashback: event.target.value })} aria-label="Vanity splashback"><option value="single-row">Single row</option><option value="custom">Custom height</option></select></label>
            {components.vanity.splashback === "custom" ? <MmField label="Splashback height" value={components.vanity.customHeightMm} onChange={(value) => setComponent("vanity", { customHeightMm: value })} /> : null}
          </div>
          {standard ? <p className="tl-calc" data-testid="tiling-vanity-result">Vanity splashback: {!surface("vanity-splashback") || surface("vanity-splashback").areaM2 === null ? "Single row - calculated once the splashback or wall tile is chosen" : <>{surface("vanity-splashback").working} = <strong>{formatM2(surface("vanity-splashback").areaM2)}</strong></>}</p> : null}
        </div>
      ) : null}
      {components.feature?.enabled ? (
        <div className="tl-sub"><h4>Feature wall</h4>
          {featureWalls.map((wall, position) => (
            <div className="tl-fields" key={position}>
              <MmField label="Feature wall width" value={wall.widthMm} testId={`tiling-feature-width-${position}`} onChange={(value) => setComponent("feature", { walls: featureWalls.map((item, i) => (i === position ? { ...item, widthMm: value } : item)) })} />
              <MmField label="Feature wall height" value={wall.heightMm} testId={`tiling-feature-height-${position}`} onChange={(value) => setComponent("feature", { walls: featureWalls.map((item, i) => (i === position ? { ...item, heightMm: value } : item)) })} />
            </div>
          ))}
          {surface("feature") ? <p className="tl-calc" data-testid="tiling-feature-result">Feature wall: {surface("feature").working} = <strong>{formatM2(surface("feature").areaM2)}</strong></p> : null}
          <label className="tl-check"><input type="checkbox" checked={components.feature.replacesWallTiles !== false} onChange={(event) => setComponent("feature", { replacesWallTiles: event.target.checked })} /> Replaces the wall tiles on that surface (not counted twice)</label>
        </div>
      ) : null}
      <div className="tl-fields"><Field label="Mosaic area (optional)" unit="m²" value={room.mosaicAreaM2} onChange={(value) => onChange({ mosaicAreaM2: value })} /></div>
    </div>
  );
}

function Openings({ room, takeoff, onChange, result }) {
  const openings = room.openings || [];
  const found = takeoffOpeningsForRoom(takeoff, room).filter((item) => !openings.some((opening) => opening.takeoffId === item.id));
  const set = (list) => onChange({ openings: list });
  const update = (position, patch) => set(openings.map((item, i) => (i === position ? { ...item, ...patch } : item)));
  const walls = result.surfaces.find((item) => item.key === "walls");
  return (
    <div className="tl-block">
      <h3>Doors &amp; windows in this room</h3>
      <p className="tl-muted">Deducted from floor-to-ceiling wall tiling; doorways are also left out of skirting.</p>
      {found.length ? <button type="button" className="tl-secondary" onClick={() => set([...openings, ...found.map((item) => ({ type: item.type, widthMm: item.widthMm, heightMm: item.heightMm, quantity: item.quantity, takeoffId: item.id, source: "takeoff" }))])}>Import {found.length} opening{found.length === 1 ? "" : "s"} from Takeoff</button> : null}
      {openings.map((opening, position) => (
        <div className="tl-fields tl-opening" key={position}>
          <label className="tl-field">Type<select value={opening.type} onChange={(event) => update(position, { type: event.target.value })} aria-label="Opening type"><option value="door">Door</option><option value="window">Window</option></select></label>
          <Field label="Width" unit="mm" step="1" value={opening.widthMm} onChange={(value) => update(position, { widthMm: value })} testId={`tiling-opening-width-${position}`} />
          <Field label="Height" unit="mm" step="1" value={opening.heightMm} onChange={(value) => update(position, { heightMm: value })} testId={`tiling-opening-height-${position}`} />
          <Field label="Qty" step="1" value={opening.quantity || 1} onChange={(value) => update(position, { quantity: value })} />
          {opening.source === "takeoff" ? <span className="tl-source">Imported from Takeoff</span> : null}
          <button type="button" className="tl-danger" onClick={() => set(openings.filter((_, i) => i !== position))}>Remove</button>
        </div>
      ))}
      <div className="tl-actions">
        <button type="button" className="tl-secondary" onClick={() => set([...openings, { type: "door", widthMm: 820, heightMm: 2040, quantity: 1 }])} data-testid="tiling-add-door">+ Door</button>
        <button type="button" className="tl-secondary" onClick={() => set([...openings, { type: "window", widthMm: "", heightMm: "", quantity: 1 }])} data-testid="tiling-add-window">+ Window</button>
      </div>
      {walls ? <p className="tl-calc" data-testid="tiling-f2c-result">Floor to ceiling walls: {walls.working} = <strong>{formatM2(walls.areaM2)}</strong> net</p> : null}
    </div>
  );
}

function Tiles({ room, rooms, onRooms, result, tileProducts, productById, onChange }) {
  const [picking, setPicking] = useState("");
  const slots = TILING_SLOTS.filter(({ slot }) => result.surfaces.some((item) => item.slot === slot) || (slot === "splashback" && result.surfaces.some((item) => item.key === "vanity-splashback")));
  const choose = (slot, productId) => { onChange((current) => ({ products: { ...current.products, [slot]: productId } })); setPicking(""); };
  // An external area's floor tile is named for the area: CHOOSE ALFRESCO TILE.
  const roomType = tilingRoomType(room.type);
  const external = Boolean(roomType.external);
  const slotLabel = (item) => (external && item.slot === "floor" ? `${roomType.label} tile` : item.label);
  if (picking) {
    const slot = TILING_SLOTS.find((item) => item.slot === picking);
    return <TilePicker slot={{ ...slot, label: slotLabel(slot) }} external={external && picking === "floor"} products={tileProducts} selectedId={room.products?.[picking]} onCancel={() => setPicking("")} onChoose={(id) => choose(picking, id)} />;
  }
  return (
    <div className="tl-block">
      <h3>Tiles</h3>
      <SchemeDefaultBanner room={room} rooms={rooms} productById={productById} onRooms={onRooms} />
      <div className="tl-fields"><Field label="Tile wastage" unit="%" step="1" value={room.wastagePct ?? 10} onChange={(value) => onChange({ wastagePct: value === "" ? "" : Number(value) })} testId="tiling-wastage" /></div>
      {slots.map((entry) => {
        const { slot } = entry;
        const label = slotLabel(entry);
        const product = room.products?.[slot] ? productById(room.products[slot]) : null;
        const surfaces = result.surfaces.filter((item) => (slot === "splashback" ? item.key === "vanity-splashback" || item.slot === "splashback" : item.slot === slot && item.key !== "vanity-splashback"));
        return (
          <div className="tl-slot" key={slot} data-testid={`tiling-slot-${slot}`}>
            <h4>{label}s</h4>
            <dl className="tl-slot-areas">
              {surfaces.map((item) => (
                <div key={item.key}><dt>{item.label}</dt><dd data-testid={`tiling-area-${item.key}`}>{item.areaM2 === null ? item.pendingReason : formatM2(item.areaM2)}</dd></div>
              ))}
            </dl>
            {/* The action sits directly under the area it is for - never out at the right edge. */}
            <button type="button" className="tl-primary tl-choose" onClick={() => setPicking(slot)} data-testid={`tiling-choose-${slot}`}>{product ? `Change ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}</button>
            {product ? <ProductLine product={product} /> : <p className="tl-muted">{slot === "splashback" ? "Optional - without one, the wall tile is used." : "Not chosen yet."}</p>}
            {surfaces.filter((item) => item.areaM2 !== null).map((item) => (
              <p className="tl-calc" key={item.key}>{item.label}: {formatM2(item.order.netAreaM2)} + {item.order.wastagePct}% wastage = <strong>{formatM2(item.order.orderAreaM2)}</strong>{item.order.boxes ? ` · ${item.order.boxes} boxes (${formatM2(item.order.suppliedAreaM2)} supplied)` : ""}</p>
            ))}
          </div>
        );
      })}
      <FinishFields room={room} onChange={onChange} />
      <SchemeActions room={room} rooms={rooms} productById={productById} onRooms={onRooms} />
    </div>
  );
}

function ProductLine({ product }) {
  return (
    <div className="tl-product-line">
      {product.primaryImageUrl ? <img src={product.primaryImageUrl} alt={product.productName} /> : null}
      <div><strong>{product.brand} {product.productName}</strong><span>{[product.sku, product.size, product.finish, product.colour].filter(Boolean).join(" · ")}</span><span>{money(unitPrice(product))} {product.priceUnit === "m2" || product.attributes?.boxCoverageM2 ? "per m²" : "each"}{product.attributes?.boxCoverageM2 ? ` · ${product.attributes.boxCoverageM2}m² per box` : ""}</span></div>
    </div>
  );
}

function TilePicker({ slot, external = false, products, selectedId, onCancel, onChoose }) {
  const [filters, setFilters] = useState({ colour: "", size: "", finish: "", material: "", maxPrice: "", search: "" });
  // External areas start with the tiles the Product Library rates for external use.
  const [externalOnly, setExternalOnly] = useState(external);
  const suitable = useMemo(() => products.filter((product) => {
    const applications = product.attributes?.tileApplications || [];
    return (!slot.application || applications.includes(slot.application)) && (!externalOnly || applications.includes("external"));
  }), [products, slot.application, externalOnly]);
  const options = (pick) => [...new Set(suitable.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const shown = suitable.filter((product) => (!filters.colour || product.colour === filters.colour) && (!filters.size || product.size === filters.size) && (!filters.finish || product.finish === filters.finish) && (!filters.material || product.material === filters.material)
    && (!filters.maxPrice || (unitPrice(product) !== null && unitPrice(product) <= Number(filters.maxPrice)))
    && (!filters.search || `${product.productName} ${product.sku}`.toLowerCase().includes(filters.search.toLowerCase())));
  const select = (key, label, values) => <label className="tl-field">{label}<select value={filters[key]} aria-label={label} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}><option value="">All</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>;
  return (
    <div className="tl-block" data-testid="tiling-tile-picker">
      <div className="tl-slot-head tl-slot-head-start"><h3>Choose {slot.label.toLowerCase()} <span className="tl-muted">({shown.length} of {suitable.length} {externalOnly ? "external-rated " : ""}{slot.application ? `${slot.application} ` : ""}tiles)</span></h3><button type="button" className="tl-secondary" onClick={onCancel}>Back</button></div>
      {external ? (
        <div className="tl-toggle" data-testid="tiling-external-filter">
          <button type="button" className={externalOnly ? "selected" : ""} onClick={() => setExternalOnly(true)}>External-rated tiles</button>
          <button type="button" className={!externalOnly ? "selected" : ""} onClick={() => setExternalOnly(false)} data-testid="tiling-external-show-all">Show all floor tiles</button>
        </div>
      ) : null}
      {external && !externalOnly ? <p className="tl-warning">These include tiles the Product Library does not rate for external use. Check slip rating and suitability with the supplier.</p> : null}
      <div className="tl-fields tl-filters">
        <label className="tl-field">Search<input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} aria-label="Search tiles" /></label>
        {select("colour", "Colour", options((p) => p.colour))}{select("size", "Size", options((p) => p.size))}{select("finish", "Finish", options((p) => p.finish))}{select("material", "Material", options((p) => p.material))}
        <label className="tl-field">Max price / m²<input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} aria-label="Max price per m2" /></label>
      </div>
      {!suitable.length ? <p className="tl-empty">No {slot.application || ""} tiles are in the Product Library yet.</p> : null}
      <div className="tl-tile-grid">
        {shown.slice(0, 60).map((product) => (
          <article key={product.productId} className={`tl-tile ${product.productId === selectedId ? "selected" : ""}`}>
            {product.primaryImageUrl ? <img src={product.primaryImageUrl} alt={product.productName} loading="lazy" /> : null}
            <strong>{product.productName}</strong>
            <span>{[product.sku, product.size, product.finish, product.material, product.attributes?.thicknessMm ? `${product.attributes.thicknessMm}mm` : "", product.attributes?.slipRating].filter(Boolean).join(" · ")}</span>
            {external && (product.attributes?.tileApplications || []).includes("external") ? <span className="tl-source">External rated</span> : null}
            <span>{money(unitPrice(product))} / m²{product.attributes?.boxCoverageM2 ? ` · ${product.attributes.boxCoverageM2}m²/box` : ""}</span>
            <button type="button" className="tl-primary" onClick={() => onChoose(product.productId)} data-testid="tiling-tile-select">{product.productId === selectedId ? "Selected" : "Select"}</button>
          </article>
        ))}
      </div>
      {shown.length > 60 ? <p className="tl-muted">Showing 60 of {shown.length}. Narrow the filters to see more.</p> : null}
    </div>
  );
}

function FloorWastes({ room, products, onChange }) {
  const wastes = room.floorWastes || [];
  const [productId, setProductId] = useState("");
  const [application, setApplication] = useState("Shower");
  const [quantity, setQuantity] = useState(1);
  const product = products.find((item) => item.productId === productId);
  const set = (list) => onChange({ floorWastes: list });
  return (
    <div className="tl-block">
      <h3>Floor wastes &amp; drains</h3>
      {wastes.map((waste, position) => (
        <div className="tl-waste" key={`${waste.productId}-${position}`}>
          <strong>{waste.productName}</strong><span>{waste.application} × {waste.quantity}</span><span>{money(waste.unitPrice)} each</span>
          <button type="button" className="tl-danger" onClick={() => set(wastes.filter((_, i) => i !== position))}>Remove</button>
        </div>
      ))}
      <div className="tl-fields">
        <label className="tl-field">Product<select value={productId} onChange={(event) => setProductId(event.target.value)} aria-label="Floor waste product" data-testid="tiling-waste-product"><option value="">Choose a floor waste or drain</option>{products.map((item) => <option key={item.productId} value={item.productId}>{item.brand} {item.productName}{item.finish ? ` - ${item.finish}` : ""}</option>)}</select></label>
        <label className="tl-field">Where<select value={application} onChange={(event) => setApplication(event.target.value)} aria-label="Floor waste location" data-testid="tiling-waste-application"><option>Shower</option><option>Floor</option><option>Laundry</option><option>Other</option></select></label>
        <Field label="Quantity" step="1" value={quantity} onChange={(value) => setQuantity(value)} />
      </div>
      {product ? <ProductLine product={product} /> : null}
      <button type="button" className="tl-primary" disabled={!product || !(Number(quantity) > 0)} data-testid="tiling-waste-add"
        onClick={() => { set([...wastes, { productId: product.productId, productName: `${product.brand} ${product.productName}`.trim(), application, quantity: Number(quantity), unitPrice: unitPrice(product), linear: /channel|linear|strip/i.test(product.productName || "") }]); setProductId(""); setQuantity(1); }}>Add to {room.name}</button>
    </div>
  );
}

function Review({ room, rooms, onRooms, productById, result, state }) {
  const geometry = roomGeometry(room.geometry);
  const custom = room.geometry?.mode === "custom";
  return (
    <div className="tl-block" data-testid="tiling-review">
      <h3>{room.name} - review</h3>
      {state.status === "complete" ? <p className="tl-status tl-status-complete" data-testid="tiling-review-status">✓ Complete</p> : state.ready ? (
        <p className="tl-source" data-testid="tiling-review-status">Everything this room needs is chosen. Confirm the room below to mark it complete.</p>
      ) : (
        <div className="tl-cannot" role="alert" data-testid="tiling-review-missing">
          <strong>Cannot complete room:</strong>
          <ul>{state.missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {state.decisions.length ? <p data-testid="tiling-review-decisions">{state.decisions.map((item) => `${item.label}: ${item.state}`).join(" · ")}</p> : null}
      <p>{tilingRoomType(room.type).label}{room.spec ? ` · ${SPEC_LABELS[room.spec]}` : ""}</p>
      <p hidden={!roomFloorTiled(room)}><strong>Dimensions:</strong> {custom ? `${formatM2(geometry.floorAreaM2)} floor, ${formatLm(geometry.perimeterLm)} perimeter` : `${formatMm(room.geometry.widthMm)} × ${formatMm(room.geometry.lengthMm)} = ${formatM2(geometry.floorAreaM2)}`}{geometry.ceilingHeightM ? ` · ceiling ${formatMm(room.geometry.ceilingHeightMm)}` : ""}</p>
      <table className="tl-table">
        <thead><tr><th>Surface</th><th>Product</th><th>Net area</th><th>Wastage</th><th>Order</th><th>Boxes</th></tr></thead>
        <tbody>
          {result.surfaces.map((item) => (
            <tr key={item.key}><td>{item.label}{item.working ? <small>{item.working}</small> : null}</td><td>{item.product ? `${item.product.productName} ${item.product.sku || ""}` : "Not chosen"}</td>
              <td>{item.areaM2 === null ? item.pendingReason : formatM2(item.order.netAreaM2)}</td><td>{item.order ? `${item.order.wastagePct}%` : ""}</td><td>{item.order ? formatM2(item.order.orderAreaM2) : ""}</td><td>{item.order?.boxes ?? ""}</td></tr>
          ))}
        </tbody>
      </table>
      {TILING_FINISH_FIELDS_SHOWN(room)}
      <SchemeActions room={room} rooms={rooms} productById={productById} onRooms={onRooms} />
      <h4>Floor wastes &amp; drains</h4>
      {result.floorWastes.length ? <ul>{result.floorWastes.map((waste, position) => <li key={position}>{waste.productName} - {waste.application} × {waste.quantity}</li>)}</ul> : <p className="tl-muted">None added.</p>}
    </div>
  );
}

// ADDITIONAL FLOOR TILING: simple floor-only areas as rows - a name, an area in m², a tile, wastage
// and the quantity required. No room workflow: nothing about showers, walls, openings or wastes.
function FloorAreasSection({ rooms, takeoff, productById, saving, onRooms, onPick, onConfirm }) {
  const areas = rooms.filter(isFloorAreaRoom);
  const complete = areas.filter((item) => tilingRoomStatus(item, { productById }).status === "complete").length;
  // Areas Job Setup / Takeoff measured that are not listed yet (a new job gets them automatically).
  const toImport = takeoffExternalRoomsToAdd(rooms, takeoff);
  const update = (id, patch) => onRooms(rooms.map((item) => (item.id === id ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) } : item)));
  return (
    <div className="tl-block" data-testid="tiling-floor-areas">
      <div>
        <h3>Additional floor tiling</h3>
        <p className="tl-muted">Floor-only tiled areas such as an alfresco, patio, balcony, porch, entry or hallway. Enter or import the area, choose the tile, confirm.</p>
        {areas.length ? <p className="tl-count" data-testid="tiling-floor-count"><strong>{complete} of {areas.length}</strong> areas complete</p> : null}
      </div>
      {toImport.length ? (
        <div className="tl-note" data-testid="tiling-external-suggestions">
          <strong>Areas in this job&apos;s Job Setup / Takeoff</strong>
          <div className="tl-actions">
            {toImport.map((entry) => <button type="button" className="tl-secondary" key={entry.type} data-testid={`tiling-add-external-${entry.type}`} onClick={() => onRooms([...rooms, tilingRoomFromTakeoff(entry)])}>+ Import {entry.name} ({formatM2(entry.areaM2)})</button>)}
          </div>
        </div>
      ) : null}
      {!areas.length ? <p className="tl-muted">No floor tiling areas yet.</p> : null}
      <div className="tl-floor-rows">
        {areas.map((area) => <FloorAreaRow key={area.id} area={area} rooms={rooms} takeoff={takeoff} productById={productById} saving={saving} onUpdate={(patch) => update(area.id, patch)} onRooms={onRooms} onPick={() => onPick(area.id)} onConfirm={() => onConfirm(area.id)} />)}
      </div>
      <div className="tl-actions"><button type="button" className="tl-primary tl-choose" data-testid="tiling-add-floor-area" onClick={() => onRooms([...rooms, newFloorArea(rooms)])}>+ Add floor tiling area</button></div>
    </div>
  );
}

function FloorAreaRow({ area, rooms, takeoff, productById, saving, onUpdate, onRooms, onPick, onConfirm }) {
  const [applying, setApplying] = useState(false);
  const [picked, setPicked] = useState([]);
  const result = calculateTilingRoom(area, { productById });
  const state = tilingRoomStatus(area, { productById });
  const floor = result.surfaces.find((item) => item.key === "floor");
  const product = floor?.product || null;
  const geometry = area.geometry || {};
  const byDimensions = geometry.mode !== "custom";
  const external = roomIsExternal(area);
  const measured = Number(takeoff?.floorAreaByRoomType?.[area.type]) || 0;
  const others = rooms.filter((item) => isFloorAreaRoom(item) && item.id !== area.id);
  const setGeometry = (patch) => onUpdate((current) => ({ geometry: { ...current.geometry, ...patch } }));
  const applyToOthers = () => { onRooms(rooms.map((item) => (picked.includes(item.id) ? applyFloorTile(area, item) : item))); setApplying(false); setPicked([]); };
  return (
    <article className={`tl-floor-row ${state.status === "complete" ? "done" : ""}`} data-testid={`tiling-floor-row-${area.id}`} data-status={state.status} data-area-name={area.name}>
      <div className="tl-floor-head">
        <label className="tl-field tl-field-wide">Area / location<input value={area.name} onChange={(event) => onUpdate((current) => renameFloorArea(current, event.target.value))} aria-label="Area or location name" data-testid="tiling-floor-name" /></label>
        <p className={`tl-status tl-status-${state.status}`} data-testid="tiling-floor-status">{STATUS_LABELS[state.status]}</p>
      </div>
      <div className="tl-fields">
        {byDimensions ? (
          <>
            <MmField label="Width" value={geometry.widthMm} onChange={(value) => setGeometry({ widthMm: value })} testId="tiling-floor-width" />
            <MmField label="Length" value={geometry.lengthMm} onChange={(value) => setGeometry({ lengthMm: value })} testId="tiling-floor-length" />
          </>
        ) : <Field label="Area" unit="m²" value={geometry.floorAreaM2} onChange={(value) => setGeometry({ floorAreaM2: value, source: "manual" })} testId="tiling-floor-area-input" />}
        <Field label="Wastage" unit="%" step="1" value={area.wastagePct ?? 10} onChange={(value) => onUpdate({ wastagePct: value === "" ? "" : Number(value) })} testId="tiling-floor-wastage" />
        <label className="tl-check"><input type="checkbox" checked={external} onChange={(event) => onUpdate({ external: event.target.checked })} data-testid="tiling-floor-external" /> External area</label>
      </div>
      <div className="tl-actions">
        {byDimensions
          ? <button type="button" className="tl-link" onClick={() => setGeometry({ mode: "custom", floorAreaM2: result.geometry.floorAreaM2 ? Math.round(result.geometry.floorAreaM2 * 100) / 100 : "", source: "manual" })} data-testid="tiling-floor-enter-area">Enter the area in m² instead</button>
          : <button type="button" className="tl-link" onClick={() => setGeometry({ mode: "rectangle" })} data-testid="tiling-floor-from-dimensions">Calculate from dimensions</button>}
        {measured && !(geometry.mode === "custom" && Number(geometry.floorAreaM2) === Math.round(measured * 100) / 100) ? <button type="button" className="tl-link" onClick={() => setGeometry({ mode: "custom", floorAreaM2: Math.round(measured * 100) / 100, source: "takeoff" })} data-testid="tiling-floor-import">Import {formatM2(measured)} from Job Setup</button> : null}
        {geometry.source === "takeoff" && !byDimensions ? <span className="tl-source">Area imported from Job Setup / Takeoff</span> : null}
      </div>
      <dl className="tl-slot-areas"><div><dt>Area</dt><dd data-testid="tiling-floor-area">{formatM2(result.geometry.floorAreaM2)}</dd></div></dl>
      <button type="button" className="tl-primary tl-choose" onClick={onPick} data-testid="tiling-floor-choose">{product ? "Change tile" : "Choose tile"}</button>
      {product ? <ProductLine product={product} /> : <p className="tl-muted">Tile: not selected</p>}
      {floor?.order && floor.areaM2 > 0 ? <p className="tl-calc" data-testid="tiling-floor-required">Required: {formatM2(floor.order.netAreaM2)} + {floor.order.wastagePct}% wastage = <strong>{formatM2(floor.order.orderAreaM2)}</strong>{floor.order.boxes ? ` · ${floor.order.boxes} boxes (${formatM2(floor.order.suppliedAreaM2)} supplied)` : ""}</p> : null}
      {state.status !== "complete" && state.missing.length ? <ul className="tl-missing" data-testid="tiling-floor-missing">{state.missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <div className="tl-actions">
        {state.status === "complete" ? null : <button type="button" className="tl-primary" disabled={saving || !state.ready} onClick={onConfirm} data-testid="tiling-floor-confirm">Confirm area</button>}
        {product && others.length ? <button type="button" className="tl-secondary" onClick={() => setApplying((value) => !value)} data-testid="tiling-floor-apply-open">Apply tile to other floor areas</button> : null}
        <button type="button" className="tl-danger" onClick={() => { if (window.confirm(`Remove ${area.name} from floor tiling?`)) onRooms(rooms.filter((item) => item.id !== area.id)); }}>Remove</button>
      </div>
      {applying ? (
        <div className="tl-scheme-panel" data-testid="tiling-floor-apply-panel">
          <strong>Apply the {area.name} tile and wastage to:</strong>
          <div className="tl-scheme-rooms">
            {others.map((item) => <label key={item.id} className="tl-check"><input type="checkbox" checked={picked.includes(item.id)} onChange={() => setPicked((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))} data-testid={`tiling-floor-apply-${item.id}`} /> {item.name}{item.products?.floor ? <em>has a tile - will be replaced</em> : null}</label>)}
          </div>
          <span className="tl-muted">Each area keeps its own m² and recalculates its own quantity.</span>
          <div className="tl-actions">
            <button type="button" className="tl-secondary" onClick={() => { setApplying(false); setPicked([]); }}>Cancel</button>
            <button type="button" className="tl-primary" disabled={!picked.length} onClick={applyToOthers} data-testid="tiling-floor-apply">Apply tile</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

// Laying pattern, grout and trim: part of the room's tile scheme (copied with it), not a quantity.
function FinishFields({ room, onChange }) {
  const set = (key, value) => onChange((current) => ({ finish: { ...(current.finish || {}), [key]: value } }));
  return (
    <div className="tl-sub" data-testid="tiling-finish">
      <h4>Laying pattern, grout &amp; trim</h4>
      <div className="tl-fields">
        <label className="tl-field tl-field-wide">Laying pattern<select value={room.finish?.pattern || ""} onChange={(event) => set("pattern", event.target.value)} aria-label="Laying pattern" data-testid="tiling-finish-pattern"><option value="">Not chosen</option>{TILING_PATTERNS.map((value) => <option key={value} value={value}>{value}</option>)}{room.finish?.pattern && !TILING_PATTERNS.includes(room.finish.pattern) ? <option value={room.finish.pattern}>{room.finish.pattern}</option> : null}</select></label>
        <label className="tl-field tl-field-wide">Grout colour<input value={room.finish?.grout || ""} onChange={(event) => set("grout", event.target.value)} aria-label="Grout colour" data-testid="tiling-finish-grout" /></label>
        <label className="tl-field tl-field-wide">Trim / edging<input value={room.finish?.trim || ""} onChange={(event) => set("trim", event.target.value)} aria-label="Trim / edging" data-testid="tiling-finish-trim" /></label>
      </div>
    </div>
  );
}

// What applying a scheme to one room will do: copied, replaced and skipped, in plain words.
function SchemePreviewLines({ preview, productById }) {
  const name = (id) => { const product = productById(id); return product ? `${product.productName}${product.sku ? ` ${product.sku}` : ""}` : "selected tile"; };
  return (
    <div className="tl-scheme-preview" data-testid={`tiling-scheme-preview-${preview.targetId}`}>
      {preview.hasExisting ? <p className="tl-warning"><strong>{preview.targetName} already has tile selections.</strong>{preview.replaces.length ? <> Replacing will change: {preview.replaces.join(", ")}.</> : null} Its dimensions and calculated areas are kept.</p> : null}
      <ul>
        {preview.products.map((item) => <li key={item.slot}>{item.label}: {name(item.productId)}</li>)}
        {preview.finish.map((item) => <li key={item.key}>{item.label}: {item.value}</li>)}
        {preview.skipped.filter((item) => !item.kept).map((item) => <li key={item.slot} className="tl-muted">{item.label} not copied - {item.reason}</li>)}
      </ul>
    </div>
  );
}

// APPLY THIS TILE SCHEME TO OTHER ROOMS + USE AS BATHROOM DEFAULT. A one-time copy into each chosen
// room's own selections; the rooms are not linked afterwards.
function SchemeActions({ room, rooms, productById, onRooms }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState("");
  const type = tilingRoomType(room.type);
  if (!type.wet || type.external) return null;
  const targets = tilingSchemeTargets(rooms, room.id);
  const ready = roomHasTileScheme(room);
  const previews = targets.filter((item) => picked.includes(item.room.id)).map((item) => tilingSchemePreview(room, item.room));
  const anyExisting = previews.some((preview) => preview.hasExisting);
  const toggle = (id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const apply = (mode) => {
    const names = targets.filter((item) => picked.includes(item.room.id)).map((item) => item.room.name);
    onRooms(rooms.map((item) => (picked.includes(item.id) ? applyTilingScheme(room, item, { mode }) : item)));
    setMessage(`${room.name} tile scheme applied to ${names.join(", ")}. Each room keeps its own dimensions and can be changed on its own.`);
    setOpen(false);
    setPicked([]);
  };
  return (
    <div className="tl-scheme" data-testid="tiling-scheme-actions">
      <h4>Use this tile scheme in other rooms</h4>
      {!ready ? <p className="tl-muted">Choose this room&apos;s tiles first, then copy them to the other wet areas.</p> : null}
      <div className="tl-actions">
        <button type="button" className="tl-primary tl-choose" disabled={!ready || !targets.length} onClick={() => { setOpen((value) => !value); setMessage(""); }} data-testid="tiling-scheme-apply-open">Apply this tile scheme to other rooms</button>
        <button type="button" className="tl-secondary tl-choose" disabled={!ready || room.schemeDefault} onClick={() => onRooms(setTilingSchemeDefault(rooms, room.id))} data-testid="tiling-scheme-default">{room.schemeDefault ? "✓ Bathroom default" : "Use as bathroom default"}</button>
      </div>
      {ready && !targets.length ? <p className="tl-muted">No other wet areas in this project yet.</p> : null}
      {message ? <p className="tl-source" role="status" data-testid="tiling-scheme-message">{message}</p> : null}
      {open ? (
        <div className="tl-scheme-panel" data-testid="tiling-scheme-panel">
          <strong>Apply {room.name} tile scheme to:</strong>
          <div className="tl-scheme-rooms">
            {targets.map((item) => (
              <label key={item.room.id} className="tl-check"><input type="checkbox" checked={picked.includes(item.room.id)} onChange={() => toggle(item.room.id)} data-testid={`tiling-scheme-room-${item.room.id}`} /> {item.room.name}{item.hasExisting ? <em>has tile selections</em> : null}</label>
            ))}
          </div>
          <div className="tl-actions"><button type="button" className="tl-secondary" onClick={() => setPicked(targets.filter((item) => item.recommended).map((item) => item.room.id))} data-testid="tiling-scheme-select-all">Select all relevant rooms</button></div>
          {previews.map((preview) => <div key={preview.targetId}><strong>{preview.targetName}</strong><SchemePreviewLines preview={preview} productById={productById} /></div>)}
          <div className="tl-actions">
            <button type="button" className="tl-secondary" onClick={() => { setOpen(false); setPicked([]); }}>Cancel</button>
            {anyExisting ? (
              <>
                <button type="button" className="tl-secondary" disabled={!picked.length} onClick={() => apply("fill-empty")} data-testid="tiling-scheme-fill">Only fill empty selections</button>
                <button type="button" className="tl-primary" disabled={!picked.length} onClick={() => apply("replace")} data-testid="tiling-scheme-replace">Apply &amp; replace</button>
              </>
            ) : <button type="button" className="tl-primary" disabled={!picked.length} onClick={() => apply("replace")} data-testid="tiling-scheme-apply">Apply scheme</button>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Shown in a wet room when another room has been marked as the bathroom default.
function SchemeDefaultBanner({ room, rooms, productById, onRooms }) {
  const type = tilingRoomType(room.type);
  const source = tilingSchemeDefaultRoom(rooms);
  if (!source || source.id === room.id || !type.wet || type.external) return null;
  if (room.schemeCopy?.copiedFromRoomId === source.id && !room.schemeCopyDismissed && roomHasTileScheme(room)) return <p className="tl-source" data-testid="tiling-scheme-copied">Tile scheme copied from {source.name}. This room is now separate - change anything here without affecting {source.name}.</p>;
  const preview = tilingSchemePreview(source, room);
  const apply = (mode) => onRooms(rooms.map((item) => (item.id === room.id ? applyTilingScheme(source, item, { mode }) : item)));
  return (
    <div className="tl-scheme-panel" data-testid="tiling-scheme-default-banner">
      <strong>Bathroom default available - {source.name}</strong>
      <SchemePreviewLines preview={preview} productById={productById} />
      <div className="tl-actions">
        {preview.hasExisting ? (
          <>
            <button type="button" className="tl-secondary tl-choose" onClick={() => apply("fill-empty")} data-testid="tiling-scheme-default-fill">Only fill empty selections</button>
            <button type="button" className="tl-primary tl-choose" onClick={() => apply("replace")} data-testid="tiling-scheme-default-replace">Replace existing tile scheme</button>
          </>
        ) : <button type="button" className="tl-primary tl-choose" onClick={() => apply("replace")} data-testid="tiling-scheme-default-apply">Apply default scheme</button>}
      </div>
    </div>
  );
}

// Each tile product across every room: every room's order area and the job total.
function TileOrderSummary({ rooms, productById }) {
  const totals = tilingProductTotals(rooms, { productById });
  if (!totals.length) return null;
  return (
    <div className="tl-block" data-testid="tiling-order-summary">
      <h3>Tile order summary</h3>
      <table className="tl-table">
        <thead><tr><th>Tile</th><th>Rooms</th><th>Total to order</th><th>Boxes</th></tr></thead>
        <tbody>
          {totals.map((entry) => (
            <tr key={entry.productId} data-testid={`tiling-order-${entry.productId}`}>
              <td><strong>{entry.productName}</strong><small>{entry.sku}</small></td>
              <td>{entry.rooms.map((item) => <span className="tl-order-room" key={item.roomId}>{item.roomName}: {formatM2(item.orderAreaM2)}</span>)}</td>
              <td><strong>{formatM2(entry.orderAreaM2)}</strong></td>
              <td>{entry.boxes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TILING_FINISH_FIELDS_SHOWN = (room) => {
  const parts = [["Laying pattern", room.finish?.pattern], ["Grout", room.finish?.grout], ["Trim", room.finish?.trim]].filter(([, value]) => value);
  return parts.length ? <p data-testid="tiling-review-finish">{parts.map(([label, value]) => `${label}: ${value}`).join(" · ")}</p> : null;
};

const CSS = `
.tl-shell { display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.tl-shell button { font-size: 16px; }
.tl-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; }
.tl-header h2 { margin: 4px 0; font-size: 28px; font-weight: 900; }
.tl-header p { margin: 0; font-size: 17px; color: #334155; }
.tl-heading { margin: 0; font-size: 22px; font-weight: 900; }
.tl-header-actions, .tl-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.tl-step-actions { justify-content: space-between; margin-top: 8px; }
.tl-primary, .tl-secondary, .tl-danger { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.tl-primary { background: #0f766e; color: #fff; border: 0; }
.tl-primary:disabled, .tl-secondary:disabled { opacity: .55; cursor: not-allowed; }
.tl-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.tl-danger { background: #fff; color: #b91c1c; border: 1px solid #fca5a5; }
.tl-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; justify-self: start; }
.tl-room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: 20px; }
.tl-room-card { display: grid; gap: 12px; align-content: start; border: 2px solid #d7deea; border-radius: 14px; background: #fff; padding: 22px; }
.tl-room-card.done { border-color: #22c55e; }
.tl-room-title { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.tl-room-title h3 { margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; }
.tl-room-title span, .tl-spec { font-size: 17px; font-weight: 800; color: #0f766e; margin: 0; }
.tl-summary { display: grid; gap: 8px; margin: 0; }
.tl-summary div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #eef2f7; padding-bottom: 6px; }
.tl-summary dt { font-weight: 700; color: #334155; }
.tl-summary dd { margin: 0; text-align: right; font-weight: 800; display: grid; }
.tl-summary small { font-size: 16px; font-weight: 600; color: #475569; }
.tl-muted { color: #475569; margin: 0; }
.tl-empty, .tl-note { border: 1px dashed #94a3b8; border-radius: 12px; padding: 16px; background: #f8fafc; margin: 0; display: grid; gap: 6px; }
.tl-panel, .tl-block { border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; display: grid; gap: 14px; }
.tl-block h3, .tl-panel h3 { margin: 0; font-size: 22px; font-weight: 900; }
.tl-block h4, .tl-sub h4 { margin: 0; font-size: 19px; font-weight: 900; }
.tl-fields { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.tl-field { display: grid; gap: 6px; font-weight: 700; min-width: 170px; max-width: 260px; }
.tl-field span { display: flex; align-items: center; gap: 6px; }
.tl-field input, .tl-field select, .tl-panel input, .tl-panel select { min-height: 44px; font-size: 17px; border: 1px solid #94a3b8; border-radius: 8px; padding: 6px 10px; background: #fff; color: #0f172a; width: 100%; box-sizing: border-box; }
.tl-panel label { display: grid; gap: 6px; font-weight: 700; min-width: 220px; }
.tl-field em { font-style: normal; font-weight: 800; color: #475569; }
.tl-editor { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
.tl-steps { display: grid; gap: 8px; position: sticky; top: 90px; }
.tl-steps button { display: flex; gap: 10px; align-items: center; text-align: left; min-height: 52px; padding: 10px 14px; border-radius: 10px; border: 1px solid #d7deea; background: #fff; color: #0f172a; font-weight: 800; cursor: pointer; }
.tl-steps button b { display: inline-grid; place-items: center; min-width: 30px; height: 30px; border-radius: 999px; background: #e2e8f0; }
.tl-steps button.active { border-color: #0f766e; background: #f0fdfa; }
.tl-steps button.active b { background: #0f766e; color: #fff; }
.tl-main { display: grid; gap: 16px; min-width: 0; }
.tl-spec-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.tl-spec-card { text-align: left; border: 2px solid #d7deea; border-radius: 14px; background: #fff; padding: 22px; cursor: pointer; color: #0f172a; display: grid; gap: 8px; align-content: start; }
.tl-spec-card strong { font-size: 24px; }
.tl-spec-card ul { margin: 0; padding-left: 20px; font-size: 17px; line-height: 1.6; }
.tl-spec-card.selected { border-color: #0f766e; background: #f0fdfa; box-shadow: 0 0 0 2px #0f766e inset; }
.tl-toggle { display: flex; gap: 8px; flex-wrap: wrap; }
.tl-toggle button { min-height: 44px; padding: 8px 16px; border-radius: 999px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-weight: 800; cursor: pointer; }
.tl-toggle button.selected { background: #0f766e; color: #fff; border-color: #0f766e; }
.tl-live { display: flex; gap: 28px; flex-wrap: wrap; background: #f0fdf4; border-radius: 10px; padding: 14px 18px; font-size: 17px; }
.tl-live span { display: grid; gap: 2px; }
.tl-live strong { font-size: 22px; }
.tl-live em { font-style: normal; color: #475569; }
.tl-source { color: #0369a1; font-weight: 700; margin: 0; }
.tl-error { color: #b91c1c; font-weight: 800; margin: 0; }
.tl-checks { display: flex; gap: 20px; flex-wrap: wrap; }
.tl-check { display: inline-flex; gap: 10px; align-items: center; font-weight: 800; font-size: 17px; }
.tl-check input { width: 22px; height: 22px; }
.tl-sub { display: grid; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.tl-calc { margin: 0; font-size: 17px; background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
.tl-slot { display: grid; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.tl-slot-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.tl-slot-head-start { justify-content: flex-start; gap: 20px; }
.tl-slot-areas { display: grid; gap: 6px; margin: 0; }
.tl-slot-areas div { display: grid; gap: 2px; }
.tl-slot-areas dt { font-weight: 700; color: #334155; }
.tl-slot-areas dd { margin: 0; font-size: 22px; font-weight: 900; }
.tl-choose { justify-self: start; text-transform: uppercase; letter-spacing: .02em; }
.tl-field-wide { min-width: 240px; max-width: 340px; }
.tl-scheme { display: grid; gap: 12px; border-top: 2px solid #0f766e; padding-top: 16px; justify-items: start; }
.tl-scheme-panel { display: grid; gap: 12px; border: 2px solid #0f766e; border-radius: 12px; background: #f0fdfa; padding: 16px 18px; justify-items: start; width: 100%; box-sizing: border-box; }
.tl-scheme-rooms { display: grid; gap: 10px; }
.tl-scheme-rooms em { font-style: normal; font-weight: 700; color: #b45309; }
.tl-scheme-preview ul { margin: 4px 0 0; padding-left: 20px; display: grid; gap: 2px; }
.tl-warning { margin: 0; border-left: 4px solid #f59e0b; background: #fffbeb; padding: 8px 12px; }
.tl-order-room { display: block; }
.tl-count { margin: 8px 0 0; font-size: 18px; }
.tl-floor-rows { display: grid; gap: 14px; }
.tl-floor-row { display: grid; gap: 12px; justify-items: start; border: 2px solid #d7deea; border-radius: 12px; padding: 16px 18px; background: #fff; }
.tl-floor-row.done { border-color: #22c55e; }
.tl-floor-head { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
.tl-floor-row .tl-calc { width: 100%; box-sizing: border-box; }
.tl-count strong { font-size: 22px; }
.tl-status { margin: 0; justify-self: start; border-radius: 999px; padding: 4px 14px; font-weight: 900; text-transform: uppercase; font-size: 16px; width: fit-content; }
.tl-status-complete { background: #dcfce7; color: #166534; }
.tl-status-incomplete { background: #fef3c7; color: #92400e; }
.tl-status-not_started { background: #e2e8f0; color: #334155; }
.tl-missing { margin: 0; padding-left: 20px; color: #92400e; font-weight: 700; display: grid; gap: 2px; }
.tl-cannot { border: 2px solid #f59e0b; border-radius: 10px; background: #fffbeb; padding: 12px 16px; display: grid; gap: 6px; }
.tl-cannot ul { margin: 0; padding-left: 20px; display: grid; gap: 2px; font-weight: 700; }
.tl-product-line { display: flex; gap: 14px; align-items: center; }
.tl-product-line img { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
.tl-product-line div { display: grid; gap: 4px; }
.tl-tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 16px; }
.tl-tile { display: grid; gap: 8px; border: 2px solid #d7deea; border-radius: 12px; padding: 12px; background: #fff; align-content: start; }
.tl-tile.selected { border-color: #0f766e; }
.tl-tile img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: #f1f5f9; }
.tl-tile strong { font-size: 18px; }
.tl-waste { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
.tl-table { width: 100%; border-collapse: collapse; font-size: 16px; }
.tl-table th, .tl-table td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 10px 8px; vertical-align: top; }
.tl-table td small { display: block; font-size: 16px; color: #475569; }
@media (max-width: 900px) { .tl-editor, .tl-spec-grid { grid-template-columns: 1fr; } .tl-steps { position: static; } }
`;
