-- Query wallet: stores purchased extra queries that never expire
CREATE TABLE IF NOT EXISTS query_wallet (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  browsing_queries integer DEFAULT 0,
  no_browsing_queries integer DEFAULT 0,
  confronti integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS query_wallet_user_id_idx ON query_wallet(user_id);
