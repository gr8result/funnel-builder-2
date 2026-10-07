import { useCallback, useEffect, useState } from 'react';
import { isSubgroupOpen, subgroupSignature } from '../../lib/construction-estimation/quotationSubgroups.js';

// Open / closed state of quotation subgroups for one job. It is display state: kept in this
// browser's local storage, per job, and never written to the job itself - collapsing a group can
// not mark the job as changed, trigger a save, or touch a quote row.
const storageKey = scope => `gr8:quotation-subgroups:${scope}`;

function read(scope) {
  if (typeof window === 'undefined' || !scope) return {};
  try { return JSON.parse(window.localStorage.getItem(storageKey(scope)) || '{}') || {}; } catch { return {}; }
}

export function useQuotationSubgroups(scope) {
  const [overrides, setOverrides] = useState({});
  useEffect(() => { setOverrides(read(scope)); }, [scope]);
  const update = useCallback((change) => {
    setOverrides((current) => {
      const next = { ...current, ...change };
      try { if (scope) window.localStorage.setItem(storageKey(scope), JSON.stringify(next)); } catch { /* display state only */ }
      return next;
    });
  }, [scope]);
  return {
    isOpen: (group, model, status) => isSubgroupOpen(group, model, status, overrides),
    toggle: (group, model, status) => update({ [group.key]: { open: !isSubgroupOpen(group, model, status, overrides), signature: subgroupSignature(group, model, status) } }),
    setAll: (model, status, open) => update(Object.fromEntries(model.list.map(group => [group.key, { open, signature: subgroupSignature(group, model, status) }]))),
  };
}
