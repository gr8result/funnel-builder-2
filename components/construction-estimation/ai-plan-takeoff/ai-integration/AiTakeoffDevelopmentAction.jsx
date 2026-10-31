import React, { useState } from 'react';
import { createAiTakeoffDevelopmentFixture } from './developmentFixture.js';

// Opt in using the development prop or ?aiTakeoffDevelopment=1. Never expose a
// fixture-writing control in a production build. This is not the final AI UI.
export function AiTakeoffDevelopmentAction({ bridge, currentPage, onRunLocalVectors, enabled = false, disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [vectorBusy, setVectorBusy] = useState(false);
  const [message, setMessage] = useState('');
  const optedIn = enabled || (typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('aiTakeoffDevelopment') === '1');
  if ((typeof process !== 'undefined' && process.env.NODE_ENV === 'production') || !optedIn) return null;

  const inject = async () => {
    setBusy(true);
    try {
      const context = await bridge.getContext();
      const result = await bridge.appendDetections(createAiTakeoffDevelopmentFixture(context, currentPage));
      setMessage(result.status === 'duplicate' ? 'Fixture already applied; no objects added.' : `Added ${result.added} AI fixture objects.`);
    } catch (error) {
      setMessage(`Import rejected: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const runLocalVectors = async () => {
    setVectorBusy(true);
    try {
      await onRunLocalVectors?.(currentPage);
    } finally {
      setVectorBusy(false);
    }
  };

  return (
    <div style={{ padding: 8, border: '1px dashed #a16207', background: '#fffbeb', fontSize: 12 }}>
      <button id="ai-takeoff-development-fixture" data-testid="ai-takeoff-development-fixture" type="button" disabled={disabled || busy} onClick={inject}>
        {busy ? 'Verifying fixture…' : 'DEV / TEST: Inject AI fixture'}
      </button>
      <button id="ai-takeoff-run-local-vector" data-testid="ai-takeoff-run-local-vector" type="button" disabled={disabled || busy || vectorBusy || !onRunLocalVectors} onClick={runLocalVectors} style={{ marginLeft: 8 }}>
        {vectorBusy ? 'Measuring vectors locally…' : 'DEV / TEST: Run local vector takeoff (no provider)'}
      </button>
      {message && <div role="status" data-testid="ai-takeoff-development-result">{message}</div>}
    </div>
  );
}
