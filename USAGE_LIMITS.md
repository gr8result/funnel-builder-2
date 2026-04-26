// USAGE LIMITS & QUOTAS DOCUMENTATION
// For Funnel Builder's Email & SMS Marketing Modules

## Overview

All email and SMS sends are tracked and quota-enforced at runtime. Users cannot exceed their plan's limits.

---

## EMAIL MARKETING LIMITS (by tier)

### Starter ($29/month)
- **Max Subscribers Overall**: 500
- **Max Emails/Month**: 1,000
- **Max Subscribers Per List**: 500 (hard limit)

### Growth ($75/month)
- **Max Subscribers Overall**: 2,000
- **Max Emails/Month**: 10,000
- **Max Subscribers Per List**: 500 (hard limit)

### Expansion ($250/month)
- **Max Subscribers Overall**: 15,000
- **Max Emails/Month**: 30,000
- **Max Subscribers Per List**: 500 (hard limit)

### Enterprise ($350/month)
- **Max Subscribers Overall**: 25,000
- **Max Emails/Month**: 100,000
- **Max Subscribers Per List**: 500 (hard limit)

### Agency (Custom)
- **Max Subscribers Overall**: Unlimited
- **Max Emails/Month**: Unlimited
- **Max Subscribers Per List**: Unlimited

---

## SMS MARKETING LIMITS (by tier)

### Starter ($25/month)
- **Max SMS/Month**: 500

### Growth ($120/month)
- **Max SMS/Month**: 2,500

### Professional ($250/month)
- **Max SMS/Month**: 5,000

### Business ($450/month)
- **Max SMS/Month**: 10,000

### Enterprise (Custom)
- **Max SMS/Month**: Custom

---

## ENFORCEMENT POINTS

### Email Enforcement
1. **List Subscription** (`/pages/api/email/subscribe.js`)
   - Checks total subscriber limit before adding
   - Checks 500 per-list limit in `addToList()` function

2. **Autoresponder Launch** (`/pages/api/email/autoresponders/save.js`)
   - Checks monthly email limit before enqueueing recipients
   - Prevents exceeding tier's monthly quota

3. **Usage Tracking** (`/lib/emailDB.js`, `/lib/usageTracking.js`)
   - Counts emails from `email_sends` table this month
   - Counts subscribers from `subscribers` table

### SMS Enforcement
1. **Campaign Launch** (`/pages/api/smsglobal/launch-sequence.js`)
   - Checks monthly SMS limit before enqueueing messages
   - Prevents exceeding tier's monthly quota

2. **Usage Tracking** (`/lib/usageTracking.js`)
   - Counts SMS from `sms_queue` table (status: "sent" or "delivered") this month

---

## TABLES INVOLVED

### Accounts Table
- `email_plan_tier` - Current email plan (email-starter, email-growth, etc.)
- `email_subscribers_count` - Cached subscriber count (updated after changes)
- `email_emails_sent_month` - Cached email count (updated after changes)
- `sms_plan` - Current SMS plan (sms-starter, sms-growth, etc.)
- `sms_monthly_limit` - Cached SMS limit (updated after changes)
- `sms_sent_month` - Cached SMS count (updated after changes)

### Email Tables
- `subscribers` - All subscribers (user_id, email, name)
- `list_subscribers` - Join table (list_id, subscriber_id)
- `email_sends` - Individual sends (user_id, status, created_at)
- `email_lists` - Lists (id, user_id, name)

### SMS Tables
- `sms_queue` - Queued SMS messages (user_id, status, created_at)

---

## API ENDPOINTS

### Check Limits
**GET** `/api/usage/check-limits`
- Returns current usage and remaining quota
- Requires Bearer token authentication

Query Parameters:
- `check` - Optional filter: "email", "sms", or "list"
- `listId` - Required if check includes "list"

Response:
```json
{
  "ok": true,
  "stats": {
    "email": {
      "sent": 150,
      "limit": 1000,
      "percentage": 15
    },
    "sms": {
      "sent": 45,
      "limit": 500,
      "percentage": 9
    },
    "subscribers": {
      "used": 250,
      "limit": 500,
      "percentage": 50
    }
  },
  "checks": {
    "email": { "ok": true, "remaining": 850 },
    "sms": { "ok": true, "remaining": 455 }
  }
}
```

---

## ERROR RESPONSES

### Email Limit Exceeded
```json
{
  "ok": false,
  "error": "Email limit reached (1000/month)",
  "code": "EMAIL_LIMIT_EXCEEDED",
  "details": {
    "limit": 1000,
    "used": 1000,
    "remaining": 0
  }
}
```

### Subscriber Limit Exceeded
```json
{
  "ok": false,
  "error": "Subscriber limit reached (500 total)",
  "code": "SUBSCRIBER_LIMIT_EXCEEDED",
  "details": {
    "limit": 500,
    "used": 500,
    "remaining": 0
  }
}
```

### List Full
```json
{
  "ok": false,
  "error": "List is full (500 subscriber limit reached)",
  "code": "LIST_LIMIT_EXCEEDED",
  "details": {
    "limit": 500,
    "current": 500
  }
}
```

### SMS Limit Exceeded
```json
{
  "ok": false,
  "error": "SMS limit reached (500/month)",
  "code": "SMS_LIMIT_EXCEEDED",
  "details": {
    "limit": 500,
    "used": 500,
    "remaining": 0
  }
}
```

---

## UI COMPONENTS

### UsageWarning Component
Located at `/components/UsageWarning.js`

Displays visual progress bars for:
- Monthly emails used
- Monthly SMS used
- Total subscribers

Shows warning colors when:
- 50%+ used: Yellow
- 80%+ used: Orange
- 100% reached: Red

Usage:
```jsx
import UsageWarning from "../components/UsageWarning";

export default function Dashboard() {
  return (
    <>
      <UsageWarning />
      {/* Rest of dashboard */}
    </>
  );
}
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
