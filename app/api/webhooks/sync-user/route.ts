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
  const hasSecret = !!process.env.WEBHOOK_SECRET;
  console.log("[WEBHOOK] sync-user called, secret match:", secret === process.env.WEBHOOK_SECRET, "| env var set:", hasSecret);
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.error("[WEBHOOK] Unauthorized — received secret:", secret?.slice(0, 8) + "...", "| env var set:", hasSecret);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("[WEBHOOK] sync-user body:", JSON.stringify(body).slice(0, 500));

    // Supabase webhook payload: { type, table, record, schema, old_record }
    const record = body.record ?? body;
    const userId = record.id;
    const email = record.email ?? "";
    const fullName = record.raw_user_meta_data?.full_name ?? null;

    if (!userId) {
      console.error("[WEBHOOK] Missing user id in payload");
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if a profile already exists for this email (prevents duplicates
    // when auth.users has multiple entries for the same email)
    if (email) {
      const { data: existing } = await (supabase.from("profiles") as any)
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (existing && existing.id !== userId) {
        console.warn(`[WEBHOOK] Profile already exists for email=${email} with id=${existing.id}, skipping creation for auth id=${userId}`);
        return NextResponse.json({ ok: true, note: "profile already exists for email" });
      }
    }

    const { error: upsertError } = await (supabase.from("profiles") as any).upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        plan: "demo",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (upsertError) {
      console.error("[WEBHOOK] upsert error:", upsertError.message, upsertError.code, upsertError.details);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("[WEBHOOK] profile synced:", userId, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] unhandled error:", err instanceof Error ? err.message : err);
    console.error("[WEBHOOK] stack:", err instanceof Error ? err.stack : "N/A");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
