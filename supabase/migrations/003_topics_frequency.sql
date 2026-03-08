-- Add frequency column to topics table
ALTER TABLE topics ADD COLUMN IF NOT EXISTS frequency INTEGER NOT NULL DEFAULT 1;

-- RPC to increment topic frequency
CREATE OR REPLACE FUNCTION increment_topic_frequency(p_project_id UUID, p_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE topics SET frequency = frequency + 1
  WHERE project_id = p_project_id AND name = p_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
