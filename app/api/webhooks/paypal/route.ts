import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  PLAN_MAP,
  getBillingCycleFromPlanId,
  getSubscriptionDetails,
} from "@/lib/paypal";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(headers, rawBody);
    if (!isValid) {
      console.error("[webhooks/paypal] Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type as string;
    const resource = event.resource;

    console.log("[webhooks/paypal] Event:", eventType, "Resource ID:", resource?.id);

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionActivated(resource);
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await handleSubscriptionCancelled(resource);
        break;

      case "BILLING.SUBSCRIPTION.UPDATED":
        await handleSubscriptionUpdated(resource);
        break;

      case "PAYMENT.CAPTURE.COMPLETED":
        await handlePaymentCompleted(resource);
        break;

      default:
        console.log("[webhooks/paypal] Unhandled event type:", eventType);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhooks/paypal] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ─── Event Handlers ─── */

async function handleSubscriptionActivated(resource: any) {
  const subscriptionId = resource.id;
  const userId = resource.custom_id; // set during createSubscription
  const planId = resource.plan_id;

  if (!userId || !planId) {
    // Try to get details from PayPal
    const details = await getSubscriptionDetails(subscriptionId);
    const resolvedUserId = details.custom_id || userId;
    const resolvedPlanId = details.plan_id || planId;
    if (!resolvedUserId) {
      console.error("[webhooks/paypal] No user_id in subscription:", subscriptionId);
      return;
    }
    await activateSubscription(resolvedUserId, subscriptionId, resolvedPlanId);
    return;
  }

  await activateSubscription(userId, subscriptionId, planId);
}

async function activateSubscription(
  userId: string,
  subscriptionId: string,
  planId: string,
) {
  const newPlan = PLAN_MAP[planId];
  if (!newPlan) {
    console.error("[webhooks/paypal] Unknown plan_id:", planId);
    return;
  }

  const billingCycle = getBillingCycleFromPlanId(planId);
  const cr = createCitationRateServiceClient();

  // Update CitationRate profiles — Supabase webhook auto-syncs to AVI
  const { error } = await (cr.from("profiles") as any)
    .update({
      plan: newPlan,
      paypal_subscription_id: subscriptionId,
      subscription_status: "active",
      subscription_plan: planId,
      subscription_period: billingCycle,
    })
    .eq("id", userId);

  if (error) {
    console.error("[webhooks/paypal] Failed to update profile:", error.message);
  } else {
    console.log("[webhooks/paypal] Subscription activated:", userId, "→", newPlan, billingCycle);
  }
}

async function handleSubscriptionCancelled(resource: any) {
  const subscriptionId = resource.id;
  const cr = createCitationRateServiceClient();

  // Find user by subscription ID
  const { data: profile } = await (cr.from("profiles") as any)
    .select("id")
    .eq("paypal_subscription_id", subscriptionId)
    .single();

  if (!profile) {
    console.error("[webhooks/paypal] No profile for subscription:", subscriptionId);
    return;
  }

  // Downgrade to demo — Supabase webhook auto-syncs to AVI
  const { error } = await (cr.from("profiles") as any)
    .update({
      plan: "demo",
      subscription_status: "cancelled",
    })
    .eq("id", profile.id);

  if (error) {
    console.error("[webhooks/paypal] Failed to cancel:", error.message);
  } else {
    console.log("[webhooks/paypal] Subscription cancelled:", profile.id);
  }
}

async function handleSubscriptionUpdated(resource: any) {
  const subscriptionId = resource.id;
  const planId = resource.plan_id;
  const cr = createCitationRateServiceClient();

  const { data: profile } = await (cr.from("profiles") as any)
    .select("id, subscription_plan")
    .eq("paypal_subscription_id", subscriptionId)
    .single();

  if (!profile) return;

  // Only update if plan actually changed
  if (planId && planId !== profile.subscription_plan) {
    const newPlan = PLAN_MAP[planId];
    if (newPlan) {
      const billingCycle = getBillingCycleFromPlanId(planId);
      await (cr.from("profiles") as any)
        .update({
          plan: newPlan,
          subscription_plan: planId,
          subscription_period: billingCycle,
        })
        .eq("id", profile.id);

      console.log("[webhooks/paypal] Subscription updated:", profile.id, "→", newPlan);
    }
  }
}

async function handlePaymentCompleted(resource: any) {
  // This handles one-time package payments confirmed via webhook
  // The main flow uses capture-order API route, but this is a fallback
  const orderId = resource.supplementary_data?.related_ids?.order_id;
  if (!orderId) return;

  const svc = createServiceClient();

  // Check if purchase already completed (via capture-order route)
  const { data: purchase } = await (svc.from("package_purchases") as any)
    .select("id, status")
    .eq("paypal_order_id", orderId)
    .single();

  if (!purchase || purchase.status === "completed") return;

  // Mark as completed — credits were already applied during capture
  await (svc.from("package_purchases") as any)
    .update({ status: "completed" })
    .eq("id", purchase.id);

  console.log("[webhooks/paypal] Payment completed for order:", orderId);
}
