-- Batch increment competitor mention_count for multiple names at once
CREATE OR REPLACE FUNCTION batch_increment_competitor_count(p_project_id UUID, p_names TEXT[])
RETURNS void AS $$
BEGIN
  UPDATE competitors SET mention_count = mention_count + 1
  WHERE project_id = p_project_id AND name = ANY(p_names);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch increment topic frequency for multiple names at once
CREATE OR REPLACE FUNCTION batch_increment_topic_frequency(p_project_id UUID, p_names TEXT[])
RETURNS void AS $$
BEGIN
  UPDATE topics SET frequency = frequency + 1
  WHERE project_id = p_project_id AND name = ANY(p_names);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
