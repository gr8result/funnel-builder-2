import { useEffect, useState } from 'react';
import Image from 'next/image';
import Papa from 'papaparse';
import { supabase } from '../../utils/supabase-client';
import { IMPORT_FIELDS, parseBuilderCsv } from '../../lib/product-library/builderCsvImport';
import { SELECTION_SLOTS } from '../../lib/builders/selectionRegistry';
import { SELECTION_REQUIREMENT_DEFINITIONS } from '../../lib/builders/selectionRequirementTaxonomy';
import { mapDbProductToEntity } from '../../lib/product-library/productLibraryDbMapper';

const labels = { rowsRead: 'Rows read', NEW: 'New products', UPDATE: 'Updated products', UNCHANGED: 'Unchanged', INVALID: 'Invalid', CONFLICT: 'Conflicts', REVIEW_REQUIRED: 'Needs requirement review', UNMAPPED: 'Unclassified requirements', excluded: 'Excluded' };
const eligible = row => ['NEW', 'UPDATE', 'UNCHANGED'].includes(row.action);
export default function BuilderCsvImport({ workspaceId, selectedFile, products = [], onImported }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [slots, setSlots] = useState({});
  const [requirements, setRequirements] = useState({});
  const [preview, setPreview] = useState(null);
  const [included, setIncluded] = useState([]);
  const [report, setReport] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [libraryPage, setLibraryPage] = useState(0);
  const imported = products.filter(product => product.workspace_id === workspaceId && product.metadata?.builderCsvKey).map(product => mapDbProductToEntity(product));
  const visible = imported.filter(product => [product.productName, product.supplier, product.supplierSku, product.category].join(' ').toLowerCase().includes(search.toLowerCase()));
  async function readFile(file) {
    if (!file) return;
    setOpen(true); setPreview(null); setReport(null); setParsed(null); setError(''); setConfirmed(false); setSlots({}); setRequirements({});
    try {
      if (file.size > 2000000) throw Error('Choose a CSV smaller than 2 MB.');
      const text = await file.text(); const value = parseBuilderCsv(text);
      setCsv(text); setParsed(value); setMapping(value.mapping);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { if (selectedFile) { readFile(selectedFile); document.getElementById('builder-csv-import')?.scrollIntoView({ behavior: 'smooth' }); } }, [selectedFile]);
  async function request(body) {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw Error('Sign in to import builder products.');
    const response = await fetch('/api/builders/product-import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ ...body, workspace_id: workspaceId }) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Import failed.');
    return result;
  }
  async function validate() {
    setBusy(true); setError(''); setConfirmed(false); setPreview(null); setReport(null);
    try { const result = await request({ action: 'preview', csv, mapping, slotMappings: slots, requirementMappings: requirements }); setPreview(result); setIncluded(result.rows.filter(eligible).map(row => row.row)); setPage(0); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setError('');
    try { const result = await request({ action: 'commit', batchId: preview.batchId, rows: included, confirmed }); setReport(result.report); setConfirmed(false); await onImported(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function exportErrors() {
    const text = Papa.unparse(preview.rows.filter(row => !eligible(row)).map(row => ({ Row: row.row, Product: row.name, Status: row.action, Errors: row.errors.join('; ') })), { escapeFormulae: true });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'builder-product-import-errors.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section id="builder-csv-import" style={{ padding: 16, border: '1px solid #cbd5e1', borderRadius: 8, margin: '12px 0', background: '#fff', color: '#172033' }}>
    <button type="button" onClick={() => setOpen(!open)}>Import builder product CSV</button>
    {imported.length > 0 && <details><summary>Builder Product Library ({imported.length} imported products)</summary>
      <label>Search imported products <input value={search} onChange={event => { setSearch(event.target.value); setLibraryPage(0); }} /></label>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}><thead><tr>{['Product', 'Supplier', 'Supplier SKU', 'Supplier ref', 'Category', 'Selection Slots', 'Price', 'GST basis', 'Price status', 'Availability', 'Cost', 'Unit', 'Active'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{visible.slice(libraryPage * 50, (libraryPage + 1) * 50).map(product => <tr key={product.productId}><td>{product.productName}</td><td>{product.supplier}</td><td>{product.supplierSku}</td><td>{product.supplierProductRef || '—'}</td><td>{product.category}</td><td>{product.selectionSlotIds.join(', ')}</td><td>{product.clientPrice}</td><td>{typeof product.gstIncluded === 'boolean' ? product.gstIncluded ? 'Included' : 'Excluded' : 'Review required'}</td><td>{product.priceStatus}</td><td>{product.availabilityStatus || 'Unknown'}</td><td>{product.builderCost}</td><td>{product.unit}</td><td>{product.active ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      <button type="button" disabled={!libraryPage} onClick={() => setLibraryPage(libraryPage - 1)}>Previous products</button> <span>{visible.length} matching products</span> <button type="button" disabled={(libraryPage + 1) * 50 >= visible.length} onClick={() => setLibraryPage(libraryPage + 1)}>Next products</button>
    </details>}
    {open && <div>
      <p>Map columns, review shared requirement classifications, then confirm. Only this builder’s Product Library is updated. Blank optional values preserve existing values. Maximum 2 MB / 2,000 rows.</p>
      <label>Upload CSV <input type="file" accept=".csv,text/csv" disabled={busy || !workspaceId} onChange={event => { readFile(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {error && <p role="alert">{error}</p>}
      {parsed && <fieldset disabled={busy}><legend>Column mapping</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{parsed.columns.map((column, index) => <label key={index}>{column}<br /><select aria-label={`Map ${column}`} value={mapping[index] || ''} onChange={event => { setMapping({ ...mapping, [index]: event.target.value }); setPreview(null); setConfirmed(false); setReport(null); }}>
          <option value="">Ignore</option>{IMPORT_FIELDS.map(field => <option key={field}>{field}</option>)}
        </select></label>)}</div>
        <p>Without Supplier + Supplier SKU, map an explicit stable Import Key. Tenant columns are ignored.</p>
        <button type="button" onClick={validate}>Validate and preview</button>
      </fieldset>}
      {preview && <div>
        <fieldset disabled={busy || Boolean(report)}><legend>Requirement classification review</legend>
          {[...new Set(preview.rows.filter(row => ['REVIEW_REQUIRED', 'UNMAPPED'].includes(row.action)).map(row => row.slotSource))].map(source => <label key={source} style={{ display: 'block', margin: 6 }}>{source || '(No category supplied)'} → <select aria-label={`Requirement for ${source || 'blank category'}`} value={requirements[source] || ''} onChange={event => { setRequirements({ ...requirements, [source]: event.target.value }); setConfirmed(false); setPreview({ ...preview, dirty: true }); }}>
            <option value="">Choose shared requirement</option>{SELECTION_REQUIREMENT_DEFINITIONS.map(definition => <option key={definition.requirementKey} value={definition.requirementKey}>{definition.label} ({definition.requirementKey})</option>)}
          </select></label>)}
          <button type="button" onClick={validate}>Revalidate requirement choices</button>
          <p>Choices classify products by shared requirement. Builder quotation targets are resolved separately.</p>
        </fieldset>
        <details>
          <summary>Legacy Selection Slot overrides</summary>
          <fieldset disabled={busy || Boolean(report)}><legend>Optional compatibility mappings</legend>
            {[...new Set(preview.rows.map(row => row.slotSource))].map(source => <label key={source} style={{ display: 'block', margin: 6 }}>{source || '(No category supplied)'} → <select aria-label={`Selection Slot for ${source || 'blank category'}`} value={slots[source] ?? preview.rows.find(row => row.slotSource === source)?.slot ?? ''} onChange={event => { setSlots({ ...slots, [source]: event.target.value }); setConfirmed(false); setPreview({ ...preview, dirty: true }); }}>
              <option value="">UNMAPPED</option>{SELECTION_SLOTS.map(slot => <option key={slot.selectionSlotId} value={slot.selectionSlotId}>{slot.displayName} ({slot.selectionSlotId})</option>)}
            </select></label>)}
            <button type="button" onClick={validate}>Revalidate legacy mappings</button>
            <p>These overrides bridge older slot-based workflows; they do not configure a builder’s quotation template.</p>
          </fieldset>
        </details>
        <p>{Object.entries(report || preview.report).map(([key, value]) => `${labels[key] || key}: ${value}`).join(' · ')}</p>
        {report && <p role="status">Import committed. Product Library reloaded.</p>}
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}><thead><tr>{['Include', 'Row', 'Image', 'Product', 'Action', 'Requirement', 'Quote target', 'Price (old → new)', 'GST basis', 'Price status', 'Availability', 'Cost (old → new)', 'Legacy Slot', 'Issues'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
          {preview.rows.slice(page * 50, (page + 1) * 50).map(row => {
            const imagePreview = row.patch.primary_image_url || row.before?.primary_image_url || '';
            return <tr key={row.row}>
              <td><input type="checkbox" aria-label={`Include row ${row.row}`} disabled={busy || !!report || !eligible(row) || preview.dirty} checked={included.includes(row.row)} onChange={event => { setConfirmed(false); setIncluded(event.target.checked ? [...included, row.row] : included.filter(n => n !== row.row)); }} /></td>
              <td>{row.row}</td><td>{imagePreview ? <Image src={imagePreview} alt={`${row.name || 'Product'} preview`} width={64} height={64} unoptimized style={{ objectFit: 'contain' }} /> : '—'}</td><td>{row.name}</td><td>{row.action}</td><td>{row.requirementKeys.join(', ') || 'UNCLASSIFIED'}</td><td>{row.quoteMappingStatus}</td><td>{row.before?.upgrade_cost ?? '—'} → {row.patch.upgrade_cost ?? row.before?.upgrade_cost ?? '0'}</td><td>{typeof row.patch.metadata?.productEntity?.gstIncluded === 'boolean' ? row.patch.metadata.productEntity.gstIncluded ? 'Included' : 'Excluded' : 'Review required'}</td><td>{row.patch.metadata?.productEntity?.priceStatus || row.before?.metadata?.productEntity?.priceStatus || 'price_pending'}</td><td>{row.patch.metadata?.productEntity?.availabilityStatus || row.before?.metadata?.productEntity?.availabilityStatus || 'Unknown'}</td><td>{row.before?.base_allowance ?? '—'} → {row.patch.base_allowance ?? row.before?.base_allowance ?? '0'}</td><td>{row.slot || '—'}</td><td>{row.errors.join(' ')}</td>
            </tr>;
          })}
        </tbody></table></div>
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous rows</button> <span>Page {page + 1} of {Math.ceil(preview.rows.length / 50)}</span> <button type="button" disabled={(page + 1) * 50 >= preview.rows.length} onClick={() => setPage(page + 1)}>Next rows</button>
        <button type="button" onClick={exportErrors}>Export error report</button>
        {!report && <div><label><input type="checkbox" checked={confirmed} disabled={busy || preview.dirty || !included.length} onChange={event => setConfirmed(event.target.checked)} /> I confirm importing {included.length} selected valid rows into this builder’s Product Library.</label><br />
          {preview.dirty && <p>Revalidate mappings before confirming.</p>}
          <button type="button" onClick={commit} disabled={busy || !confirmed || preview.dirty || !included.length}>Commit import</button></div>}
      </div>}
      {busy && <p role="status">Processing import…</p>}
    </div>}
  </section>;
}
