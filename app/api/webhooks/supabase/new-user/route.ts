import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { verifyWebhookSecret, sendAlertEmail, deriveSource, deriveCountry, nowItalian, escapeHtml } from "@/lib/webhooks/alert-email";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { detectLang } from "@/lib/email/lifecycle/lang-detect";
import { emailLayout } from "@/lib/email/lifecycle/styles";

/**
 * Supabase Database Webhook — INSERT on auth.users (CitationRate project)
 *
 * Configure in CR Supabase Dashboard:
 *   Database → Webhooks → New Webhook
 *   Table: auth.users | Event: INSERT
 *   URL: https://avi.citationrate.com/api/webhooks/supabase/new-user
 *   Headers: x-webhook-secret: <WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const record = body.record ?? body;
    const userId: string | undefined = record.id;
    const email: string = record.email ?? "(no email)";
    const createdAt: string = record.created_at ?? new Date().toISOString();
    const rawUserMeta = record.raw_user_meta_data ?? {};
    const rawAppMeta = record.raw_app_meta_data ?? {};

    if (!userId) {
      return NextResponse.json({ received: true, error: "missing user id" });
    }

    let profileCountry: string | null = null;
    try {
      const supabase = createCitationRateServiceClient();
      const { data } = await (supabase.from("profiles") as any)
        .select("country")
        .eq("id", userId)
        .maybeSingle();
      profileCountry = data?.country ?? null;
    } catch (e) {
      console.warn("[new-user] profile lookup failed:", e);
    }

    const source = deriveSource(rawUserMeta, rawAppMeta);
    const country = deriveCountry(rawUserMeta, profileCountry);
    const signupTime = new Date(createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const subject = `🎉 Nuovo iscritto: ${email}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
        <h2 style="color:#0ea5e9;margin:0 0 16px">🎉 Nuovo iscritto su CitationRate</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Email</td><td style="padding:8px 12px"><strong>${escapeHtml(email)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Quando</td><td style="padding:8px 12px">${escapeHtml(signupTime)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Fonte</td><td style="padding:8px 12px">${escapeHtml(source)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Paese</td><td style="padding:8px 12px">${escapeHtml(country)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">User ID</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${escapeHtml(userId)}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">Notifica automatica · ${escapeHtml(nowItalian())}</p>
      </div>
    `;

    const result = await sendAlertEmail(subject, html);
    if (!result.ok) {
      console.error("[new-user] email failed:", result.error);
    }

    // W0 — Welcome email to the new user (template from DB)
    let w0Sent = false;
    try {
      const fullName: string = rawUserMeta.full_name || rawUserMeta.name || "";
      const lang = detectLang({ email, profileLang: rawUserMeta.lang });

      const supabaseCr = createCitationRateServiceClient();
      const { data: tpl } = await (supabaseCr.from("email_templates") as any)
        .select("subject_it, preview_it, body_it, body_en")
        .eq("id", "W0")
        .maybeSingle();

      if (tpl?.body_it) {
        const vars: Record<string, string> = { nome: fullName || (lang === "en" ? "there" : "ciao") };
        const interpolate = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => escapeHtml(vars[k] || `{${k}}`));
        const bodyIt = interpolate(tpl.body_it);
        const w0Subject = interpolate(tpl.subject_it);
        const preview = interpolate(tpl.preview_it || "");
        let bodyInner = bodyIt;
        if (tpl.body_en) {
          const divider = `<div style="margin:32px 0;padding:24px 0;border-top:2px solid #e5e7eb;border-bottom:2px solid #e5e7eb;text-align:center;"><span style="font-size:13px;color:#8a8f96;letter-spacing:1px;text-transform:uppercase;">🇬🇧 English version below</span></div>`;
          bodyInner = bodyIt + divider + interpolate(tpl.body_en);
        }
        const w0Html = emailLayout({ lang: "it", preview, bodyInner });

        const w0Result = await sendLifecycleEmail({
          userId,
          emailType: "W0",
          recipientEmail: email,
          lang,
          subject: w0Subject,
          html: w0Html,
          payload: { source, country },
        });
        w0Sent = w0Result.ok;
        if (!w0Result.ok && !w0Result.skipped) {
          console.error("[new-user] W0 failed:", w0Result.error);
        }
      } else {
        console.warn("[new-user] W0 template not found in DB, skipping");
      }
    } catch (e) {
      console.error("[new-user] W0 exception:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ received: true, emailed: result.ok, w0: w0Sent });
  } catch (err) {
    console.error("[new-user] unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ received: true, error: "logged" });
  }
}
