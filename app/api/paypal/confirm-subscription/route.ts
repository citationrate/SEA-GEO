import { requireAuth } from "@/lib/api-helpers";
import { getSubscriptionDetails, PLAN_MAP, getBillingCycleFromPlanId } from "@/lib/paypal";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  subscriptionId: z.string().min(1),
});

/**
 * Called from the success page after PayPal redirects back.
 * Fetches subscription details from PayPal and activates the plan
 * immediately — doesn't wait for the webhook.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "subscriptionId richiesto" }, { status: 400 });
    }

    const { subscriptionId } = parsed.data;

    // Fetch subscription details from PayPal
    const details = await getSubscriptionDetails(subscriptionId);

    if (details.status !== "ACTIVE" && details.status !== "APPROVAL_PENDING") {
      return NextResponse.json({
        error: "Abbonamento non attivo",
        status: details.status,
      }, { status: 400 });
    }

    // Verify this subscription belongs to the current user
    if (details.custom_id && details.custom_id !== user.id) {
      return NextResponse.json({ error: "Abbonamento non associato a questo utente" }, { status: 403 });
    }

    const planId = details.plan_id;
    const newPlan = PLAN_MAP[planId];

    if (!newPlan) {
      console.error("[confirm-subscription] Unknown plan_id:", planId);
      return NextResponse.json({ error: "Piano non riconosciuto" }, { status: 400 });
    }

    const billingCycle = getBillingCycleFromPlanId(planId);

    // Update CitationRate profiles
    const cr = createCitationRateServiceClient();
    await (cr.from("profiles") as any)
      .update({
        plan: newPlan,
        paypal_subscription_id: subscriptionId,
        subscription_status: "active",
        subscription_plan: planId,
        subscription_period: billingCycle,
      })
      .eq("id", user.id);

    // Also update seageo1 profiles directly (don't wait for webhook sync)
    const svc = createServiceClient();
    await (svc.from("profiles") as any)
      .update({ plan: newPlan })
      .eq("id", user.id);

    // PayPal flow is deprecated post-unification (2026-04-08). Cycle counters
    // now live on CitationRate.user_usage and are reset by the Stripe suite
    // webhook on checkout.session.completed / invoice.paid. The legacy
    // seageo1.usage_monthly table was dropped — no usage write here.
    console.log("[confirm-subscription] Activated:", user.id, "→", newPlan, billingCycle, "(legacy PayPal path, no usage write)");

    return NextResponse.json({
      ok: true,
      plan: newPlan,
      billingCycle,
      subscriptionStatus: details.status,
    });
  } catch (err: any) {
    console.error("[confirm-subscription] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella conferma dell'abbonamento" }, { status: 500 });
  }
}
