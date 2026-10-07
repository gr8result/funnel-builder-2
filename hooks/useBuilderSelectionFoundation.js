import { useCallback, useEffect, useState } from 'react';
import { useApiFetch, useWorkspace } from './useWorkspace';

export function useBuilderSelectionFoundation() {
  const { workspaceId } = useWorkspace();
  const apiFetch = useApiFetch();
  const [state, setState] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    apiFetch('/api/builders/selection-foundation', { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data.workspace_id !== workspaceId) throw new Error('Builder inclusion schedules could not be loaded.');
        if (!controller.signal.aborted) setState(data);
      }).catch(error => { if (!controller.signal.aborted) setState({ workspace_id: workspaceId, error: error.message }); });
    return () => controller.abort();
  }, [apiFetch, workspaceId, revision]);
  return { foundation: state?.workspace_id === workspaceId ? state : null, reload };
}
