-- Run on seageo1 (ubvkzstxviqwgufppiko) via SQL Editor
-- Adds url_analysis JSONB column to sources table for caching AI analysis results

ALTER TABLE sources
ADD COLUMN IF NOT EXISTS url_analysis jsonb;
