-- Soft delete: add deleted_at column to projects
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for fast filtering of active projects
CREATE INDEX idx_projects_deleted_at ON projects (deleted_at) WHERE deleted_at IS NULL;
