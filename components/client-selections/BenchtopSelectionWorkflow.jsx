// Client Selections > Cabinetry > Benchtops for one room: kitchen-style benches (Kitchen, Butler's
// Pantry, Laundry, ...) and bathroom vanity tops, each asked only what applies to it
// (benchtopProfile). The order is the order a client decides in:
//   1. SETUP            edge, upstand, cut-outs (and waterfall ends on a bench)
//   2. BENCHTOP AREAS   the areas the PROJECT says the room has, with their length
//   3. CHOOSE           a surface / colour for each area
//   4. SELECTED         what was chosen, per area
// Project geometry is not recreated here: the main run, an island the cabinetry scope shows and
// each vanity are listed already; only a length the project does not hold is asked for.
// Each benchtop area takes its own finished thickness (20 / 40 / 60 mm) and, for a vanity top, its
// depth, basin and drop-front (benchtopFabrication.js, 17 Nov 2026), chosen in step 2 beside the
// area itself (18 Nov 2026). The client chooses the finished thickness; the builder view also shows
// the edge construction (solid slab or mitred / built-up) and the fabricator checks. Measurements,
// LM totals, quotation ranges and builder reviews are never shown to the client - they reach the
// Quotation Builder from the same saved data (cabinetryRequirements.js). Templates,
// supplier quotes, sample sign-off and every measurement stay with the builder / fabricator, and the
// quotation range comes from the builder's supplier price group mapping (benchtopRangeMapping.js).
// Readable text is never below 16px.
import { useMemo, useRef, useState } from "react";
import { BENCHTOP_RANGES } from "../../lib/construction-estimation/cabinetryRequirements.js";
import {
  BENCHTOP_AREA_PRESETS, BENCHTOP_SAMPLE_NOTE, BENCHTOP_UPSTAND_OPTIONS, ISLAND_AREA_ID, WATERFALL_END_OPTIONS,
  benchRunFromSchedule, benchtopAreasFor, benchtopDepthsForRoom, benchtopLocationPatch, benchtopProfile, benchtopRangeByKey,
  benchtopRangeKeyFor, benchtopSetupComplete, benchtopSetupFor, clientEdgeProfileOptions, laminateSurfaceForArea, newBenchtopArea, stoneSurfaceForArea,
} from "../../lib/builders/benchtopSelection.js";
import { isIslandArea, islandInheritsMain, mainBenchtopArea, setIslandSameAsMain, surfaceName } from "../../lib/builders/benchtopInheritance.js";
import { BENCHTOP_THICKNESSES, COMPATIBILITY_SUPPORTED, VANITY_DROP_FRONTS, VANITY_TYPE_LABELS, benchtopFabrication, benchtopFabricationReviews, benchtopThicknessOptions, isStoneSurface, vanityBasinOptions, vanityDepthOptions, withThickness } from "../../lib/builders/benchtopFabrication.js";

// A thickness chosen before the stone keeps its millimetres; the edge construction is settled from
// the stone's slab data when the stone is chosen (withThickness). A laminate top clears it.
function fabricationForSurface(area, surface) {
  const current = benchtopFabrication(area);
  return current.thicknessMm ? withThickness({ ...area, surface }, current.thicknessMm) : current;
}

const PAGE_SIZE = 24;
const UNCLASSIFIED = "unclassified";
const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
const RANGE_SOURCE_NOTES = { "supplier-price-group": "from the supplier price group", "job-confirmation": "confirmed earlier on this job", material: "by material", override: "set for this benchtop" };

