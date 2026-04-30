/**
 * Trigger detection: per ogni tipo di lifecycle email, query SQL su CR Supabase
 * che restituisce gli utenti candidati.
 *
 * Tutti i trigger eseguono dedup nativo via UNIQUE(user_id, email_type) sulla
 * insert in lifecycle_emails: una mail dello stesso tipo non parte 2 volte
 * per lo stesso utente.
 */

import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";
import type { EmailType } from "./templates";

export interface CandidateBase {
  user_id: string;
  email: string;
  full_name: string | null;
  lang_hint: string | null;
  plan: string;
  signup_at: string;
  days_since_signup: number;
}

export interface CandidateForCS extends CandidateBase {
  audit_id: string;
  brand: string;
  scores: any; // jsonb
  audit_created_at: string;
}

export interface CandidateForAVI extends CandidateBase {
  project_id: string;
  run_id: string;
  brand: string;
  country: string | null;
  avi_score: number;
  presence_score: number;
  sentiment_score: number;
  avg_brand_rank: number | null;
  run_created_at: string;
}

export interface CandidateForUpgrade extends CandidateBase {
  upgrade_at: string; // billing_period_start
  days_since_upgrade: number;
  audit_limit: number;
}

const PLAN_AUDIT_LIMITS: Record<string, number> = {
  demo: 1,
  base: 10,
  pro: 50,
  enterprise: 500,
};

/**
 * D1 — signup +24h±1h, zero azioni (no audit, no AVI run)
 */
