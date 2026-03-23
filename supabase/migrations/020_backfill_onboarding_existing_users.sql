-- Backfill: mark all existing users as onboarding-completed
-- so they never see the tour (it's only for new registrations).
UPDATE profiles
SET onboarding_completed = true
WHERE onboarding_completed IS NOT TRUE
  AND created_at < NOW() - INTERVAL '1 hour';
