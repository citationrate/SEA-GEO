import { NextResponse } from "next/server";
import { getStripe, planFromPriceId, isPackagePrice, packageDetailsFromPriceId } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { addToWallet } from "@/lib/usage";
import type Stripe from "stripe";

/* ─── Supabase clients ─── */

/** CitationRate project (tzcxlchrcspqsayehrky) — auth + profiles */
function getCitationRateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing CitationRate env vars");
  return createClient(url, key);
}

/** seageo1 project (ubvkzstxviqwgufppiko) — data */
function getSeageo1Client() {
  return createServiceClient();
}

/* ─── Webhook handler ─── */

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/* ─── Event handlers ─── */

async function updateProfiles(userId: string, data: Record<string, unknown>) {
  console.log("[stripe-webhook] updateProfiles userId:", userId, "data:", JSON.stringify(data));

  // Update on CitationRate (has all Stripe columns)
  const cr = getCitationRateClient();
  // Ensure profile exists on CitationRate before updating
  const { data: crProfile } = await cr.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!crProfile) {
    console.log("[stripe-webhook] CitationRate profile missing, creating for:", userId);
    const { error: createErr } = await cr.from("profiles").insert({ id: userId, plan: data.plan ?? "demo", ...data } as any);
    if (createErr) console.error("[stripe-webhook] CitationRate profile create error:", createErr);
    else console.log("[stripe-webhook] CitationRate profile created OK");
  } else {
    const { error: crErr } = await cr.from("profiles").update(data as any).eq("id", userId);
    if (crErr) console.error("[stripe-webhook] CitationRate update error:", crErr);
    else console.log("[stripe-webhook] CitationRate profile updated OK");
  }

  // Update on seageo1 (try all columns, fallback to plan-only if columns don't exist yet)
  const svc = getSeageo1Client();
  const { error: sgErr } = await (svc.from("profiles") as any).update(data).eq("id", userId);
  if (sgErr) {
    console.warn("[stripe-webhook] seageo1 full update failed, trying plan-only:", sgErr.message);
    if ("plan" in data) {
      const { error: sgErr2 } = await (svc.from("profiles") as any).update({ plan: data.plan }).eq("id", userId);
      if (sgErr2) console.error("[stripe-webhook] seageo1 plan-only update error:", sgErr2);
      else console.log("[stripe-webhook] seageo1 plan updated to:", data.plan);
    }
  } else {
    console.log("[stripe-webhook] seageo1 profile updated OK");
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[stripe-webhook] checkout.session.completed, session:", session.id, "mode:", session.mode);
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error("[stripe-webhook] No user_id in checkout metadata");
    return;
  }

  if (session.mode === "subscription") {
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const priceId = sub.items.data[0]?.price.id;
    console.log("[stripe-webhook] subscription priceId:", priceId, "envPro:", process.env.STRIPE_PRICE_PRO_MONTHLY);
    const mapping = priceId ? planFromPriceId(priceId) : null;
    console.log("[stripe-webhook] mapping:", JSON.stringify(mapping));

    if (!mapping) {
      console.error("[stripe-webhook] Unknown price ID:", priceId);
      return;
    }

    await updateProfiles(userId, {
      plan: mapping.plan,
      subscription_status: "active",
      subscription_period: mapping.period,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    });

    console.log(`[stripe-webhook] Activated ${mapping.plan}/${mapping.period} for user ${userId}`);
  } else if (session.mode === "payment") {
    console.log("[stripe-webhook] one-time payment session:", session.id, "metadata:", JSON.stringify(session.metadata));
    const lineItems = await getStripe().checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;
    console.log("[stripe-webhook] package priceId:", priceId);
    if (!priceId || !isPackagePrice(priceId)) {
      console.error("[stripe-webhook] Unknown package price:", priceId);
      return;
    }

    const details = packageDetailsFromPriceId(priceId);
    if (!details) return;
    console.log("[stripe-webhook] package details:", JSON.stringify(details));

    if (details.platform === "citationrate") {
      // ── CitationRate packages: update CitationRate DB ──
      await handleCitationRatePackage(userId, session.payment_intent as string, details);
    } else {
      // ── AVI packages: update seageo1 wallet ──
      const svc = getSeageo1Client();

      // Record purchase
      const { error } = await (svc.from("package_purchases") as any).insert({
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent as string,
        queries_added: details.queries_added,
        package_type: details.package_type,
        status: "completed",
      });
      if (error) console.error("[stripe-webhook] package_purchases insert error:", error);

      // Add to query wallet (never expires)
      const pt = details.package_type;
      const isCompare = pt.startsWith("confronti");
      const isPro = pt.startsWith("queries_pro");
      const isBase = pt.startsWith("queries_base");

      await addToWallet(
        userId,
        isPro ? details.queries_added : 0,
        isBase ? details.queries_added : 0,
        isCompare ? details.queries_added : 0,
      );

      console.log(`[stripe-webhook] Added to wallet: ${details.package_type} (+${details.queries_added}) for user ${userId}`);
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const mapping = priceId ? planFromPriceId(priceId) : null;

  if (subscription.status === "active" && mapping) {
    await updateProfiles(userId, {
      plan: mapping.plan,
      subscription_status: "active",
      subscription_period: mapping.period,
      stripe_subscription_id: subscription.id,
    });
  } else if (subscription.status === "past_due") {
    await updateProfiles(userId, { subscription_status: "past_due" });
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    await updateProfiles(userId, {
      plan: "demo",
      subscription_status: "inactive",
      subscription_period: null,
      stripe_subscription_id: null,
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  await updateProfiles(userId, {
    plan: "demo",
    subscription_status: "inactive",
    subscription_period: null,
    stripe_subscription_id: null,
  });

  console.log(`[stripe-webhook] Subscription deleted, reverted to free for user ${userId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null;
  if (!subscriptionId) return;

  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const userId = sub.metadata?.user_id;
  if (!userId) return;

  await updateProfiles(userId, { subscription_status: "past_due" });
  console.log(`[stripe-webhook] Payment failed, set past_due for user ${userId}`);
}

/* ─── CitationRate package fulfillment ─── */

async function handleCitationRatePackage(
  userId: string,
  paymentIntentId: string,
  details: { queries_added: number; package_type: string; platform: string },
) {
  const cr = getCitationRateClient();

  if (details.package_type === "cr_extra_unlock") {
    // Unlock 56 parameters for the next audit
    await cr.from("profiles").update({
      full_params_unlocked: true,
    } as any).eq("id", userId);
    console.log(`[stripe-webhook] CitationRate: unlocked 56 params for user ${userId}`);
  } else {
    // Extra audits (cr_extra_5 or cr_extra_10)
    // Read current extra_audits, then add
    const { data: profile } = await cr.from("profiles").select("extra_audits").eq("id", userId).single();
    const current = Number((profile as any)?.extra_audits) || 0;
    await cr.from("profiles").update({
      extra_audits: current + details.queries_added,
    } as any).eq("id", userId);
    console.log(`[stripe-webhook] CitationRate: added ${details.queries_added} extra audits for user ${userId} (now ${current + details.queries_added})`);
  }

  console.log(`[stripe-webhook] CitationRate package fulfilled: ${details.package_type} for user ${userId}`);
}
