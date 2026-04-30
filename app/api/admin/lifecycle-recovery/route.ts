/**
 * Recovery batch endpoint per gli iscritti pre-cron-go-live.
 *
 * Pesca utenti reali dal DB e manda 1A/1B/1C alle persone giuste:
 *   - 1A: signup pre-go-live, ZERO azioni (no audit, no run)
 *   - 1B: demo CS attivato (≥1 audit completato)
 *   - 1C: AVI run completato con score basso (<70)
 *
 * Idempotente: dedup via UNIQUE(user_id, email_type) su lifecycle_emails.
 * Una volta che un utente ha ricevuto 1A/1B/1C, non lo riceverà di nuovo.
 *
 * Auth: header `Authorization: Bearer {CRON_SECRET}` o `?secret=`.
 *
 * Modi:
 *   GET ?secret=XXX&dryrun=1 → mostra solo candidati, non spedisce
 *   GET ?secret=XXX → invia per davvero (rispetta LIFECYCLE_RECIPIENT_OVERRIDE se settato)
 *   GET ?secret=XXX&type=1A → solo un type
 */

import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { detectLang, type SupportedLang } from "@/lib/email/lifecycle/lang-detect";
import { tpl1A, tpl1B, tpl1C, type EmailType } from "@/lib/email/lifecycle/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const headerToken = (request.headers.get("authorization") || "").trim();
  if (headerToken === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  const querySecret = (url.searchParams.get("secret") || "").trim();
  return querySecret === secret;
}

const INTERNAL_EMAIL_PATTERNS = [
  "test",
  "@example.",
  "tutorial",
  "@citationrate.com",
  "@duelombardialristorante",
  "monzabrianzadascoprire",
  "metafunnel",
  "pixel",
];

function isInternal(email: string): boolean {
  const e = email.toLowerCase();
  if (e.startsWith("gianmaria")) return true;
  if (e.endsWith("@studenti.iulm.it") || e.endsWith("@studnti.iulm.it")) return true;
  if (e === "citation333rate@gmail.com") return true;
  if (e === "samuele.barchet@gmail.com") return true;
  if (e === "tecla.casalone@gmail.com") return true;
  if (e === "email.prova.15y@gmail.com") return true;
  return INTERNAL_EMAIL_PATTERNS.some((p) => e.includes(p));
}

interface Candidate1A {
  user_id: string;
  email: string;
  full_name: string | null;
  days_since_signup: number;
}
interface Candidate1B {
  user_id: string;
  email: string;
  full_name: string | null;
  audit_id: string;
  brand: string;
  scores_per_engine: Record<string, number>;
  global: number;
  sector?: string;
}
interface Candidate1C {
  user_id: string;
  email: string;
  full_name: string | null;
  brand: string;
  country: string | null;
  avi_score: number;
  presence: number;
  sentiment: number;
  avg_rank: number | null;
}

async function find1A(): Promise<Candidate1A[]> {
  const cr = createCitationRateServiceClient();
  // CS audits actors → escludi
  const { data: cs } = await (cr.from("audits") as any).select("user_id");
  const audit_user_ids = new Set((cs || []).map((r: any) => r.user_id));

  // AVI projects user_ids → escludi (cross-DB)
  const seageo = createServiceClient();
  const { data: avi } = await (seageo.from("projects") as any).select("user_id").eq("deleted_at", null as any);
  const avi_user_ids = new Set((avi || []).map((r: any) => r.user_id));

  const cutoffOld = new Date(Date.now() - 60 * 86400_000).toISOString();
  const cutoffRecent = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: profiles } = await (cr.from("profiles") as any)
    .select("id, full_name, plan")
    .eq("is_admin", false as any)
    .eq("plan", "demo");

  if (!profiles) return [];

  const ids = profiles.map((p: any) => p.id);
  const { data: authData } = await (cr.auth.admin as any).listUsers({ perPage: 1000 });
  const authMap = new Map<string, any>();
  for (const u of authData?.users || []) {
    if (ids.includes(u.id)) authMap.set(u.id, u);
  }

  const out: Candidate1A[] = [];
  for (const p of profiles) {
    const u = authMap.get(p.id);
    if (!u) continue;
    if (audit_user_ids.has(p.id)) continue;
    if (avi_user_ids.has(p.id)) continue;
    if (isInternal(u.email)) continue;
    if (u.created_at < cutoffOld || u.created_at > cutoffRecent) continue;

    out.push({
      user_id: p.id,
      email: u.email,
      full_name: p.full_name,
      days_since_signup: Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400_000),
    });
  }
  return out;
}

