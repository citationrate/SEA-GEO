-- 044_confini_account.sql
-- Applicata in produzione sul progetto seageo1 (ubvkzstxviqwgufppiko) il
-- 09/09/2026 tramite MCP Supabase, nelle migrazioni:
--   20260909161040 blinda_funzioni_security_definer_avi
--   20260909170702 confini_diagnostica_avi
-- Gemella di aivx-backend/migrations/029_confini_account.sql sul database
-- CitationRate.
--
-- CONTESTO: 10 funzioni SECURITY DEFINER (saltano la RLS) avevano EXECUTE
-- concesso a PUBLIC, anon e authenticated, e prendono l'id utente o l'id
-- progetto come PARAMETRO senza controllare chi chiama. Con la chiave pubblica
-- del browser si potevano accreditare query nel wallet (add_to_wallet),
-- consumare il wallet di un altro (consume_wallet) o toccare i contatori di un
-- progetto altrui. Tutti i chiamanti veri usano il service role:
-- lib/usage.ts via sg(), lib/haiku-rate-limit.ts riceve createDataClient()
-- (SEAGEO_SERVICE_ROLE_KEY), inngest e suite-stats lato server.
--
-- ⚠️ REGOLA: su Supabase EXECUTE arriva sia da PUBLIC sia dai grant espliciti ad
-- anon e authenticated. Revocare da una sola strada non chiude niente: sempre
-- tutte e tre, e ricontrollare dopo con has_function_privilege().

revoke execute on function public.add_to_wallet(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.add_to_wallet(uuid, integer, integer, integer) to service_role;

revoke execute on function public.consume_wallet(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_wallet(uuid, integer, integer) to service_role;

revoke execute on function public.increment_haiku_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_haiku_count(uuid) to service_role;

revoke execute on function public.increment_competitor_count(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_competitor_count(uuid, text) to service_role;

revoke execute on function public.increment_topic_frequency(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_topic_frequency(uuid, text) to service_role;

revoke execute on function public.upsert_sources_increment(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_sources_increment(jsonb) to service_role;

revoke execute on function public.compute_and_save_avi(uuid) from public, anon, authenticated;
grant execute on function public.compute_and_save_avi(uuid) to service_role;

revoke execute on function public.compute_competitor_avi(uuid) from public, anon, authenticated;
grant execute on function public.compute_competitor_avi(uuid) to service_role;

revoke execute on function public.alert_webhook_post() from public, anon, authenticated;
grant execute on function public.alert_webhook_post() to service_role;

revoke execute on function public.suite_stats_ext() from public, anon, authenticated;
grant execute on function public.suite_stats_ext() to service_role;

-- NB: handle_new_user resta aperta di proposito, e' una funzione trigger.

-- Diagnostica letta ogni notte dal cron /api/cron/guardia-confini della suite.
-- Guarda anche lo schema brand_profile.
create or replace function public.confini_diagnostica()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
with
eccezioni_funzioni(nome) as (values ('handle_new_user'), ('set_updated_at')),
policy_aperte as (
  select jsonb_build_object(
    'tipo', 'policy_aperta',
    'oggetto', p.schemaname || '.' || p.tablename,
    'dettaglio', p.policyname || ' (' || p.cmd || ', ruoli ' || p.roles::text || ')'
  ) as problema
  from pg_policies p
  where p.schemaname in ('public', 'brand_profile')
    and (coalesce(p.qual, '') in ('true', '(true)') or coalesce(p.with_check, '') in ('true', '(true)'))
    and (p.roles::text[] && array['public', 'anon', 'authenticated'])
),
funzioni_aperte as (
  select jsonb_build_object(
    'tipo', 'funzione_aperta',
    'oggetto', pr.proname,
    'dettaglio', case when has_function_privilege('anon', pr.oid, 'EXECUTE') then 'eseguibile da anonimo' else 'eseguibile da utente loggato' end
  ) as problema
  from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
  where n.nspname in ('public', 'brand_profile') and pr.prosecdef
    and (has_function_privilege('anon', pr.oid, 'EXECUTE') or has_function_privilege('authenticated', pr.oid, 'EXECUTE'))
    and pr.proname not in (select nome from eccezioni_funzioni)
),
tabelle_scoperte as (
  select jsonb_build_object('tipo', 'tabella_senza_rls', 'oggetto', n.nspname || '.' || c.relname, 'dettaglio', 'RLS disattivata') as problema
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'brand_profile') and c.relkind = 'r' and not c.relrowsecurity
)
select coalesce(jsonb_agg(problema), '[]'::jsonb)
from (
  select problema from policy_aperte
  union all select problema from funzioni_aperte
  union all select problema from tabelle_scoperte
) tutti;
$$;

revoke execute on function public.confini_diagnostica() from public, anon, authenticated;
grant execute on function public.confini_diagnostica() to service_role;
