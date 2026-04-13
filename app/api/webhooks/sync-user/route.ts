import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
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
  // Verify webhook secret (timing-safe comparison)
  const secret = request.headers.get("x-webhook-secret");
  const expected = Buffer.from(process.env.WEBHOOK_SECRET || "");
  const received = Buffer.from(secret || "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    console.error("[WEBHOOK] Unauthorized — secret mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Log event type only, not full body (contains user data)

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

    console.log("[WEBHOOK] profile synced:", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // C8: Always return 200 to prevent retry storms. Log error server-side.
    console.error("[WEBHOOK] unhandled error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ received: true, error: "logged" });
  }
}
