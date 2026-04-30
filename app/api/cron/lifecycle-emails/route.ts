/**
 * Cron worker per lifecycle emails.
 *
 * Trigger via Vercel Cron (vedi vercel.json) ogni ora.
 * Auth: header `Authorization: Bearer {CRON_SECRET}` oppure `?secret={CRON_SECRET}`.
 *
 * Modalità di safety:
 *   - Default: il cron NON è registrato in vercel.json (off)
 *   - LIFECYCLE_DRY_RUN=true → non spedisce davvero, logga
 *   - LIFECYCLE_RECIPIENT_OVERRIDE=foo@bar.com → tutto va a quell'indirizzo
 *
 * Query string opzionali:
 *   - ?type=D1 → filtra a un solo trigger
 *   - ?dryrun=1 → forza dry run anche se env var non settata
 *   - ?limit=N → max N invii per esecuzione (safety guard)
 */

import { NextResponse } from "next/server";
import { TRIGGERS } from "@/lib/email/lifecycle/triggers";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { detectLang } from "@/lib/email/lifecycle/lang-detect";
import {
  tplD1,
  tplD2,
  tplD3,
  tplD4_CS,
  tplD4_AVI,
  tplD5_CS,
  tplD5_AVI,
  tplD6,
  type EmailType,
} from "@/lib/email/lifecycle/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    console.error("[lifecycle-cron] CRON_SECRET not set — refusing");
    return false;
  }
  const authHeader = (request.headers.get("authorization") || "").trim();
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  const querySecret = (url.searchParams.get("secret") || "").trim();
  if (querySecret === secret) return true;
  return false;
}

interface RunSummary {
  type: EmailType;
  candidates: number;
  sent: number;
  skipped: number;
  errors: number;
  details: Array<{ user: string; result: string }>;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const onlyType = url.searchParams.get("type") as EmailType | null;
  const forceDry = url.searchParams.get("dryrun") === "1";
  const maxPerType = parseInt(url.searchParams.get("limit") || "50", 10);

  if (forceDry) process.env.LIFECYCLE_DRY_RUN = "true";

  const types: EmailType[] = onlyType
    ? [onlyType]
    : ["D1", "D2", "D3", "D4_CS", "D4_AVI", "D5_CS", "D5_AVI", "D6"];

  const report: RunSummary[] = [];

  for (const type of types) {
    const summary: RunSummary = { type, candidates: 0, sent: 0, skipped: 0, errors: 0, details: [] };
    try {
      const trigger = TRIGGERS[type];
      if (!trigger) continue;
      const candidates = await trigger();
      summary.candidates = candidates.length;

      const sliced = candidates.slice(0, maxPerType);
      for (const c of sliced) {
        try {
          const lang = detectLang({
            email: c.email,
            profileLang: c.lang_hint,
          });
          const { subject, html } = renderTemplate(type, c, lang);
          const r = await sendLifecycleEmail({
            userId: c.user_id,
            emailType: type,
            recipientEmail: c.email,
            lang,
            subject,
            html,
            payload: extractPayload(type, c),
          });
          if (r.skipped === "already_sent") {
            summary.skipped += 1;
            summary.details.push({ user: c.email, result: "already_sent" });
          } else if (r.skipped === "dry_run") {
            summary.sent += 1;
            summary.details.push({ user: c.email, result: `dry_run → ${r.finalRecipient}` });
          } else if (r.ok) {
            summary.sent += 1;
            summary.details.push({ user: c.email, result: `sent → ${r.finalRecipient}` });
          } else {
            summary.errors += 1;
            summary.details.push({ user: c.email, result: `error: ${r.error}` });
          }
        } catch (e: any) {
          summary.errors += 1;
          summary.details.push({ user: c.email, result: `exception: ${e?.message}` });
        }
      }
    } catch (e: any) {
      summary.details.push({ user: "(query)", result: `query exception: ${e?.message}` });
    }
    report.push(summary);
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    dryRun: process.env.LIFECYCLE_DRY_RUN === "true",
    recipientOverride: process.env.LIFECYCLE_RECIPIENT_OVERRIDE || null,
    report,
  });
}

// Permetti anche POST (alcuni schedulatori usano POST)
export const POST = GET;

function renderTemplate(type: EmailType, c: any, lang: "it" | "en"): { subject: string; html: string } {
  const name = c.full_name || "";
  switch (type) {
    case "D1":
      return tplD1({ name, lang });
    case "D2":
      return tplD2({ name, lang });
    case "D3":
      return tplD3({ name, lang });
    case "D4_CS": {
      const scores = parseScores(c.scores);
      return tplD4_CS({ name, lang, brand: c.brand, auditId: c.audit_id, scores });
    }
    case "D4_AVI": {
      return tplD4_AVI({
        name,
        lang,
        brand: c.brand,
        projectId: c.project_id,
        runId: c.run_id,
        result: {
          aviScore: c.avi_score,
          presence: c.presence_score,
          sentiment: c.sentiment_score,
          avgRank: c.avg_brand_rank,
        },
      });
    }
    case "D5_CS": {
      const scores = parseScores(c.scores);
      return tplD5_CS({ name, lang, brand: c.brand, globalScore: scores.global });
    }
    case "D5_AVI": {
      return tplD5_AVI({ name, lang, brand: c.brand, aviScore: c.avi_score });
    }
    case "D6": {
      return tplD6({
        name,
        lang,
        plan: c.plan,
        daysSinceUpgrade: c.days_since_upgrade,
        auditLimit: c.audit_limit,
      });
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

function parseScores(scores: any): { global: number; perEngine?: any } {
  const global = Number(scores?.global ?? scores?.score ?? 0);
  const perEngine: any = {};
  const engines = scores?.per_engine || scores?.engines || {};
  for (const k of ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "AIMode", "Grok"]) {
    const v = engines[k] ?? engines[k.toLowerCase()] ?? engines[k.toLowerCase().replace(/[^a-z]/g, "")];
    if (v !== undefined && v !== null) perEngine[k] = Number(v);
  }
  return { global, perEngine };
}

function extractPayload(type: EmailType, c: any): Record<string, any> {
  const base = { plan: c.plan, days_since_signup: c.days_since_signup };
  if (type.startsWith("D4_CS") || type.startsWith("D5_CS"))
    return { ...base, brand: c.brand, audit_id: c.audit_id };
  if (type.startsWith("D4_AVI") || type.startsWith("D5_AVI"))
    return { ...base, brand: c.brand, project_id: c.project_id, run_id: c.run_id, avi_score: c.avi_score };
  if (type === "D6") return { ...base, days_since_upgrade: c.days_since_upgrade };
  return base;
}
