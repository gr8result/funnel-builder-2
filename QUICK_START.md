# 🚀 Quick Start: Email Automation

## What Was Fixed

**Problem:** Emails marked as sent on nodes but never actually delivered to SendGrid

**Solution:** Automatic queue flushing + comprehensive queue management UI

---

## 1. Verify Setup (5 minutes)

### ✅ Database
```bash
# In Supabase SQL Editor, verify table exists:
SELECT COUNT(*) FROM automation_email_queue;
# Should return: (1 row) with count
```

### ✅ Environment
Check `.env.local`:
```
SENDGRID_API_KEY=SG.xxx              # Must have value
SENDGRID_FROM_EMAIL=noreply@xyz.com  # Must have value
AUTOMATION_CRON_SECRET=your_secret   # Recommended
```

### ✅ Start Dev Server
```bash
npm run dev
# Runs on http://localhost:3000
```

---

## 2. Test the Flow (10 minutes)

### Option A: Manual Test via UI
1. Go to **Email > Automation**
2. Open or create a flow
3. Click on any **email node** → See node details
4. Manually add a lead: **⚙️ Members** → Import from list
5. Queue indicator shows: **📧 1 queued**
6. Click **📤 Flush Queue** button
7. Watch queue indicator → should change to **📧 0 queued**

### Option B: API Test
```bash
# Terminal 1: Check queue status
curl http://localhost:3000/api/automation/email/queue-health

# Terminal 2: Run tick to queue emails
curl -X POST "http://localhost:3000/api/automation/engine/tick?flow_id=YOUR_FLOW_ID"

# Terminal 1 again: See if queue sent them
curl http://localhost:3000/api/automation/email/queue-health

# Should show "sent" count increased
```

### Option C: Automated Test Script
```bash
node test-automation-flow.js c74ab752-75c9-47d1-8dd2-7497f1e22434
# Shows full flow: queue → tick → flush → SendGrid
```

---

## 3. How Emails Actually Get Sent Now

```
Lead Added → Tick Engine → Queue to DB → Auto-Flush → SendGrid → Delivered
     (UI)      (API)      (save to table)   (auto)    (send email)  (✅)
```

**Key difference:** Flush happens automatically after tick, not manually

---

## 4. Click Email Node to See Queue

1. In flow builder, **click any orange email node**
2. Modal opens showing:
   - Current leads at that node
   - All queued emails (pending/sent/failed)
   - Open/click tracking
   - **Remove lead** button to stop them
   - Unsubscribed leads highlighted in red

---

## 5. Important Features

| Feature | How to Use |
|---------|-----------|
| **Queue Health** | `GET /api/automation/email/queue-health` |
| **Node Details** | Click orange email node in UI |
| **Remove Lead** | Click **Remove** in node details modal |
| **Manual Flush** | Click **📤 Flush Queue** button (shows when queue has pending) |
| **Unsubscribe Blocking** | If lead.unsubscribed=true, run pauses automatically |
| **Test Script** | `node test-automation-flow.js [flow_id]` |

---

## 6. Troubleshooting

### "Emails still not sending?"
1. Run test script: `node test-automation-flow.js`
2. Check SendGrid config: Does `queue-health` show `sendgrid_configured: true`?
3. Check tick response: Look for auto-flush success/error in debug output
4. Verify `automation_email_queue` table exists

### "Queue shows pending but not flushing?"
- Click **📤 Flush Queue** button manually
- Check browser console for errors
- Run: `curl -X POST http://localhost:3000/api/automation/email/flush-queue`

### "Can't see emails in SendGrid?"
- Run: `curl http://localhost:3000/api/automation/email/queue-health`
- Check `sent_tracking.count` (emails we logged)
- If 0 but tick said it sent: Check flush response for errors

---

## 7. What Each Component Does

### `/pages/api/automation/engine/tick.js`
- Processes leads through flow nodes
- **NEW:** Automatically calls flush-queue after queueing emails
- **NEW:** Checks if lead unsubscribed, pauses if so

### `/pages/api/automation/email/queue-health.js`
- Single endpoint to check everything
- Returns: pending/sent/failed counts, SendGrid config, diagnosis

### `/pages/api/automation/email/flush-queue.js` (existing)
- Sends pending emails via SendGrid
- Updates status to "sent" + logs to email_sends
- Now called automatically by tick

### `NodeDetailsModal` (new UI component)
- Shows all email activity for a node
- Can remove leads manually
- Shows unsubscribed status

---

## 8. Files to Know

**Core fixes:**
- `pages/api/automation/engine/tick.js` - Auto-flush added (lines 455-465)
- `pages/api/automation/engine/tick.js` - Unsubscribe check (lines 297-312)

**New endpoints:**
- `pages/api/automation/email/queue-health.js` - Health check
- `pages/api/automation/nodes/[nodeId]/details.js` - Node info
- `pages/api/automation/nodes/[nodeId]/remove-lead.js` - Remove lead

**New UI:**
- `components/automation/NodeDetailsModal.js` - Modal component
- `pages/modules/email/automation/index.js` - Added flush button, queue indicator

**Docs:**
- `AUTOMATION_EMAIL_FIX.md` - Complete technical details
- `test-automation-flow.js` - Test script

---

## Next: Monitor Your Flows

1. **Real-time:** Check queue health while testing
2. **Dashboard:** Click nodes to see email tracking
3. **Logs:** Check automation_logs table for activity
4. **Email_sends:** Verify all emails logged in database

---

**Ready? Add a test lead to a flow and watch the queue fill and flush!** 🚀
