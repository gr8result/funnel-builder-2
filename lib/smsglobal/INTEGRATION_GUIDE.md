# Integration Guide: Automated SMS Subaccount Setup

## Quick Start (5 steps)

### Setup:
1. **Import the subaccount creator** in your onboarding approval handler
2. **Issue initial credit** to fund the subaccount
3. **Call during approval** to auto-create and fund
4. **Store credentials** in user's account
5. **User starts sending** SMS immediately

### Implementation:

#### Step 1: Add to Your Approval Handler

In your dashboard/admin endpoint where applications are approved:

```javascript
// pages/api/admin/approve-application.js (or similar)

import { createSmsGlobalSubaccount } from "../../../lib/smsglobal/create-subaccount.js";
import { topupSubaccount } from "../../../lib/smsglobal/topup-subaccount.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

const INITIAL_SMS_CREDIT = 50;  // $50 AUD or your currency

export default async function handler(req, res) {
  const { userId, businessName, email } = req.body;

  // ... your approval logic ...

  // STEP 1: CREATE SMS SUBACCOUNT
  const { ok: createOk, sender_id, sms_api_key, sms_api_secret } = 
    await createSmsGlobalSubaccount(
      businessName,
      email,
      process.env.SMSGLOBAL_API_KEY,
      process.env.SMSGLOBAL_API_SECRET
    );

  if (!createOk) {
    return res.status(500).json({ ok: false, error: "Failed to create SMS account" });
  }

  // STEP 2: FUND THE SUBACCOUNT (CRITICAL!)
  const { ok: fundOk, new_balance } = await topupSubaccount(
    sender_id,
    INITIAL_SMS_CREDIT,
    process.env.SMSGLOBAL_API_KEY,
    process.env.SMSGLOBAL_API_SECRET
  );

  // STEP 3: STORE CREDENTIALS
  await supabaseAdmin
    .from("accounts")
    .update({
      sender_id,
      sms_api_key,
      sms_api_secret,
      sms_initial_credit: INITIAL_SMS_CREDIT,
      sms_current_balance: fundOk ? new_balance : 0,
      sms_activated: fundOk,  // Only activate if funded
    })
    .eq("user_id", userId);

  return res.json({ 
    ok: true, 
    sms_status: fundOk ? "ready" : "pending_funding",
    balance: fundOk ? new_balance : 0
  });
}
```

#### Step 2: Verify SMS Works

Test single SMS:

```javascript
// pages/api/smsglobal/SMSSend.js (already updated)
// Users can now send SMS via:

POST /api/smsglobal/SMSSend
{
  "lead_id": "...",
  "message": "Test SMS"
}
// SMS sent from user's subaccount
// Shows from their business name (if registered)
```

Test campaign:

```javascript
// pages/api/smsglobal/launch-sequence.js (already updated)
// Users can now queue campaigns via:

POST /api/smsglobal/launch-sequence
{
  "audience": { "type": "lead_id", "value": "..." },
  "steps": [{ "message": "Hello", "delay": 0, "unit": "minutes" }]
}
// Campaign queued with user's business name as origin
// Auto-flushes using their subaccount credentials
```

#### Step 3: Update UI Feedback

When showing SMS marketing UI, check if SMS is activated:

```javascript
// pages/modules/email/crm/sms-marketing/index.js

async function checkSmsStatus(userId) {
  const { data } = await supabase
    .from('accounts')
    .select('sms_activated, business_name, sender_id')
    .eq('user_id', userId)
    .single();

  if (!data?.sms_activated) {
    return {
      ready: false,
      message: "SMS not yet activated. Complete your SMS setup."
    };
  }

  return {
    ready: true,
    origin: data.business_name,
    subaccount: data.sender_id
  };
}

// In your component:
const smsStatus = await checkSmsStatus(userId);
if (!smsStatus.ready) {
  // Show "SMS Setup Required" message
} else {
  // Show SMS sending UI
}
```

#### Step 4: Test End-to-End

```bash
# 1. Get a user's Bearer token
TOKEN="your_user_bearer_token"

# 2. Send single SMS
curl -X POST http://localhost:3000/api/smsglobal/SMSSend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-lead",
    "message": "Hello from subaccount!"
  }'

# Expected: SMS sent from user's business name
# Check logs for: ✅ SMS sent OK
```

