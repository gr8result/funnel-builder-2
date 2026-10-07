import React, { useMemo, useState } from 'react';
import colourCatalogue from '../../data/product-library/catalogues/residential/AU-DULUX-COLOURS.json';
import { getEffectiveProductCatalogue } from '../../lib/product-library/catalogueService.js';
import { PAINT_SURFACES, paintSchemeFromInclusions, paintChoiceErrors, paintSchemeComplete, paintQuotationRequirements, snapshotPaintScheme, paintLitres } from '../../lib/builders/paintScheme.js';

export default function PaintSchemeWorkflow({ organisationId, workbook = {}, selection, projectRoomNames = [], onSave, onBack }) {
  const products = useMemo(() => getEffectiveProductCatalogue({ organisationId }).products.filter(p => ['paint', 'exterior-paint'].includes(p.familyKey) && p.attributes?.availableFinishes?.length), [organisationId]);
  const colours = colourCatalogue.colours;
  const saved = selection?.selected_details?.paintScheme;
  const [scheme, setScheme] = useState(() => saved || paintSchemeFromInclusions(workbook.standardInclusions || {}, products, colours));
  const [surface, setSurface] = useState('walls');
  const [mode, setMode] = useState('default');
  const [location, setLocation] = useState('');
  const [wall, setWall] = useState('');
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [page, setPage] = useState(0);
  const [choice, setChoice] = useState(() => saved?.defaults?.walls || {});
  const [message, setMessage] = useState('');
  const requirements = paintQuotationRequirements(workbook);
  const product = products.find(p => p.productCode === choice.productCode);
  const matching = colours.filter(c => (!product || c.manufacturer === product.manufacturer) && (!family || c.family === family) && (!query || `${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b) => a.displayPriority - b.displayPriority || a.name.localeCompare(b.name));
  const selectedColour = colours.find(c => c.id === choice.colourId);
  const updateChoice = patch => setChoice(c => ({ ...c, ...patch }));
  const edit = key => { setSurface(key); setMode('default'); setChoice(scheme.defaults[key] || {}); setMessage(''); };
  const persist = async next => {
    setMessage('Saving paint selection...');
    const saved = await onSave(snapshotPaintScheme(next, products, colours));
    if (!saved) { setMessage('Paint selection could not be saved. Please retry.'); return; }
    setScheme(next);
    setMessage('Paint selection saved.');
  };
  const apply = async () => {
    const errors = paintChoiceErrors(choice, products, colours);
    if (mode !== 'default' && !location.trim()) errors.push('Enter a project location');
    if (mode === 'feature' && !wall.trim()) errors.push('Describe the feature wall');
    if (errors.length) { setMessage(errors.join('. ')); return; }
    let next = { ...scheme, confirmed: false };
    if (mode === 'default') next.defaults = { ...scheme.defaults, [surface]: { ...choice } };
    else if (mode === 'override') next.overrides = [...scheme.overrides.filter(o => !(o.surface === surface && o.location === location)), { surface, location, choice: { ...choice } }];
    else next.featureWalls = [...scheme.featureWalls.filter(o => !(o.location === location && o.wall === wall)), { id: `${location}:${wall}`, surface: 'feature-wall', location, wall, areaM2: area === '' ? null : Number(area), choice: { ...choice } }];
    await persist(next); setMessage('Paint selection saved.');
  };
  return <section className="paintScheme" data-testid="paint-scheme-workflow">
    <button type="button" onClick={onBack}>← Interior</button>
    <h2>House paint scheme</h2>
    <p>Set house defaults, then override individual locations. Screen colours are indicative. Confirm final colour using a physical Dulux sample before ordering.</p>
    {['interior','exterior'].map(areaGroup => <div key={areaGroup}><h3>{areaGroup === 'interior' ? 'Interior paint scheme' : 'Exterior paint scheme'}</h3><div className="paintSummary">{PAINT_SURFACES.filter(s => s.area === areaGroup).map(s => { const c = scheme.defaults[s.key]; const colour = colours.find(v => v.id === c?.colourId); const p = products.find(v => v.productCode === c?.productCode); return <button type="button" key={s.key} onClick={() => edit(s.key)}>
      <span className="chip" style={{ background: colour?.hex || '#eee' }} /><strong>{s.label}{s.required ? ' *' : ''}</strong><small>{colour?.name || 'Choose colour'}</small><small>{p?.productName || ''} {c?.finish || ''}</small>
    </button>; })}</div></div>)}
    <h3>{PAINT_SURFACES.find(s => s.key === surface)?.label}</h3>
    <div className="paintFields">
      <label>Application<select value={mode} onChange={e => setMode(e.target.value)}><option value="default">House default</option><option value="override">Room override</option><option value="feature">Add feature wall</option></select></label>
      {mode !== 'default' && <label>Location<input list="paint-locations" value={location} onChange={e => setLocation(e.target.value)} /><datalist id="paint-locations">{[...new Set([...projectRoomNames, ...requirements.map(r => r.location)])].map(n => <option key={n} value={n} />)}</datalist></label>}
      {mode === 'feature' && <><label>Wall description<input value={wall} onChange={e => setWall(e.target.value)} placeholder="North wall" /></label><label>Measured area (m²)<input type="number" min="0" value={area} onChange={e => setArea(e.target.value)} /></label></>}
      <label>Paint product<select value={choice.productCode || ''} onChange={e => { const p = products.find(v => v.productCode === e.target.value); updateChoice({ productCode: e.target.value, finish: p?.attributes.availableFinishes[0] || '' }); }}><option value="">Choose product</option>{products.map(p => <option key={p.productCode} value={p.productCode}>{p.productName} — {p.productType}</option>)}</select></label>
      <label>Finish<select value={choice.finish || ''} onChange={e => updateChoice({ finish: e.target.value })}><option value="">Choose finish</option>{(product?.attributes.availableFinishes || []).map(f => <option key={f}>{f}</option>)}</select></label>
      <label>Search colour name or code<input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      <label>Colour family<select value={family} onChange={e => { setFamily(e.target.value); setPage(0); }}><option value="">All families</option>{[...new Set(colours.map(c => c.family))].map(f => <option key={f}>{f}</option>)}</select></label>
    </div>
    <p>{selectedColour ? `Selected: ${selectedColour.name} (${selectedColour.code})` : 'Choose a colour below'}</p>
    <div className="paintColours">{matching.slice(page * 48, (page + 1) * 48).map(c => <button type="button" key={c.id} aria-pressed={choice.colourId === c.id} onClick={() => updateChoice({ colourId: c.id })}><span className="swatch" style={{ background: c.hex }} /><strong>{c.name}</strong><small>{c.manufacturer} · {c.code}</small></button>)}</div>
    <div className="paintActions"><button type="button" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>{matching.length} colours · Page {page + 1}</span><button type="button" disabled={(page + 1) * 48 >= matching.length} onClick={() => setPage(p => p + 1)}>Next</button></div>
    <button type="button" className="primary" onClick={apply}>{mode === 'default' ? 'Apply as house default' : mode === 'feature' ? 'Save feature wall' : 'Save room override'}</button>
    <p role="status">{message}</p>
    <h3>Room overrides and feature walls</h3>
    {[...scheme.overrides.map(o => ({ ...o, kind: 'override' })), ...scheme.featureWalls.map(o => ({ ...o, kind: 'feature' }))].map((o,i) => <div className="paintOverride" key={`${o.kind}:${o.location}:${o.surface}:${i}`}><span>{o.location} · {o.wall || o.surface} · {colours.find(c => c.id === o.choice.colourId)?.name}</span><button type="button" onClick={() => { setMode(o.kind); setSurface(o.surface === 'feature-wall' ? 'walls' : o.surface); setLocation(o.location); setWall(o.wall || ''); setArea(o.areaM2 ?? ''); setChoice(o.choice); }}>Edit</button><button type="button" onClick={() => persist({ ...scheme, confirmed: false, [o.kind === 'feature' ? 'featureWalls' : 'overrides']: scheme[o.kind === 'feature' ? 'featureWalls' : 'overrides'].filter(v => !(v.location === o.location && (o.kind === 'feature' ? v.wall === o.wall : v.surface === o.surface))) })}>Remove</button></div>)}
    <h3>Project painting requirements</h3>
    {requirements.length ? <ul>{requirements.map((r,i) => <li key={`${r.rowId}:${i}`}>{r.location} · {r.surface}: {r.quantity ?? 'Quantity pending'} {r.unit} — {r.section}</li>)}</ul> : <p>Painting areas will appear from the project quotation when measured quantities are available.</p>}
    <details><summary>Paint quantity and material cost</summary><p>Keep coats, coverage and waste specific to the selected product and surface. Project quotation areas are used for ordering. Primer is a separate requirement.</p><div className="paintFields">{[['areaM2','Calculator area (m²)'],['coverage','Published coverage (m²/L)'],['coats','Coats'],['wastePercent','Waste (%)'],['materialAllowancePerM2','Original material allowance ($/m² ex GST)']].map(([k,label]) => <label key={k}>{label}<input type="number" min="0" value={choice[k] ?? ''} onChange={e => updateChoice({ [k]: e.target.value })} /></label>)}<label>Paint package<select value={choice.packageSku || ''} onChange={e => updateChoice({ packageSku: e.target.value })}><option value="">Confirm package / base with supplier</option>{(product?.attributes.variants || []).filter(v => !v.isNotSelling && v.price?.value > 0).map(v => <option key={v.sku} value={v.sku}>{v.size} · {v.sku} · ${v.price.value}</option>)}</select></label></div><p>Calculator: {paintLitres(choice.areaM2, choice.coverage, choice.coats, choice.wastePercent) ?? 'Enter quantity inputs'} litres</p>{product?.specificationUrl && <a href={product.specificationUrl} target="_blank" rel="noreferrer">Manufacturer specifications</a>}<p>Apply the choice again to save these inputs. The original combined painting rate remains until material quantities and allowance are known.</p></details>
    <button type="button" className="primary" disabled={!paintSchemeComplete(scheme, products, colours)} onClick={() => persist({ ...scheme, confirmed: true })}>{scheme.confirmed ? 'Paint scheme confirmed ✓' : 'Confirm paint scheme'}</button>
    <style jsx>{`
      .paintScheme {padding:24px;color:#172c3b;background:#fff;border-radius:16px} .paintScheme h2{font-size:26px}.paintScheme h3{margin-top:24px;font-size:19px}.paintScheme p{margin:14px 0}.paintSummary,.paintColours{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:20px 0}.paintSummary button,.paintColours button{border:1px solid #cbd5e1;border-radius:10px;padding:12px;text-align:left}.paintColours button[aria-pressed=true]{outline:3px solid #176e66}.paintSummary small,.paintColours small{display:block}.chip{display:block;width:44px;height:28px;border:1px solid #ddd;margin-bottom:8px}.swatch{display:block;height:65px;margin:-12px -12px 10px;border-radius:9px 9px 0 0}.paintFields{display:flex;flex-wrap:wrap;gap:16px}.paintFields label{display:flex;flex-direction:column;gap:6px;min-width:180px}.paintFields input,.paintFields select{padding:9px;border:1px solid #94a3b8;border-radius:6px;max-width:380px}.paintActions,.paintOverride{display:flex;gap:16px;align-items:center;margin:14px 0}.primary{background:#176e66;color:white;padding:12px 20px;border-radius:8px;margin:12px 0}button:disabled{opacity:.45}button{cursor:pointer}
    `}</style>
  </section>;
}
