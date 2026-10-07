import assert from "node:assert/strict";
import test from "node:test";
import { observeAuthSession } from "../lib/authSessionState.js";

const signedIn = { access_token: "test-token", user: { id: "test-user" } };
const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(getSession) {
  let listener;
  const states = [];
  const scheduled = new Map();
  let timerId = 0;
  const observer = observeAuthSession({
    getSession,
    refreshSession() { throw new Error("Redundant forced refresh"); },
    onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
  }, (state) => states.push(state), {
    schedule(fn) { const id = ++timerId; scheduled.set(id, fn); return id; },
    cancel(id) { scheduled.delete(id); },
  });
  return { observer, states, scheduled, event: (...args) => listener(...args), state: () => states.at(-1) };
}

test("restores a persisted session without asking for another login or forced refresh", async () => {
  const env = setup(async () => ({ data: { session: signedIn }, error: null }));
  await tick();
  assert.equal(env.state().session, signedIn);
  assert.equal(env.state().loading, false);
  env.observer.dispose();
});

test("temporary restore error and null INITIAL_SESSION wait for retry, not logout", async () => {
  let fail = true;
  const env = setup(async () => fail ? { data: { session: null }, error: new Error("Network unavailable") } : { data: { session: signedIn } });
  env.event("INITIAL_SESSION", null);
  await tick();
  assert.equal(env.state().loading, true);
  assert.match(env.state().error.message, /Network/);
  assert.equal(env.scheduled.size, 1);
  fail = false;
  await env.observer.retry();
  assert.equal(env.state().session, signedIn);
  assert.equal(env.state().error, null);
  assert.equal(env.scheduled.size, 0);
  env.observer.dispose();
});

test("a late initial read cannot overwrite sign-in or sign-out events", async () => {
  for (const event of ["SIGNED_IN", "SIGNED_OUT"]) {
    let finish;
    const env = setup(() => new Promise((resolve) => { finish = resolve; }));
    env.event(event, event === "SIGNED_IN" ? signedIn : null);
    finish({ data: { session: event === "SIGNED_IN" ? null : signedIn } });
    await tick();
    assert.equal(env.state().session, event === "SIGNED_IN" ? signedIn : null);
    assert.equal(env.state().loading, false);
    env.observer.dispose();
  }
});

test("transient errors retain an established session; explicit logout clears it", async () => {
  let fail = false;
  const env = setup(async () => { if (fail) throw new Error("Lock busy"); return { data: { session: signedIn } }; });
  await tick();
  fail = true;
  await env.observer.retry();
  assert.equal(env.state().session, signedIn);
  assert.equal(env.state().loading, false);
  env.event("SIGNED_OUT", null);
  assert.equal(env.state().session, null);
  assert.equal(env.state().error, null);
  assert.equal(env.scheduled.size, 0);
  env.observer.dispose();
});

test("confirmed missing session allows sign-in; disposed observers ignore results", async () => {
  const env = setup(async () => ({ data: { session: null }, error: null }));
  await tick();
  assert.equal(env.state().loading, false);
  assert.equal(env.state().error, null);
  env.observer.dispose();
  env.event("SIGNED_IN", signedIn);
  assert.equal(env.state().session, null);
});
