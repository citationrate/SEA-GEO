import { timingSafeEqual } from "crypto";

const ALERT_RECIPIENTS = ["citationrate@gmail.com", "gianmariacipriano3@gmail.com", "tecla.casalone@studenti.iulm.it"];
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || "info@citationrate.com";
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
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    console.error("[alert-email] BREVO_API_KEY not configured");
    return { ok: false, error: "BREVO_API_KEY missing" };
  }

  // Brevo requires sending to each recipient individually or as array of objects
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: ALERT_RECIPIENTS.map(email => ({ email })),
      subject,
      htmlContent: html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[alert-email] brevo error:", data);
    return { ok: false, error: data.message };
  }
  return { ok: true, id: data.messageId };
}

export async function sendFailureAlert(opts: {
  tool: "AVI" | "Brand Profile" | "Citability Score";
  brand: string;
  userEmail: string;
  userId: string;
  errorMessage: string;
  runId: string;
}): Promise<{ ok: boolean }> {
  const { tool, brand, userEmail, userId, errorMessage, runId } = opts;
  const subject = `❌ ${tool} fallita: ${brand} (${userEmail})`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
      <h2 style="color:#dc2626;margin:0 0 16px">❌ Analisi ${escapeHtml(tool)} fallita</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600;width:140px">Tool</td><td style="padding:8px 12px"><strong>${escapeHtml(tool)}</strong></td></tr>
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600">Brand</td><td style="padding:8px 12px">${escapeHtml(brand)}</td></tr>
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600">Utente</td><td style="padding:8px 12px">${escapeHtml(userEmail)}</td></tr>
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600">Errore</td><td style="padding:8px 12px;color:#dc2626">${escapeHtml(errorMessage)}</td></tr>
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600">Run ID</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${escapeHtml(runId)}</td></tr>
        <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:600">User ID</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${escapeHtml(userId)}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b">Notifica automatica · ${escapeHtml(nowItalian())}</p>
    </div>
  `;
  const result = await sendAlertEmail(subject, html);
  if (!result.ok) console.error(`[failure-alert] ${tool} email failed:`, result.error);
  return { ok: result.ok };
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