```bash
# 3. Queue campaign
curl -X POST http://localhost:3000/api/smsglobal/launch-sequence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "audience": { "type": "lead_id", "value": "test-lead" },
    "steps": [
      {"message": "Step 1", "delay": 0, "unit": "minutes"}
    ]
  }'

# Expected: Campaign queued + auto-flushed successfully
# Check sms_queue table: status should be "sent"
```

#### Step 5: Monitor Production

## Funding Model

### How Subaccounts Get Funded

When you approve a user, the system:

1. **Creates their subaccount** - New unique SMS account in SMSGlobal
2. **Transfers initial credit** - Moves $50 (or configured amount) from your master balance
3. **User can send immediately** - SMS deducted from their subaccount balance

### Funding Options

**Option A: Automatic (Recommended for Scale)**
```javascript
// In approval handler
const { ok } = await topupSubaccount(
  sender_id,
  50,  // $50 initial credit
  apiKey,
  apiSecret
);
```
- ✅ User SMS ready immediately after approval
- ✅ No manual steps needed 
- ✅ Scales to thousands of users

**Option B: Manual Top-up (if approval fails)**
```javascript
// If automatic top-up fails, manual fallback
// Via SMSGlobal portal:
// 1. Login as admin
// 2. Go to Reseller > Subaccounts
// 3. Find user's subaccount
// 4. Click "Top up" or "Add Credit"
// 5. Transfer amount from master balance
```

**Option C: Pay-Per-Use (User Funded)**
```javascript
// Instead of pre-funding:
// - Create subaccount with $0 balance
// - User enters their own payment method
// - SMS auto-deducted from their card
// (Requires SMSGlobal account configuration)
```

### Checking Balance

```javascript
import { getSubaccountBalance } from '@/lib/smsglobal/topup-subaccount.js';

const { ok, balance, currency } = await getSubaccountBalance(
  sender_id,
  apiKey,
  apiSecret
);

if (ok) {
  console.log(`Current balance: $${balance} ${currency}`);
}
```

### Database Schema Update

```sql
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_initial_credit NUMERIC DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_current_balance NUMERIC DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_last_funded_at TIMESTAMP;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_total_spent NUMERIC DEFAULT 0;
```

### Cost Per SMS

- **Australia**: ~0.05-0.10 AUD per SMS (varies by carrier)
- **International**: varies significantly by country
- **Deducted from subaccount** in real-time as SMS sent

### Why Pre-funding Works

```
Master Account Balance:  $1000
                          ↓
Creates 20 Users @ $50 each
                          ↓
Remaining Master Balance: $1000
Each User Balance:        $50 (in their subaccount)
                          ↓
User 1 sends 500 SMS = -$25 from their $50 balance
User 2 sends 100 SMS = -$5 from their $50 balance
Etc.
```

### Low Balance Warnings

```javascript
// After funding, optionally set low-balance alerts
// Via SMSGlobal API or portal:
// - Alert when subaccount drops below $10
// - Sent to user's email
// - They can top up themselves OR you auto-top-up via API
```

#### Step 5: Monitor Production

```sql
-- Check SMS activation status
SELECT user_id, business_name, sender_id, sms_activated, sms_enabled_at 
FROM accounts 
WHERE sms_activated = true 
LIMIT 10;

-- Check queued SMS
SELECT id, user_id, status, origin, sender_id, created_at 
FROM sms_queue 
ORDER BY created_at DESC 
LIMIT 20;

-- Check failed SMS
SELECT id, user_id, last_error, body 
FROM sms_queue 
WHERE status = 'failed' 
ORDER BY updated_at DESC 
LIMIT 10;
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Approved                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │ createSmsGlobalSubaccount()   │
           │ - Calls SMSGlobal /v2/user/   │
           │   sub-account POST API        │
           │ - Returns: sender_id,         │
           │   api_key, api_secret         │
           └───────────┬───────────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ Store in accounts table  │
           │ - sender_id              │
           │ - sms_api_key            │
           │ - sms_api_secret         │
           │ - sms_activated = true   │
           └───────────┬──────────────┘
                       │
                       ▼
     ┌─────────────────────────────────────┐
     │    User Can Now Send SMS            │
     │                                     │
     │  SMSSend (single) →                 │
     │  launch-sequence (campaigns) →      │
     │  All use user's subaccount creds    │
     │  SMS shows from their business name │
     └─────────────────────────────────────┘
```

