-- Add models_config to projects (fixed AI models per project)
ALTER TABLE projects ADD COLUMN models_config JSONB DEFAULT '["gpt-4o-mini"]';
