import { NextResponse } from "next/server";
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
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.error("[sync-plan] Unauthorized — secret mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("[sync-plan] payload:", JSON.stringify(body).slice(0, 500));

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

    // Reset usage counters for current period on plan change
    const period = billingPeriodStart
      ? billingPeriodStart.slice(0, 7)
      : new Date().toISOString().slice(0, 7);

    // Check if row exists for this period
    const { data: existing } = await (supabase.from("usage_monthly") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("period", period)
      .maybeSingle();

    let usageError;
    if (existing) {
      ({ error: usageError } = await (supabase.from("usage_monthly") as any)
        .update({
          browsing_prompts_used: 0,
          no_browsing_prompts_used: 0,
          comparisons_used: 0,
          prompts_used: 0,
        })
        .eq("user_id", userId)
        .eq("period", period));
    } else {
      ({ error: usageError } = await (supabase.from("usage_monthly") as any)
        .insert({
          user_id: userId,
          period,
          browsing_prompts_used: 0,
          no_browsing_prompts_used: 0,
          comparisons_used: 0,
          prompts_used: 0,
        }));
    }

    if (usageError) {
      console.error("[sync-plan] usage reset error:", usageError.message);
    } else {
      console.log("[sync-plan] usage reset for period:", period, "user:", userId);
    }

    console.log("[sync-plan] updated:", userId, "→", normalizedPlan);
    return NextResponse.json({ ok: true, user_id: userId, plan: normalizedPlan });
  } catch (err) {
    console.error("[sync-plan] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
