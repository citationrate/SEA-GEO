/**
 * Resend webhook receiver per tracking lifecycle emails.
 *
 * Eventi gestiti:
 *   - email.sent / email.delivered → delivered_at
 *   - email.opened → first_opened_at, last_opened_at, open_count++
 *   - email.clicked → first_clicked_at, click_count++, link_url
 *   - email.bounced / email.complained / email.failed → bounced_at / complained_at
 *
 * Logga sempre TUTTI gli eventi raw in `email_events` per audit trail.
 *
 * Configurazione su Resend Dashboard:
 *   Webhooks → Add → URL: https://avi.citationrate.com/api/webhooks/resend
 *   Subscribe to: tutti gli eventi email.*
 *   Signing secret → salvato come RESEND_WEBHOOK_SECRET su Vercel
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export const runtime = "nodejs";

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    open?: { ipAddress?: string; userAgent?: string };
    bounce?: { type?: string; subType?: string };
    [k: string]: any;
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Verify Svix signature se RESEND_WEBHOOK_SECRET è settato.
  // Resend usa Svix con headers svix-id, svix-timestamp, svix-signature.
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn("[resend-webhook] missing svix headers");
      return NextResponse.json({ error: "missing signature" }, { status: 401 });
    }
    if (!verifySvixSignature(svixId, svixTimestamp, rawBody, svixSignature, secret)) {
      console.warn("[resend-webhook] signature mismatch");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let evt: ResendEvent;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messageId = evt.data?.email_id;
  const eventType = evt.type || "unknown";
  const occurredAt = evt.created_at || new Date().toISOString();

  const cr = createCitationRateServiceClient();

  // 1. Audit log: insert raw evento
  await (cr.from("email_events") as any).insert({
    message_id: messageId,
    event_type: eventType,
    occurred_at: occurredAt,
    payload: evt.data,
    ip: evt.data?.click?.ipAddress || evt.data?.open?.ipAddress || null,
    user_agent: evt.data?.click?.userAgent || evt.data?.open?.userAgent || null,
    link_url: evt.data?.click?.link || null,
  });

  // 2. Aggiorna lifecycle_emails se messageId presente
  if (messageId) {
    await updateLifecycleStatus(cr, messageId, eventType, occurredAt, evt);
  }

  return NextResponse.json({ ok: true });
}

async function updateLifecycleStatus(
  cr: any,
  messageId: string,
  eventType: string,
  occurredAt: string,
  evt: ResendEvent,
): Promise<void> {
  const { data: existing } = await cr
    .from("lifecycle_emails")
    .select("id, open_count, click_count, first_opened_at, first_clicked_at")
    .eq("resend_message_id", messageId)
    .maybeSingle();

  if (!existing) return; // mail non tracciata da noi (es. supporto, consultation)

  const update: Record<string, any> = {};
  switch (eventType) {
    case "email.sent":
      update.status = "sent";
      break;
    case "email.delivered":
      update.delivered_at = occurredAt;
      update.status = "delivered";
      break;
    case "email.opened":
      update.last_opened_at = occurredAt;
      update.open_count = (existing.open_count || 0) + 1;
      if (!existing.first_opened_at) update.first_opened_at = occurredAt;
      break;
    case "email.clicked":
      update.click_count = (existing.click_count || 0) + 1;
      if (!existing.first_clicked_at) update.first_clicked_at = occurredAt;
      break;
    case "email.bounced":
      update.bounced_at = occurredAt;
      update.status = "bounced";
      break;
    case "email.complained":
      update.complained_at = occurredAt;
      update.status = "complained";
      break;
    case "email.failed":
    case "email.delivery_delayed":
      update.status = eventType.replace("email.", "");
      break;
  }

  if (Object.keys(update).length > 0) {
    await cr.from("lifecycle_emails").update(update).eq("id", existing.id);
  }
  void evt;
}

function verifySvixSignature(
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
  secret: string,
): boolean {
  // Svix secret format: "whsec_xxx" — strip prefix per HMAC
  const secretRaw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(secretRaw, "base64");
  const signedPayload = `${id}.${timestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  // signatureHeader format: "v1,sig1 v1,sig2 ..."
  const sigs = signatureHeader.split(" ").map((s) => s.split(",")[1]);
  for (const sig of sigs) {
    if (!sig) continue;
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // skip
    }
  }
  return false;
}