export default function BenchtopSelectionWorkflow({ location, scheduleLines = [], project = {}, workbook = null, mapping = null, classifications = {}, stoneProducts = [], laminateOptions = [], onChange, onOpenRangeSettings, clientView = false }) {
  const room = location.location || location.name || "";
  const profile = useMemo(() => benchtopProfile(location), [location]);
  const vanity = profile.variant === "vanity";
  const ranges = useMemo(() => ({ mapping, classifications }), [mapping, classifications]);
  const setup = useMemo(() => benchtopSetupFor(location, { scheduleLines, project }), [location, scheduleLines, project]);
  const areas = useMemo(() => benchtopAreasFor(location, { scheduleLines, workbook }), [location, scheduleLines, workbook]);
  const run = useMemo(() => benchRunFromSchedule(scheduleLines, room), [scheduleLines, room]);
  const depths = useMemo(() => benchtopDepthsForRoom(room), [room]);
  const setupDone = benchtopSetupComplete(setup);
  const [editingAreaState, setEditingAreas] = useState(false);
  // Client view: benchtop lengths are the builder's measurement, never asked of the client.
  const editingAreas = editingAreaState && !clientView;
  const [targetId, setTargetId] = useState("");
  const [filters, setFilters] = useState({ material: "", brand: "", range: "", colour: "", search: "" });
  const [shown, setShown] = useState(PAGE_SIZE);
  const [custom, setCustom] = useState(null);
  const [overriding, setOverriding] = useState("");
  const [linkWarning, setLinkWarning] = useState(null);
  const chooser = useRef(null);
  const target = areas.find((area) => area.id === targetId) || areas.find((area) => !area.surface) || areas[0];
  const main = mainBenchtopArea(areas);
  const linked = Boolean(target && islandInheritsMain(target) && main);

  // save: a deliberate choice is stored on the job straight away (without leaving this screen);
  // typing into a field is stored with the next choice or with Save Draft / Next.
  const commit = (nextSetup, nextAreas, save = true) => onChange(benchtopLocationPatch({ location, setup: nextSetup, areas: nextAreas, ranges }), save);
  // Changing the setup after it was confirmed keeps it confirmed; the surfaces follow the change.
  const changeSetup = (patch, save = true) => commit({ ...setup, ...patch }, areas, save);
  const changeArea = (id, patch, save = true) => commit(setup, areas.map((area) => (area.id === id ? { ...area, ...patch, source: patch.lengthMm !== undefined ? "manual" : area.source } : area)), save);
  const toggleCutout = (name) => changeSetup({ cutouts: setup.cutouts.includes(name) ? setup.cutouts.filter((item) => item !== name) : [...setup.cutouts, name] });
  // Removing the island the project listed is remembered, so it is not listed again.
  const removeArea = (area) => commit(area.id === ISLAND_AREA_ID ? { ...setup, islandRemoved: true } : setup, areas.filter((item) => item.id !== area.id));

  // Every surface the room can take, as one list: stone / porcelain / sintered products and laminate.
  const surfaces = useMemo(() => [
    ...stoneProducts.map((product) => ({ id: product.id, kind: "stone", product, brand: product.supplier, name: product.colourName, range: product.collection, colour: product.colourFamily, image: product.primarySwatchImage, code: product.productCode, rangeKey: benchtopRangeKeyFor(product, ranges) })),
    ...laminateOptions.map((bench) => ({ id: bench.id, kind: "laminate", product: bench, brand: bench.supplier, name: `${bench.supplier} laminate`, range: bench.range, colour: "", image: "", code: "", rangeKey: benchtopRangeByKey(bench.rangeKey) ? bench.rangeKey : "standard_laminate" })),
  ], [stoneProducts, laminateOptions, ranges]);
  const materials = BENCHTOP_RANGES.filter((range) => surfaces.some((surface) => surface.rangeKey === range.key));
  const visible = surfaces.filter((surface) => {
    if (filters.material && (filters.material === UNCLASSIFIED ? surface.rangeKey : surface.rangeKey !== filters.material)) return false;
    if (filters.brand && surface.brand !== filters.brand) return false;
    if (filters.range && surface.range !== filters.range) return false;
    if (filters.colour && surface.colour !== filters.colour) return false;
    const search = filters.search.trim().toLowerCase();
    return !search || `${surface.brand} ${surface.name} ${surface.range} ${surface.code}`.toLowerCase().includes(search);
  });
  const inBrand = surfaces.filter((surface) => !filters.brand || surface.brand === filters.brand);
  const setFilter = (key) => (event) => { setFilters((current) => ({ ...current, [key]: event.target.value, ...(key === "brand" ? { range: "" } : {}) })); setShown(PAGE_SIZE); };

  const surfaceFor = (surface, area) => (surface.kind === "laminate" ? laminateSurfaceForArea(surface.product, { area, setup }) : stoneSurfaceForArea(surface.product, { room, area, setup, ranges }));
  function selectSurface(surface) {
    if (!target) return;
    commit(setup, areas.map((area) => {
      if (area.id !== target.id) return area;
      const next = surfaceFor(surface, area);
      return { ...area, surface: next, fabrication: fabricationForSurface(area, next) };
    }));
    setTargetId(target.id);
  }
  const applyToAll = (from) => commit(setup, areas.map((area) => { const next = { ...from.surface, applications: [area.label] }; return { ...area, surface: next, fabrication: fabricationForSurface(area, next) }; }));
  // Island link: ON follows the main benchtop; OFF keeps what it has as the starting point; ON again warns before replacing an independent choice.
  function toggleIslandLink(on, force = false) {
    const result = setIslandSameAsMain(areas, on, { force });
    if (result.blocked) { setLinkWarning({ replacing: result.replacing, with: result.with }); return; }
    setLinkWarning(null);
    commit(setup, result.areas);
  }
  function changeSurface(area) {
    setTargetId(area.id);
    chooser.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  // A deliberate, builder-level exception for one benchtop. Empty returns it to the mapped range.
  const overrideRange = (area, rangeKey) => { commit(setup, areas.map((item) => (item.id === area.id ? { ...item, surface: { ...item.surface, rangeOverrideKey: rangeKey, ...(rangeKey ? {} : { rangeKey: "", benchtopRangeKey: "" }) } } : item))); setOverriding(""); };
  function saveCustom() {
    if (!target || !custom?.name.trim()) return;
    const surface = { materialChoice: "custom", supplier: custom.supplier.trim(), colourName: custom.name.trim(), colour: custom.name.trim(), range: custom.name.trim(), productRange: custom.name.trim(), collection: "", productId: `custom-${Date.now().toString(36)}`, rangeKey: custom.rangeKey, benchtopRangeKey: custom.rangeKey,
      rangeOverrideKey: custom.rangeKey, rangeSource: "override", classificationKey: "", applications: [target.label], edgeProfile: setup.edgeProfile, waterfallEnds: setup.waterfallEnds, cutouts: setup.cutouts, priceStatus: "quote_required", pricingStatus: "quote_required", supplierConfirmationStatus: "required" };
    commit(setup, areas.map((area) => (area.id === target.id ? { ...area, surface } : area)));
    setCustom(null);
  }

  if (vanity && !areas.length) {
    return <div className="bts-shell" data-testid="benchtop-selection" data-room={room} data-variant="vanity"><style>{BENCHTOP_CSS}</style><section className="bts-block"><h3>Vanity benchtop</h3><p className="bts-muted" data-testid="benchtop-none">{room} has no vanity in its cabinet schedule, so there is no vanity benchtop to choose.</p></section></div>;
  }

  return (
    <div className="bts-shell" data-testid="benchtop-selection" data-room={room} data-variant={profile.variant} data-setup-complete={setupDone ? "true" : "false"}>
      <style>{BENCHTOP_CSS}</style>

      <section className="bts-block" data-testid="benchtop-setup">
        <div className="bts-head"><div><span className="bts-step">Step 1</span><h3>{vanity ? "Vanity benchtop setup" : "Benchtop setup"}</h3><p>{vanity ? `How the ${room} vanity benchtop is finished.` : `How the ${room} benchtops are finished. This applies to every benchtop in the room.`}</p></div>
          {setupDone ? <span className="bts-pill done" data-testid="benchtop-setup-status">✓ Setup confirmed</span> : <span className="bts-pill" data-testid="benchtop-setup-status">Confirm to continue</span>}</div>
        <div className="bts-fields">
          <label><span>Edge profile</span><select value={setup.edgeProfile} onChange={(event) => changeSetup({ edgeProfile: event.target.value })} data-testid="benchtop-edge">{clientEdgeProfileOptions(profile.edgeProfiles, setup.edgeProfile).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {profile.waterfall ? <label><span>Waterfall ends</span><select value={setup.waterfallEnds} onChange={(event) => changeSetup({ waterfallEnds: event.target.value })} data-testid="benchtop-waterfall">{WATERFALL_END_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
          <label><span>{vanity ? "Upstand / splashback" : "Upstand"}</span><select value={setup.upstand} onChange={(event) => changeSetup({ upstand: event.target.value })} data-testid="benchtop-upstand">{BENCHTOP_UPSTAND_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
          {setup.upstand === "Custom" ? <label><span>Upstand height (mm)</span><input type="number" min="0" step="10" value={setup.upstandCustomMm} onChange={(event) => changeSetup({ upstandCustomMm: event.target.value }, false)} data-testid="benchtop-upstand-custom" /></label> : null}
        </div>
        <fieldset className="bts-cutouts">
          <legend>Cut-outs</legend>
          {profile.cutouts.map((name) => <label key={name}><input type="checkbox" checked={setup.cutouts.includes(name)} onChange={() => toggleCutout(name)} data-testid={`benchtop-cutout-${name.toLowerCase()}`} /><span>{profile.cutoutLabels[name]}</span></label>)}
          {setup.cutouts.includes("Other") ? <input value={setup.cutoutNote} onChange={(event) => changeSetup({ cutoutNote: event.target.value }, false)} placeholder="What is the other cut-out for?" aria-label="Other cut-out" /> : null}
        </fieldset>
        {setup.prefilledCutouts?.length ? <p className="bts-note" data-testid="benchtop-prefilled">Already ticked from this project: {setup.prefilledCutouts.map((name) => profile.cutoutLabels[name]).join(", ")}.</p> : null}
        {setupDone ? null : <div className="bts-actions"><button type="button" className="bts-primary" onClick={() => changeSetup({ confirmedAt: new Date().toISOString() })} data-testid="benchtop-setup-confirm">Confirm {vanity ? "vanity benchtop" : "benchtop"} setup</button></div>}
      </section>

      <section className="bts-block" data-testid="benchtop-areas">
        <div className="bts-head"><div><span className="bts-step">Step 2</span><h3>{vanity ? "Vanity benchtops" : "Benchtop areas"}</h3><p>{vanity ? "Choose the thickness, depth and basin for each vanity benchtop." : "Choose the finished stone thickness for each benchtop."}</p></div>
          {clientView ? null : <button type="button" className="bts-secondary" onClick={() => { if (editingAreas) commit(setup, areas); setEditingAreas((value) => !value); }} data-testid="benchtop-edit-dimensions">{editingAreas ? "Done" : "Edit benchtop areas"}</button>}</div>
        {editingAreas ? (
          <table className="bts-areas">
            <tbody>
              {areas.map((area) => (
                <tr key={area.id} data-testid="benchtop-area" data-area={area.label} data-source={area.source}>
                  <td>{profile.canAddAreas ? <label><span>Benchtop</span><input value={area.label} onChange={(event) => changeArea(area.id, { label: event.target.value }, false)} data-testid="benchtop-area-label" /></label> : <strong>{area.label}</strong>}</td>
                  {/* No length entry or LM figure in Client Selections: lengths come from the approved takeoff or the builder in the Quotation Builder. */}
                  <td>{depths.length > 1 ? <label><span>Width</span><select value={area.depthMm} onChange={(event) => changeArea(area.id, { depthMm: Number(event.target.value) })} data-testid="benchtop-area-depth">{depths.map((depth) => <option key={depth} value={depth}>{depth} mm</option>)}</select></label> : <span>{area.depthMm} mm wide</span>}</td>
                  <td>{profile.canAddAreas && areas.length > 1 ? <button type="button" className="bts-link danger" onClick={() => removeArea(area)} data-testid="benchtop-area-remove">Remove</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="bts-areaRows">
            {areas.map((area) => (
              <div key={area.id} className="bts-areaRow" data-testid="benchtop-area" data-area={area.label} data-source={area.source}>
                <div className="bts-areaName">
                  <h4>{area.label}</h4>
                  <span>{area.surface ? surfaceName(area.surface) : "Stone not chosen yet"}</span>
                </div>
                <BenchtopFabricationFields area={area} room={room} vanity={vanity} clientView={clientView} onChange={(fabrication) => changeArea(area.id, { fabrication })} />
              </div>
            ))}
          </div>
        )}
        {editingAreas && profile.canAddAreas ? (
          <div className="bts-actions start">
            <label className="bts-inline"><span>Add a benchtop the project does not show</span><select value="" onChange={(event) => { if (event.target.value) commit(setup, [...areas, newBenchtopArea(event.target.value === "Other" ? "Benchtop" : event.target.value === "Island" ? "Island benchtop" : event.target.value, { depthMm: depths.includes(900) && /island|breakfast/i.test(event.target.value) ? 900 : depths[0] })]); }} data-testid="benchtop-add-area"><option value="">Choose…</option>{BENCHTOP_AREA_PRESETS.filter((name) => name !== "Island" || !areas.some((area) => /\bisland\b/i.test(area.label))).map((name) => <option key={name}>{name}</option>)}</select></label>
          </div>
        ) : null}
      </section>

      <section className="bts-block" ref={chooser} data-testid="benchtop-chooser" data-locked={setupDone ? "false" : "true"}>
        <div className="bts-head"><div><span className="bts-step">Step 3</span><h3>{vanity ? "Choose your vanity benchtop" : "Choose your benchtop"}</h3><p>{setupDone ? "Pick the surface and colour." : "Confirm the setup above first."}</p></div>
          {onOpenRangeSettings ? <button type="button" className="bts-link" onClick={onOpenRangeSettings} data-testid="benchtop-range-settings">Supplier price groups</button> : null}</div>
        {setupDone ? (
          <>
            {areas.length > 1 ? <div className="bts-targets" role="tablist" aria-label="Benchtop being chosen" data-testid="benchtop-targets">{areas.map((area) => <button key={area.id} type="button" role="tab" aria-selected={target?.id === area.id} className={target?.id === area.id ? "active" : ""} onClick={() => setTargetId(area.id)} data-testid="benchtop-target" data-area={area.label}>{area.label}<small>{area.surface ? `${area.surface.supplier || ""} ${area.surface.colourName || area.surface.range || ""}`.trim() : "Not chosen"}</small></button>)}</div> : null}
            {target && isIslandArea(target) && main ? (
              <div className="bts-link-panel" data-testid="benchtop-island-link" data-linked={linked ? "true" : "false"}>
                <label className="bts-check"><input type="checkbox" checked={linked} onChange={(event) => toggleIslandLink(event.target.checked)} data-testid="benchtop-island-same-as-main" /><span>Use same benchtop as Main Benchtop</span></label>
                {linked ? <p className="bts-muted" data-testid="benchtop-island-inherited">{main.surface ? `The island follows the Main benchtop: ${surfaceName(main.surface)}. Change the Main benchtop and the island changes with it.` : "The island will take the Main benchtop's selection as soon as one is chosen."}</p>
                  : <p className="bts-muted">The island has its own selection. The Main benchtop no longer changes it.</p>}
                {!linked && target.surface ? (
                  <label className="bts-inline"><span>Island edge profile</span><select value={target.edgeProfile || setup.edgeProfile} onChange={(event) => changeArea(target.id, { edgeProfile: event.target.value })} data-testid="benchtop-island-edge">{clientEdgeProfileOptions(profile.edgeProfiles, target.edgeProfile || setup.edgeProfile).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                ) : null}
                {linkWarning ? (
                  <div className="bts-note warn" role="alertdialog" data-testid="benchtop-island-link-warning">
                    <p>Turning this on replaces the island's own selection ({linkWarning.replacing}) with the Main benchtop ({linkWarning.with}).</p>
                    <div className="bts-actions start"><button type="button" className="bts-secondary" onClick={() => setLinkWarning(null)} data-testid="benchtop-island-link-keep">Keep the island's own selection</button><button type="button" className="bts-primary" onClick={() => toggleIslandLink(true, true)} data-testid="benchtop-island-link-replace">Replace with the Main benchtop</button></div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {linked ? null : <>
            <div className="bts-filters" data-testid="benchtop-filters">
              <label><span>Material</span><select value={filters.material} onChange={setFilter("material")} data-testid="benchtop-filter-material"><option value="">All materials</option>{materials.map((range) => <option key={range.key} value={range.key}>{range.label}</option>)}{surfaces.some((surface) => !surface.rangeKey) ? <option value={UNCLASSIFIED}>Range not yet set</option> : null}</select></label>
              <label><span>Brand</span><select value={filters.brand} onChange={setFilter("brand")} data-testid="benchtop-filter-brand"><option value="">All brands</option>{unique(surfaces.map((surface) => surface.brand)).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Colour</span><select value={filters.colour} onChange={setFilter("colour")}><option value="">All colours</option>{unique(inBrand.map((surface) => surface.colour)).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Range</span><select value={filters.range} onChange={setFilter("range")}><option value="">All ranges</option>{unique(inBrand.map((surface) => surface.range)).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Search</span><input value={filters.search} onChange={setFilter("search")} placeholder="Colour or product code" data-testid="benchtop-search" /></label>
            </div>
            <p className="bts-muted" data-testid="benchtop-result-count">{visible.length} surface{visible.length === 1 ? "" : "s"}{target && areas.length > 1 ? ` · choosing for ${target.label}` : ""}</p>
            <div className="bts-grid" data-testid="benchtop-product-grid">
              {visible.slice(0, shown).map((surface) => {
                const selected = target?.surface && (target.surface.productId || target.surface.id) === surface.id;
                return (
                  <article key={surface.id} className={`bts-card ${selected ? "selected" : ""}`} data-testid="benchtop-product" data-product-name={surface.name} data-brand={surface.brand} data-range-key={surface.rangeKey}>
                    {surface.image ? <img src={surface.image} alt={`${surface.brand} ${surface.name}`} loading="lazy" /> : <div className="bts-noImage">{surface.kind === "laminate" ? "Laminate" : "Image not available"}</div>}
                    <div className="bts-cardBody">
                      <span>{surface.brand}</span>
                      <strong>{surface.name}</strong>
                      <span>{surface.range}</span>
                      {benchtopRangeByKey(surface.rangeKey) ? <span className="bts-muted">{benchtopRangeByKey(surface.rangeKey).label}</span> : null}
                      <button type="button" className={selected ? "bts-secondary" : "bts-primary"} onClick={() => selectSurface(surface)} data-testid="benchtop-select">{selected ? "✓ Selected" : "Select surface"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
            {visible.length > shown ? <button type="button" className="bts-secondary bts-more" onClick={() => setShown(shown + PAGE_SIZE)}>Show more ({visible.length - shown} more)</button> : null}
            {custom ? (
              <div className="bts-custom" data-testid="benchtop-custom">
                <div className="bts-fields">
                  <label><span>Supplier</span><input value={custom.supplier} onChange={(event) => setCustom({ ...custom, supplier: event.target.value })} /></label>
                  <label><span>Product / colour</span><input value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })} /></label>
                  <label><span>Material</span><select value={custom.rangeKey} onChange={(event) => setCustom({ ...custom, rangeKey: event.target.value })}><option value="">Choose…</option>{BENCHTOP_RANGES.map((range) => <option key={range.key} value={range.key}>{range.label}</option>)}</select></label>
                </div>
                <div className="bts-actions"><button type="button" className="bts-secondary" onClick={() => setCustom(null)}>Cancel</button><button type="button" className="bts-primary" disabled={!custom.name.trim()} onClick={saveCustom}>Use this surface{target && areas.length > 1 ? ` for ${target.label}` : ""}</button></div>
              </div>
            ) : <button type="button" className="bts-link" onClick={() => setCustom({ supplier: "", name: "", rangeKey: "" })} data-testid="benchtop-custom-open">The surface is not listed</button>}
            </>}
          </>
        ) : null}
      </section>

      {areas.some((area) => area.surface) ? (
        <section className="bts-block" data-testid="benchtop-selected">
          <div className="bts-head"><div><span className="bts-step">Step 4</span><h3>Selected {vanity ? "vanity " : ""}benchtop{areas.filter((area) => area.surface).length > 1 ? "s" : ""}</h3></div></div>
          <div className="bts-summaries">
            {areas.filter((area) => area.surface).map((area) => {
              const surface = area.surface;
              const range = benchtopRangeByKey(surface.rangeKey);
              const others = areas.filter((item) => item.id !== area.id && (item.surface?.productId || item.surface?.id) !== (surface.productId || surface.id));
              const group = [surface.supplier, surface.supplierPriceGroup || surface.collection].filter(Boolean).join(" ");
              return (
                <article key={area.id} className="bts-summary" data-testid="benchtop-summary" data-area={area.label} data-product-name={surface.colourName || surface.range || ""} data-range-key={surface.rangeKey || ""} data-range-source={surface.rangeSource || ""}>
                  {surface.slabImage ? <img src={surface.slabImage} alt={`${surface.supplier} ${surface.colourName}`} /> : <div className="bts-noImage">{surface.materialChoice === "laminate" ? "Laminate" : "No image"}</div>}
                  <div className="bts-summaryBody">
                    <span className="bts-eyebrow">{area.label}{surface.inheritedFromAreaId && islandInheritsMain(area) ? " (same as Main benchtop)" : ""}</span>
                    <strong className="bts-name">{surface.supplier} {surface.colourName || surface.range}</strong>
                    {(() => {
                      // What the client chose, in plain words. Pricing, ranges, quantities and builder checks
                      // stay in the data for the Quotation Builder (18 Nov 2026).
                      const fabrication = benchtopFabrication(area);
                      const upstand = setup.upstand === "Custom" ? `${setup.upstandCustomMm || "Custom"} mm` : setup.upstand;
                      const cutouts = setup.cutouts.map((name) => profile.cutoutLabels[name]).join(", ");
                      return (
                        <dl data-testid="benchtop-summary-details">
                          <div><dt>Brand</dt><dd>{surface.supplier || "Not recorded"}</dd></div>
                          <div><dt>Range</dt><dd>{surface.collection || surface.range || "Not recorded"}</dd></div>
                          <div><dt>Colour</dt><dd>{surface.colourName || surface.colour || "Not recorded"}</dd></div>
                          {isStoneSurface(surface) ? <div><dt>Finished thickness</dt><dd data-testid="benchtop-summary-thickness">{fabrication.thicknessMm ? `${fabrication.thicknessMm} mm` : "Choose in Benchtop areas above"}</dd></div> : null}
                          <div><dt>Edge profile</dt><dd>{area.edgeProfile || setup.edgeProfile}</dd></div>
                          {profile.waterfall && setup.waterfallEnds && setup.waterfallEnds !== "None" ? <div><dt>Waterfall ends</dt><dd>{setup.waterfallEnds}</dd></div> : null}
                          {upstand && upstand !== "None" ? <div><dt>Upstand</dt><dd>{upstand}</dd></div> : null}
                          {vanity && fabrication.basinType ? <div><dt>Basin</dt><dd>{fabrication.basinType}{fabrication.dropFrontMm ? ` · ${fabrication.dropFrontMm} mm drop-front` : ""}</dd></div> : null}
                          {cutouts ? <div><dt>Cut-outs</dt><dd>{cutouts}</dd></div> : null}
                          {clientView ? null : <div><dt>Quotation classification</dt><dd data-testid="benchtop-classification">{range ? <>{range.label}{RANGE_SOURCE_NOTES[surface.rangeSource] ? <span className="bts-muted"> · {RANGE_SOURCE_NOTES[surface.rangeSource]}</span> : null}</> : <b className="bts-warn">Not set for {group || "this surface"}</b>}</dd></div>}
                        </dl>
                      );
                    })()}
                    {!range && !clientView ? <p className="bts-note warn" data-testid="benchtop-range-missing">The builder has not yet set which quotation range {group || "this surface"} belongs to, so this benchtop is not priced in the quotation yet.{onOpenRangeSettings ? <> <button type="button" className="bts-link" onClick={onOpenRangeSettings}>Set supplier price groups</button></> : null}</p> : null}
                    <div className="bts-actions start">
                      <button type="button" className="bts-secondary" onClick={() => changeSurface(area)} data-testid="benchtop-change-surface">Change surface</button>
                      {others.length ? <button type="button" className="bts-secondary" onClick={() => applyToAll(area)} data-testid="benchtop-apply-all">Apply this surface to all {room} benchtops</button> : null}
                      {overriding === area.id ? (
                        <label className="bts-inline"><span>Quotation range for this benchtop only</span><select value={surface.rangeOverrideKey || ""} onChange={(event) => overrideRange(area, event.target.value)} data-testid="benchtop-override-select"><option value="">Use the supplier price group</option>{BENCHTOP_RANGES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                      ) : clientView ? null : <button type="button" className="bts-link" onClick={() => setOverriding(area.id)} data-testid="benchtop-override-open">Builder: override quotation range</button>}
                    </div>
                    {surface.materialChoice === "stone" ? <p className="bts-sample">{BENCHTOP_SAMPLE_NOTE}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Thickness, edge construction and (vanity tops) depth, basin and drop-front for ONE benchtop area.
// Each area keeps its own: the same stone on another benchtop never copies these (benchtopFabrication.js).
function BenchtopFabricationFields({ area, room, vanity, clientView, onChange }) {
  const surface = area.surface;
  const fabrication = benchtopFabrication(area);
  const stone = !surface || isStoneSurface(surface);
  // With a stone chosen, its slab data decides what is offered; before that, the three finished thicknesses.
  const thicknesses = surface ? benchtopThicknessOptions(surface) : BENCHTOP_THICKNESSES.map((thicknessMm) => ({ thicknessMm, constructions: [] }));
  const option = surface ? thicknesses.find((item) => item.thicknessMm === fabrication.thicknessMm) : null;
  const reviews = clientView ? [] : benchtopFabricationReviews(area, { room });
  const set = (patch) => onChange({ ...fabrication, ...patch });
  const chooseThickness = (value) => onChange(surface ? withThickness(area, value) : { ...fabrication, thicknessMm: Number(value) || "", edgeConstruction: "" });
  const confirm = (item) => (clientView || !item.constructions.length || item.constructions.some((construction) => construction.status === COMPATIBILITY_SUPPORTED) ? "" : " (builder to confirm)");
  return (
    <div className="bts-fabrication" data-testid="benchtop-fabrication" data-area={area.label}>
      <div className="bts-fields">
        {stone && thicknesses.length ? (
          <label><span>Stone thickness</span>
            <select value={fabrication.thicknessMm || ""} onChange={(event) => chooseThickness(event.target.value)} data-testid="benchtop-thickness">
              <option value="">Choose…</option>
              {thicknesses.map((item) => <option key={item.thicknessMm} value={item.thicknessMm}>{item.thicknessMm} mm{confirm(item)}</option>)}
            </select>
          </label>
        ) : <p className="bts-muted" data-testid="benchtop-thickness-na">Laminate — standard thickness</p>}
        {!clientView && option ? (
          <label><span>Edge construction (builder)</span>
            <select value={fabrication.edgeConstruction} onChange={(event) => set({ edgeConstruction: event.target.value })} data-testid="benchtop-edge-construction">
              {option.constructions.map((construction) => <option key={construction.key} value={construction.key}>{construction.label}{construction.status === COMPATIBILITY_SUPPORTED ? "" : " - builder to confirm"}</option>)}
            </select>
          </label>
        ) : null}
        {vanity ? (
          <>
            <p className="bts-vanityType" data-testid="benchtop-vanity-type"><b>Vanity</b> {VANITY_TYPE_LABELS[area.id] || "Vanity"}</p>
            <label><span>Benchtop depth</span>
              <select value={fabrication.vanityDepthMm || ""} onChange={(event) => set({ vanityDepthMm: Number(event.target.value) || "" })} data-testid="benchtop-vanity-depth">
                <option value="">Choose…</option>
                {vanityDepthOptions(area.id).map((depth) => <option key={depth} value={depth}>{depth} mm{depth === 350 ? " (narrow wall-hung)" : ""}</option>)}
              </select>
            </label>
            <label><span>Basin</span>
              <select value={fabrication.basinType} onChange={(event) => set({ basinType: event.target.value })} data-testid="benchtop-basin">
                <option value="">Choose…</option>
                {vanityBasinOptions(surface).map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            {stone ? (
              <label><span>Stone drop-front</span>
                <select value={fabrication.dropFrontMm || ""} onChange={(event) => set({ dropFrontMm: Number(event.target.value) || "" })} data-testid="benchtop-drop-front">
                  <option value="">None</option>
                  {VANITY_DROP_FRONTS.map((mm) => <option key={mm} value={mm}>{mm} mm</option>)}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
      </div>
      {reviews.length ? (
        <div className="bts-note warn" data-testid="benchtop-fabrication-review">
          <strong>Builder / stone fabricator to confirm</strong>
          <ul>{reviews.map((review) => <li key={review}>{review}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

const BENCHTOP_CSS = `
.bts-shell { display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.bts-shell h3, .bts-shell p, .bts-shell dl, .bts-shell dd { margin: 0; }
.bts-shell button, .bts-shell input, .bts-shell select { font-size: 16px; font-family: inherit; }
.bts-block { border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; display: grid; gap: 16px; }
.bts-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.bts-head h3 { font-size: 24px; font-weight: 900; color: #071827; } .bts-head p { color: #334155; margin-top: 2px; }
.bts-step, .bts-eyebrow { font-size: 16px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
.bts-pill { padding: 8px 16px; border-radius: 999px; background: #fef3c7; color: #78350f; font-weight: 800; } .bts-pill.done { background: #dcfce7; color: #14532d; }
.bts-fields, .bts-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.bts-shell label { display: grid; gap: 6px; font-weight: 700; }
.bts-shell label input, .bts-shell label select { min-height: 46px; font-weight: 400; }
.bts-cutouts { border: 0; padding: 0; margin: 0; display: flex; gap: 12px 22px; flex-wrap: wrap; align-items: center; }
.bts-cutouts legend { font-weight: 700; padding: 0; margin-bottom: 8px; }
.bts-cutouts label { display: flex; gap: 10px; align-items: center; font-weight: 600; border: 1px solid #d7deea; border-radius: 10px; padding: 10px 16px; cursor: pointer; }
.bts-cutouts label input { min-height: 0; width: 22px; height: 22px; margin: 0 !important; }
.bts-cutouts > input { flex: 1 1 260px; min-height: 46px; }
.bts-note { color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; }
.bts-note.warn { color: #78350f; background: #fffbeb; border-color: #fcd34d; font-weight: 600; }
.bts-warn { color: #b45309; } .bts-muted { color: #64748b; }
.bts-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px 18px; flex-wrap: wrap; } .bts-actions.start { justify-content: flex-start; }
.bts-primary, .bts-secondary { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.bts-primary { background: #0f766e; color: #fff; border: 0; } .bts-primary:disabled { background: #94a3b8; cursor: default; }
.bts-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.bts-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; justify-self: start; } .bts-link.danger { color: #b91c1c; }
.bts-areas { width: 100%; border-collapse: collapse; }
.bts-areas th, .bts-areas td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 17px; vertical-align: bottom; }
.bts-areas th { font-weight: 800; } .bts-areas tfoot th, .bts-areas tfoot td { border-bottom: 0; font-weight: 900; font-size: 19px; }
.bts-inline { max-width: 360px; }
.bts-targets { display: flex; gap: 10px; flex-wrap: wrap; }
.bts-targets button { display: grid; gap: 2px; text-align: left; min-height: 56px; padding: 8px 18px; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-weight: 800; cursor: pointer; }
.bts-targets button.active { border-color: #0f766e; box-shadow: 0 0 0 2px #0f766e; } .bts-targets small { font-size: 16px; font-weight: 500; color: #475569; }
.bts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.bts-card { border: 1px solid #d7deea; border-radius: 14px; overflow: hidden; display: grid; grid-template-rows: auto 1fr; background: #fff; }
.bts-card.selected { border-color: #0f766e; box-shadow: 0 0 0 2px #0f766e; }
.bts-card img, .bts-card .bts-noImage { width: 100%; height: 150px; object-fit: cover; }
.bts-noImage { display: grid; place-items: center; background: #f1f5f9; color: #475569; font-weight: 700; }
.bts-cardBody { display: grid; gap: 3px; padding: 12px 14px 14px; align-content: start; } .bts-cardBody strong { font-size: 19px; } .bts-cardBody span { color: #334155; }
.bts-cardBody button { margin-top: 8px; }
.bts-more { justify-self: center; }
.bts-custom { border: 1px solid #d7deea; border-radius: 12px; padding: 16px; display: grid; gap: 14px; }
.bts-summaries { display: grid; gap: 16px; }
.bts-summary { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; gap: 20px; border: 1px solid #0f766e; border-radius: 14px; padding: 16px; }
.bts-summary > img, .bts-summary > .bts-noImage { width: 100%; height: 100%; min-height: 200px; max-height: 320px; object-fit: cover; border-radius: 10px; }
.bts-summaryBody { display: grid; gap: 10px; align-content: start; }
.bts-name { font-size: 24px; font-weight: 900; }
.bts-summary dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 20px; }
.bts-summary dl div { display: grid; gap: 2px; } .bts-summary dt { font-weight: 700; color: #475569; } .bts-summary dd { font-size: 17px; }
.bts-sample { color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
@media (max-width: 720px) { .bts-summary { grid-template-columns: 1fr; } }
.bts-fabrication { display: grid; gap: 12px; }
.bts-areaRows { display: grid; gap: 14px; }
.bts-areaRow { display: grid; grid-template-columns: minmax(200px, 260px) 1fr; gap: 14px 22px; align-items: start; border: 1px solid #d7deea; border-left: 5px solid #0f766e; border-radius: 12px; padding: 16px 18px; background: #f8fafc; }
.bts-areaName { display: grid; gap: 4px; } .bts-areaName h4 { margin: 0; font-size: 20px; font-weight: 900; color: #071827; } .bts-areaName span { color: #475569; }
@media (max-width: 720px) { .bts-areaRow { grid-template-columns: 1fr; } }
.bts-fabrication ul { margin: 6px 0 0; padding-left: 20px; } .bts-vanityType { align-self: end; font-size: 17px; }
.bts-link-panel { border: 1px solid #99f6e4; background: #f0fdfa; border-radius: 10px; padding: 14px 16px; display: grid; gap: 10px; }
.bts-shell label.bts-check { display: flex; align-items: center; gap: 10px; }
.bts-shell label.bts-check input { min-height: 0; width: 22px; height: 22px; }
`;
