import { useState } from 'react';
import { useBuilderSelectionFoundation } from '../../hooks/useBuilderSelectionFoundation';
import { useApiFetch } from '../../hooks/useWorkspace';

export default function SelectionBaselineControl({ workbook, onApply }) {
  const { foundation } = useBuilderSelectionFoundation();
  const apiFetch = useApiFetch();
  const [scheduleId, setScheduleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function apply() {
    setBusy(true); setMessage('');
    try {
      const [data, catalogue] = await Promise.all(['items', 'products'].map(async resource => {
        const response = await apiFetch(`/api/builders/selection-foundation?resource=${resource}`);
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Could not load inclusion products.');
        return data;
      }));
      const schedule = foundation.schedules.find(item => item.id === scheduleId);
      if (!schedule) throw Error('Choose an inclusion schedule.');
      const items = data.records.filter(item => item.inclusion_schedule_id === schedule.id).map(item => {
        const product = catalogue.records.find(product => product.id === item.default_product_id && product.workspace_id === foundation.workspace_id);
        return { ...item, baselineProductName: product?.product_name,
          baselineUnitPrice: item.allowance?.unitPrice ?? item.allowance?.amount ?? (typeof item.allowance === 'number' ? item.allowance : product?.metadata?.productEntity?.clientPrice ?? product?.upgrade_cost ?? null) };
      });
      if (!items.length) throw Error('This schedule has no inclusion items.');
      const result = await onApply({ schedule, items }, foundation);
      setMessage(`Baseline saved. ${result.filter(item => item.status === 'UNMAPPED' || item.status === 'CONFLICT').length} unresolved targets. Existing baselines and client/manual selections are preserved.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  const unresolved = (workbook.selectionMappingReport || []).filter(item => ['UNMAPPED', 'CONFLICT'].includes(item.status));
  return <details style={{ padding: 12, border: '1px solid #cbd5e1', marginBottom: 12 }}><summary>Inclusion baseline and quote mapping</summary>
    <p>{workbook.jobInclusionSnapshot?.schedule?.display_name || workbook.jobInclusionSnapshot?.schedule?.name || 'No inclusion baseline applied.'}</p>
    <label>Inclusion schedule <select value={scheduleId} disabled={busy} onChange={event => setScheduleId(event.target.value)}><option value="">Choose schedule</option>{(foundation?.schedules || []).filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.display_name || item.name}</option>)}</select></label>
    <button type="button" disabled={busy || !scheduleId || !foundation || !!foundation.error} onClick={apply}>Apply inclusion baseline</button>
    {message && <p role="status">{message}</p>}
    {foundation?.error && <p role="alert">{foundation.error}</p>}
    {!!unresolved.length && <div role="status">Selections saved with unresolved quote targets. Configure their Selection Slot/location mappings; the quote rows were preserved.<ul>{unresolved.map((item, index) => <li key={index}>{item.selectionSlotId} · {item.locationId || 'Default'} · {item.status}</li>)}</ul></div>}
  </details>;
}
