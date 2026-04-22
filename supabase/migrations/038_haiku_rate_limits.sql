-- Daily rate limit on Claude Haiku calls per user (reset at UTC midnight).
-- Applied to narrative generation, site analysis, quick-start, and other
-- on-demand Haiku calls to prevent abuse from demo users.
CREATE TABLE IF NOT EXISTS public.haiku_rate_limits (
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.haiku_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic increment: bumps counter under the lock, returns the new count.
-- Returns the new count; caller compares against limit and rejects if exceeded.
CREATE OR REPLACE FUNCTION public.increment_haiku_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.haiku_rate_limits (user_id, date, count)
  VALUES (p_user_id, (NOW() AT TIME ZONE 'UTC')::DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = public.haiku_rate_limits.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_haiku_count(UUID) TO service_role;
