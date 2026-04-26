# Automated SMS Subaccount Setup for Multi-Tenant

## Overview

When a user's application is approved, we automatically:
1. Create a subaccount in SMSGlobal
2. Generate unique API credentials for that subaccount
3. Store credentials in their account
4. User can immediately start sending SMS from their business name

This eliminates manual setup and scales to thousands of users.

## Architecture

```
User's Application → Approved → Create SMSGlobal Subaccount
                                ↓
                         Get: sender_id, api_key, api_secret
                                ↓
                         Store in accounts table
                                ↓
                    User can send SMS immediately
                                ↓
        SMS shows from their business name
        (inherited approved senders from parent account)
        Each user's SMS billed to their subaccount
```

## Database Schema

### accounts table
```sql
user_id                    UUID        (FK to auth.users)
business_name              TEXT        -- Business/brand name
sender_id                  TEXT        -- Subaccount ID (e.g., "3q5959hs")
sms_api_key                TEXT        -- Subaccount API key
sms_api_secret             TEXT        -- Subaccount API secret
sms_activated              BOOLEAN     -- Whether SMS is enabled
sms_enabled_at             TIMESTAMP   -- When SMS was activated
sms_initial_credit         NUMERIC     -- Initial funding amount ($50, etc)
sms_current_balance        NUMERIC     -- Current subaccount balance
sms_last_funded_at         TIMESTAMP   -- When last topup occurred
sms_total_spent            NUMERIC     -- Cumulative SMS spending
```

## API Endpoints

### 1. During Onboarding Approval
**POST /api/onboarding/approve-application**

```javascript
// Request
{
  "userId": "user-123",
  "businessName": "Waite and Sea Health",
  "email": "owner@waiteandseahealth.com",
  "applicationId": "app-456"  // Optional
}

// Response
{
  "ok": true,
  "sms_subaccount": "3q5959hs",
  "sms_status": "ready"
}
```

This endpoint:
- Creates a SMSGlobal subaccount
- Gets back sender_id and API credentials
- Stores credentials in user's account
- User is ready to send SMS

### 2. Send Single SMS
**POST /api/smsglobal/SMSSend**

```javascript
// Request
{
  "lead_id": "lead-789",
  "message": "Hello, this is a test SMS"
}

// Flow
1. Get user from Bearer token
2. Fetch user's subaccount credentials from accounts table
3. Send via user's subaccount (shows from their business name)
4. SMS billed to their subaccount
```

### 3. Send Campaign
**POST /api/smsglobal/launch-sequence**

```javascript
// Request
{
  "audience": { "type": "lead_id", "value": "lead-789" },
  "steps": [
    {
      "message": "Step 1",
      "delay": 0,
      "unit": "minutes"
    },
    {
      "message": "Step 2",
      "delay": 1,
      "unit": "minutes"
    }
  ]
}

// Flow
1. Get user from Bearer token
2. Fetch user's subaccount credentials
3. Queue messages with user's business_name as origin
4. Auto-flush queued messages via user's credentials
5. Each SMS sent from their subaccount
```

## Key Files

| File | Purpose |
|------|---------|
| `/lib/smsglobal/create-subaccount.js` | Creates SMSGlobal subaccount via API |
| `/pages/api/onboarding/approve-application.js` | Example approval workflow |
| `/pages/api/smsglobal/SMSSend.js` | Single SMS using user's credentials |
| `/pages/api/smsglobal/launch-sequence.js` | Campaign queueing with user's data |
| `/pages/api/smsglobal/flush-queue.js` | Processes queue using user credentials |

## SMS Origin / Sender ID

When a user sends SMS:

1. **Origin** (what shows on SMS):
   - Preference: User's business name (if registered in their subaccount)
   - Fallback: "gr8result" (approved parent account sender)

2. **Sender ID** (for routing/billing):
   - User's subaccount ID (e.g., "3q5959hs")
   - Used by SMSGlobal to route to correct subaccount

## User Registration Process

### Step 1: Application Submitted
User fills out SMS onboarding:
- Business name
- Email
- Verification (phone, website, etc.)

### Step 2: Admin Reviews & Approves
When approved via dashboard:
```javascript
// Call approval endpoint
await fetch('/api/onboarding/approve-application', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    businessName: 'Waite and Sea Health',
    email: 'owner@example.com',
    applicationId: 'app-456'
  })
});
```

### Step 3: Automatic Setup
- ✅ SMSGlobal subaccount created
- ✅ API credentials generated
- ✅ Stored in user's account
- ✅ **Initial credit transferred** ($50 or configured amount)
- ✅ SMS immediately available

