// scripts/test-takeoff-v2-detection-auth.mjs
//
// Proves — with real HTTP requests against a running dev server, not code
// inspection — exactly which layer produces "AI detection API error 401" for
// /api/ai/plan-detect (the endpoint modules/takeoff-v2/takeoff/wallDetection.js
// calls for Detect Exterior Walls).
//
// What this proves:
//  - No Authorization header  -> 401 from withAuth (lib/withWorkspace.js),
//    body { error: "Unauthorized: missing token", code: "USER_AUTH_REQUIRED" }.
//  - A syntactically-valid-but-fake bearer token -> 401 from withAuth's
//    supabaseAdmin.auth.getUser(token) call, body { error: "Unauthorized:
//    invalid token", code: "USER_AUTH_REQUIRED" }.
//  - Both prove the 401 is the Gr8 Result APPLICATION's own session check,
//    never the external OpenAI provider (which is only ever reached after
//    withAuth succeeds, server-side, inside the handler).
//
// A real *valid* Supabase session is intentionally NOT fabricated here (that
// would mean creating/deleting a real auth user against whichever Supabase
// project this environment points at — out of scope for an automated repo
// test to do unprompted). The two cases above are sufficient to prove the
// 401's origin conclusively; verifying the authenticated-success path is a
// manual step (log in normally in a browser, then check the Network tab).
//
// Requires a Next dev server already running (npm run dev).
// Run with: node scripts/test-takeoff-v2-detection-auth.mjs [baseUrl]

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

const SAMPLE_PAYLOAD = {
  imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  imageWidth: 10,
  imageHeight: 10,
};

async function postDetect(headers) {
  const response = await fetch(`${baseUrl}/api/ai/plan-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(SAMPLE_PAYLOAD),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  // ---------- 1: no Authorization header at all ----------
  const noAuth = await postDetect({});
  record(
    "no Authorization header returns 401 from the application's own auth (USER_AUTH_REQUIRED), not the AI provider",
    noAuth.status === 401 && noAuth.body.code === "USER_AUTH_REQUIRED" && /missing token/i.test(noAuth.body.error || ""),
    `status=${noAuth.status} body=${JSON.stringify(noAuth.body)}`
  );

  // ---------- 2: a syntactically valid but fake bearer token ----------
  const badAuth = await postDetect({ Authorization: "Bearer not-a-real-supabase-jwt-12345" });
  record(
    "an invalid bearer token returns 401 from the application's own auth (USER_AUTH_REQUIRED), not the AI provider",
    badAuth.status === 401 && badAuth.body.code === "USER_AUTH_REQUIRED" && /invalid token/i.test(badAuth.body.error || ""),
    `status=${badAuth.status} body=${JSON.stringify(badAuth.body)}`
  );

  // ---------- 3: detection-health without admin auth also rejects cleanly ----------
  // /api/dev/* is double-gated: middleware.js's admin_key cookie check runs
  // first (redirecting to /dev/login if absent), then withAdmin's own Bearer
  // token check. Sending the admin_key cookie (same convention the existing
  // Puppeteer acceptance scripts use) gets past the outer gate so this
  // actually exercises withAdmin's own 401, rather than just observing a
  // redirect to the login page.
  const adminKey = process.env.ADMIN_DASH_KEY || "";
  const health = await fetch(`${baseUrl}/api/dev/detection-health`, {
    redirect: "manual",
    headers: adminKey ? { Cookie: `admin_key=${adminKey}` } : {},
  });
  const isRejection = health.status === 401 || (health.status >= 300 && health.status < 400);
  let healthDetail = `status=${health.status}`;
  if (health.status === 401) healthDetail += ` body=${JSON.stringify(await health.json().catch(() => ({})))}`;
  record(
    "unauthenticated /api/dev/detection-health correctly rejects (never leaks config to an anonymous caller)",
    isRejection,
    healthDetail
  );

  console.log("\nManual follow-up (cannot be automated safely here): log into the app normally in a browser,");
  console.log("open DevTools > Network, click Detect Exterior Walls, and confirm the request to");
  console.log("/api/ai/plan-detect now carries an Authorization header and does NOT return 401.");

  const failures = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length) process.exit(1);
}

main();