## Database Changes

### New Columns (if not already present)

```sql
-- In accounts table, ensure these columns exist:
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_api_key TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_api_secret TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_activated BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sms_enabled_at TIMESTAMP;
```

### Verification

```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
AND column_name IN ('sender_id', 'sms_api_key', 'sms_api_secret', 'sms_activated');
```

## Troubleshooting

### Error: "Subaccount creation failed"

**Cause:** SMSGlobal API not responding or credentials invalid

**Check:**
1. Are SMSGLOBAL_API_KEY and SMSGLOBAL_API_SECRET set in .env?
2. Are credentials for your master account (not a subaccount)?
3. Is your SMSGlobal account in good standing (not suspended)?

**Fix:**
```bash
# Test credentials manually
curl -H "Authorization: MAC id=KEY, ts=TIME, nonce=NONCE, mac=HASH" \
  https://api.smsglobal.com/v2/user/credit-balance
# Should return your account balance
```

### Error: "SMS not activated for this account"

**Cause:** User doesn't have sms_api_key stored

**Check:**
```sql
SELECT user_id, sms_api_key, sms_api_secret, sms_activated 
FROM accounts 
WHERE user_id = 'problem-user-id';
```

**Fix:**
1. Manually run approve-application endpoint again
2. Or manually insert credentials:
   ```sql
   UPDATE accounts 
   SET sms_api_key='...', sms_api_secret='...', sms_activated=true 
   WHERE user_id='user-id';
   ```

### SMS sent but shows wrong origin

**Cause:** Business name not registered in their subaccount

**Solutions:**
1. Register business name in their SMSGlobal subaccount (manual)
2. SMS automatically falls back to "gr8result" (inherited)
3. Add registered sender IDs to their subaccount

**Note:** See [SUBACCOUNT_SETUP.md] for "Origin not Registered" section

### Campaign stuck in queue (status = "queued")

**Cause:** Auto-flush failed or flush-queue endpoint not responding

**Check:**
1. Is flush-queue endpoint working?
   ```bash
   curl http://localhost:3000/api/smsglobal/flush-queue?limit=5
   ```

2. Are there queued SMS?
   ```sql
   SELECT COUNT(*) FROM sms_queue WHERE status = 'queued';
   ```

3. Manually flush:
   ```bash
   curl http://localhost:3000/api/smsglobal/flush-queue?key=CRON_SECRET&limit=50
   ```

## Performance Considerations

### Subaccount Creation Time
- Takes 2-5 seconds per subaccount
- Do this during off-hours or async if possible
- Consider: await operation, then reload UI when complete

### SMS Sending Rate
- Each subaccount has SMSGlobal's standard rate limits
- No additional limitation from our system
- Batched queueing efficient for campaigns

### Cost per Message
- Charged to user's subaccount
- Same rate as master account
- No markup from our system

## Security Notes

1. **API Keys Stored Encrypted** (if using Supabase Encryption)
   ```javascript
   // Consider enabling RLS on accounts table
   ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users see own SMS creds" ON accounts
   FOR SELECT USING (auth.uid() = user_id);
   ```

2. **Never Log API Secrets**
   - Our code logs `has_api_key: true` not actual secret
   - Check logs for accidental exposure

3. **Rotation** (When Needed)
   - Generate new SMSGlobal API key in their subaccount
   - Update accounts table
   - Old key becomes invalid

## Next Steps

1. ✅ Files created:
   - `/lib/smsglobal/create-subaccount.js` 
   - `/pages/api/onboarding/approve-application.js`
   - `/lib/smsglobal/SUBACCOUNT_SETUP.md`

2. Integration checklist:
   - [ ] Update your approval handler to call createSmsGlobalSubaccount
   - [ ] Test with one user
   - [ ] Verify SMS sends from their business name
   - [ ] Deploy to staging
   - [ ] Test with multiple users
   - [ ] Deploy to production

3. Optional enhancements:
   - [ ] Auto-register business name as approved sender
   - [ ] User dashboard to manage SMS settings
   - [ ] Per-user SMS usage analytics
   - [ ] Subaccount balance management UI