User doesn't do anything - all automatic after approval!

## Funding Model

### How Subaccounts Get Money

**The Short Version:**
1. You have $X balance in your master SMSGlobal account
2. When approving a user, system transfers $50 to their new subaccount
3. User's SMS deducted from their $50 balance
4. When they run out, they ask you to top-up (or API auto-tops-up)

### Pre-Funding (Recommended)

During approval, system auto-transfers credit:
```
Your Master Balance: $1000
            ↓ (approve user)
System creates subaccount + transfers $50
            ↓ 
Your Balance: $950
User Balance: $50

User sends 500 SMS @ $0.05 each = $25 cost
User's new balance: $25
```

### Files for Funding

| File | Purpose |
|------|---------|
| `/lib/smsglobal/topup-subaccount.js` | Top-up API call + balance check |
| `/pages/api/onboarding/approve-application.js` | Approval + auto-topup (uses above) |

### Configurable Initial Credit

Change this in `approve-application.js`:
```javascript
const INITIAL_SMS_CREDIT = 50;  // Change to any amount: $20, $100, etc.
```

Or make it dynamic:
```javascript
const creditByTier = {
  'free': 10,      // Free users get $10
  'starter': 50,   // Starters get $50
  'pro': 200,      // Pro gets $200
};

const credit = creditByTier[userTier] || 50;
const { ok } = await topupSubaccount(sender_id, credit, key, secret);
```

### Cost Per SMS

- Australia: ~$0.05-0.10 per SMS (varies by network)
- International: varies significantly  
- Deducted in real-time from subaccount balance

### Checking Balance

```javascript
import { getSubaccountBalance } from '@/lib/smsglobal/topup-subaccount.js';

const { balance } = await getSubaccountBalance(subaccount_id, key, secret);
console.log(`User balance: $${balance}`);
```

### What If Auto-Topup Fails?

If the funding fails during approval:
```javascript
{
  "ok": true,
  "sms_status": "pending_funding",  // Not ready yet
  "balance": 0,
  "message": "Subaccount created but needs manual funding"
}
```

**Fallback:**
1. Retry the topup later via API
2. Or manually top-up in SMSGlobal portal
3. Once funded, user can send SMS

### Large Scale Funding Strategy

For 1000s of users:
```javascript
// Approve user with small initial credit
const INITIAL_CREDIT = 20;  // Lower per user
await topupSubaccount(sender_id, INITIAL_CREDIT, key, secret);

// Later, when they reach 80% usage, auto-top-up
// (you'd run a background job for this)
if (userBalance < (INITIAL_CREDIT * 0.2)) {
  await topupSubaccount(sender_id, INITIAL_CREDIT, key, secret);  // Top up another $20
}
```

This way:
- ✓ Low upfront cost per user ($20 vs $50)
- ✓ Auto top-up ensures SMS never fails
- ✓ Users never hit $0 balance unexpectedly

## Scaling to Thousands of Users

**Single Shared Sender (Old Approach - Limited)**
```
All users → "gr8result" origin → Limited to one approved sender
Problem: Can't personalize, limits per-user SMS reputation
```

**Individual Subaccounts (New Approach - Scalable)**
```
User 1 → Subaccount 1 → "Waite and Sea" origin → Billed to subaccount 1
User 2 → Subaccount 2 → "Fitness First" origin → Billed to subaccount 2
User 3 → Subaccount 3 → "Health Hub" origin → Billed to subaccount 3
...
User N → Subaccount N → Their business name → Billed to subaccount N

Each subaccount:
- Separate API keys
- Separate billing
- Can register own approved senders
- Tracked independently
- No contention between users
```

## Billing & Costs per Subaccount

Each subaccount:
- Has own credit balance
- SMS cost debited from subaccount balance
- Master account retains control
- Can top up each subaccount independently

## Error Handling

### Missing Credentials
If user's SMS credentials aren't found:
```javascript
// Response from SingleSMS or Campaign
{
  "ok": false,
  "error": "SMS not activated for this account",
  "detail": "User's SMS subaccount not found. Contact support."
}
```

**Solution:** Run approval endpoint to create subaccount

### Subaccount Creation Failed
If SMSGlobal API fails:
```javascript
{
  "ok": false,
  "error": "Failed to create SMS subaccount",
  "detail": "SMSGlobal error message..."
}
```

**Solution:** Retry approval, check SMSGlobal account status

### Origin Not Registered
If user's business name isn't registered with SMSGlobal:
```
SMS sent with origin "Waite and Sea"
SMSGlobal rejects: "Origin is invalid"
```

**Solution:**
1. Register business name in their SMSGlobal subaccount, OR
2. SMS automatically falls back to "gr8result" (inherited from parent)

