// Resolve hook: every import of lib/supabaseAdmin(.js) gets the in-memory fake instead.
// Registered by scripts/register-fake-supabase-admin.mjs.
const fake = new URL("./fixtures/fake-supabase-admin.mjs", import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (/(^|\/)supabaseAdmin(\.js)?$/.test(specifier) && /lib\/supabaseAdmin(\.js)?$|^\.{1,2}\/supabaseAdmin(\.js)?$/.test(specifier)) {
    return { url: fake, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
