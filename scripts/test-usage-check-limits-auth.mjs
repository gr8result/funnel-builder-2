import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
const [{ default: handler }, { createSupabaseAdmin }] = await Promise.all([
  import("../pages/api/usage/check-limits.js"),
  import("../lib/supabaseAdmin.js"),
]);

const supabaseAdmin = createSupabaseAdmin();
const originalGetUser = supabaseAdmin.auth.getUser;
const originalFrom = supabaseAdmin.from;
const requestedTokens = [];
supabaseAdmin.auth.getUser = async (token) => {
  requestedTokens.push(token);
  return token === "test-subscriber-token"
    ? { data: { user: { id: "subscriber-test-user" } }, error: null }
    : { data: { user: null }, error: { message: "Invalid token" } };
};
supabaseAdmin.from = (table) => {
  const result = table === "accounts"
    ? { data: { email_plan_tier: "starter", sms_monthly_limit: null }, count: null, error: null }
    : { data: null, count: 0, error: null };
  const query = {
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lte() { return this; },
    in() { return this; },
    maybeSingle() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
};

function response() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

try {
  const anonymousResponse = response();
  await handler({ method: "GET", headers: {}, query: {} }, anonymousResponse);
  assert.equal(anonymousResponse.statusCode, 401, "anonymous usage checks remain unauthorized");
  assert.equal(requestedTokens.length, 0, "missing credentials are rejected before token validation");

  const subscriberResponse = response();
  await handler({
    method: "GET",
    headers: { authorization: "Bearer test-subscriber-token" },
    query: {},
  }, subscriberResponse);
  assert.equal(subscriberResponse.statusCode, 200, "authenticated subscribers receive usage data");
  assert.equal(subscriberResponse.body?.ok, true);
  assert.deepEqual(requestedTokens, ["test-subscriber-token"], "normalized lowercase Authorization header reaches auth validation");
  console.log("Usage check auth: signed-in subscriber and anonymous protection passed.");
} finally {
  supabaseAdmin.auth.getUser = originalGetUser;
  supabaseAdmin.from = originalFrom;
}
