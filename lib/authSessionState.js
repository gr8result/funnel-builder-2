// One session observer for the application. Storage/refresh errors are not logout events.
function sameSession(current, next) {
  if (current === next) return true;
  if (!current || !next) return false;
  try {
    return JSON.stringify(current) === JSON.stringify(next);
  } catch {
    return false;
  }
}

export function observeAuthSession(auth, publish, { schedule = setTimeout, cancel = clearTimeout } = {}) {
  let disposed = false;
  let version = 0;
  let retryTimer = null;
  let emptySessionRetry = false;
  let state = { session: null, user: null, loading: true, error: null };
  const emit = (next) => { state = next; if (!disposed) publish(next); };
  const accept = (session) => {
    if (retryTimer !== null) cancel(retryTimer);
    retryTimer = null;
    // Supabase re-announces the stored session (SIGNED_IN) whenever a tab becomes visible.
    // An identical session is not a change: keep the published state so consumers do not re-render.
    if (!state.loading && !state.error && sameSession(state.session, session)) return;
    emit({ session, user: session?.user || null, loading: false, error: null });
  };
  const restore = async () => {
    const requestVersion = ++version;
    try {
      // getSession already refreshes expired access tokens using the persisted session.
      const { data, error } = await auth.getSession();
      if (disposed || version !== requestVersion) return;
      if (error) throw error;
      if (data?.session) {
        emptySessionRetry = false;
        accept(data.session);
        return;
      }
      // A new or duplicated tab can read storage before Supabase completes its
      // local session initialization. Confirm the absence once before routing
      // protected content to login.
      if (!emptySessionRetry) {
        emptySessionRetry = true;
        retryTimer = schedule(() => { retryTimer = null; void restore(); }, 350);
        return;
      }
      accept(null);
    } catch (error) {
      if (disposed || version !== requestVersion) return;
      emit({ ...state, loading: !state.session, error });
      if (retryTimer !== null) cancel(retryTimer);
      retryTimer = schedule(() => { retryTimer = null; void restore(); }, 3000);
    }
  };
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (disposed) return;
    // A null INITIAL_SESSION can also accompany an initialization error.
    // Let getSession distinguish that error from a confirmed absent session.
    if (!session && event !== "SIGNED_OUT") return;
    version++;
    emptySessionRetry = false;
    accept(session || null);
  });
  void restore();
  return {
    retry: restore,
    dispose() {
      disposed = true;
      version++;
      if (retryTimer !== null) cancel(retryTimer);
      subscription?.unsubscribe();
    },
  };
}
