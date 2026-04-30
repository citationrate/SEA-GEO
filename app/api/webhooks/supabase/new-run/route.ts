import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { verifyWebhookSecret, sendAlertEmail, nowItalian, escapeHtml } from "@/lib/webhooks/alert-email";

/**
 * Supabase Database Webhook — INSERT on public.runs (AVI / seageo1 project)
 *
 * Configure in seageo1 Supabase Dashboard:
 *   Database → Webhooks → New Webhook
 *   Table: public.runs | Event: INSERT
 *   URL: https://avi.citationrate.com/api/webhooks/supabase/new-run
 *   Headers: x-webhook-secret: <WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const record = body.record ?? body;
    const runId: string | undefined = record.id;
    const projectId: string | undefined = record.project_id;
    const createdAt: string = record.created_at ?? new Date().toISOString();
    const status: string | undefined = record.status;

    if (!projectId) {
      return NextResponse.json({ received: true, error: "missing project_id" });
    }

    let userId: string | undefined;
    let brandName = "(brand sconosciuto)";
    let projectName: string | undefined;
    let modelsCount: number | undefined;
    try {
      const seageo = createServiceClient();
      const { data: project } = await (seageo.from("projects") as any)
        .select("user_id, brand_name, name, ai_models")
        .eq("id", projectId)
        .maybeSingle();
      if (project) {
        userId = project.user_id;
        brandName = project.brand_name || project.name || brandName;
        projectName = project.name;
        if (Array.isArray(project.ai_models)) modelsCount = project.ai_models.length;
      }
    } catch (e) {
      console.warn("[new-run] project lookup failed:", e);
    }

    let userEmail = "(unknown)";
    let userPlan = "?";
    if (userId) {
      try {
        const cr = createCitationRateServiceClient();
        const { data: profile } = await (cr.from("profiles") as any)
          .select("email, plan")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.email) userEmail = profile.email;
        if (profile?.plan) userPlan = profile.plan;
      } catch (e) {
        console.warn("[new-run] user lookup failed:", e);
      }
    }

    const runTime = new Date(createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const subject = `📊 Run AVI: ${userEmail} → ${brandName}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
        <h2 style="color:#8b5cf6;margin:0 0 16px">📊 Nuovo Run AVI</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Utente</td><td style="padding:8px 12px"><strong>${escapeHtml(userEmail)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Piano</td><td style="padding:8px 12px">${escapeHtml(userPlan)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Brand</td><td style="padding:8px 12px"><strong>${escapeHtml(brandName)}</strong></td></tr>
          ${projectName && projectName !== brandName ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Progetto</td><td style="padding:8px 12px">${escapeHtml(projectName)}</td></tr>` : ""}
          ${modelsCount !== undefined ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Modelli</td><td style="padding:8px 12px">${modelsCount}</td></tr>` : ""}
          ${status ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Stato iniziale</td><td style="padding:8px 12px">${escapeHtml(status)}</td></tr>` : ""}
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Quando</td><td style="padding:8px 12px">${escapeHtml(runTime)}</td></tr>
          ${runId ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Run ID</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${escapeHtml(runId)}</td></tr>` : ""}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">Notifica automatica · ${escapeHtml(nowItalian())}</p>
      </div>
    `;

    const result = await sendAlertEmail(subject, html);
    if (!result.ok) {
      console.error("[new-run] email failed:", result.error);
    }
    return NextResponse.json({ received: true, emailed: result.ok });
  } catch (err) {
    console.error("[new-run] unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ received: true, error: "logged" });
  }
}
