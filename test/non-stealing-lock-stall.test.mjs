// Regression: the Supabase auth lock must not report contention in a single tab after the main thread
// was blocked longer than the acquire timeout (AI Takeoff "Another tab is still saving or signing in").
// Run: node test/non-stealing-lock-stall.test.mjs

const lockPath = new URL('../lib/nonStealingLock.js', import.meta.url);
const { nonStealingLock } = await import(lockPath.href);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const block = (ms) => { const end = Date.now() + ms; while (Date.now() < end) { /* main thread busy */ } };

// Minimal exclusive Web Locks: FIFO queue, ifAvailable, AbortSignal, grant as a task.
const state = new Map();
const abortError = () => Object.assign(new Error('The request was aborted.'), { name: 'AbortError' });
const locks = {
  request(name, options, callback) {
    const s = state.get(name) || state.set(name, { held: false, queue: [] }).get(name);
    if (options.steal) throw new Error('steal must never be used');
    if (options.signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const run = () => { s.held = true; Promise.resolve().then(() => callback({ name })).then(resolve, reject).finally(release); };
      const release = () => { s.held = false; const next = s.queue.shift(); if (next) setTimeout(next.run, 0); };
      if (!s.held) return run();
      if (options.ifAvailable) return Promise.resolve().then(() => callback(null)).then(resolve, reject);
      const entry = { run };
      s.queue.push(entry);
      options.signal?.addEventListener('abort', () => { const i = s.queue.indexOf(entry); if (i >= 0) { s.queue.splice(i, 1); reject(abortError()); } }, { once: true });
    });
  },
};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });

const TIMEOUT = 1000; // stands in for auth-js lockAcquireTimeout (5000) at 1/5 scale
const outcome = (p) => p.then((v) => `ok:${v}`, (e) => `${e.code || e.name}:${e.isAcquireTimeout ? 'acquireTimeout' : ''}`);
// Holder does several short async steps (like reading storage then refreshing state).
const holderTask = async () => { for (let i = 0; i < 5; i += 1) await sleep(20); return 'holder'; };

const scenarios = {
  async 'no contention'() { return { got: await outcome(nonStealingLock('a', TIMEOUT, async () => 'w')), want: 'ok:w' }; },
  async 'stall 3x timeout while waiting (single tab)'() {
    const holder = outcome(nonStealingLock('b', TIMEOUT, holderTask));
    const waiter = outcome(nonStealingLock('b', TIMEOUT, async () => 'w'));
    await Promise.resolve(); block(TIMEOUT * 3);
    await holder; return { got: await waiter, want: 'ok:w' };
  },
  async 'genuine contention times out on schedule'() {
    const holder = outcome(nonStealingLock('c', TIMEOUT, () => sleep(TIMEOUT * 3).then(() => 'holder')));
    const t0 = Date.now(); const got = await outcome(nonStealingLock('c', TIMEOUT, async () => 'w')); const ms = Date.now() - t0;
    await holder; return { got: `${got}${ms >= TIMEOUT * 0.9 && ms <= TIMEOUT * 1.5 ? '' : ` (after ${ms} ms)`}`, want: 'LOCK_CONTENTION:acquireTimeout' };
  },
  async 'stall then holder keeps the lock: still times out'() {
    const holder = outcome(nonStealingLock('d', TIMEOUT, () => sleep(TIMEOUT * 6).then(() => 'holder')));
    const waiter = outcome(nonStealingLock('d', TIMEOUT, async () => 'w'));
    await Promise.resolve(); block(TIMEOUT * 3);
    const got = await waiter; await holder; return { got, want: 'LOCK_CONTENTION:acquireTimeout' };
  },
  async 'ifAvailable (timeout 0) on a held lock'() {
    const holder = outcome(nonStealingLock('e', TIMEOUT, () => sleep(100).then(() => 'h')));
    const got = await outcome(nonStealingLock('e', 0, async () => 'w')); await holder;
    return { got, want: 'Error:acquireTimeout' };
  },
  async 'task error passes through, no timer left'() {
    const got = await outcome(nonStealingLock('f', TIMEOUT, async () => { throw Object.assign(new Error('x'), { code: 'TASK' }); }));
    const timers = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    return { got: `${got}${timers ? ` (${timers} timers left)` : ''}`, want: 'TASK:' };
  },
};

let failed = 0;
for (const [name, run] of Object.entries(scenarios)) {
  const { got, want } = await run();
  const pass = got === want; if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${got}${pass ? '' : `  (want ${want})`}`);
}
console.log(failed ? `${failed} scenario(s) failed` : 'all scenarios pass');
process.exitCode = failed ? 1 : 0;
