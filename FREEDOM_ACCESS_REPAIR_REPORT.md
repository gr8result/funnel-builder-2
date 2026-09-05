# Freedom access repair ? 6 September 2026

The authenticated platform-owner account now receives 200 responses and the original records display. No records or subscription rows were inserted, recreated, deleted, or modified.

## Why access returned 403

The exact canonical module/subscription key is **`freedom`** (`FREEDOM_MODULE_CODE` and `MODULES.FREEDOM`). There is no separate Freedom base-plan feature in `MODULE_PLAN_FEATURES` / `FEATURE_PLANS`; Freedom is an add-on entitlement for ordinary customers.

The guard loaded only `user_modules.module_id` and enabled `workspace_entitlements.module_id`, and discarded the email returned by Supabase token validation. Both live entitlement queries returned 200 with zero `freedom` rows. The platform already authorized developer/admin accounts using `lib/adminUsers.js:isDeveloperEmail`, including the authenticated demo-company APIs, but Freedom did not consult that policy. This was missing integration of existing admin access, not a misspelled Freedom slug, wrong workspace selection, or stale subscription cache. Verified developer identities and active workspace memberships were confirmed in Supabase.

The guard now uses that same existing admin policy only after Supabase verifies the bearer token and confirms the account email. It does not trust request-provided emails, roles, tenant IDs, metadata, or development headers. No new hard-coded identity or unconditional/environment allow was added. Ordinary customers still require the `freedom` subscription and existing sole-owner check; absent or invalid tokens still return 401, unentitled customers 403, and ambiguous global-data ownership 503. The server wrapper converts unexpected auth/handler exceptions into JSON 500 responses.

## Original records

Source: server file `tmp/freedom-trades.json`. The configured store path remains the default. Legacy `tmp/freedom-paper-local.json` is the recorded source for CLSK's historical ID; the current JSON store already contains its original history. Browser localStorage is used for the session and market preferences, not these portfolio records. The isolated authenticated test browser used only its own session storage; no existing user browser storage was cleared or changed.

| Symbol | Original ID | Quantity | State |
| --- | --- | --- | --- |
| CBA | `lt_CBA_159.174_45` | 45 | Active holding |
| JBLU | `lt_JBLU_7.016_240` | 240 | Active holding |
| WULF | `lt_WULF_21.619_88` | 88 | Active holding |
| NWH | `lt_NWH_real_1436` | 1436 | Active holding |
| CLSK | `legacy_market_watch_watch_1787308148465_n9xq4o4c` | 320 | Pending short-term |
| IVV | `st_ivv_pb_mtjr2gyn` | 86 | Pending long-term |

- JBLU's original attached sell order `so_jblu_ls_mtjr2gys` remains US$6.00.
- WULF's original attached sell order `so_wulf_ls_mtjr2gys` remains US$16.40.
- NWH's original attached sell order `so_nwh_tp_mtjr2gyr` remains A$7.85.
- IVV remains unfilled, long-term, 86 at A$71.09.
- CLSK remains unfilled, short-term, 320 at US$10.85, take profit US$16.00.
- Original purchase costs, missing NWH purchase information, IDs, classifications, timestamps, and histories were preserved.
- Additional existing orders were preserved. The short-term store currently has no `status:open` rows; no short-term positions were invented. The four real owned positions are in `longTermHoldings` and display in Active Holdings.

**Store byte-for-byte identical to the before snapshot.** SHA-256: `7dc48a97c5e97e1f5fcc32a848bcb3515d65217a223fafbe92958317578559e8`.

## Page and API changes

Three collections load independently and publish results as each request settles:

- `/api/freedom/trades?type=ACTIVE_HOLDING`: existing open short-term positions.
- `/api/freedom/trades?type=PENDING_BUY_ORDER`: unfilled buy orders, preserving term classification.
- `/api/freedom/long-term`: existing holdings collection.

Each section has its own loading/error state and Retry. A failed collection cannot discard successful siblings. Expected failures are represented as local state, without console.error or rejected promises reaching the runtime overlay. Empty text requires successful empty responses. Authenticated requests now cover My Trades, Long-Term Portfolio, Opportunities, and the shared chart modal. Short-term holding edits/targets use the trades endpoint; long-term holdings use the holdings endpoint.

## Files changed this turn

- `platform-core/api-guards/freedomApiGuard.js`
- `lib/freedom/portfolioClient.js`
- `pages/api/freedom/trades.js`
- `pages/freedom/my-trades.js`
- `pages/freedom/long-term.js`
- `pages/freedom/index.js`
- `components/freedom/FreedomChartModal.js`
- `test/freedom-admin-access.test.mjs`
- `test/freedom-portfolio-loading.test.mjs`
- `test/freedom-portfolio-page.test.mjs`
- This report.

Unrelated work was preserved using scoped before snapshots for comparison. The trade store implementation was not changed in this turn.

## Validation

- **44 regression tests passed** across admin access, collection loading, the actual React page, and existing trade-store tests. Includes authenticated admin, unentitled customer, invalid/missing token, forged identity, customer ownership, partial failure, delayed collection, populated/empty load, Retry, pending status/no P&L, edit and remount persistence, stable IDs and attached sells.
- **735 existing Freedom API security assertions passed.**
- Live existing platform-owner session: all three portfolio endpoints returned **200**; anonymous holdings request returned **401**.
- `/freedom`, `/freedom/my-trades`, and `/freedom/long-term` opened using the authenticated session. Long-Term Portfolio displayed the original four holdings.
- Live My Trades: each of the four holdings and every displayed pending order opened Edit and rendered View Full Chart. The first browser harness encountered a mouse-dispatch timeout after checking pending orders; a second run using DOM clicks completed all holdings and failure/retry verification.
- Reload displayed CBA, JBLU, WULF and NWH with their original records.
- Live simulated long-term **403** retained all six displayed pending orders, showed no false empty message and no Next.js error dialog. Retry restored all four holdings. Recorded page runtime errors: **[]**.
- Edit-and-reload persistence was tested with isolated test storage/state; genuine trade fields were not modified for testing.
- Screenshot: `tmp/freedom-access-repaired.png`.

Commands:

```
node --import ./scripts/register-extensionless-loader.mjs --test --test-reporter=dot test/freedom-admin-access.test.mjs test/freedom-portfolio-loading.test.mjs test/freedom-portfolio-page.test.mjs test/freedom-trade-store.test.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-freedom-api-security.mjs
```

**Refresh the browser. No manual restart is required.** The existing development server was not started, stopped, or restarted.
