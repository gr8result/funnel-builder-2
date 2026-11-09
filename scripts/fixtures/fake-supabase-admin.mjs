// In-memory stand-in for lib/supabaseAdmin.js, used by scripts/test-client-selections-authorisation.mjs.
// Tests set globalThis.__fakeSupabase = { users: { token: user }, resolve(table, query) => { data, error } }.
// Every query is recorded in globalThis.__fakeSupabase.calls so a test can prove nothing was written.
const WRITE = new Set(["insert", "update", "upsert", "delete"]);
function builder(table) {
  const query = { table, ops: [], write: false };
  const chain = new Proxy({}, {
    get(target, prop) {
      if (prop === "then") {
        const state = globalThis.__fakeSupabase;
        state.calls.push(query);
        const result = state.resolve(table, query) || { data: null, error: null };
        return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      }
      return (...args) => {
        query.ops.push([prop, ...args]);
        if (WRITE.has(prop)) query.write = true;
        return chain;
      };
    },
  });
  return chain;
}
export const supabaseAdmin = {
  from: (table) => builder(table),
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({ upload: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }), remove: async () => ({ data: null, error: null }) }) },
  auth: { getUser: async (token) => {
    const user = globalThis.__fakeSupabase.users[token];
    return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid" } };
  } },
};
export const supabase = supabaseAdmin;
export function createSupabaseAdmin() { return supabaseAdmin; }
export default supabaseAdmin;
export const __isFakeSupabaseAdmin = true;
