update public.email_campaigns_queue
set status = 'queued',
    processing = false,
    last_error = null
where status = 'error';
