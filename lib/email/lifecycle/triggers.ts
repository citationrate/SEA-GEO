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
 * D1 — signup between 1 and 2 days ago, zero azioni (no audit, no AVI run)
 * Wide window (24h) so the daily cron at 9am catches everyone regardless of signup hour.
 * Dedup in send.ts prevents double-sending.
 */
export async function findCandidatesD1(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang")
    .gt("created_at", new Date(Date.now() - 2 * 24 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 1 * 24 * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  const usersWithNoAudit = await filterUsersWithNoAudit(cr, users);
  return await enrichWithAuth(usersWithNoAudit);
}

/**
 * D2 — signup between 3 and 4 days ago, zero azioni
 */
export async function findCandidatesD2(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang")
    .gt("created_at", new Date(Date.now() - 4 * 24 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  const usersWithNoAudit = await filterUsersWithNoAudit(cr, users);
  return await enrichWithAuth(usersWithNoAudit);
}

/**
 * D3 — signup between 7 and 8 days ago, zero azioni
 */
export async function findCandidatesD3(): Promise<CandidateBase[]> {
  const cr = createCitationRateServiceClient();
  const { data: users } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, lang")
    .gt("created_at", new Date(Date.now() - 8 * 24 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
    .neq("is_admin", true);
  if (!users) return [];
  const usersWithNoAudit = await filterUsersWithNoAudit(cr, users);
  return await enrichWithAuth(usersWithNoAudit);
}

/**
 * D4 CS — audit completato negli ultimi 15 minuti
 */
export async function findCandidatesD4_CS(): Promise<CandidateForCS[]> {
  const cr = createCitationRateServiceClient();
  const { data: audits } = await (cr.from("audits") as any)
    .select("id, user_id, brand, scores, status, created_at")
    .eq("status", "completed")
    .gt("created_at", new Date(Date.now() - 15 * 60_000).toISOString());
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
 * D4 AVI — run completato negli ultimi 15 minuti
 */
export async function findCandidatesD4_AVI(): Promise<CandidateForAVI[]> {
  const seageo = createServiceClient();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("id, project_id, status, completed_at, created_by")
    .eq("status", "completed")
    .gt("completed_at", new Date(Date.now() - 15 * 60_000).toISOString());
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
      avi_score: h.avi_score != null ? Number(h.avi_score) : 0,
      presence_score: h.presence_score != null ? Number(h.presence_score) : 0,
      sentiment_score: h.sentiment_score != null ? Number(h.sentiment_score) : 0,
      avg_brand_rank: h.avg_brand_rank != null ? Number(h.avg_brand_rank) : null,
      run_created_at: r.completed_at,
    });
  }
  return out;
}

/**
 * D5 CS — audit completato between 3 and 4 days ago
 */
export async function findCandidatesD5_CS(): Promise<CandidateForCS[]> {
  const cr = createCitationRateServiceClient();
  const { data: audits } = await (cr.from("audits") as any)
    .select("id, user_id, brand, scores, status, created_at")
    .eq("status", "completed")
    .gt("created_at", new Date(Date.now() - 4 * 24 * 3600_000).toISOString())
    .lt("created_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString());
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
 * D5 AVI — run completato between 3 and 4 days ago, user ancora demo
 */
export async function findCandidatesD5_AVI(): Promise<CandidateForAVI[]> {
  const seageo = createServiceClient();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("id, project_id, status, completed_at, created_by")
    .eq("status", "completed")
    .gt("completed_at", new Date(Date.now() - 4 * 24 * 3600_000).toISOString())
    .lt("completed_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString());
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
      avi_score: h.avi_score != null ? Number(h.avi_score) : 0,
      presence_score: h.presence_score != null ? Number(h.presence_score) : 0,
      sentiment_score: h.sentiment_score != null ? Number(h.sentiment_score) : 0,
      avg_brand_rank: h.avg_brand_rank != null ? Number(h.avg_brand_rank) : null,
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
    .select("id, full_name, plan, lang, billing_period_start")
    .in("plan", ["base", "pro", "enterprise"])
    .gt("billing_period_start", new Date(Date.now() - 14 * 86400_000).toISOString())
    .lt("billing_period_start", new Date(Date.now() - 5 * 86400_000).toISOString())
    .neq("is_admin", true);
  if (!profiles || profiles.length === 0) return [];

  // Filter by real audit count = 0
  const filteredProfiles = await filterUsersWithNoAudit(cr, profiles);
  if (filteredProfiles.length === 0) return [];

  const userIds = filteredProfiles.map((p: any) => p.id);
  const auths = await fetchAuthUsers(userIds);

  const out: CandidateForUpgrade[] = [];
  for (const p of filteredProfiles) {
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

// ===== Azioni "Design Diabolico" gruppo D (codici NUOVI, ricorrenti) =====

/** Media semplice (0-100) dei valori numerici di un oggetto scores jsonb. */
function avgScores(scores: any): number {
  if (!scores || typeof scores !== "object") return 0;
  const vals = Object.values(scores).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : String(r);
}

/**
 * Rate-limit per le mail RICORRENTI: true se NON ne e' stata inviata una dello
 * stesso tipo all'utente negli ultimi `days` giorni. Sostituisce il dedup
 * permanente (che per questi tipi e' disattivato in send.ts).
 */
async function notSentSince(cr: any, userId: string, type: EmailType, days: number): Promise<boolean> {
  const { data } = await (cr.from("lifecycle_emails") as any)
    .select("sent_at")
    .eq("user_id", userId)
    .eq("email_type", type)
    .gte("sent_at", new Date(Date.now() - days * 86400_000).toISOString())
    .limit(1);
  return !(data && data.length > 0);
}

/**
 * RECAP_M (D1-libro) — recap mensile "Il tuo mese con CitationRate".
 * Utenti con almeno un'analisi completata negli ultimi 31 giorni, non gia'
 * recapati negli ultimi 27 (≈ una volta al mese, rolling sull'anniversario).
 */
export async function findCandidatesRECAP_M(): Promise<any[]> {
  const cr = createCitationRateServiceClient();
  const { data: audits } = await (cr.from("audits") as any)
    .select("user_id, brand, scores, status, created_at")
    .eq("status", "completed")
    .gt("created_at", new Date(Date.now() - 31 * 86400_000).toISOString())
    .order("created_at", { ascending: false });
  if (!audits || audits.length === 0) return [];

  const byUser = new Map<string, any[]>();
  for (const a of audits) {
    if (!a.scores || !Object.keys(a.scores).length) continue;
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push(a);
  }
  const userIds = Array.from(byUser.keys());
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const out: any[] = [];
  for (const [userId, list] of Array.from(byUser.entries())) {
    const p = profiles.get(userId);
    const u = auths.get(userId);
    if (!p || !u || p.is_admin) continue;
    if (!(await notSentSince(cr, userId, "RECAP_M", 27))) continue;
    const latest = list[0];
    const prev = list[1] || null;
    out.push({
      user_id: userId,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      brand: latest.brand || "",
      scores: latest.scores,
      audits_this_month: list.length,
      score_delta: prev ? signed(avgScores(latest.scores) - avgScores(prev.scores)) : "",
    });
  }
  return out;
}

/**
 * Confronto AVI tra le ultime 2 history per i progetti con un run completato
 * nelle ultime 48h. Base condivisa per INSIGHT_AVI (salita) e DECAY_AVI (calo).
 */
async function recentAviDeltas(): Promise<Array<{ project_id: string; curr: any; prev: any }>> {
  const seageo = createServiceClient();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("project_id, completed_at, status")
    .eq("status", "completed")
    .gt("completed_at", new Date(Date.now() - 2 * 86400_000).toISOString());
  if (!runs || runs.length === 0) return [];
  const projectIds = Array.from(new Set(runs.map((r: any) => r.project_id))) as string[];

  const { data: hist } = await (seageo.from("avi_history") as any)
    .select("project_id, run_id, avi_score, presence_score, sentiment_score, avg_brand_rank, computed_at")
    .in("project_id", projectIds)
    .order("computed_at", { ascending: false });
  const byProj = new Map<string, any[]>();
  for (const h of hist || []) {
    if (!byProj.has(h.project_id)) byProj.set(h.project_id, []);
    const arr = byProj.get(h.project_id)!;
    if (arr.length < 2) arr.push(h);
  }
  const res: Array<{ project_id: string; curr: any; prev: any }> = [];
  for (const [pid, arr] of Array.from(byProj.entries())) {
    if (arr.length < 2) continue;
    res.push({ project_id: pid, curr: arr[0], prev: arr[1] });
  }
  return res;
}

async function buildAviCandidates(
  kind: "decay" | "insight",
): Promise<any[]> {
  const deltas = await recentAviDeltas();
  if (deltas.length === 0) return [];
  const seageo = createServiceClient();
  const cr = createCitationRateServiceClient();
  const pids = deltas.map((d) => d.project_id);
  const { data: projects } = await (seageo.from("projects") as any)
    .select("id, user_id, target_brand, country")
    .in("id", pids);
  const projMap = new Map<string, any>();
  for (const p of projects || []) projMap.set(p.id, p);
  const userIds = Array.from(new Set((projects || []).map((p: any) => p.user_id))) as string[];
  const profiles = await fetchProfiles(userIds);
  const auths = await fetchAuthUsers(userIds);

  const type: EmailType = kind === "decay" ? "DECAY_AVI" : "INSIGHT_AVI";
  const out: any[] = [];
  for (const d of deltas) {
    const curr = Number(d.curr.avi_score);
    const prev = Number(d.prev.avi_score);
    const presGain = Number(d.curr.presence_score) - Number(d.prev.presence_score);
    const diff = curr - prev;
    if (kind === "decay" && !(-diff >= 8)) continue;       // calo >= 8 punti AVI
    if (kind === "insight" && !(diff >= 8 || presGain >= 8)) continue; // salita >= 8
    const proj = projMap.get(d.project_id);
    if (!proj) continue;
    const userId = proj.user_id;
    if (!userId) continue;
    const p = profiles.get(userId);
    const u = auths.get(userId);
    if (!p || !u || p.is_admin) continue;
    if (!(await notSentSince(cr, userId, type, 14))) continue;
    out.push({
      user_id: userId,
      email: u.email,
      full_name: p.full_name,
      lang_hint: p.lang || null,
      plan: p.plan,
      signup_at: u.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
      brand: proj.target_brand || "",
      project_id: d.project_id,
      run_id: d.curr.run_id,
      avi_score: Math.round(curr),
      prev_avi_score: Math.round(prev),
      presence_score: Math.round(Number(d.curr.presence_score)),
      sentiment_score: Math.round(Number(d.curr.sentiment_score)),
      avg_brand_rank: d.curr.avg_brand_rank != null ? Number(d.curr.avg_brand_rank) : null,
      drop_points: Math.round(-diff),
      gain_points: Math.round(Math.max(diff, presGain)),
    });
  }
  return out;
}

/** DECAY_AVI (D5-libro) — la visibilita' AI e' calata: "difendi la tua visibilita'". */
export async function findCandidatesDECAY_AVI(): Promise<any[]> {
  return buildAviCandidates("decay");
}

/** INSIGHT_AVI (D4-libro) — insight a sorpresa: la visibilita' AI e' salita. */
export async function findCandidatesINSIGHT_AVI(): Promise<any[]> {
  return buildAviCandidates("insight");
}

// ===== helpers =====

/**
 * Filter users who have zero audits in the audits table.
 * Uses real count instead of the unreliable audit_used counter.
 */
async function filterUsersWithNoAudit(cr: any, users: any[]): Promise<any[]> {
  if (users.length === 0) return [];
  const userIds = users.map((u: any) => u.id);
  const { data: audits } = await (cr.from("audits") as any)
    .select("user_id")
    .in("user_id", userIds);
  const usersWithAudit = new Set((audits || []).map((a: any) => a.user_id));
  return users.filter((u: any) => !usersWithAudit.has(u.id));
}

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
  W0: async () => [],   // triggered via webhook, not cron
  "1A": async () => [], // recovery one-shot manuale
  "1B": async () => [],
  "1C": async () => [],
  D1: findCandidatesD1,
  D2: findCandidatesD2,
  D3: findCandidatesD3,
  D4_CS: findCandidatesD4_CS,
  D4_AVI: findCandidatesD4_AVI,
  D4_BP: async () => [],  // triggered directly from Inngest, not cron
  D5_CS: findCandidatesD5_CS,
  D5_AVI: findCandidatesD5_AVI,
  D6: findCandidatesD6,
  F1_CS: async () => [],  // triggered on failure, not cron
  F1_AVI: async () => [],
  F1_BP: async () => [],
  D7_TIPS: async () => [],  // triggered by Suite ToolTracker immediately
  D7_CROSS: async () => [], // triggered by cron +3 days after first tool use
  RECAP_M: findCandidatesRECAP_M,
  INSIGHT_AVI: findCandidatesINSIGHT_AVI,
  DECAY_AVI: findCandidatesDECAY_AVI,
};
