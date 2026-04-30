import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { verifyWebhookSecret, sendAlertEmail, nowItalian, escapeHtml } from "@/lib/webhooks/alert-email";

/**
 * Supabase Database Webhook — INSERT on public.audits (CitationRate project)
 *
 * Trigger: alert-new-audit (CR) → POST avi.citationrate.com/api/webhooks/supabase/new-audit
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
    const urls: string[] = Array.isArray(record.urls) ? record.urls : [];
    const primaryUrl: string = urls[0] ?? "(URL sconosciuto)";
    const brand: string | undefined = record.brand;
    const topic: string | undefined = record.topic;
    const sector: string | undefined = record.sector_label || record.sector;
    const status: string | undefined = record.status;

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
    const extraUrlsLine = urls.length > 1 ? ` (+${urls.length - 1} altri URL)` : "";

    const subject = `🔍 Audit CS: ${userEmail} → ${primaryUrl}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
        <h2 style="color:#10b981;margin:0 0 16px">🔍 Nuovo Audit Citation Score</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Utente</td><td style="padding:8px 12px"><strong>${escapeHtml(userEmail)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Piano</td><td style="padding:8px 12px">${escapeHtml(userPlan)}</td></tr>
          ${brand ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Brand</td><td style="padding:8px 12px"><strong>${escapeHtml(brand)}</strong></td></tr>` : ""}
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">URL principale</td><td style="padding:8px 12px"><a href="${escapeHtml(primaryUrl)}" style="color:#0ea5e9">${escapeHtml(primaryUrl)}</a>${escapeHtml(extraUrlsLine)}</td></tr>
          ${topic ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Topic</td><td style="padding:8px 12px">${escapeHtml(topic)}</td></tr>` : ""}
          ${sector ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Settore</td><td style="padding:8px 12px">${escapeHtml(sector)}</td></tr>` : ""}
          ${status ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Stato iniziale</td><td style="padding:8px 12px">${escapeHtml(status)}</td></tr>` : ""}
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
