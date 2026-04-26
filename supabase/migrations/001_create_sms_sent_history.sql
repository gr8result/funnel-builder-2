-- Create sms_sent_history table to preserve SMS delivery records
-- This table stores all successfully sent SMS for historical analysis and reporting

CREATE TABLE IF NOT EXISTS sms_sent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_phone TEXT NOT NULL,
  body TEXT,
  origin TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, failed, etc
  provider_message_id TEXT, -- From SMSGlobal response
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sms_sent_history_user_created 
  ON sms_sent_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_sent_history_user_sent 
  ON sms_sent_history(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_sent_history_status 
  ON sms_sent_history(user_id, status);

-- Add sms_monthly_limit column to accounts if it doesn't exist
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS sms_monthly_limit INTEGER DEFAULT NULL;

-- Create index on sms_queue for scheduled messages
CREATE INDEX IF NOT EXISTS idx_sms_queue_scheduled 
  ON sms_queue(user_id, scheduled_for, status) 
  WHERE status IN ('queued', 'pending');
