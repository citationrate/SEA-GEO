/**
 * One-click unsubscribe endpoint.
 * GET /api/email/unsubscribe?id={tracking_id}
 *
 * - Sets email_unsubscribed = true on profiles
 * - Sets unsubscribed_at on lifecycle_emails
 * - Redirects to /unsubscribe confirmation page
 */

import { NextRequest, NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get("id");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";

  if (!trackingId) {
    return NextResponse.redirect(`${baseUrl}/unsubscribe?status=error`, 302);
  }

  try {
    const cr = createCitationRateServiceClient();

    // Find the email record
    const { data: emailRecord } = await (cr.from("lifecycle_emails") as any)
      .select("id, user_id")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (!emailRecord) {
      return NextResponse.redirect(`${baseUrl}/unsubscribe?status=error`, 302);
    }

    // Set email_unsubscribed = true on profiles
    await (cr.from("profiles") as any)
      .update({ email_unsubscribed: true })
      .eq("id", emailRecord.user_id);

    // Set unsubscribed_at on lifecycle_emails
    await (cr.from("lifecycle_emails") as any)
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", emailRecord.id);

    // Log event
    await (cr.from("email_events") as any).insert({
      message_id: trackingId,
      event_type: "email.unsubscribed",
      occurred_at: new Date().toISOString(),
      payload: { user_id: emailRecord.user_id },
    });

    return NextResponse.redirect(`${baseUrl}/unsubscribe?status=ok`, 302);
  } catch (e) {
    console.error("[unsubscribe]", e);
    return NextResponse.redirect(`${baseUrl}/unsubscribe?status=error`, 302);
  }
}
