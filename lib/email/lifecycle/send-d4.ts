/**
 * Direct D4 email sender — called immediately when an analysis completes.
 * Handles D4_CS (Citability Score), D4_AVI (AVI run), and D4_BP (Brand Profile).
 *
 * Unlike the cron-based approach, this sends the email right away without
 * waiting for the next cron tick. Dedup for D4 types is disabled in send.ts
 * so users receive an email for every analysis they run.
 */

import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { sendLifecycleEmail } from "./send";
import { detectLang } from "./lang-detect";
import { emailLayout, escapeHtml } from "./styles";
import type { EmailType } from "./templates";

/* ─── Template rendering (mirrors cron logic) ─── */

async function fetchTemplate(type: EmailType) {
  const cr = createCitationRateServiceClient();
  const { data } = await (cr.from("email_templates") as any)
    .select("id, subject_it, subject_en, preview_it, preview_en, body_it, body_en, active")
    .eq("id", type)
    .maybeSingle();
  return data;
}

function interpolate(body: string, vars: Record<string, string | number | null | undefined>): string {
  let result = body;
  for (const [key, val] of Object.entries(vars)) {
    if (val !== null && val !== undefined) {
      result = result.replaceAll(`{${key}}`, escapeHtml(String(val)));
    }
  }
  return result;
}

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

const BILINGUAL_DIVIDER = `
  <div style="margin:32px 0;padding:24px 0;border-top:2px solid #e5e7eb;border-bottom:2px solid #e5e7eb;text-align:center;">
    <span style="font-size:13px;color:#8a8f96;letter-spacing:1px;text-transform:uppercase;">\u{1F1EC}\u{1F1E7} English version below</span>
  </div>
`;

function buildVars(type: EmailType, data: any): Record<string, string | number | null> {
  const scores = data.scores || {};
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
    nome: data.full_name || "",
    brand: data.brand || "",
    days: data.days_since_signup ?? "",
    globalScore: global ? String(global) : "",
    aviScore: data.avi_score ? String(Math.round(Number(data.avi_score))) : "",
    presence: data.presence_score ? String(Math.round(Number(data.presence_score))) : "",
    sentiment: data.sentiment_score ? String(Math.round(Number(data.sentiment_score))) : "",
    avgRank: data.avg_brand_rank ? Number(data.avg_brand_rank).toFixed(1) : "",
    plan: data.plan || "",
    auditId: data.audit_id || "",
    projectId: data.project_id || "",
    runId: data.run_id || "",
    ...engineVars,
  };
}

async function renderD4(type: EmailType, vars: Record<string, string | number | null>): Promise<{ subject: string; html: string }> {
  const tpl = await fetchTemplate(type);
  if (!tpl || !tpl.body_it) {
    throw new Error(`Template ${type} not found in DB or body_it is empty`);
  }

  const bodyIt = fixCtaButtons(interpolate(tpl.body_it, vars));
  const subjectIt = interpolate(tpl.subject_it, vars);
  const subjectEn = tpl.subject_en ? interpolate(tpl.subject_en, vars) : null;
  const subject = subjectEn ? `${subjectEn} | ${subjectIt}` : subjectIt;
  const preview = interpolate(tpl.preview_it || "", vars);

  let bodyInner = bodyIt;
  if (tpl.body_en) {
    const bodyEn = fixCtaButtons(interpolate(tpl.body_en, vars));
    bodyInner = bodyIt + BILINGUAL_DIVIDER + bodyEn;
  }

  const html = emailLayout({ lang: "it", preview, bodyInner });
  return { subject, html };
}

/* ─── Fetch user profile + auth ─── */

async function fetchUserData(userId: string): Promise<{
  email: string;
  full_name: string | null;
  lang_hint: string | null;
  plan: string;
  signup_at: string;
  days_since_signup: number;
} | null> {
  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("full_name, plan, lang, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.is_admin) return null;

  const { data: { user } } = await (cr.auth.admin as any).getUserById(userId);
  if (!user) return null;

  return {
    email: user.email,
    full_name: profile.full_name,
    lang_hint: profile.lang || null,
    plan: profile.plan,
    signup_at: user.created_at,
    days_since_signup: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400_000),
  };
}

