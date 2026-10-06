import { supabase } from '../../../../utils/supabase-client.js';

// Transient failures get one retry, after the provider's own retry-after/reset
// hint. Hard failures (no credit, bad key, model access, server not configured)
// can never succeed by retrying and must stop every further paid request.
const RETRYABLE_FAILURES = new Set(['provider_unreachable', 'provider_rate_limit', 'provider_unavailable', 'analysis_limit']);
export const HARD_FAILURES = new Set(['provider_quota_exhausted', 'provider_auth_failed', 'provider_model_unavailable', 'provider_access_denied',
  'analysis_not_configured', 'invalid_model_configuration', 'authentication_required']);
const DEFAULT_RETRY_SECONDS = 2;
const MAX_RETRY_WAIT_SECONDS = 60;

const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

export async function requestTakeoffAnalysis(payload, signal) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw Object.assign(new Error('Sign in before running AI Takeoff.'), { code: 'authentication_required', hard: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('/api/ai/takeoff-analyse', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) return result;
    const hinted = Number(result?.retryAfterSeconds ?? response.headers?.get?.('Retry-After'));
    const retryAfterSeconds = Number.isFinite(hinted) && hinted >= 0 ? hinted : null;
    const failure = Object.assign(new Error(result?.error || result?.message || `AI Takeoff request failed (${response.status}).`), {
      code: result?.code, status: response.status, retryAfterSeconds, hard: HARD_FAILURES.has(result?.code),
    });
    const delaySeconds = retryAfterSeconds ?? DEFAULT_RETRY_SECONDS;
    if (attempt || !RETRYABLE_FAILURES.has(result?.code) || delaySeconds > MAX_RETRY_WAIT_SECONDS) throw failure;
    await wait(delaySeconds * 1000, signal);
  }
}
