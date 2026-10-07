// Client Selections > Internal Paint Colours. The client chooses the COLOURS for the house: one
// main wall colour, one trim / internal door colour and one ceiling colour apply throughout; single
// rooms and feature walls can differ. Colours come from the Dulux colour library and are recorded
// as a specification - no product, price or quotation row is created here. The rules live in
// lib/builders/internalPaintColours.js; this component only collects choices.
// Readable text is never below 16px.
import { useEffect, useMemo, useRef, useState } from "react";
import { COLOUR_DISCLAIMER, COLOUR_GROUPS, builderColourIds, findColour, groupCounts, readableOn, searchColours } from "../../lib/builders/duluxColourLibrary.js";
import {
  PAINT_COLOUR_SURFACES, choiceSwatch, colourLabel, confirmHouseScheme, internalPaintSchemeStatus, isStandardCeiling, normaliseInternalPaintScheme, paintableRoomNames, resetCeilingToStandard,
  removeFeatureWall, resolveRoomColours, saveFeatureWall, setHouseColour, setRoomOverride, storedInternalPaintScheme,
} from "../../lib/builders/internalPaintColours.js";
import { paintBaselineWithStandards } from "../../lib/builders/paintStandards.js";

const PAGE_SIZE = 60;
// A saved choice or a library colour. Ready-mixed whites have a screen-only swatch (displaySwatch).
const swatchStyle = (choice) => { const colour = choiceSwatch(choice); return colour ? { background: colour, color: readableOn(colour) } : undefined; };

