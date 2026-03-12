-- Ensure funnel column exists on queries table (may already exist from 012)
ALTER TABLE queries ADD COLUMN IF NOT EXISTS funnel TEXT DEFAULT NULL;

-- Also add new fields to query_generation_inputs for the updated generator
ALTER TABLE query_generation_inputs ADD COLUMN IF NOT EXISTS luogo TEXT;
ALTER TABLE query_generation_inputs ADD COLUMN IF NOT EXISTS punti_di_forza TEXT[] DEFAULT '{}';
ALTER TABLE query_generation_inputs ADD COLUMN IF NOT EXISTS competitor TEXT[] DEFAULT '{}';
ALTER TABLE query_generation_inputs ADD COLUMN IF NOT EXISTS ai_answers TEXT[] DEFAULT '{}';

-- Update obiezioni from TEXT to TEXT[] if it's not already an array
-- (012 created it as TEXT, but the new generator sends an array)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_generation_inputs'
      AND column_name = 'obiezioni'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE query_generation_inputs ALTER COLUMN obiezioni TYPE TEXT[] USING CASE WHEN obiezioni IS NULL THEN '{}' ELSE ARRAY[obiezioni] END;
  END IF;
END $$;
