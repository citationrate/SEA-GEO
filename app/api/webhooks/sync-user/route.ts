import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Webhook: sync CitationRate auth.users → seageo1 profiles.
 *
 * Configure in CitationRate Supabase Dashboard:
 *   Database → Webhooks → New Webhook
 *   Table: auth.users | Event: INSERT
 *   URL: https://ai.citationrate.com/api/webhooks/sync-user
 *   Headers: x-webhook-secret: <WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Supabase webhook payload: { type, table, record, schema, old_record }
    const record = body.record ?? body;
    const userId = record.id;
    const email = record.email ?? "";
    const fullName = record.raw_user_meta_data?.full_name ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    await (supabase.from("profiles") as any).upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        plan: "demo",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sync-user webhook] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
