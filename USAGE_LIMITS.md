# USAGE LIMITS & QUOTAS DOCUMENTATION
# For Funnel Builder — All Plan Modules

## Overview

All usage (contacts, emails, SMS, funnels, automations, etc.) is tracked and quota-enforced at
runtime via `lib/featureGates.js` (client-side) and `lib/entitlements.js` (server-side).
`null` means unlimited. Plan enforcement cascades — a higher plan always includes everything
below it.

---

## PLAN SUMMARY

| Resource              | Starter ($129) | Growth ($299)  | Scale ($449)   | Professional ($899) |
|-----------------------|----------------|----------------|----------------|---------------------|
| Contacts              | 5,000          | 15,000         | 40,000         | Unlimited           |
| Emails / month        | 50,000         | 150,000        | 400,000        | Unlimited           |
| SMS / month           | 500            | 2,500          | 5,000          | 10,000              |
| Websites              | 1              | 3              | 7              | Unlimited           |
| Full Funnels          | 0 (pages only) | 1              | 3              | Unlimited           |
| Automations           | 5              | 15             | Unlimited      | Unlimited           |
| Team Members          | 2              | 5              | 10             | 25                  |
| Pipelines             | 1              | Unlimited      | Unlimited      | Unlimited           |
| Communities           | 1              | 3              | Unlimited      | Unlimited           |
| Social Profiles       | 5              | 10             | 50             | Unlimited           |
| AI Credits / month    | 50             | 250            | 750            | Unlimited           |
| Storage               | 5 GB           | 25 GB          | 100 GB         | 1 TB                |

---

## EMAIL LIMITS

### Starter ($129/month base plan)
- **Max Contacts**: 5,000
- **Max Emails/Month**: 50,000

### Growth ($299/month)
- **Max Contacts**: 15,000
- **Max Emails/Month**: 150,000

### Scale ($449/month)
- **Max Contacts**: 40,000
- **Max Emails/Month**: 400,000

### Professional ($899/month)
- **Max Contacts**: Unlimited
- **Max Emails/Month**: Unlimited (separate high-volume email plan may apply)

---

## SMS LIMITS

### Starter
- **Max SMS/Month**: 500

### Growth
- **Max SMS/Month**: 2,500

### Scale
- **Max SMS/Month**: 5,000

### Professional
- **Max SMS/Month**: 10,000

---

## ENFORCEMENT POINTS

### Feature Gating
- **`lib/featureGates.js`** — single source of truth for all plan limits and feature access
  - `canUseFeature(plan, feature)` — returns bool
  - `getLimit(plan, resource)` — returns number or null (unlimited)
  - `PLAN_LIMITS` — all quota values keyed by plan id
  - `FEATURE_PLANS` — feature keys mapped to minimum required plan

- **`lib/entitlements.js`** — server-side async wrappers
  - `workspaceCanUse(workspaceId, feature)` — looks up plan from DB, calls canUseFeature
  - `getWorkspaceLimit(workspaceId, resource)` — looks up plan from DB, calls getLimit
  - Falls back to `"starter"` if no plan is set on the workspace

- **`hooks/useWorkspace.js`** — client-side access
  - `workspace.can("feature")` — feature gate check
  - `workspace.limit("resource")` — quota limit

### Email Enforcement
1. **List Subscription** (`/pages/api/email/subscribe.js`) — checks contact limit before adding
2. **Autoresponder Launch** (`/pages/api/email/autoresponders/save.js`) — checks monthly email limit before enqueueing
3. **Usage Tracking** (`/lib/emailDB.js`) — counts from `email_sends` and `subscribers` tables

### SMS Enforcement
1. **Campaign Launch** (`/pages/api/smsglobal/launch-sequence.js`) — checks monthly SMS limit before enqueueing
2. **Bulk Send** (`/pages/api/smsglobal/send-bulk.js`) — enforces per-send quota check
3. **Usage Tracking** — counts from `sms_queue` table (status: "sent" or "delivered") this month

---

## TABLES INVOLVED

### Workspaces Table
- `plan` — Active plan id: `"starter"` | `"growth"` | `"scale"` | `"professional"`

### Email Tables
- `subscribers` — All subscribers (user_id, email, name)
- `list_subscribers` — Join table (list_id, subscriber_id)
- `email_sends` — Individual sends (user_id, status, created_at)
- `email_lists` — Lists (id, user_id, name)

### SMS Tables
- `sms_queue` — Queued SMS messages (user_id, status, created_at)

---

## ERROR RESPONSES

### Feature Blocked (upgrade required)
```json
{
  "ok": false,
  "error": "Upgrade required",
  "code": "FEATURE_GATED"
}
```

### Email Limit Exceeded
```json
{
  "ok": false,
  "error": "Monthly email limit reached",
  "code": "EMAIL_LIMIT_EXCEEDED",
  "details": { "limit": 50000, "used": 50000, "remaining": 0 }
}
```

### Contact/Subscriber Limit Exceeded
```json
{
  "ok": false,
  "error": "Contact limit reached",
  "code": "CONTACT_LIMIT_EXCEEDED",
  "details": { "limit": 5000, "used": 5000, "remaining": 0 }
}
```

### SMS Limit Exceeded
```json
{
  "ok": false,
  "error": "Monthly SMS limit reached",
  "code": "SMS_LIMIT_EXCEEDED",
  "details": { "limit": 500, "used": 500, "remaining": 0 }
}
```

---

## UI COMPONENTS

### UsageWarning Component
Located at `/components/UsageWarning.js`

Displays visual progress bars for monthly emails, SMS, and total contacts.

Shows warning colors when:
- 50%+ used: Yellow
- 80%+ used: Orange
- 100% reached: Red
```

---

## MONTH RESET

Usage quotas reset on the first day of each month (00:00 UTC):
- Email sends counter resets
- SMS sends counter resets
- Subscriber overages are NOT automatically downgraded

---

## UPGRADE BEHAVIOR

When a user upgrades their plan mid-month:
- Higher limits immediately apply
- Existing usage counts toward new quota
- No pro-rata adjustments

When a user downgrades:
- Lower limits immediately apply
- If current usage exceeds new limit, account may be in violation
- Auto-upgrade API (`/pages/api/upgrade-email-plan.js`) may force upgrades to maintain compliance

---

## DATA SYNC

Usage columns on `accounts` table are updated when:
- A subscriber is added/removed
- An email is sent
- An SMS is sent

Updates are asynchronous (triggered by `updateAccountUsage()`)

---

## TESTING

Check limits endpoint:
```bash
curl http://localhost:3000/api/usage/check-limits \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Simulate subscriber limit:
1. Create subscriber #500
2. Try to add subscriber #501
3. Should receive LIST_LIMIT_EXCEEDED error

Simulate email limit:
1. Set email_emails_sent_month to 999 in database
2. Try to send autoresponder to 2+ recipients
3. Should receive EMAIL_LIMIT_EXCEEDED error
