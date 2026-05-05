/**
 * Click tracking redirect endpoint.
 * GET /api/email/track/click?id={tracking_id}&url={encoded_destination}
 *
 * Increments click_count in lifecycle_emails, logs to email_events,
 * then redirects (302) to the destination URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get("id");
  const destinationUrl = req.nextUrl.searchParams.get("url");

  // Always redirect even if tracking fails
  if (!destinationUrl) {
    return NextResponse.redirect("https://avi.citationrate.com", 302);
  }

  if (trackingId) {
    // Fire-and-forget
    void handleClick(trackingId, destinationUrl, req).catch((e) =>
      console.error("[track/click]", e),
    );
  }

  return NextResponse.redirect(destinationUrl, 302);
}

async function handleClick(
  trackingId: string,
  url: string,
  req: NextRequest,
) {
  const cr = createCitationRateServiceClient();
  const now = new Date().toISOString();

  const { data: existing } = await (cr.from("lifecycle_emails") as any)
    .select("id, click_count, first_clicked_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!existing) return;

  // Update click counts
  await (cr.from("lifecycle_emails") as any)
    .update({
      click_count: (existing.click_count || 0) + 1,
      ...(existing.first_clicked_at ? {} : { first_clicked_at: now }),
    })
    .eq("id", existing.id);

  // Audit log
  await (cr.from("email_events") as any).insert({
    message_id: trackingId,
    event_type: "email.clicked",
    occurred_at: now,
    payload: {},
    link_url: url,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent") || null,
  });
}
