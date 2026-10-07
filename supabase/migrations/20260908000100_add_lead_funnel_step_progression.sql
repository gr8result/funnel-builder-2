-- Tracks a CRM lead's position within its assigned funnel.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS current_funnel_step_id UUID
  REFERENCES funnel_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_current_funnel_step_idx
  ON leads(current_funnel_step_id)
  WHERE current_funnel_step_id IS NOT NULL;