async function find1B(): Promise<Candidate1B[]> {
  const cr = createCitationRateServiceClient();
  const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: audits } = await (cr.from("audits") as any)
    .select("id, user_id, brand, scores, sector_label, sector, status, created_at")
    .eq("status", "completed")
    .lt("created_at", cutoff);

  if (!audits) return [];

  const userIds = Array.from(new Set(audits.map((a: any) => a.user_id))) as string[];
  const { data: profiles } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, is_admin")
    .in("id", userIds);
  const profileMap = new Map<string, any>();
  for (const p of profiles || []) profileMap.set(p.id, p);

  const { data: authData } = await (cr.auth.admin as any).listUsers({ perPage: 1000 });
  const authMap = new Map<string, any>();
  for (const u of authData?.users || []) {
    if (userIds.includes(u.id)) authMap.set(u.id, u);
  }

  // Solo il primo audit per user
  const seenUsers = new Set<string>();
  const out: Candidate1B[] = [];
  for (const a of audits) {
    const p = profileMap.get(a.user_id);
    const u = authMap.get(a.user_id);
    if (!p || !u) continue;
    if (p.is_admin) continue;
    if (p.plan !== "demo") continue;
    if (isInternal(u.email)) continue;
    if (seenUsers.has(a.user_id)) continue;
    seenUsers.add(a.user_id);

    const engines = (a.scores || {}) as Record<string, any>;
    const knownEngines = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "AIMode", "Grok"];
    const perEngine: Record<string, number> = {};
    let sum = 0;
    let cnt = 0;
    for (const k of knownEngines) {
      const v = engines[k];
      if (typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)))) {
        const n = Number(v);
        perEngine[k] = n;
        sum += n;
        cnt += 1;
      }
    }
    const global = cnt > 0 ? Math.round(sum / cnt) : 0;

    out.push({
      user_id: a.user_id,
      email: u.email,
      full_name: p.full_name,
      audit_id: a.id,
      brand: a.brand || "",
      scores_per_engine: perEngine,
      global,
      sector: a.sector_label || a.sector,
    });
  }
  return out;
}

