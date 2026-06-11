/**
 * Cron worker per lifecycle emails.
 *
 * Trigger via Vercel Cron (vedi vercel.json). D4_CS/D4_AVI ogni 5 min, resto giornaliero alle 9.
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
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { emailLayout, emailButton, paragraph, escapeHtml, statTable, scoreZone } from "@/lib/email/lifecycle/styles";
import type { EmailType } from "@/lib/email/lifecycle/templates";

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
    : ["D1", "D2", "D3", "D5_CS", "D5_AVI", "D6"];

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
          const { subject, html } = await renderTemplate(type, c, lang);
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

// Cache templates from DB for the duration of this cron run
let _tplCache: Map<string, any> | null = null;
async function fetchTemplates(): Promise<Map<string, any>> {
  if (_tplCache) return _tplCache;
  const cr = createCitationRateServiceClient();
  const { data } = await (cr.from("email_templates") as any)
    .select("id, subject_it, subject_en, preview_it, preview_en, body_it, body_en, active");
  const m = new Map<string, any>();
  for (const t of data || []) m.set(t.id, t);
  _tplCache = m;
  return m;
}

const BILINGUAL_DIVIDER = `
  <div style="margin:32px 0;padding:24px 0;border-top:2px solid #e5e7eb;border-bottom:2px solid #e5e7eb;text-align:center;">
    <span style="font-size:13px;color:#8a8f96;letter-spacing:1px;text-transform:uppercase;">🇬🇧 English version below</span>
  </div>
`;

/** Transform plain <a> tags (from CRM editor) into styled email buttons */
function fixCtaButtons(html: string): string {
  return html.replace(
    /<a\s([^>]*?)href="([^"]*)"([^>]*?)>([\s\S]*?)<\/a>/gi,
    (match, before, url, after, text) => {
      const fullAttrs = before + after;
      if (fullAttrs.includes("background") && fullAttrs.includes("display:block")) return match;
      const plainText = text.replace(/<[^>]*>/g, "").trim();
      if (plainText.length > 2) {
        return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 28px;"><tr><td align="center"><a href="${url}" style="display:block;background:#7eb89a;color:#0d1a14;font-family:Arial,'Helvetica Neue',sans-serif;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:18px 32px;text-align:center;">${plainText}</a></td></tr></table>`;
      }
      return match;
    }
  );
}

/** Replace {nome}, {brand}, {days}, etc. in template body */
function interpolate(body: string, vars: Record<string, string | number | null | undefined>): string {
  let result = body;
  for (const [key, val] of Object.entries(vars)) {
    if (val !== null && val !== undefined) {
      result = result.replaceAll(`{${key}}`, escapeHtml(String(val)));
    }
  }
  return result;
}

/** Build template variables from candidate data */
function candidateVars(type: EmailType, c: any): Record<string, string | number | null> {
  const scores = c.scores || {};
  const aviScore = c.avi_score ? Math.round(Number(c.avi_score)) : null;
  const presence = c.presence_score ? Math.round(Number(c.presence_score)) : null;
  const sentiment = c.sentiment_score ? Math.round(Number(c.sentiment_score)) : null;
  const avgRank = c.avg_brand_rank ? Number(c.avg_brand_rank).toFixed(1) : null;

  // Per-engine scores — scores is flat: { ChatGPT: 60, Claude: 58, ... }
  const engineKeys: Record<string, string> = {
    ChatGPT: "chatgpt", Claude: "claude", Gemini: "gemini",
    Perplexity: "perplexity", Copilot: "copilot", AIMode: "aimode", Grok: "grok",
  };
  const engineVars: Record<string, string> = {};
  const engineValues: number[] = [];
  for (const [displayName, varName] of Object.entries(engineKeys)) {
    const v = scores[displayName];
    if (typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)))) {
      const n = Math.round(Number(v));
      engineVars[varName] = String(n);
      engineValues.push(n);
    } else {
      engineVars[varName] = "";
    }
  }
  const global = engineValues.length > 0
    ? Math.round(engineValues.reduce((a, b) => a + b, 0) / engineValues.length)
    : 0;

  return {
    nome: c.full_name || "",
    brand: c.brand || "",
    days: c.days_since_signup ?? "",
    globalScore: global ? String(global) : "",
    aviScore: aviScore ? String(aviScore) : "",
    presence: presence ? String(presence) : "",
    sentiment: sentiment ? String(sentiment) : "",
    avgRank: avgRank || "",
    plan: c.plan || "",
    daysSinceUpgrade: c.days_since_upgrade ?? "",
    auditLimit: c.audit_limit ?? "",
    auditId: c.audit_id || "",
    projectId: c.project_id || "",
    runId: c.run_id || "",
    ...engineVars,
  };
}

async function renderTemplate(type: EmailType, c: any, lang: "it" | "en"): Promise<{ subject: string; html: string }> {
  const templates = await fetchTemplates();
  const tpl = templates.get(type);

  if (!tpl || !tpl.body_it) {
    throw new Error(`Template ${type} not found in DB or body_it is empty`);
  }

  const vars = candidateVars(type, c);
  const bodyIt = fixCtaButtons(interpolate(tpl.body_it, vars));
  // Subject: EN | IT (bilingual subject line)
  const subjectIt = interpolate(tpl.subject_it, vars);
  const subjectEn = tpl.subject_en ? interpolate(tpl.subject_en, vars) : null;
  const subject = subjectEn ? `${subjectEn} | ${subjectIt}` : subjectIt;
  const preview = interpolate(tpl.preview_it || "", vars);

  // Compose bilingual body: IT + divider + EN (if EN exists)
  let bodyInner = bodyIt;
  if (tpl.body_en) {
    const bodyEn = fixCtaButtons(interpolate(tpl.body_en, vars));
    bodyInner = bodyIt + BILINGUAL_DIVIDER + bodyEn;
  }

  const html = emailLayout({ lang: "it", preview, bodyInner });
  return { subject, html };
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
