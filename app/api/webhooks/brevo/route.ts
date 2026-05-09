/**
 * Brevo webhook receiver per tracking lifecycle emails.
 *
 * Eventi gestiti:
 *   - delivered → delivered_at
 *   - opened → first_opened_at, last_opened_at, open_count++ (deprecated — usiamo pixel custom)
 *   - click → first_clicked_at, click_count++, link_url (deprecated — usiamo redirect custom)
 *   - hard_bounce / soft_bounce → bounced_at
 *   - complaint → complained_at
 *   - blocked / invalid / deferred → status
 *
 * Logga sempre TUTTI gli eventi raw in `email_events` per audit trail.
 *
 * Configurazione su Brevo Dashboard:
 *   Settings → Webhooks → Add → URL: https://avi.citationrate.com/api/webhooks/brevo
 *   Subscribe to: tutti gli eventi transazionali
 */

import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export const runtime = "nodejs";

interface BrevoEvent {
  event: string;
  "message-id"?: string;
  email?: string;
  date?: string;
  ts_event?: number;
  link?: string;
  ip?: string;
  reason?: string;
  tag?: string;
  [k: string]: any;
}

export async function POST(request: Request) {
  let evt: BrevoEvent;
  try {
    evt = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messageId = evt["message-id"] || null;
  const eventType = evt.event || "unknown";
  const occurredAt = evt.date || new Date().toISOString();

  const cr = createCitationRateServiceClient();

  // 1. Audit log: insert raw evento
  await (cr.from("email_events") as any).insert({
    message_id: messageId,
    event_type: `email.${eventType}`,
    occurred_at: occurredAt,
    payload: evt,
    ip: evt.ip || null,
    user_agent: null,
    link_url: evt.link || null,
  });

  // 2. Aggiorna lifecycle_emails se messageId presente
  if (messageId) {
    const { data: existing } = await (cr.from("lifecycle_emails") as any)
      .select("id, open_count, click_count, first_opened_at, first_clicked_at")
      .eq("resend_message_id", messageId)
      .maybeSingle();

    if (existing) {
      const update: Record<string, any> = {};

      switch (eventType) {
        case "delivered":
          update.delivered_at = occurredAt;
          update.status = "delivered";
          break;
        case "opened":
          // Brevo open tracking — keep as fallback alongside our custom pixel
          update.last_opened_at = occurredAt;
          update.open_count = (existing.open_count || 0) + 1;
          if (!existing.first_opened_at) update.first_opened_at = occurredAt;
          break;
        case "click":
          update.click_count = (existing.click_count || 0) + 1;
          if (!existing.first_clicked_at) update.first_clicked_at = occurredAt;
          break;
        case "hard_bounce":
        case "soft_bounce":
          update.bounced_at = occurredAt;
          update.status = "bounced";
          break;
        case "complaint":
          update.complained_at = occurredAt;
          update.status = "complained";
          break;
        case "blocked":
        case "invalid":
        case "deferred":
        case "error":
          update.status = eventType;
          break;
      }

      if (Object.keys(update).length > 0) {
        await (cr.from("lifecycle_emails") as any).update(update).eq("id", existing.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
