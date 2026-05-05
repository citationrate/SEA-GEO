/**
 * Open tracking pixel endpoint.
 * GET /api/email/track/open?id={tracking_id}
 *
 * Returns a 1x1 transparent GIF and increments open_count
 * in lifecycle_emails. Also logs to email_events for audit.
 */

import { NextRequest } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get("id");
  if (!trackingId) {
    return new Response(PIXEL, { status: 200, headers: HEADERS });
  }

  // Fire-and-forget: don't block the pixel response
  void handleOpen(trackingId, req).catch((e) =>
    console.error("[track/open]", e),
  );

  return new Response(PIXEL, { status: 200, headers: HEADERS });
}

async function handleOpen(trackingId: string, req: NextRequest) {
  const cr = createCitationRateServiceClient();
  const now = new Date().toISOString();

  const { data: existing } = await (cr.from("lifecycle_emails") as any)
    .select("id, open_count, first_opened_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!existing) return;

  // Update open counts
  await (cr.from("lifecycle_emails") as any)
    .update({
      open_count: (existing.open_count || 0) + 1,
      last_opened_at: now,
      ...(existing.first_opened_at ? {} : { first_opened_at: now }),
    })
    .eq("id", existing.id);

  // Audit log
  await (cr.from("email_events") as any).insert({
    message_id: trackingId,
    event_type: "email.opened",
    occurred_at: now,
    payload: {},
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent") || null,
  });
}
