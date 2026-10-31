import { useEffect, useMemo, useRef, useState } from 'react';
import { useBuilderSelectionFoundation } from '../../hooks/useBuilderSelectionFoundation';
import { useApiFetch } from '../../hooks/useWorkspace';
import { requirementsForSelectionSlot } from '../../lib/builders/selectionRequirementTaxonomy.js';
import { resolveTradeSection } from '../../lib/builders/quotationTradeSections.js';
import { resolveInclusionBaselineItems } from '../../lib/builders/selectionBaselineProducts.js';
import { getEffectiveProductCatalogue } from '../../lib/product-library/catalogueService.js';
import { mapDbProductToEntity } from '../../lib/product-library/productLibraryDbMapper.js';
import { buildJobInclusionSnapshot, planJobInclusionApplication, JOB_APPLICATION_STATUS } from '../../lib/standard-inclusions/jobBaseline.mjs';
import { approvedPremierDefault } from '../../lib/standard-inclusions/tierScheduleReview.mjs';

export default function SelectionBaselineControl({ workbook, onApply, autoApplyDefault = false }) {
  const { foundation } = useBuilderSelectionFoundation();
  const apiFetch = useApiFetch();
  const [scheduleId, setScheduleId] = useState('');
  const [targets, setTargets] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [publishedSchedules, setPublishedSchedules] = useState([]);
  const [publishedError, setPublishedError] = useState('');
  const automaticAssignmentRequests = useRef(new Set());
  const defaultAssignmentRequests = useRef(new Set());
  useEffect(() => {
    let cancelled = false;
    setPublishedSchedules([]);
    setPublishedError('');
    if (!foundation?.workspace_id) return;
    apiFetch('/api/standard-inclusions/pdf-library').then(async response => {
      const body = await response.json();
      if (!response.ok || body.ok === false) throw Error(body.error || 'Could not load published inclusions schedules.');
      if (!cancelled) setPublishedSchedules((body.schedules || []).filter(schedule => schedule.metadata?.workflowStatus === 'Published' && schedule.currentVersion && (schedule.metadata?.publishedSnapshots || []).some(snapshot => snapshot.versionId === schedule.currentVersion.id)));
    }).catch(error => { if (!cancelled) setPublishedError(error.message); });
    return () => { cancelled = true; };
  }, [apiFetch, foundation?.workspace_id]);
  useEffect(() => {
    if (!autoApplyDefault || workbook.standardInclusionsDefault?.status !== 'pending' || workbook.jobInclusionSnapshot || !workbook.jobId || !foundation || foundation.error || !onApply) return;
    const schedule = approvedPremierDefault(publishedSchedules);
    if (!schedule) {
      setMessage('Premier is the default for this new quotation. Publish one complete, builder-approved Premier schedule before a baseline can be applied. Existing quotation values remain unchanged.');
      return;
    }
    const key = `${foundation.workspace_id}:${workbook.jobId}:${schedule.currentVersion.id}`;
    if (defaultAssignmentRequests.current.has(key)) return;
    defaultAssignmentRequests.current.add(key);
    let cancelled = false;
    (async () => {
      try {
        const snapshot = buildJobInclusionSnapshot({ workspaceId: foundation.workspace_id, schedule });
        const plan = planJobInclusionApplication(workbook, snapshot);
        if (plan.status !== JOB_APPLICATION_STATUS.NEW) return;
        const projectId = workbook.commercialProjectId || workbook.projectId;
        if (projectId) {
          const response = await apiFetch('/api/standard-inclusions/apply-to-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, scheduleId: schedule.id }) });
          const body = await response.json();
          if (!response.ok || body.ok === false) throw Error(body.error || 'Could not assign the approved Premier default.');
        }
        const report = await onApply(snapshot, foundation);
        const unresolved = (report || []).filter(item => ['UNMAPPED', 'CONFLICT'].includes(item.status)).length;
        if (!cancelled) setMessage(`Approved Premier baseline saved. ${unresolved} quotation targets require mapping review. Job quantities and manual/client values were preserved.`);
      } catch (error) {
        defaultAssignmentRequests.current.delete(key);
        if (!cancelled) setMessage(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [publishedSchedules, workbook, foundation, apiFetch, onApply, autoApplyDefault]);
  useEffect(() => {
    const projectId = workbook.commercialProjectId || workbook.projectId;
    const workspaceId = foundation?.workspace_id;
    if (!projectId || !workspaceId || !foundation || foundation.error || !onApply) return undefined;
    const key = `${workspaceId}:${projectId}`;
    if (automaticAssignmentRequests.current.has(key)) return undefined;
    automaticAssignmentRequests.current.add(key);
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/api/builders/project-inclusions?projectId=${encodeURIComponent(projectId)}`);
        const body = await response.json();
        if (!response.ok || body.ok === false) throw Error(body.error || 'Could not load this job\'s assigned inclusion schedule.');
        if (cancelled) return;
        const snapshot = body.document?.standardScheduleSnapshot?.jobInclusionSnapshot;
        if (!snapshot) return;
        const plan = planJobInclusionApplication(workbook, snapshot);
        if (plan.status === JOB_APPLICATION_STATUS.CONFLICT) {
          setMessage('This job has a different inclusion baseline already. It was preserved; review the assigned schedule before changing it.');
          return;
        }
        if (plan.status === JOB_APPLICATION_STATUS.ALREADY_APPLIED) return;
        await onApply(snapshot, foundation);
        if (!cancelled) setMessage(`Loaded ${snapshot.schedule.display_name || snapshot.schedule.name} into this job. Quotation quantities and confirmed client choices are preserved.`);
      } catch (error) {
        automaticAssignmentRequests.current.delete(key);
        if (!cancelled) setMessage(error.message || 'The assigned inclusion schedule could not be loaded.');
      }
    })();
    return () => { cancelled = true; };
  }, [apiFetch, foundation, workbook, onApply]);
  const unresolved = (workbook.selectionMappingReport || []).filter(item => ['UNMAPPED', 'CONFLICT'].includes(item.status));
  const candidateRows = useMemo(() => {
    const rows = Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).map(row => ({ section, row })));
    return unresolved.map(item => {
      const requirements = requirementsForSelectionSlot(item.selectionSlotId || '');
      const tagged = rows.filter(({ section, row }) => row.selectionSlotId === item.selectionSlotId || requirements.some(requirement => row.requirementKey === requirement.requirementKey || (row.requirementKeys || []).includes(requirement.requirementKey)));
      if (tagged.length) return { item, rows: tagged };
      const trades = requirements.map(requirement => resolveTradeSection({ workbook, identity: { requirementKey: requirement.requirementKey } }));
      const sectionNames = [...new Set(trades.flatMap(trade => trade.status === 'FOUND' ? [trade.section] : trade.status === 'AMBIGUOUS' ? trade.candidates : []))];
      return { item, rows: rows.filter(({ section, row }) => sectionNames.includes(section) && row.lineType !== 'Heading' && !/^quotation-subheading:/.test(row.id || '')) };
    });
  }, [unresolved, workbook]);

  async function resolveMapping(item) {
    setBusy(true); setMessage('');
    try {
      const key = `${item.selectionSlotId}|${item.locationId || ''}`;
      const chosen = targets[key];
      const option = candidateRows.find(entry => entry.item === item)?.rows.find(entry => `${entry.section}|${entry.row.id}` === chosen);
      if (!option) throw Error('Choose an existing quotation row before resolving this mapping.');
      const response = await apiFetch('/api/builders/selection-foundation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'mappings', record: {
        workspace_id: foundation.workspace_id, selection_slot_id: item.selectionSlotId, template_id: workbook.templateKey || '', quote_section_id: option.section, quote_row_id: option.row.id,
        status: 'MAPPED', metadata: { locationId: item.locationId || '', confirmedBy: 'builder-inclusion-baseline-review' },
      } }) });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Could not save the quotation target.');
      setMessage(`${item.selectionSlotId} · ${item.locationId || 'Default'} now maps to ${option.section} / ${option.row.item || option.row.id}. The inclusion baseline was not applied.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function apply() {
    setBusy(true); setMessage('');
    try {
      if (scheduleId.startsWith('published:')) {
        const schedule = publishedSchedules.find(item => `published:${item.id}` === scheduleId);
        if (!schedule) throw Error('Choose a published inclusion schedule.');
        const snapshot = buildJobInclusionSnapshot({ workspaceId: foundation.workspace_id, schedule });
        const plan = planJobInclusionApplication(workbook, snapshot);
        if (plan.status === JOB_APPLICATION_STATUS.CONFLICT) throw Error('This job already has a different inclusion baseline. Nothing was changed.');
        if (plan.status === JOB_APPLICATION_STATUS.ALREADY_APPLIED) {
          setMessage('This published version is already applied. No duplicate products or quotation rows were created.');
          return;
        }
        const projectId = workbook.commercialProjectId || workbook.projectId;
        if (projectId) {
          const response = await apiFetch('/api/standard-inclusions/apply-to-project', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, scheduleId: schedule.id }),
          });
          const body = await response.json();
          if (!response.ok || body.ok === false) throw Error(body.error || 'Could not assign this schedule to the job.');
        }
        const report = await onApply(snapshot, foundation);
        const unresolvedCount = report.filter(item => ['UNMAPPED', 'CONFLICT'].includes(item.status)).length + plan.unslotted.length;
        setMessage(`Published baseline saved to this job. ${unresolvedCount} products require quotation mapping; ${snapshot.items.filter(item => item.baselineUnitPrice === null).length} require pricing. Existing manual values and job quantities are preserved.`);
        return;
      }
      const [data, catalogue] = await Promise.all(['items', 'products'].map(async resource => {
        const response = await apiFetch(`/api/builders/selection-foundation?resource=${resource}`);
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Could not load inclusion products.');
        return data;
      }));
      const schedule = foundation.schedules.find(item => item.id === scheduleId);
      if (!schedule) throw Error('Choose an inclusion schedule.');
      const privateProducts = catalogue.records.map(product => mapDbProductToEntity(product))
        .filter(product => product.workspace_id === foundation.workspace_id);
      const effectiveProducts = getEffectiveProductCatalogue({ organisationId: foundation.workspace_id, includeDisabled: true }).products;
      const items = resolveInclusionBaselineItems(
        data.records.filter(item => item.inclusion_schedule_id === schedule.id),
        { workspaceId: foundation.workspace_id, privateProducts, catalogueProducts: effectiveProducts },
      );
      if (!items.length) throw Error('This schedule has no inclusion items.');
      const result = await onApply({ schedule, items }, foundation);
      const stillUnresolved = result.filter(item => item.status === 'UNMAPPED' || item.status === 'CONFLICT').length;
      setMessage(`Baseline saved. ${stillUnresolved} selections still require a quotation target. Existing baselines, quantities, rates and client/manual selections are preserved.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <details style={{ padding: 12, border: '1px solid #cbd5e1', marginBottom: 12 }}><summary>Inclusion baseline and quote mapping</summary>
    <p>{workbook.jobInclusionSnapshot?.schedule?.display_name || workbook.jobInclusionSnapshot?.schedule?.name || 'No inclusion baseline applied.'}</p>
    <label>Inclusion schedule <select value={scheduleId} disabled={busy} onChange={event => setScheduleId(event.target.value)}><option value="">Choose schedule</option>{publishedSchedules.map(item => <option key={`published:${item.id}`} value={`published:${item.id}`}>{item.name} · Published v{item.currentVersion.versionNumber}</option>)}{(foundation?.schedules || []).filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.display_name || item.name}</option>)}</select></label>
    <button type="button" disabled={busy || !scheduleId || !foundation || !!foundation.error} onClick={() => apply()}>Apply inclusion baseline</button>
    {message && <p role="status">{message}</p>}
    {foundation?.error && <p role="alert">{foundation.error}</p>}
    {foundation?.unavailableResources?.includes('requirementMappings') && <p role="alert">Requirement-to-quotation mappings are unavailable until the builder mapping migration is applied. Unresolved selections remain review-required; no quotation target is assumed.</p>}
    {publishedError && <p role="alert">{publishedError}</p>}
    {(workbook.constructionInclusionMappingReport || []).some(item => ['UNMAPPED', 'CONFLICT'].includes(item.status)) && <div role="status"><strong>Construction quotation targets require review</strong><ul>{workbook.constructionInclusionMappingReport.filter(item => ['UNMAPPED', 'CONFLICT'].includes(item.status)).map(item => <li key={item.requirementKey}>{item.requirementKey}: {item.reason}</li>)}</ul></div>}
    {!!unresolved.length && <div data-testid="selection-mapping-review">
      <p role="status">Selections are preserved. Each unresolved target below needs a builder decision; no quote row is chosen automatically.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{['Selection slot', 'Location', 'Intended quotation target', 'Reason', 'Action'].map(label => <th key={label} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #cbd5e1' }}>{label}</th>)}</tr></thead>
        <tbody>{candidateRows.map(({ item, rows }, index) => {
          const key = `${item.selectionSlotId}|${item.locationId || ''}`;
          return <tr key={`${key}|${index}`}>
            <td style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}>{item.selectionSlotId}</td>
            <td style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}>{item.locationId || 'Default'}</td>
            <td style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}><select aria-label={`Quotation target for ${item.selectionSlotId} ${item.locationId || 'default'}`} value={targets[key] || ''} onChange={event => setTargets(current => ({ ...current, [key]: event.target.value }))}>
              <option value="">Choose existing quote row</option>{rows.map(({ section, row }) => <option key={`${section}|${row.id}`} value={`${section}|${row.id}`}>{section} · {row.item || row.id} · qty {row.qty ?? row.quantity ?? '—'} · rate {row.manualRate || row.excelRate || '—'}</option>)}
            </select>{!rows.length ? <span> No stable-slot or requirement-tagged row exists in the configured trade. The quotation template needs a target row.</span> : null}</td>
            <td style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}>{item.reason || item.status}</td>
            <td style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}><button type="button" disabled={busy || !foundation || !targets[key]} onClick={() => resolveMapping(item)}>Resolve Mapping</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </details>;
}
