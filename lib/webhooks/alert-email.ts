import { Resend } from "resend";
import { timingSafeEqual } from "crypto";

const ALERT_RECIPIENTS = ["citationrate@gmail.com", "gianmariacipriano3@gmail.com"];
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";
const FROM_NAME = "Alerts CitationRate";

export function verifyWebhookSecret(request: Request): boolean {
  const secret = request.headers.get("x-webhook-secret");
  const expected = Buffer.from(process.env.WEBHOOK_SECRET || "");
  const received = Buffer.from(secret || "");
  if (expected.length === 0) return false;
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export async function sendAlertEmail(subject: string, html: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[alert-email] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: ALERT_RECIPIENTS,
    subject,
    html,
  });
  if (result.error) {
    console.error("[alert-email] resend error:", result.error);
    return { ok: false, error: result.error.message };
  }
  return { ok: true, id: result.data?.id };
}

export function deriveSource(rawUserMetaData: any, rawAppMetaData: any): string {
  const meta = { ...(rawUserMetaData || {}), ...(rawAppMetaData || {}) };
  const candidates = [meta.utm_source, meta.source, meta.signup_source, meta.referrer, meta.provider];
  const raw = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  if (!raw) return "direct";
  const s = String(raw).toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || s.includes("meta") || s === "fb" || s === "ig") return "meta";
  if (s.includes("google") && !s.includes("organic")) return "google ads";
  if (s.includes("organic") || s.includes("seo")) return "organic";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("youtube") || s === "yt") return "youtube";
  if (s.includes("twitter") || s === "x") return "twitter/x";
  if (s.includes("email") || s.includes("newsletter")) return "email";
  return s;
}

export function deriveCountry(rawUserMetaData: any, profileCountry?: string | null): string {
  if (profileCountry && typeof profileCountry === "string") return profileCountry.toUpperCase();
  const meta = rawUserMetaData || {};
  const candidates = [meta.country, meta.country_code, meta.locale, meta.lang];
  const raw = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  if (!raw) return "?";
  const s = String(raw).toUpperCase().slice(0, 2);
  return s;
}

export function nowItalian(): string {
  return new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
