import React, { useState } from 'react';
import { COLOUR_DISCLAIMER, COLOUR_GROUPS, DULUX_COLOURS, searchColours } from '../../lib/builders/duluxColourLibrary.js';

// Read-only view of the Dulux colour library for the builder. Colours are specifications chosen in
// Client Selections; they are not Product Library products and carry no price.
export default function PaintColourLibrary() {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [page, setPage] = useState(0);
  const colours = searchColours(search, group);
  return <details data-testid="paint-colour-library"><summary>Paint colour library — {DULUX_COLOURS.length} Dulux colours</summary>
    <p>{COLOUR_DISCLAIMER}</p>
    <div style={{ display: 'flex', gap: 12, padding: 12 }}><input aria-label="Search paint colours" placeholder="Colour name or code" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /><select aria-label="Colour family" value={group} onChange={e => { setGroup(e.target.value); setSearch(''); setPage(0); }}><option value="all">All colour families</option>{COLOUR_GROUPS.filter(g => g.key !== 'popular').map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>{colours.slice(page * 48, (page + 1) * 48).map(c => <a key={c.id} href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ border: '1px solid #ccd4df', borderRadius: 6, padding: 8 }}><span style={{ display: 'block', height: 64, background: c.hex }} /><strong>{c.name}</strong><small style={{ display: 'block' }}>{c.code}</small></a>)}</div>
    <div style={{ display: 'flex', gap: 16, padding: 12 }}><button type="button" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>{colours.length} colours · Page {page + 1}</span><button type="button" disabled={(page + 1) * 48 >= colours.length} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </details>;
}
