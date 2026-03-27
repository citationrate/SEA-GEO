import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getSubscription } from "@/lib/stripe/client";

export async function GET() {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("plan, stripe_subscription_id, subscription_status, subscription_period, stripe_customer_id")
      .eq("id", user!.id)
      .single();

    const p = profile as any;
    const subId = p?.stripe_subscription_id;

    let nextBillingDate: string | null = null;
    let cancelAtPeriodEnd = false;

    if (subId) {
      try {
        const sub = await getSubscription(subId) as any;
        nextBillingDate = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
      } catch {
        // Subscription may have been deleted on Stripe side
      }
    }

    return NextResponse.json({
      plan: p?.plan || "demo",
      subscription_status: p?.subscription_status || "inactive",
      subscription_period: p?.subscription_period || null,
      stripe_subscription_id: subId || null,
      stripe_customer_id: p?.stripe_customer_id || null,
      next_billing_date: nextBillingDate,
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  } catch (err: any) {
    console.error("[subscription-status]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
