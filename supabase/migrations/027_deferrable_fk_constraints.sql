-- Make profile FK constraints deferrable so user IDs can be updated within a transaction
-- (needed when auth.users ID changes for the same email)

-- projects.user_id → profiles.id
ALTER TABLE projects
DROP CONSTRAINT projects_user_id_fkey,
ADD CONSTRAINT projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id)
  DEFERRABLE INITIALLY DEFERRED;

-- analysis_runs.created_by → profiles.id
ALTER TABLE analysis_runs
DROP CONSTRAINT analysis_runs_created_by_fkey,
ADD CONSTRAINT analysis_runs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id)
  DEFERRABLE INITIALLY DEFERRED;

-- usage_monthly.user_id → profiles.id
ALTER TABLE usage_monthly
DROP CONSTRAINT usage_monthly_user_id_fkey,
ADD CONSTRAINT usage_monthly_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id)
  DEFERRABLE INITIALLY DEFERRED;