/* ─── Public API ─── */

export interface SendD4Result {
  ok: boolean;
  skipped?: string;
  error?: string;
}

/**
 * Send D4_CS email immediately after a Citability Score audit completes.
 */
export async function sendD4CS(params: {
  userId: string;
  auditId: string;
  brand: string;
  scores: any;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("D4_CS", {
      ...userData,
      audit_id: params.auditId,
      brand: params.brand,
      scores: params.scores,
    });

    const { subject, html } = await renderD4("D4_CS", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "D4_CS",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, audit_id: params.auditId, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-d4] D4_CS error:", e?.message);
    return { ok: false, error: e?.message };
  }
}

/**
 * Send D4_AVI email immediately after an AVI run completes.
 */
export async function sendD4AVI(params: {
  userId: string;
  runId: string;
  projectId: string;
  brand: string;
  country?: string | null;
  aviScore: number;
  presenceScore: number;
  sentimentScore: number;
  avgBrandRank?: number | null;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("D4_AVI", {
      ...userData,
      run_id: params.runId,
      project_id: params.projectId,
      brand: params.brand,
      avi_score: params.aviScore,
      presence_score: params.presenceScore,
      sentiment_score: params.sentimentScore,
      avg_brand_rank: params.avgBrandRank,
    });

    const { subject, html } = await renderD4("D4_AVI", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "D4_AVI",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, project_id: params.projectId, run_id: params.runId, avi_score: params.aviScore, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-d4] D4_AVI error:", e?.message);
    return { ok: false, error: e?.message };
  }
}

/**
 * Send D4_BP email immediately after a Brand Profile run completes.
 */
export async function sendD4BP(params: {
  userId: string;
  runId: string;
  projectId: string;
  brand: string;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("D4_BP", {
      ...userData,
      run_id: params.runId,
      project_id: params.projectId,
      brand: params.brand,
    });

    const { subject, html } = await renderD4("D4_BP", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "D4_BP",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, project_id: params.projectId, run_id: params.runId, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-d4] D4_BP error:", e?.message);
    return { ok: false, error: e?.message };
  }
}

/* ─── Failure emails (F1) ─── */

/**
 * Send F1_CS email when a Citability Score audit fails.
 */
export async function sendF1CS(params: {
  userId: string;
  brand: string;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("F1_CS", { ...userData, brand: params.brand });
    const { subject, html } = await renderD4("F1_CS", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "F1_CS",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-f1] F1_CS error:", e?.message);
    return { ok: false, error: e?.message };
  }
}

/**
 * Send F1_AVI email when an AVI run fails.
 */
export async function sendF1AVI(params: {
  userId: string;
  brand: string;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("F1_AVI", { ...userData, brand: params.brand });
    const { subject, html } = await renderD4("F1_AVI", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "F1_AVI",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-f1] F1_AVI error:", e?.message);
    return { ok: false, error: e?.message };
  }
}

/**
 * Send F1_BP email when a Brand Profile run fails.
 */
export async function sendF1BP(params: {
  userId: string;
  brand: string;
}): Promise<SendD4Result> {
  try {
    const userData = await fetchUserData(params.userId);
    if (!userData) return { ok: false, skipped: "user_not_found_or_admin" };

    const lang = detectLang({ email: userData.email, profileLang: userData.lang_hint });
    const vars = buildVars("F1_BP", { ...userData, brand: params.brand });
    const { subject, html } = await renderD4("F1_BP", vars);
    const r = await sendLifecycleEmail({
      userId: params.userId,
      emailType: "F1_BP",
      recipientEmail: userData.email,
      lang,
      subject,
      html,
      payload: { brand: params.brand, plan: userData.plan },
    });

    return { ok: r.ok, skipped: r.skipped, error: r.error };
  } catch (e: any) {
    console.error("[send-f1] F1_BP error:", e?.message);
    return { ok: false, error: e?.message };
  }
}
