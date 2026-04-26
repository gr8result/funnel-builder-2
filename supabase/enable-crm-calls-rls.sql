-- Enable RLS on crm_calls table
ALTER TABLE public.crm_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own calls
DROP POLICY IF EXISTS "Users can read their own calls" ON public.crm_calls;
CREATE POLICY "Users can read their own calls" 
  ON public.crm_calls 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own calls
DROP POLICY IF EXISTS "Users can insert their own calls" ON public.crm_calls;
CREATE POLICY "Users can insert their own calls" 
  ON public.crm_calls 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own calls
DROP POLICY IF EXISTS "Users can update their own calls" ON public.crm_calls;
CREATE POLICY "Users can update their own calls" 
  ON public.crm_calls 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
