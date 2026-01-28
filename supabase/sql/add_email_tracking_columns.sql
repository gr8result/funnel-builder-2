-- Add email tracking columns to automation_email_queue table
-- This allows tracking whether emails were opened and when

-- Add opened_at column if it doesn't exist
ALTER TABLE public.automation_email_queue 
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add clicked_at column for tracking clicks
ALTER TABLE public.automation_email_queue 
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add bounced_at column for bounced emails
ALTER TABLE public.automation_email_queue 
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add sent_at column for when email was actually sent
ALTER TABLE public.automation_email_queue 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index on opened_at for faster condition evaluations
CREATE INDEX IF NOT EXISTS idx_automation_email_queue_opened_at 
  ON public.automation_email_queue(opened_at) 
  WHERE opened_at IS NOT NULL;

-- Create index on sent_at for faster filtering
CREATE INDEX IF NOT EXISTS idx_automation_email_queue_sent_at 
  ON public.automation_email_queue(sent_at) 
  WHERE sent_at IS NOT NULL;
