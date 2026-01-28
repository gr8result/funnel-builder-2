-- Add opened_at column to track when emails are opened
ALTER TABLE public.automation_email_queue 
ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone;

-- Create index for opened_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_automation_email_queue_opened_at 
ON public.automation_email_queue(opened_at);