## Testing

### Test Single SMS
```bash
curl -X POST http://localhost:3000/api/smsglobal/SMSSend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-lead-123",
    "message": "Test SMS from subaccount"
  }'
```

### Test Campaign
```bash
curl -X POST http://localhost:3000/api/smsglobal/launch-sequence \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "audience": { "type": "lead_id", "value": "test-lead-123" },
    "steps": [
      {"message": "Hello", "delay": 0, "unit": "minutes"}
    ]
  }'
```

### Manual Account Setup (For Testing)
If you need to set up a test user manually:
```sql
UPDATE accounts
SET
  sender_id = '3q5959hs',
  sms_api_key = 'your_test_key',
  sms_api_secret = 'your_test_secret',
  sms_activated = true
WHERE user_id = 'user-id-123';
```

## Environment Variables

```bash
SMSGLOBAL_API_KEY=your_master_api_key        # Master account key
SMSGLOBAL_API_SECRET=your_master_api_secret  # Master account secret
DEFAULT_SMS_ORIGIN=gr8result                 # Fallback sender name
CRON_SECRET=your_cron_key                    # For auto-flush auth
```

## Monitoring & Debugging

### Check if User Has SMS Active
```sql
SELECT user_id, sender_id, business_name, sms_activated, sms_current_balance, sms_enabled_at 
FROM accounts 
WHERE user_id = 'user-123';
```

### Check Subaccount Balance
```sql
-- From your database
SELECT user_id, sender_id, sms_current_balance 
FROM accounts 
WHERE sms_activated = true 
ORDER BY sms_current_balance ASC;
-- Users with low balance are above (may need top-up soon)

-- Or via API
import { getSubaccountBalance } from './lib/smsglobal/topup-subaccount.js';
const { balance } = await getSubaccountBalance(sender_id, key, secret);
```

### View Queued SMS
```sql
SELECT id, user_id, to_phone, status, origin, sender_id FROM sms_queue WHERE user_id = 'user-123';
```

### Monitor Low Balance Users
```sql
-- Find users running low on SMS credit
SELECT user_id, sender_id, sms_current_balance, sms_enabled_at 
FROM accounts 
WHERE sms_activated = true 
AND sms_current_balance < 10  -- Less than $10 remaining
ORDER BY sms_current_balance ASC;

-- Consider auto-topping these up:
-- UPDATE accounts 
-- SET sms_current_balance = sms_current_balance + 50,
--     sms_last_funded_at = NOW()
-- WHERE sms_current_balance < 10;
```

### Manually Top-up a Subaccount
```javascript
import { topupSubaccount } from './lib/smsglobal/topup-subaccount.js';

// Top up a user's subaccount manually
const { ok, new_balance } = await topupSubaccount(
  'sender-id-3q5959hs',
  50,  // Add $50
  process.env.SMSGLOBAL_API_KEY,
  process.env.SMSGLOBAL_API_SECRET
);

if (ok) {
  // Update database
  await supabaseAdmin
    .from('accounts')
    .update({ 
      sms_current_balance: new_balance,
      sms_last_funded_at: new Date().toISOString()
    })
    .eq('sender_id', 'sender-id-3q5959hs');
}
```

### Manually Flush Queue
```bash
curl -X GET 'http://localhost:3000/api/smsglobal/flush-queue?key=CRON_SECRET&limit=50'
```

### Check SMSGlobal Subaccount Balance (Portal)
Via SMSGlobal portal:
1. Login as admin
2. Go to Reseller > Subaccounts
3. Find user's subaccount
4. Check "Credit Balance" or "Available Credit"

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "SMS not activated" | No subaccount created | Run approve-application endpoint |
| "Origin is invalid" | Business name not registered | Register in their subaccount OR use "gr8result" |
| Campaign stuck in queue | Flush-queue not running | Check cron job / call flush manually |
| SMS not sent but queued | Missing API credentials | Check accounts table has sms_api_key |
| SMS fails to send | Subaccount balance = $0 | Check balance; top-up via topupSubaccount() |
| "Insufficient credit" error | User ran out of balance | Auto-topup or notify user to fund account |
| High per-message cost | Wrong API endpoint | Ensure using /v2/sms endpoint |

## Future Enhancements

1. **Sender ID Registration**: Auto-register user's business name as approved sender in their subaccount
2. **Credit Management**: UI to top up subaccount balance
3. **Usage Analytics**: Per-user SMS usage dashboard
4. **Rate Limiting**: Per-subaccount rate limits
5. **Callback Webhooks**: Delivery receipts per subaccount
