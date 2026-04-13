import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Webhook: sync plan changes from CitationRate → seageo1 profiles.
 *
 * Configure in CitationRate Supabase Dashboard:
 *   Database → Webhooks → New Webhook
 *   Table: profiles | Event: UPDATE (when plan changes)
 *   URL: https://avi.citationrate.com/api/webhooks/sync-plan
 *   Headers: x-webhook-secret: <WEBHOOK_SECRET>
 *
 * Payload (Supabase webhook format):
 *   { type: "UPDATE", table: "profiles", schema: "public",
 *     record: { id, plan, ... }, old_record: { id, plan, ... } }
 *
 * Also accepts direct calls:
 *   { user_id, plan, billing_period_start? }
 */
export async function POST(request: Request) {
  // Verify webhook secret (timing-safe comparison)
  const secret = request.headers.get("x-webhook-secret");
  const expected = Buffer.from(process.env.WEBHOOK_SECRET || "");
  const received = Buffer.from(secret || "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    console.error("[sync-plan] Unauthorized — secret mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Log type only, not full payload (may contain user data)
    console.log("[sync-plan] event type:", body.type ?? "direct-call");

    // Support both Supabase webhook format and direct call format
    let userId: string;
    let newPlan: string;
    let billingPeriodStart: string | null = null;

    if (body.record) {
      // Supabase webhook format: { type, table, record, old_record }
      userId = body.record.id;
      newPlan = body.record.plan;

      // Skip if plan didn't actually change
      if (body.old_record?.plan === newPlan) {
        console.log("[sync-plan] plan unchanged, skipping:", userId);
        return NextResponse.json({ ok: true, skipped: true });
      }
    } else {
      // Direct call format: { user_id, plan, billing_period_start? }
      userId = body.user_id;
      newPlan = body.plan;
      billingPeriodStart = body.billing_period_start ?? null;
    }

    if (!userId || !newPlan) {
      return NextResponse.json({ error: "Missing user_id or plan" }, { status: 400 });
    }

    // Normalize CitationRate plan → AVI plan_id
    // Keep legacy mappings for safety during transition
    const PLAN_MAP: Record<string, string> = {
      demo: "demo",
      free: "demo",
      base: "base",
      pro: "pro",
      agency: "pro",
      enterprise: "enterprise",
    };
    const normalizedPlan = PLAN_MAP[newPlan];
    if (!normalizedPlan) {
      return NextResponse.json({ error: `Invalid plan: ${newPlan}` }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Update plan in seageo1 profiles
    const { error: updateError } = await (supabase.from("profiles") as any)
      .update({ plan: normalizedPlan })
      .eq("id", userId);

    if (updateError) {
      console.error("[sync-plan] update error:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Cycle counters on CitationRate.user_usage are reset by the Stripe suite
    // webhook (checkout.session.completed / invoice.paid). This Supabase
    // database webhook is now plan-shadow-only — no longer touches usage.
    console.log("[sync-plan] updated:", userId, "→", normalizedPlan, "(usage reset is owned by Stripe suite webhook)");
    return NextResponse.json({ ok: true, user_id: userId, plan: normalizedPlan });
  } catch (err) {
    // C8: Always return 200 to prevent retry storms. Log error server-side.
    console.error("[sync-plan] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ received: true, error: "logged" });
  }
}
