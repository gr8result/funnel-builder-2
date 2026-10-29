// Node module-resolution hooks so real Next.js API route files can be imported by plain Node tests:
//  * extensionless relative imports resolve to .js / .mjs / index.js (as Next's bundler does);
//  * lib/supabaseAdmin and lib/withWorkspace resolve to test stubs (PGlite-backed client, header-driven auth).
// Everything else (handlers, libs, @sendgrid/mail, crypto) is the real code.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const STUBS = {
  supabaseAdmin: new URL('./stubs/supabaseAdmin.mjs', import.meta.url).href,
  withWorkspace: new URL('./stubs/withWorkspace.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  if (/(^|\/)lib\/supabaseAdmin(\.js)?$/.test(specifier)) return { url: STUBS.supabaseAdmin, shortCircuit: true };
  if (/(^|\/)lib\/withWorkspace(\.js)?$/.test(specifier)) return { url: STUBS.withWorkspace, shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !/\.[cm]?js$|\.json$/.test(specifier)) {
    for (const suffix of ['.js', '.mjs', '/index.js']) {
      const candidate = new URL(specifier + suffix, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
