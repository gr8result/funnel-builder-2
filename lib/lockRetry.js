export const isLockContention = (error) =>
  Boolean(error && (error.isAcquireTimeout || /Another tab is (still saving|busy)/i.test(String(error.message || ""))));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries only lock-acquisition timeouts; the lock itself is never stolen or bypassed.
export async function retryOnLockContention(task, { attempts = 4, baseDelayMs = 500, maxDelayMs = 4000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!isLockContention(error)) throw error;
      lastError = error;
      if (attempt < attempts - 1) {
        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
        await sleep(delay + Math.random() * delay * 0.25);
      }
    }
  }
  throw lastError;
}

// Resolves to { user, error } and never throws on lock contention.
export async function getUserSafe(supabase) {
  try {
    const { data, error } = await retryOnLockContention(() => supabase.auth.getUser());
    return { user: data?.user || null, error: error || null };
  } catch (error) {
    return { user: null, error };
  }
}