export default function InternalPaintColourSpecification({ selection, projectRoomNames = [], inclusions = {}, onSave, onBack, backLabel = "← Interior" }) {
  // Finishes and the standard ceiling come from the builder's Standard Inclusions where they say.
  const baseline = useMemo(() => paintBaselineWithStandards(inclusions), [inclusions]);
  const savedScheme = selection?.selected_details?.paintScheme || selection?.guidedSelection?.paintScheme || null;
  const [scheme, setScheme] = useState(() => normaliseInternalPaintScheme(savedScheme, baseline));
  const [saveState, setSaveState] = useState({ state: "idle", message: "" });
  const [picker, setPicker] = useState(null);           // { kind: "house" | "room" | "feature", surface, location }
  const [featureDraft, setFeatureDraft] = useState(null); // { id, location, wall, notes, colour }
  const [managingRooms, setManagingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState("");
  // The job's saved scheme can arrive after this screen opens; adopt it unless there are edits here.
  const adopted = useRef(savedScheme);
  const edited = useRef(false);
  useEffect(() => {
    if (savedScheme === adopted.current) return;
    adopted.current = savedScheme;
    if (!edited.current) setScheme(normaliseInternalPaintScheme(savedScheme, baseline));
  }, [savedScheme, baseline]);
  // A job saved before ceilings had a standard has no ceiling colour recorded. It takes the
  // standard once, and that is saved; a ceiling colour the client chose is never touched.
  const ceilingBackfilled = useRef(false);
  useEffect(() => {
    if (ceilingBackfilled.current || !savedScheme || savedScheme.defaults?.ceilings?.colourName || savedScheme.defaults?.ceilings?.colourId) return;
    const next = normaliseInternalPaintScheme(savedScheme, baseline);
    if (!next.defaults.ceilings) return;
    ceilingBackfilled.current = true;
    commit(next, "Standard ceiling colour applied.");
  }, [savedScheme, baseline]); // eslint-disable-line react-hooks/exhaustive-deps

  const rooms = useMemo(() => paintableRoomNames(projectRoomNames), [projectRoomNames]);
  const builderIds = useMemo(() => builderColourIds(baseline.text), [baseline.text]);
  const status = internalPaintSchemeStatus(scheme);
  const overriddenRooms = [...new Set(scheme.overrides.map((override) => override.location))];

  async function commit(next, savedMessage) {
    edited.current = true;
    setScheme(next);
    setSaveState({ state: "saving", message: "Saving…" });
    const stored = storedInternalPaintScheme(next);
    let ok = false;
    try { ok = Boolean(await onSave?.(stored)); } catch { ok = false; }
    setSaveState(ok ? { state: "saved", message: savedMessage } : { state: "failed", message: "This change is on screen but could not be saved to the job." });
    return ok;
  }

  function chooseColour(colour) {
    const target = picker;
    setPicker(null);
    if (!target || !colour) return;
    if (target.kind === "feature") { setFeatureDraft((draft) => (draft ? { ...draft, colour } : draft)); return; }
    const surface = PAINT_COLOUR_SURFACES.find((item) => item.key === target.surface);
    if (target.kind === "room") { commit(setRoomOverride(scheme, target.location, target.surface, colour, baseline), `${target.location} ${surface.shortLabel.toLowerCase()} set to ${colour.name}.`); return; }
    commit(setHouseColour(scheme, target.surface, colour, baseline), `${surface.label} set to ${colour.name}.`);
  }

  async function submitFeatureWall() {
    if (!featureDraft?.location || !featureDraft.wall.trim() || !featureDraft.colour) return;
    const ok = await commit(saveFeatureWall(scheme, featureDraft, baseline), `Feature wall saved for ${featureDraft.location}.`);
    if (ok) setFeatureDraft(null);
  }

  const pickerCurrent = !picker ? null
    : picker.kind === "feature" ? (featureDraft?.colour ? { colourId: featureDraft.colour.id } : null)
      : picker.kind === "room" ? resolveRoomColours(scheme, picker.location)[picker.surface].choice
        : scheme.defaults[picker.surface];
  const pickerTitle = !picker ? ""
    : picker.kind === "feature" ? "Feature wall colour"
      : picker.kind === "room" ? `${picker.location} - ${PAINT_COLOUR_SURFACES.find((item) => item.key === picker.surface).shortLabel}`
        : PAINT_COLOUR_SURFACES.find((item) => item.key === picker.surface).label;

  return (
    <section className="ipc-shell" data-testid="internal-paint-colour-specification" data-complete={status.complete ? "true" : "false"}>
      <style>{INTERNAL_PAINT_CSS}</style>

      <header className="ipc-header">
        <div>
          {onBack ? <button type="button" className="ipc-link" onClick={onBack} data-testid="paint-back">{backLabel}</button> : null}
          <h2>Internal Paint Colours</h2>
          <p>Choose the main colours for the home. These colours apply throughout unless a room is overridden.</p>
        </div>
        <div className="ipc-headerStatus">
          <span className={`ipc-pill ${status.complete ? "done" : ""}`} data-testid="paint-status">{status.complete ? "✓ Complete" : status.ready ? "Ready to confirm" : `${status.chosen} of 3 colours chosen`}</span>
          {saveState.state !== "idle" ? <span className={`ipc-save ${saveState.state}`} role="status" data-testid="paint-save-state">{saveState.message}</span> : null}
        </div>
      </header>

      {baseline.fromInclusions ? (
        <aside className="ipc-included" data-testid="paint-included">
          <strong>Included in your home</strong>
          <ul>{baseline.lines.map((line) => <li key={line}>{line}</li>)}</ul>
          <p>Choosing a colour does not change your price.</p>
        </aside>
      ) : null}

      <section className="ipc-block">
        <h3>House colour scheme</h3>
        <div className="ipc-schemeGrid">
          {PAINT_COLOUR_SURFACES.map((surface) => {
            const choice = scheme.defaults[surface.key];
            const hasSwatch = Boolean(choiceSwatch(choice));
            // Ceilings carry the builder's standard until the client chooses otherwise.
            const standard = surface.key === "ceilings" && choice ? isStandardCeiling(scheme, baseline) : null;
            return (
              <article key={surface.key} className={`ipc-surface ${choice ? "chosen" : ""}`} data-testid={`paint-surface-${surface.key}`} data-colour-code={choice?.colourCode || ""} data-colour-hex={choice?.hex || ""} data-colour-id={choice?.colourId || ""} data-standard={standard === null ? "" : standard ? "standard" : "override"}>
                <div className={`ipc-swatch ${hasSwatch ? "" : "empty"}`} style={swatchStyle(choice)} data-testid={`paint-surface-swatch-${surface.key}`}>
                  {hasSwatch ? null : <span>{choice ? "Swatch not recorded" : "No colour chosen"}</span>}
                </div>
                <div className="ipc-surfaceBody">
                  <span className="ipc-eyebrow">{surface.label}</span>
                  {choice ? (
                    <>
                      <strong className="ipc-colourName">{choice.manufacturer} {choice.colourName}</strong>
                      <span>{choice.colourCode ? `Colour code: ${choice.colourCode}` : choice.displaySwatch ? "Ready-mixed white - no colour code" : "Colour code not recorded"}</span>
                    </>
                  ) : <strong className="ipc-colourName muted">Not selected</strong>}
                  <span>Finish: {choice?.finish || baseline.finishes[surface.key]}</span>
                  {standard === null ? null : <span className={`ipc-tag ${standard ? "standard" : "override"}`} data-testid="paint-ceiling-tag">{standard ? baseline.standards.ceilings.label : "Client override"}</span>}
                  <div className="ipc-surfaceActions">
                    <button type="button" className={choice ? "ipc-secondary" : "ipc-primary"} onClick={() => setPicker({ kind: "house", surface: surface.key })} data-testid={`paint-choose-${surface.key}`}>
                      {choice ? "Change colour" : "Choose colour"}
                    </button>
                    {standard === false ? <button type="button" className="ipc-secondary" onClick={() => commit(resetCeilingToStandard(scheme, baseline), `Ceilings reset to ${baseline.standards.ceilings.colour.name}.`)} data-testid="paint-ceiling-reset">Reset to standard</button> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ipc-block" data-testid="paint-feature-walls">
        <div className="ipc-blockHead">
          <div><h3>Feature walls</h3><p>Optional. A single wall in a different colour.</p></div>
          <button type="button" className="ipc-secondary" onClick={() => setFeatureDraft({ id: "", location: rooms[0] || "", wall: "", notes: "", colour: null })} data-testid="paint-add-feature-wall">+ Add feature wall</button>
        </div>
        {scheme.featureWalls.length ? (
          <ul className="ipc-list">
            {scheme.featureWalls.map((wall) => (
              <li key={wall.id} data-testid="paint-feature-wall" data-location={wall.location}>
                <i className="ipc-chip" style={swatchStyle(wall.choice)} />
                <div className="ipc-rowText"><strong>{wall.location} - {wall.wall}</strong><span>{colourLabel(wall.choice)}{wall.notes ? ` · ${wall.notes}` : ""}</span></div>
                <div className="ipc-rowActions">
                  <button type="button" className="ipc-link" onClick={() => setFeatureDraft({ id: wall.id, location: wall.location, wall: wall.wall, notes: wall.notes, colour: findColour(wall.choice.colourId) || { id: wall.choice.colourId, name: wall.choice.colourName, code: wall.choice.colourCode, hex: wall.choice.hex, manufacturer: wall.choice.manufacturer, sourceUrl: wall.choice.sourceUrl } })}>Edit</button>
                  <button type="button" className="ipc-link danger" onClick={() => commit(removeFeatureWall(scheme, wall.id), "Feature wall removed.")}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="ipc-empty">No feature walls selected.</p>}
      </section>

      <section className="ipc-block" data-testid="paint-room-overrides">
        <div className="ipc-blockHead">
          <div><h3>Room overrides</h3><p>Optional. A room that uses different colours from the rest of the house.</p></div>
          <button type="button" className="ipc-secondary" onClick={() => { setManagingRooms(true); setEditingRoom(""); }} data-testid="paint-manage-overrides">Manage room overrides</button>
        </div>
        {overriddenRooms.length ? (
          <ul className="ipc-list">
            {overriddenRooms.map((room) => (
              <li key={room} data-testid="paint-override-summary" data-location={room}>
                <div className="ipc-chipRow">{scheme.overrides.filter((override) => override.location === room).map((override) => <i key={override.surface} className="ipc-chip" style={swatchStyle(override.choice)} />)}</div>
                <div className="ipc-rowText"><strong>{room}</strong><span>{scheme.overrides.filter((override) => override.location === room).map((override) => `${PAINT_COLOUR_SURFACES.find((item) => item.key === override.surface).shortLabel}: ${colourLabel(override.choice)}`).join(" · ")}</span></div>
              </li>
            ))}
          </ul>
        ) : <p className="ipc-empty">No room overrides. Every room uses the house colour scheme.</p>}
      </section>

      <footer className="ipc-confirm">
        <div>
          <strong>{status.complete ? "Internal colour scheme confirmed" : "Confirm the house colour scheme"}</strong>
          <span>{status.complete ? "You can still add feature walls or room overrides at any time." : status.ready ? "The three house colours are chosen. Confirm to complete this selection." : `Still to choose: ${status.required.filter((item) => !item.done).map((item) => item.label).join(", ")}.`}</span>
        </div>
        <button type="button" className="ipc-primary large" disabled={!status.ready || status.complete || saveState.state === "saving"} onClick={() => commit(confirmHouseScheme(scheme), "Internal colour scheme confirmed.")} data-testid="paint-confirm">
          {status.complete ? "✓ Scheme confirmed" : "Confirm internal colour scheme"}
        </button>
      </footer>

      {managingRooms ? (
        <Modal title="Room overrides" onClose={() => setManagingRooms(false)} testId="paint-overrides-modal">
          <div className="ipc-houseDefault">
            <span className="ipc-eyebrow">House default</span>
            <div className="ipc-defaultRow">
              {PAINT_COLOUR_SURFACES.map((surface) => (
                <div key={surface.key}><i className="ipc-chip" style={swatchStyle(scheme.defaults[surface.key])} /><span><b>{surface.shortLabel}</b>{colourLabel(scheme.defaults[surface.key]) || "Not selected"}</span></div>
              ))}
            </div>
          </div>
          {rooms.length ? (
            <ul className="ipc-rooms">
              {rooms.map((room) => {
                const colours = resolveRoomColours(scheme, room);
                const overridden = PAINT_COLOUR_SURFACES.filter((surface) => colours[surface.key].overridden);
                const open = editingRoom === room;
                return (
                  <li key={room} className={open ? "open" : ""} data-testid="paint-room" data-location={room} data-overridden={overridden.length ? "true" : "false"}>
                    <div className="ipc-roomHead">
                      <div><strong>{room}</strong><span>{overridden.length ? overridden.map((surface) => `${surface.shortLabel}: ${colourLabel(colours[surface.key].choice)}`).join(" · ") : "Using house default"}</span></div>
                      <button type="button" className="ipc-secondary" onClick={() => setEditingRoom(open ? "" : room)} data-testid="paint-room-override">{open ? "Done" : overridden.length ? "Edit override" : "Override"}</button>
                    </div>
                    {open ? (
                      <div className="ipc-roomEdit">
                        {PAINT_COLOUR_SURFACES.map((surface) => {
                          const { choice, overridden: isOverridden } = colours[surface.key];
                          return (
                            <div key={surface.key} className="ipc-roomSurface" data-testid={`paint-room-surface-${surface.key}`}>
                              <i className="ipc-chip large" style={swatchStyle(choice)} />
                              <div><b>{surface.shortLabel}</b><span>{isOverridden ? colourLabel(choice) : `House default${choice ? `: ${colourLabel(choice)}` : ""}`}</span></div>
                              <div className="ipc-rowActions">
                                <button type="button" className="ipc-secondary" onClick={() => setPicker({ kind: "room", location: room, surface: surface.key })} data-testid={`paint-room-choose-${surface.key}`}>{isOverridden ? "Change colour" : "Choose Dulux colour"}</button>
                                {isOverridden ? <button type="button" className="ipc-link" onClick={() => commit(setRoomOverride(scheme, room, surface.key, null, baseline), `${room} ${surface.shortLabel.toLowerCase()} returned to the house default.`)}>Use house default</button> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="ipc-empty">This project has no rooms recorded yet. Rooms appear here once they are entered in Job Setup or measured in the takeoff.</p>}
        </Modal>
      ) : null}

      {featureDraft ? (
        <Modal title={featureDraft.id ? "Edit feature wall" : "Add feature wall"} onClose={() => setFeatureDraft(null)} testId="paint-feature-modal" narrow>
          <div className="ipc-form">
            <label><span>Room / location</span>
              {rooms.length ? (
                <select value={featureDraft.location} onChange={(event) => setFeatureDraft({ ...featureDraft, location: event.target.value })} data-testid="paint-feature-room">
                  {!rooms.includes(featureDraft.location) && featureDraft.location ? <option value={featureDraft.location}>{featureDraft.location}</option> : null}
                  {rooms.map((room) => <option key={room} value={room}>{room}</option>)}
                </select>
              ) : <input value={featureDraft.location} onChange={(event) => setFeatureDraft({ ...featureDraft, location: event.target.value })} placeholder="Room or location" data-testid="paint-feature-room" />}
            </label>
            <label><span>Wall / description</span>
              <input value={featureDraft.wall} onChange={(event) => setFeatureDraft({ ...featureDraft, wall: event.target.value })} placeholder="e.g. Bedhead wall" data-testid="paint-feature-wall-name" />
            </label>
            <div className="ipc-formColour">
              <span>Colour</span>
              <div>
                <i className={`ipc-chip large ${featureDraft.colour ? "" : "empty"}`} style={swatchStyle(featureDraft.colour)} />
                <strong>{featureDraft.colour ? `Dulux ${featureDraft.colour.name} (${featureDraft.colour.code})` : "No colour chosen"}</strong>
                <button type="button" className="ipc-secondary" onClick={() => setPicker({ kind: "feature" })} data-testid="paint-feature-choose">{featureDraft.colour ? "Change colour" : "Choose Dulux colour"}</button>
              </div>
            </div>
            <label><span>Notes (optional)</span>
              <textarea rows={2} value={featureDraft.notes} onChange={(event) => setFeatureDraft({ ...featureDraft, notes: event.target.value })} data-testid="paint-feature-notes" />
            </label>
          </div>
          <div className="ipc-modalActions">
            <button type="button" className="ipc-secondary" onClick={() => setFeatureDraft(null)}>Cancel</button>
            <button type="button" className="ipc-primary" disabled={!featureDraft.location || !featureDraft.wall.trim() || !featureDraft.colour || saveState.state === "saving"} onClick={submitFeatureWall} data-testid="paint-feature-save">Save feature wall</button>
          </div>
        </Modal>
      ) : null}

      {picker ? <ColourSelector title={pickerTitle} currentId={pickerCurrent?.colourId || ""} builderIds={builderIds} onSelect={chooseColour} onClose={() => setPicker(null)} /> : null}
    </section>
  );
}

function Modal({ title, onClose, children, testId, narrow = false, wide = false }) {
  const overlay = useRef(null);
  useEffect(() => {
    // Dialogs stack (the colour selector opens over a feature wall); Escape closes the top one only.
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      const open = document.querySelectorAll(".ipc-overlay");
      if (open[open.length - 1] === overlay.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={overlay} className="ipc-overlay" role="dialog" aria-modal="true" aria-label={title} data-testid={testId} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`ipc-modal ${narrow ? "narrow" : ""} ${wide ? "wide" : ""}`}>
        <div className="ipc-modalHead"><h3>{title}</h3><button type="button" className="ipc-close" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

// The Dulux colour selector: search by colour name or code, or browse a colour family.
function ColourSelector({ title, currentId, builderIds, onSelect, onClose }) {
  const counts = useMemo(() => groupCounts(builderIds), [builderIds]);
  const groups = useMemo(() => COLOUR_GROUPS.filter((group) => counts[group.key] > 0), [counts]);
  const [group, setGroup] = useState(() => groups[0]?.key || "all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const results = useMemo(() => searchColours(query, group, builderIds), [query, group, builderIds]);
  const current = currentId ? findColour(currentId) : null;
  const searching = Boolean(query.trim());
  return (
    <Modal title={`Choose colour - ${title}`} onClose={onClose} testId="dulux-colour-selector" wide>
      <div className="ipc-selectorTools">
        <input type="search" autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE_SIZE); }} placeholder="Search Dulux colour name or code" aria-label="Search Dulux colours" data-testid="dulux-colour-search" />
        {current ? <div className="ipc-current"><i className="ipc-chip" style={swatchStyle(current)} /><span>Current: <b>{current.name}</b> {current.code}</span></div> : null}
      </div>
      <div className="ipc-groups" role="tablist" aria-label="Colour families">
        {groups.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={!searching && group === item.key} className={!searching && group === item.key ? "active" : ""} onClick={() => { setGroup(item.key); setQuery(""); setShown(PAGE_SIZE); }} data-testid={`dulux-colour-group-${item.key}`}>
            {item.label}<small>{counts[item.key]}</small>
          </button>
        ))}
      </div>
      <p className="ipc-resultCount" data-testid="dulux-colour-count">{searching ? `${results.length} Dulux colour${results.length === 1 ? "" : "s"} match “${query.trim()}”` : `${results.length} colours in ${groups.find((item) => item.key === group)?.label || "all colours"}`}</p>
      {results.length ? (
        <div className="ipc-colourGrid" data-testid="dulux-colour-grid">
          {results.slice(0, shown).map((colour) => (
            <article key={colour.id} className={`ipc-colourCard ${colour.id === currentId ? "selected" : ""}`} data-testid="dulux-colour-card" data-colour-id={colour.id} data-colour-name={colour.name} data-colour-code={colour.code}>
              <div className="ipc-cardSwatch" style={{ background: colour.hex, color: readableOn(colour.hex) }}>{colour.id === currentId ? <span>✓ Selected</span> : null}</div>
              <div className="ipc-cardBody">
                <strong>{colour.name}</strong>
                <span>Dulux</span>
                <span>Colour code {colour.code}</span>
                <button type="button" className="ipc-primary" onClick={() => onSelect(colour)} data-testid="dulux-colour-select">{colour.id === currentId ? "Selected" : "Select"}</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="ipc-empty">No Dulux colour matches that search. Check the spelling or try the colour code.</p>}
      {results.length > shown ? <button type="button" className="ipc-secondary ipc-more" onClick={() => setShown(shown + PAGE_SIZE)} data-testid="dulux-colour-more">Show more colours ({results.length - shown} more)</button> : null}
      <p className="ipc-disclaimer" data-testid="dulux-colour-disclaimer">{COLOUR_DISCLAIMER}</p>
    </Modal>
  );
}

const INTERNAL_PAINT_CSS = `
.ipc-shell { display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.ipc-shell button, .ipc-shell input, .ipc-shell select, .ipc-shell textarea { font-size: 16px; font-family: inherit; }
.ipc-shell input, .ipc-shell select, .ipc-shell textarea { background: #fff; color: #0f172a; }
.ipc-shell input::placeholder, .ipc-shell textarea::placeholder { color: #64748b; }
.ipc-shell h2, .ipc-shell h3, .ipc-shell p { margin: 0; }
.ipc-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; }
.ipc-header h2 { margin: 4px 0; font-size: 28px; font-weight: 900; }
.ipc-header p { font-size: 17px; color: #334155; max-width: 62ch; }
.ipc-headerStatus { display: grid; gap: 8px; justify-items: end; }
.ipc-pill { display: inline-block; padding: 8px 16px; border-radius: 999px; background: #fef3c7; color: #78350f; font-weight: 800; font-size: 16px; }
.ipc-pill.done { background: #dcfce7; color: #14532d; }
.ipc-save { font-size: 16px; color: #475569; }
.ipc-save.saved { color: #166534; } .ipc-save.failed { color: #b91c1c; font-weight: 700; }
.ipc-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; }
.ipc-link.danger { color: #b91c1c; }
.ipc-primary, .ipc-secondary { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.ipc-primary { background: #0f766e; color: #fff; border: 0; }
.ipc-primary.large { min-height: 54px; padding: 12px 28px; font-size: 18px; }
.ipc-primary:disabled { background: #94a3b8; cursor: default; }
.ipc-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.ipc-included { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 12px; padding: 16px 22px; display: grid; gap: 6px; }
.ipc-included strong { font-size: 18px; } .ipc-included ul { margin: 0; padding-left: 20px; } .ipc-included p { color: #1e3a8a; font-weight: 700; }
.ipc-block { border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; display: grid; gap: 16px; }
.ipc-block h3 { font-size: 22px; font-weight: 900; }
.ipc-blockHead { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.ipc-blockHead p { color: #475569; margin-top: 2px; }
.ipc-schemeGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
.ipc-surface { border: 1px solid #d7deea; border-radius: 14px; overflow: hidden; display: grid; grid-template-rows: auto 1fr; background: #fff; }
.ipc-surface.chosen { border-color: #0f766e; box-shadow: 0 0 0 1px #0f766e; }
.ipc-swatch { height: 190px; display: grid; place-items: center; border-bottom: 1px solid #d7deea; }
.ipc-swatch.empty { background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 12px, #e2e8f0 12px, #e2e8f0 24px); color: #475569; font-weight: 700; }
.ipc-surfaceBody { display: grid; gap: 6px; padding: 16px 18px 18px; align-content: start; }
.ipc-surfaceBody > span { color: #334155; }
.ipc-eyebrow { font-size: 16px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
.ipc-colourName { font-size: 22px; font-weight: 900; } .ipc-colourName.muted { color: #64748b; }
.ipc-surfaceActions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.ipc-tag { justify-self: start; padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 16px; }
.ipc-tag.standard { background: #e0f2fe; color: #075985; } .ipc-tag.override { background: #fef3c7; color: #78350f; }
.ipc-empty { color: #475569; }
.ipc-list, .ipc-rooms { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ipc-list li { display: flex; align-items: center; gap: 14px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; flex-wrap: wrap; }
.ipc-rowText { display: grid; gap: 2px; flex: 1 1 240px; } .ipc-list li span { color: #334155; }
.ipc-chipRow { display: flex; gap: 4px; flex: 0 0 auto; }
.ipc-rowActions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.ipc-chip { display: inline-block; width: 44px; height: 44px; border-radius: 8px; border: 1px solid #94a3b8; flex: 0 0 auto; background: #f1f5f9; }
.ipc-chip.large { width: 64px; height: 64px; }
.ipc-confirm { display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; }
.ipc-confirm > div { display: grid; gap: 4px; } .ipc-confirm strong { font-size: 20px; } .ipc-confirm span { color: #334155; }
.ipc-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(15, 23, 42, .55); display: grid; place-items: start center; padding: 4vh 16px; overflow-y: auto; }
.ipc-modal { width: min(880px, 100%); background: #fff; border-radius: 16px; padding: 22px 24px 24px; display: grid; gap: 16px; font-size: 16px; color: #0f172a; }
.ipc-modal.narrow { width: min(620px, 100%); } .ipc-modal.wide { width: min(1240px, 100%); }
.ipc-modalHead { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.ipc-modalHead h3 { font-size: 24px; font-weight: 900; }
.ipc-shell .ipc-close { width: 44px; height: 44px; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-size: 26px; line-height: 1; cursor: pointer; }
.ipc-modalActions { display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
.ipc-selectorTools { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.ipc-selectorTools input { flex: 1 1 320px; min-height: 50px; padding: 10px 16px; border-radius: 10px; border: 1px solid #94a3b8; font-size: 18px; }
.ipc-current { display: flex; align-items: center; gap: 10px; }
.ipc-groups { display: flex; gap: 8px; flex-wrap: wrap; }
.ipc-groups button { min-height: 44px; padding: 8px 14px; border-radius: 999px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-weight: 700; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
.ipc-groups button.active { background: #0f172a; color: #fff; border-color: #0f172a; }
.ipc-groups small { font-size: 16px; font-weight: 600; opacity: .7; }
.ipc-resultCount { color: #475569; }
.ipc-colourGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.ipc-colourCard { border: 1px solid #d7deea; border-radius: 14px; overflow: hidden; background: #fff; display: grid; }
.ipc-colourCard.selected { border-color: #0f766e; box-shadow: 0 0 0 2px #0f766e; }
.ipc-cardSwatch { height: 150px; display: grid; place-items: end start; padding: 10px; border-bottom: 1px solid #d7deea; font-weight: 800; }
.ipc-cardBody { display: grid; gap: 3px; padding: 12px 14px 14px; }
.ipc-cardBody strong { font-size: 18px; } .ipc-cardBody span { color: #334155; }
.ipc-cardBody button { margin-top: 8px; }
.ipc-more { justify-self: center; }
.ipc-disclaimer { font-size: 16px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.ipc-houseDefault { border: 1px solid #d7deea; border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; background: #f8fafc; }
.ipc-defaultRow { display: flex; gap: 22px; flex-wrap: wrap; }
.ipc-defaultRow > div { display: flex; gap: 10px; align-items: center; } .ipc-defaultRow span { display: grid; } .ipc-defaultRow b { font-weight: 800; }
.ipc-rooms li { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; display: grid; gap: 14px; }
.ipc-rooms li.open { border-color: #0f766e; }
.ipc-roomHead { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.ipc-roomHead > div { display: grid; gap: 2px; } .ipc-roomHead strong { font-size: 18px; } .ipc-roomHead span { color: #334155; }
.ipc-roomEdit { display: grid; gap: 10px; }
.ipc-roomSurface { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-top: 1px solid #e2e8f0; padding-top: 10px; }
.ipc-roomSurface > div:nth-of-type(1) { display: grid; gap: 2px; flex: 1 1 220px; } .ipc-roomSurface span { color: #334155; }
.ipc-form { display: grid; gap: 14px; }
.ipc-form label, .ipc-formColour { display: grid; gap: 6px; font-weight: 700; }
.ipc-form input, .ipc-form select, .ipc-form textarea { min-height: 46px; padding: 10px 12px; border-radius: 10px; border: 1px solid #94a3b8; font-weight: 400; }
.ipc-formColour > div { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ipc-chip.empty { background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 6px, #e2e8f0 6px, #e2e8f0 12px); }
@media (max-width: 640px) { .ipc-swatch { height: 140px; } .ipc-headerStatus { justify-items: start; } }
`;
