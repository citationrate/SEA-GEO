/**
 * Resend wrapper per lifecycle emails.
 * Supporta:
 *   - LIFECYCLE_DRY_RUN=true → non spedisce, logga e basta
 *   - LIFECYCLE_RECIPIENT_OVERRIDE=foo@bar.com → manda SOLO a quell'indirizzo, prefissa subject
 *
 * Inserisce sempre una riga in `lifecycle_emails` per dedup.
 */

import { Resend } from "resend";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import type { EmailType } from "./templates";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";
const FROM_NAME = "Team CitationRate";
const REPLY_TO = "hello@aicitationrate.com";

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

  // 2. Recipient override (testing). Trimmed because Vercel env vars copy-pasted
  // from a terminal often carry a trailing newline, and Resend rejects an
  // address that ends with whitespace — silently dropping every cron run.
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
    await (cr.from("lifecycle_emails") as any).insert({
      user_id: input.userId,
      email_type: input.emailType,
      resend_message_id: fakeId,
      recipient_email: input.recipientEmail,
      lang: input.lang,
      payload: input.payload || {},
      status: "dry_run",
      is_test: true,
    });
    return { ok: true, messageId: fakeId, skipped: "dry_run", finalRecipient, isTest: true };
  }

  // 4. Send via Resend
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      error: "RESEND_API_KEY missing",
      finalRecipient,
      isTest,
    };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const sendResult = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: finalRecipient,
    replyTo: REPLY_TO,
    subject: finalSubject,
    html: input.html,
    headers: {
      "X-Lifecycle-Type": input.emailType,
      "X-User-Id": input.userId,
      "X-Real-Recipient": input.recipientEmail,
    },
    tags: [
      { name: "type", value: input.emailType },
      { name: "lang", value: input.lang },
      { name: "test", value: isTest ? "1" : "0" },
    ],
  });

  if (sendResult.error) {
    console.error(`[lifecycle] resend error for ${input.emailType}:`, sendResult.error);
    return {
      ok: false,
      error: sendResult.error.message || "resend_unknown_error",
      finalRecipient,
      isTest,
    };
  }

  const messageId = sendResult.data?.id;
  if (!messageId) {
    return { ok: false, error: "no_message_id", finalRecipient, isTest };
  }

  // 5. Log in lifecycle_emails (dedup primary)
  const { error: insertError } = await (cr.from("lifecycle_emails") as any).insert({
    user_id: input.userId,
    email_type: input.emailType,
    resend_message_id: messageId,
    recipient_email: input.recipientEmail,
    lang: input.lang,
    payload: input.payload || {},
    status: "sent",
    is_test: isTest,
  });

  if (insertError) {
    console.warn(`[lifecycle] log insert failed for ${input.emailType} ${input.userId}:`, insertError.message);
    // mail già spedita, non rollback. Tracking degraded ma nessun impatto utente.
  }

  return { ok: true, messageId, finalRecipient, isTest };
}