export async function findCandidatesD1(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data, error } = await (cr.rpc as any)("__noop_dummy__", {}).catch(() => ({ data: null, error: null }));
  void data;
  void error;
  // raw SQL via REST: usiamo .from() chain
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang, audit_used")
    .gt("created_at", new Date(Date.now() - 26 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 23 * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  return await enrichWithAuth(users.filter((u: any) => (u.audit_used || 0) === 0));
}

/**
 * D2 — signup +72h±1h, zero azioni
 */
export async function findCandidatesD2(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang, audit_used")
    .gt("created_at", new Date(Date.now() - 73 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 71 * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  return await enrichWithAuth(users.filter((u: any) => (u.audit_used || 0) === 0));
}

/**
 * D3 — signup +7gg±2h, zero azioni
 */
export async function findCandidatesD3(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang, audit_used")
    .gt("created_at", new Date(Date.now() - (7 * 24 + 1) * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - (7 * 24 - 1) * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  return await enrichWithAuth(users.filter((u: any) => (u.audit_used || 0) === 0));
}

/**
 * D4 CS — audit completato 1h±30min fa
 */
export async function findCandidatesD4_CS(): Promise<CandidateForCS[]> {
  const cr = createCitationRateServiceClient();
  const { data: audits } = await (cr.from("audits") as any)
    .select("id, user_id, brand, scores, status, created_at")
    .eq("status", "completed")
    .gt("created_at", new Date(Date.now() - 90 * 60_000).toISOString())
    .lt("created_at", new Date(Date.now() - 30 * 60_000).toISOString());
  if (!audits || audits.length === 0) return [];

  const userIds = Array.from(new Set(audits.map((a: any) => a.user_id))) as string[];
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForCS[] = [];
  for (const a of audits) {
    const p = profiles.get(a.user_id);
    const u = auths.get(a.user_id);
    if (!p || !u || p.is_admin) continue;
    out.push({
      user_id: a.user_id,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      audit_id: a.id,
      brand: a.brand,
      scores: a.scores,
      audit_created_at: a.created_at,
    });
  }
  return out;
}

/**
 * D4 AVI — run completato 1h±30min fa
 */
export async function findCandidatesD4_AVI(): Promise<CandidateForAVI[]> {
  const seageo = createServiceClient();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("id, project_id, status, completed_at, created_by")
    .eq("status", "completed")
    .gt("completed_at", new Date(Date.now() - 90 * 60_000).toISOString())
    .lt("completed_at", new Date(Date.now() - 30 * 60_000).toISOString());
  if (!runs || runs.length === 0) return [];

  const projectIds = Array.from(new Set(runs.map((r: any) => r.project_id))) as string[];
  const { data: projects } = await (seageo.from("projects") as any)
    .select("id, user_id, target_brand, country")
    .in("id", projectIds);
  const projMap = new Map<string, any>();
  for (const p of projects || []) projMap.set(p.id, p);

  const { data: histories } = await (seageo.from("avi_history") as any)
    .select("project_id, run_id, avi_score, presence_score, sentiment_score, avg_brand_rank, computed_at")
    .in("run_id", runs.map((r: any) => r.id) as string[])
    .order("computed_at", { ascending: false });
  const histMap = new Map<string, any>();
  for (const h of histories || []) {
    if (!histMap.has(h.run_id)) histMap.set(h.run_id, h);
  }

  const userIds = Array.from(new Set((projects || []).map((p: any) => p.user_id))) as string[];
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForAVI[] = [];
  for (const r of runs) {
    const proj = projMap.get(r.project_id);
    if (!proj) continue;
    const userId = proj.user_id || r.created_by;
    if (!userId) continue;
    const p = profiles.get(userId);
    const u = auths.get(userId);
    if (!p || !u || p.is_admin) continue;
    const h = histMap.get(r.id);
    if (!h) continue;

    out.push({
      user_id: userId,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      project_id: r.project_id,
      run_id: r.id,
      brand: proj.target_brand || "",
      country: proj.country || null,
      avi_score: Number(h.avi_score) || 0,
      presence_score: Number(h.presence_score) || 0,
      sentiment_score: Number(h.sentiment_score) || 0,
      avg_brand_rank: h.avg_brand_rank ? Number(h.avg_brand_rank) : null,
      run_created_at: r.completed_at,
    });
  }
  return out;
}

/**
 * D5 CS — audit completato 3gg±2h fa
 */
export async function findCandidatesD5_CS(): Promise<CandidateForCS[]> {
  const cr = createCitationRateServiceClient();
  const { data: audits } = await (cr.from("audits") as any)
    .select("id, user_id, brand, scores, status, created_at")
    .eq("status", "completed")
    .gt("created_at", new Date(Date.now() - (72 + 2) * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - (72 - 2) * 3600_000).toISOString());
  if (!audits || audits.length === 0) return [];

  const userIds = Array.from(new Set(audits.map((a: any) => a.user_id))) as string[];
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForCS[] = [];
  for (const a of audits) {
    const p = profiles.get(a.user_id);
    const u = auths.get(a.user_id);
    if (!p || !u || p.is_admin) continue;
    if (p.plan !== "demo") continue; // solo per chi è ancora demo

    out.push({
      user_id: a.user_id,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      audit_id: a.id,
      brand: a.brand,
      scores: a.scores,
      audit_created_at: a.created_at,
    });
  }
  return out;
}

/**
 * D5 AVI — run completato 3gg±2h fa, user ancora demo
 */
export async function findCandidatesD5_AVI(): Promise<CandidateForAVI[]> {
  const seageo = createServiceClient();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("id, project_id, status, completed_at, created_by")
    .eq("status", "completed")
    .gt("completed_at", new Date(Date.now() - (72 + 2) * 3600_000).toISOString())
    .lt("completed_at", new Date(Date.now() - (72 - 2) * 3600_000).toISOString());
  if (!runs || runs.length === 0) return [];

  const projectIds = Array.from(new Set(runs.map((r: any) => r.project_id))) as string[];
  const { data: projects } = await (seageo.from("projects") as any)
    .select("id, user_id, target_brand, country")
    .in("id", projectIds);
  const projMap = new Map<string, any>();
  for (const p of projects || []) projMap.set(p.id, p);

  const { data: histories } = await (seageo.from("avi_history") as any)
    .select("run_id, avi_score, presence_score, sentiment_score, avg_brand_rank")
    .in("run_id", runs.map((r: any) => r.id) as string[]);
  const histMap = new Map<string, any>();
  for (const h of histories || []) histMap.set(h.run_id, h);

  const userIds = Array.from(new Set((projects || []).map((p: any) => p.user_id))) as string[];
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForAVI[] = [];
  for (const r of runs) {
    const proj = projMap.get(r.project_id);
    if (!proj) continue;
    const userId = proj.user_id || r.created_by;
    if (!userId) continue;
    const p = profiles.get(userId);
    const u = auths.get(userId);
    if (!p || !u || p.is_admin) continue;
    if (p.plan !== "demo") continue;
    const h = histMap.get(r.id);
    if (!h) continue;

    out.push({
      user_id: userId,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      project_id: r.project_id,
      run_id: r.id,
      brand: proj.target_brand || "",
      country: proj.country || null,
      avi_score: Number(h.avi_score) || 0,
      presence_score: Number(h.presence_score) || 0,
      sentiment_score: Number(h.sentiment_score) || 0,
      avg_brand_rank: h.avg_brand_rank ? Number(h.avg_brand_rank) : null,
      run_created_at: r.completed_at,
    });
  }
  return out;
}

/**
 * D6 — Pro/Base inattivo: upgrade tra 5 e 14 giorni fa, audit_used=0
 */
export async function findCandidatesD6(): Promise<CandidateForUpgrade[]> {
  const cr = createCitationRateServiceClient();
  const { data: profiles } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang, audit_used, billing_period_start")
    .in("plan", ["base", "pro", "enterprise"])
    .eq("audit_used", 0)
    .gt("billing_period_start", new Date(Date.now() - 14 * 86400_000).toISOString())
    .lt("billing_period_start", new Date(Date.now() - 5 * 86400_000).toISOString())
    .neq("is_admin", true);
  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p: any) => p.id);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForUpgrade[] = [];
  for (const p of profiles) {
    const u = auths.get(p.id);
    if (!u) continue;
    const upgradeAt = p.billing_period_start;
    const daysSinceUpgrade = Math.floor((Date.now() - new Date(upgradeAt).getTime()) / 86400_000);
    out.push({
      user_id: p.id,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      upgrade_at: upgradeAt,
      days_since_upgrade: daysSinceUpgrade,
      audit_limit: PLAN_AUDIT_LIMITS[p.plan] || 10,
    });
  }
  return out;
}

// ===== helpers =====

async function fetchProfiles(userIds: string[]): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const cr = createCitationRateServiceClient();
  const { data } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang, is_admin, audit_used")
    .in("id", userIds);
  const m = new Map<string, any>();
  for (const p of data || []) m.set(p.id, p);
  return m;
}

async function fetchAuthUsers(userIds: string[]): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const cr = createCitationRateServiceClient();
  const m = new Map<string, any>();
  // listUsers paginato fino a trovarli tutti — semplice approccio O(N) batch
  const { data } = await (cr.auth.admin as any).listUsers({ perPage: 1000 });
  for (const u of data?.users || []) {
    if (userIds.includes(u.id)) m.set(u.id, u);
  }
  return m;
}

async function enrichWithAuth(profiles: any[]): Promise<CandidateBase[]> {
  if (profiles.length === 0) return [];
  const ids = profiles.map((p: any) => p.id);
  const auths = await fetchAuthUsers(ids);
  const out: CandidateBase[] = [];
  for (const p of profiles) {
    const u = auths.get(p.id);
    if (!u) continue;
    out.push({
      user_id: p.id,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
    });
  }
  return out;
}

export const TRIGGERS: Record<EmailType, () => Promise<any[]>> = {
  "1A": async () => [], // recovery one-shot manuale
  "1B": async () => [],
  "1C": async () => [],
  D1: findCandidatesD1,
  D2: findCandidatesD2,
  D3: findCandidatesD3,
  D4_CS: findCandidatesD4_CS,
  D4_AVI: findCandidatesD4_AVI,
  D5_CS: findCandidatesD5_CS,
  D5_AVI: findCandidatesD5_AVI,
  D6: findCandidatesD6,
};
