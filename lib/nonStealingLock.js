const queues = new Map();

// The acquire timeout counts only time this page was able to run. A wall-clock timer also counted
// time the main thread was blocked (e.g. a long plan-image task), so a waiter timed out the moment
// the thread came back, before the lock holder could finish, and a healthy single tab reported
// "Another tab is still saving or signing in". Each tick credits at most MAX_TICK_CREDIT_MS, so a
// stall uses up at most that much of the wait; genuine contention still times out on schedule.
const TICK_MS = 250;
const MAX_TICK_CREDIT_MS = 2 * TICK_MS;
const clock = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function responsiveTimeout(timeout, onExpire) {
  let used = 0;
  let last = clock();
  let timer = null;
  const tick = () => {
    const now = clock();
    used += Math.min(Math.max(0, now - last), MAX_TICK_CREDIT_MS);
    last = now;
    if (used >= timeout) { timer = null; onExpire(); return; }
    timer = setTimeout(tick, Math.min(TICK_MS, timeout - used));
  };
  timer = setTimeout(tick, Math.min(TICK_MS, timeout));
  return () => { if (timer) clearTimeout(timer); timer = null; };
}

export async function nonStealingLock(name, timeout, task) {
  if (globalThis.navigator?.locks) {
    const controller = new AbortController();
    const stopTimer = timeout > 0 ? responsiveTimeout(timeout, () => controller.abort()) : () => {};
    try {
      return await navigator.locks.request(name, {
        mode: "exclusive", ...(timeout === 0 ? { ifAvailable: true } : { signal: controller.signal }),
      }, async lock => {
        stopTimer();
        if (!lock) throw Object.assign(new Error("Another tab is busy. Retry when it finishes."), { isAcquireTimeout: true });
        return task();
      });
    } catch (error) {
      if (controller.signal.aborted) throw Object.assign(new Error("Another tab is still saving or signing in. Retry shortly; no lock was stolen."), { isAcquireTimeout: true, code: "LOCK_CONTENTION" });
      throw error;
    } finally { stopTimer(); }
  }
  const previous = queues.get(name) || Promise.resolve();
  const pending = previous.catch(() => {}).then(task);
  queues.set(name, pending);
  try { return await pending; }
  finally { if (queues.get(name) === pending) queues.delete(name); }
}

export const documentLock = (scope, task) => nonStealingLock(`project-estimate:${scope}`, 30000, task);
