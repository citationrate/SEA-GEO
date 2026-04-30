import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { verifyWebhookSecret, sendAlertEmail, nowItalian, escapeHtml } from "@/lib/webhooks/alert-email";

/**
 * Supabase Database Webhook — INSERT on public.audits (CitationRate project)
 *
 * Configure in CR Supabase Dashboard:
 *   Database → Webhooks → New Webhook
 *   Table: public.audits | Event: INSERT
 *   URL: https://avi.citationrate.com/api/webhooks/supabase/new-audit
 *   Headers: x-webhook-secret: <WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const record = body.record ?? body;
    const auditId: string | undefined = record.id;
    const userId: string | undefined = record.user_id;
    const createdAt: string = record.created_at ?? new Date().toISOString();
    const url: string = record.website_url ?? record.url ?? record.domain ?? "(URL sconosciuto)";
    const sector: string | undefined = record.sector ?? record.macro_sector;
    const country: string | undefined = record.country;

    if (!userId) {
      return NextResponse.json({ received: true, error: "missing user_id" });
    }

    let userEmail = "(unknown)";
    let userPlan = "?";
    try {
      const supabase = createCitationRateServiceClient();
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("email, plan")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.email) userEmail = profile.email;
      if (profile?.plan) userPlan = profile.plan;
    } catch (e) {
      console.warn("[new-audit] user lookup failed:", e);
    }

    const auditTime = new Date(createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const subject = `🔍 Audit CS: ${userEmail} → ${url}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
        <h2 style="color:#10b981;margin:0 0 16px">🔍 Nuovo Audit Citation Score</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Utente</td><td style="padding:8px 12px"><strong>${escapeHtml(userEmail)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Piano</td><td style="padding:8px 12px">${escapeHtml(userPlan)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">URL analizzato</td><td style="padding:8px 12px"><a href="${escapeHtml(url)}" style="color:#0ea5e9">${escapeHtml(url)}</a></td></tr>
          ${sector ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Settore</td><td style="padding:8px 12px">${escapeHtml(sector)}</td></tr>` : ""}
          ${country ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Paese</td><td style="padding:8px 12px">${escapeHtml(country)}</td></tr>` : ""}
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Quando</td><td style="padding:8px 12px">${escapeHtml(auditTime)}</td></tr>
          ${auditId ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Audit ID</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${escapeHtml(auditId)}</td></tr>` : ""}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">Notifica automatica · ${escapeHtml(nowItalian())}</p>
      </div>
    `;

    const result = await sendAlertEmail(subject, html);
    if (!result.ok) {
      console.error("[new-audit] email failed:", result.error);
    }
    return NextResponse.json({ received: true, emailed: result.ok });
  } catch (err) {
    console.error("[new-audit] unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ received: true, error: "logged" });
  }
}