async function find1C(): Promise<Candidate1C[]> {
  const seageo = createServiceClient();
  const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: runs } = await (seageo.from("analysis_runs") as any)
    .select("id, project_id, status, completed_at")
    .eq("status", "completed")
    .lt("completed_at", cutoff);

  if (!runs) return [];

  const projectIds = Array.from(new Set(runs.map((r: any) => r.project_id))) as string[];
  const { data: projects } = await (seageo.from("projects") as any)
    .select("id, user_id, target_brand, country")
    .in("id", projectIds);
  const projMap = new Map<string, any>();
  for (const p of projects || []) projMap.set(p.id, p);

  const { data: histories } = await (seageo.from("avi_history") as any)
    .select("run_id, project_id, avi_score, presence_score, sentiment_score, avg_brand_rank, computed_at")
    .order("computed_at", { ascending: false });
  const latestPerProject = new Map<string, any>();
  for (const h of histories || []) {
    if (!latestPerProject.has(h.project_id)) latestPerProject.set(h.project_id, h);
  }

  const userIds = Array.from(new Set((projects || []).map((p: any) => p.user_id))) as string[];
  const cr = createCitationRateServiceClient();
  const { data: profiles } = await (cr.from("profiles") as any)
    .select("id, full_name, plan, is_admin")
    .in("id", userIds);
  const profileMap = new Map<string, any>();
  for (const p of profiles || []) profileMap.set(p.id, p);

  const { data: authData } = await (cr.auth.admin as any).listUsers({ perPage: 1000 });
  const authMap = new Map<string, any>();
  for (const u of authData?.users || []) {
    if (userIds.includes(u.id)) authMap.set(u.id, u);
  }

  // 1 candidato per user (il progetto con il run più recente che ha score basso)
  const seenUsers = new Set<string>();
  const out: Candidate1C[] = [];
  // Sort projects by latest run time desc using the histories we have
  const sortedProjects = Array.from(projMap.values()).sort((a: any, b: any) => {
    const ha = latestPerProject.get(a.id)?.computed_at || "";
    const hb = latestPerProject.get(b.id)?.computed_at || "";
    return hb.localeCompare(ha);
  });

  for (const proj of sortedProjects) {
    const h = latestPerProject.get(proj.id);
    if (!h) continue;
    const aviScore = Number(h.avi_score) || 0;
    if (aviScore >= 70) continue;
    const u = authMap.get(proj.user_id);
    const p = profileMap.get(proj.user_id);
    if (!u || !p) continue;
    if (p.is_admin) continue;
    if (isInternal(u.email)) continue;
    if (seenUsers.has(proj.user_id)) continue;
    seenUsers.add(proj.user_id);

    out.push({
      user_id: proj.user_id,
      email: u.email,
      full_name: p.full_name,
      brand: proj.target_brand || "",
      country: proj.country || null,
      avi_score: aviScore,
      presence: Number(h.presence_score) || 0,
      sentiment: Number(h.sentiment_score) || 0,
      avg_rank: h.avg_brand_rank ? Number(h.avg_brand_rank) : null,
    });
  }
  return out;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryrun = url.searchParams.get("dryrun") === "1";
  const onlyType = url.searchParams.get("type") as EmailType | null;

  const [c1a, c1b, c1c] = await Promise.all([
    onlyType && onlyType !== "1A" ? Promise.resolve([] as Candidate1A[]) : find1A(),
    onlyType && onlyType !== "1B" ? Promise.resolve([] as Candidate1B[]) : find1B(),
    onlyType && onlyType !== "1C" ? Promise.resolve([] as Candidate1C[]) : find1C(),
  ]);

  // Dedup: chi è in 1B o 1C non riceve 1A; chi è in 1C non riceve 1B
  const inHigher = new Set<string>();
  for (const c of c1c) inHigher.add(c.user_id);
  const c1bFiltered = c1b.filter((c) => !inHigher.has(c.user_id));
  for (const c of c1bFiltered) inHigher.add(c.user_id);
  const c1aFiltered = c1a.filter((c) => !inHigher.has(c.user_id));

  if (dryrun) {
    return NextResponse.json({
      ok: true,
      dryrun: true,
      summary: {
        "1A": c1aFiltered.length,
        "1B": c1bFiltered.length,
        "1C": c1c.length,
        total: c1aFiltered.length + c1bFiltered.length + c1c.length,
      },
      "1A": c1aFiltered.map((c) => ({ email: c.email, name: c.full_name, days: c.days_since_signup })),
      "1B": c1bFiltered.map((c) => ({ email: c.email, brand: c.brand, score: c.global })),
      "1C": c1c.map((c) => ({ email: c.email, brand: c.brand, avi: c.avi_score, presence: c.presence })),
    });
  }

  // SEND
  const results: any[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of c1aFiltered) {
    const lang = detectLang({ email: c.email });
    const { subject, html } = tpl1A({ name: c.full_name || "", lang, daysSinceSignup: c.days_since_signup });
    const r = await sendLifecycleEmail({
      userId: c.user_id,
      emailType: "1A",
      recipientEmail: c.email,
      lang,
      subject,
      html,
      payload: { days_since_signup: c.days_since_signup },
    });
    if (r.skipped === "already_sent") skipped++;
    else if (r.ok) sent++;
    else failed++;
    results.push({ type: "1A", email: c.email, ok: r.ok, skipped: r.skipped, error: r.error });
    await sleep(250);
  }

  for (const c of c1bFiltered) {
    const lang = detectLang({ email: c.email });
    const { subject, html } = tpl1B({
      name: c.full_name || "",
      lang,
      brand: c.brand,
      scores: { global: c.global, perEngine: c.scores_per_engine as any },
      sector: c.sector,
    });
    const r = await sendLifecycleEmail({
      userId: c.user_id,
      emailType: "1B",
      recipientEmail: c.email,
      lang,
      subject,
      html,
      payload: { brand: c.brand, audit_id: c.audit_id, global_score: c.global },
    });
    if (r.skipped === "already_sent") skipped++;
    else if (r.ok) sent++;
    else failed++;
    results.push({ type: "1B", email: c.email, ok: r.ok, skipped: r.skipped, error: r.error });
    await sleep(250);
  }

  for (const c of c1c) {
    const lang: SupportedLang = detectLang({ email: c.email, aviProjectCountry: c.country });
    const { subject, html } = tpl1C({
      name: c.full_name || "",
      lang,
      brand: c.brand,
      country: c.country,
      result: { aviScore: c.avi_score, presence: c.presence, sentiment: c.sentiment, avgRank: c.avg_rank },
    });
    const r = await sendLifecycleEmail({
      userId: c.user_id,
      emailType: "1C",
      recipientEmail: c.email,
      lang,
      subject,
      html,
      payload: { brand: c.brand, avi_score: c.avi_score },
    });
    if (r.skipped === "already_sent") skipped++;
    else if (r.ok) sent++;
    else failed++;
    results.push({ type: "1C", email: c.email, ok: r.ok, skipped: r.skipped, error: r.error });
    await sleep(250);
  }

  return NextResponse.json({
    ok: true,
    dryrun: false,
    summary: { total: results.length, sent, skipped, failed },
    results,
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const POST = GET;
