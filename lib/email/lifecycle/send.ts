/**
 * Brevo wrapper per lifecycle emails.
 * Supporta:
 *   - LIFECYCLE_DRY_RUN=true → non spedisce, logga e basta
 *   - LIFECYCLE_RECIPIENT_OVERRIDE=foo@bar.com → manda SOLO a quell'indirizzo, prefissa subject
 *
 * Inserisce sempre una riga in `lifecycle_emails` per dedup.
 */

import { randomUUID } from "crypto";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { injectTracking } from "./inject-tracking";
import type { EmailType } from "./templates";

const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || "info@citationrate.com";
const FROM_NAME = "Team CitationRate";
const REPLY_TO = "support@citationrate.com";

interface SendInput {
  userId: string;
  emailType: EmailType;
  recipientEmail: string;
  lang: "it" | "en";
  subject: string;
  html: string;
  payload?: Record<string, any>;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: "already_sent" | "dry_run";
  finalRecipient: string;
  isTest: boolean;
}

export async function sendLifecycleEmail(input: SendInput): Promise<SendResult> {
  const cr = createCitationRateServiceClient();

  // 1. Dedup: controlla se è già stata mandata a questo utente
  // D4 emails (post-analysis) skip dedup — they send every time the user runs an analysis
  const REPEATABLE_TYPES: ReadonlySet<string> = new Set(["D4_CS", "D4_AVI", "D4_BP"]);
  if (!REPEATABLE_TYPES.has(input.emailType)) {
    const { data: existing } = await (cr.from("lifecycle_emails") as any)
      .select("id, sent_at")
      .eq("user_id", input.userId)
      .eq("email_type", input.emailType)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        skipped: "already_sent",
        finalRecipient: input.recipientEmail,
        isTest: false,
      };
    }
  }

  // 1b. Check unsubscribe / marketing consent.
  // - email_unsubscribed = true → user clicked unsubscribe → block ALL emails
  // - marketing_consent = false → no marketing consent → block only campaigns,
  //   service/lifecycle emails (D1-D6, 1A-1C) still go through (GDPR art. 6.1.f)
  const SERVICE_EMAIL_TYPES: ReadonlySet<string> = new Set([
    "W0", "D1", "D2", "D3", "D4_CS", "D4_AVI", "D4_BP", "D5_CS", "D5_AVI", "D6",
    "1A", "1B", "1C",
  ]);

  {
    const { data: profile } = await (cr.from("profiles") as any)
      .select("email_unsubscribed, marketing_consent")
      .eq("id", input.userId)
      .maybeSingle();

    // Hard unsubscribe: block everything (service + marketing)
    if (profile && profile.email_unsubscribed === true) {
      console.log(`[lifecycle] ${input.emailType} skipped for ${input.userId}: email_unsubscribed`);
      return {
        ok: false,
        skipped: "already_sent" as const,
        finalRecipient: input.recipientEmail,
        isTest: false,
      };
    }

    // No marketing consent: block non-service emails only
    if (!SERVICE_EMAIL_TYPES.has(input.emailType) && profile && profile.marketing_consent === false) {
      console.log(`[lifecycle] ${input.emailType} skipped for ${input.userId}: no marketing_consent`);
      return {
        ok: false,
        skipped: "already_sent" as const,
        finalRecipient: input.recipientEmail,
        isTest: false,
      };
    }
  }

  // 1c. Check if template is active in CRM
  const { data: tpl } = await (cr.from("email_templates") as any)
    .select("active, unsubscribe_text, unsubscribe_url")
    .eq("id", input.emailType)
    .maybeSingle();

  if (tpl && !tpl.active) {
    console.log(`[lifecycle] ${input.emailType} disabled in CRM, skipping`);
    return {
      ok: false,
      skipped: "already_sent" as const,
      finalRecipient: input.recipientEmail,
      isTest: false,
    };
  }

  // 2. Recipient override (testing).
  const override = process.env.LIFECYCLE_RECIPIENT_OVERRIDE?.trim() || undefined;
  const isTest = !!override;
  const finalRecipient = override || input.recipientEmail;
  const finalSubject = isTest
    ? `[TEST → ${input.recipientEmail}] ${input.subject}`
    : input.subject;

  // 3. Dry run
  const isDry = process.env.LIFECYCLE_DRY_RUN === "true";
  if (isDry) {
    console.log(
      `[lifecycle][DRY_RUN] would send ${input.emailType} to ${finalRecipient} (real: ${input.recipientEmail})`,
    );
    const fakeId = `dry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (REPEATABLE_TYPES.has(input.emailType)) {
      await (cr.from("lifecycle_emails") as any)
        .delete()
        .eq("user_id", input.userId)
        .eq("email_type", input.emailType);
    }
    await (cr.from("lifecycle_emails") as any).insert({
      user_id: input.userId,
      email_type: input.emailType,
      resend_message_id: fakeId,
      tracking_id: randomUUID(),
      recipient_email: input.recipientEmail,
      lang: input.lang,
      payload: input.payload || {},
      status: "dry_run",
      is_test: true,
    });
    return { ok: true, messageId: fakeId, skipped: "dry_run", finalRecipient, isTest: true };
  }

  // 4. Send via Brevo
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    return {
      ok: false,
      error: "BREVO_API_KEY missing",
      finalRecipient,
      isTest,
    };
  }

  // Inject open pixel + click tracking before sending
  const trackingId = randomUUID();
  const trackedHtml = injectTracking(input.html, trackingId, {
    unsubscribeText: tpl?.unsubscribe_text || undefined,
    unsubscribeUrl: tpl?.unsubscribe_url || undefined,
  });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: finalRecipient }],
      replyTo: { email: REPLY_TO },
      subject: finalSubject,
      htmlContent: trackedHtml,
      headers: {
        "X-Lifecycle-Type": input.emailType,
        "X-User-Id": input.userId,
        "X-Real-Recipient": input.recipientEmail,
      },
      tags: [input.emailType, input.lang, isTest ? "test" : "production"],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`[lifecycle] brevo error for ${input.emailType}:`, data);
    return {
      ok: false,
      error: data.message || "brevo_unknown_error",
      finalRecipient,
      isTest,
    };
  }

  const messageId = data.messageId;
  if (!messageId) {
    return { ok: false, error: "no_message_id", finalRecipient, isTest };
  }

  // 5. Log in lifecycle_emails (dedup primary)
  // For repeatable D4 types, delete the old row first to avoid UNIQUE constraint violation
  if (REPEATABLE_TYPES.has(input.emailType)) {
    await (cr.from("lifecycle_emails") as any)
      .delete()
      .eq("user_id", input.userId)
      .eq("email_type", input.emailType);
  }

  const { error: insertError } = await (cr.from("lifecycle_emails") as any).insert({
    user_id: input.userId,
    email_type: input.emailType,
    resend_message_id: messageId,
    tracking_id: trackingId,
    recipient_email: input.recipientEmail,
    lang: input.lang,
    payload: input.payload || {},
    status: "sent",
    is_test: isTest,
  });

  if (insertError) {
    console.warn(`[lifecycle] log insert failed for ${input.emailType} ${input.userId}:`, insertError.message);
  }

  return { ok: true, messageId, finalRecipient, isTest };
}
