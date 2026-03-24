-- Remove foreign key constraint on profiles.id → auth.users(id)
-- Auth is now handled by a separate Supabase project (CitationRate),
-- so profiles.id references users that only exist in CitationRate's auth.users,
-- not in seageo1's auth.users. The FK prevents profile creation for these users.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
