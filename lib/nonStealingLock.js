const queues = new Map();

export async function nonStealingLock(name, timeout, task) {
  if (globalThis.navigator?.locks) {
    const controller = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      return await navigator.locks.request(name, {
        mode: "exclusive", ...(timeout === 0 ? { ifAvailable: true } : { signal: controller.signal }),
      }, async lock => {
        if (timer) clearTimeout(timer);
        if (!lock) throw Object.assign(new Error("Another tab is busy. Retry when it finishes."), { isAcquireTimeout: true });
        return task();
      });
    } catch (error) {
      if (controller.signal.aborted) throw Object.assign(new Error("Another tab is still saving or signing in. Retry shortly; no lock was stolen."), { isAcquireTimeout: true });
      throw error;
    } finally { if (timer) clearTimeout(timer); }
  }
  const previous = queues.get(name) || Promise.resolve();
  const pending = previous.catch(() => {}).then(task);
  queues.set(name, pending);
  try { return await pending; }
  finally { if (queues.get(name) === pending) queues.delete(name); }
}

export const documentLock = (scope, task) => nonStealingLock(`project-estimate:${scope}`, 30000, task);
