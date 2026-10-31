// Test stub for lib/supabaseAdmin: forwards to the PGlite-backed adapter the test installs on globalThis.
const target = () => {
  if (!globalThis.__MARKETING_TEST_DB__) throw new Error('Test database not installed');
  return globalThis.__MARKETING_TEST_DB__;
};
export const supabaseAdmin = new Proxy({}, {
  get(_, key) {
    const value = target()[key];
    return typeof value === 'function' ? value.bind(target()) : value;
  },
});
export default supabaseAdmin;
