-- 039: Add 'enterprise' to the user_plan enum on seageo1.
-- Applied in prod 2026-04-23 via MCP.
-- Run in the Supabase SQL editor of project ubvkzstxviqwgufppiko (seageo1).
-- Previously the enum only had (free, pro, agency, demo, base) — enterprise
-- users from CitationRate were being demoted to "pro" as a workaround. With
-- this value the sync-plan webhook can finally mirror the CR plan verbatim.

ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'enterprise';
