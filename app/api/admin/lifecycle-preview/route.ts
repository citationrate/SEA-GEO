/**
 * Preview endpoint per QA visivo lifecycle emails.
 *
 * Genera dati fake per tutti gli 11 template e invia il batch al
 * RESEND_FROM_EMAIL configurato (oppure all'indirizzo passato in ?to=).
 *
 * Auth: header `Authorization: Bearer {CRON_SECRET}` o `?secret=`.
 *
 * NON scrive su lifecycle_emails (dedup non scatta per la preview).
 *
 * Uso:
 *   GET /api/admin/lifecycle-preview?secret=XXX&to=gianmariacipriano3@gmail.com
 *   GET /api/admin/lifecycle-preview?secret=XXX&type=D4_CS&lang=en
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  tpl1A,
  tpl1B,
  tpl1C,
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
import type { SupportedLang } from "@/lib/email/lifecycle/lang-detect";

export const runtime = "nodejs";
export const maxDuration = 60;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";
const FROM_NAME = "Team CitationRate";
const REPLY_TO = "hello@aicitationrate.com";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

function fakeAuditScores() {
  return {
    global: 47,
    perEngine: {
      ChatGPT: 52,
      Claude: 38,
      Gemini: 61,
      Perplexity: 44,
      Copilot: 41,
      AIMode: 49,
      Grok: 33,
    },
  };
}

function fakeAviResult() {
  return { aviScore: 26.3, presence: 50, sentiment: 25, avgRank: 3.4 };
}

function buildAll(lang: SupportedLang): Array<{ type: EmailType; subject: string; html: string }> {
  const name = lang === "en" ? "Alex" : "Marco";
  const brand = "Demo Brand";
  return [
    { type: "1A", ...tpl1A({ name, lang, daysSinceSignup: 3 }) },
    { type: "1B", ...tpl1B({ name, lang, brand, scores: fakeAuditScores(), sector: "tech" }) },
    {
      type: "1C",
      ...tpl1C({ name, lang, brand, country: lang === "en" ? "United Kingdom" : "Italia", result: fakeAviResult() }),
    },
    { type: "D1", ...tplD1({ name, lang }) },
    {
      type: "D2",
      ...tplD2({ name, lang, sector: lang === "en" ? "dentists" : "ristoranti", city: lang === "en" ? "London" : "Milano" }),
    },
    { type: "D3", ...tplD3({ name, lang }) },
    {
      type: "D4_CS",
      ...tplD4_CS({ name, lang, brand, auditId: "demo-audit-uuid-1234", scores: fakeAuditScores() }),
    },
    {
      type: "D4_AVI",
      ...tplD4_AVI({
        name,
        lang,
        brand,
        projectId: "demo-project-uuid",
        runId: "demo-run-uuid",
        result: fakeAviResult(),
      }),
    },
    { type: "D5_CS", ...tplD5_CS({ name, lang, brand, globalScore: 47 }) },
    { type: "D5_AVI", ...tplD5_AVI({ name, lang, brand, aviScore: 26.3 }) },
    { type: "D6", ...tplD6({ name, lang, plan: "pro", daysSinceUpgrade: 5, auditLimit: 50 }) },
  ];
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") || process.env.LIFECYCLE_RECIPIENT_OVERRIDE || "gianmariacipriano3@gmail.com";
  const onlyType = url.searchParams.get("type") as EmailType | null;
  const lang = (url.searchParams.get("lang") as SupportedLang) || "it";

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const all = buildAll(lang);
  const filtered = onlyType ? all.filter((e) => e.type === onlyType) : all;

  const results: Array<{ type: EmailType; ok: boolean; messageId?: string; error?: string }> = [];

  for (const mail of filtered) {
    try {
      const r = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        replyTo: REPLY_TO,
        subject: `[PREVIEW ${lang.toUpperCase()}] ${mail.subject}`,
        html: mail.html,
        headers: { "X-Lifecycle-Preview": "1", "X-Lifecycle-Type": mail.type },
        tags: [
          { name: "preview", value: "1" },
          { name: "type", value: mail.type },
          { name: "lang", value: lang },
        ],
      });
      if (r.error) {
        results.push({ type: mail.type, ok: false, error: r.error.message });
      } else {
        results.push({ type: mail.type, ok: true, messageId: r.data?.id });
      }
    } catch (e: any) {
      results.push({ type: mail.type, ok: false, error: e?.message || "unknown" });
    }
  }

  return NextResponse.json({
    ok: true,
    sentTo: to,
    lang,
    total: results.length,
    successes: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok).length,
    results,
  });
}

export const POST = GET;
