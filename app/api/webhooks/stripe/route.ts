import { NextResponse } from "next/server";
import { getStripe, isPackagePrice, packageDetailsFromPriceId } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";
import { addToWallet } from "@/lib/usage";
import type Stripe from "stripe";

/**
 * AVI Stripe webhook.
 *
 * Scope (post-unification 2026-04-08):
 *  - Handles ONLY one-time payments (mode=payment) for AVI query packages,
 *    crediting seageo1.query_wallet via addToWallet().
 *  - Subscriptions, plan changes, and CitationRate extra-audit/unlock packages
 *    are owned by the suite webhook at suite.citationrate.com — this handler
 *    must stay out of that flow.
 *  - Any other event type returns 200 immediately so Stripe does not retry.
 *
 * Signature is verified with STRIPE_WEBHOOK_SECRET (the pre-existing AVI
 * endpoint secret), NOT the new suite secret.
 */

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

  // Only checkout.session.completed for one-time AVI package payments is
  // in-scope for this webhook. Everything else: ack and ignore.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  } catch (err: any) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[stripe-webhook] checkout.session.completed, mode:", session.mode);

  // Never credit unpaid sessions (e.g. async payment methods still pending).
  if (session.payment_status !== "paid") {
    console.log("[stripe-webhook] Ignoring unpaid session, status:", session.payment_status);
    return;
  }

  // Subscriptions are owned by the suite webhook — ignore here.
  if (session.mode !== "payment") {
    console.log("[stripe-webhook] Ignoring non-payment session (handled by suite webhook)");
    return;
  }

  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error("[stripe-webhook] No user_id in checkout metadata");
    return;
  }

  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id);
  const priceId = lineItems.data[0]?.price?.id;
  if (!priceId || !isPackagePrice(priceId)) {
    console.log("[stripe-webhook] Not an AVI package price, ignoring:", priceId);
    return;
  }

  const details = packageDetailsFromPriceId(priceId);
  if (!details) return;

  // CitationRate packages are fulfilled by the suite webhook.
  if (details.platform !== "avi") {
    console.log("[stripe-webhook] Non-AVI package, ignoring (handled by suite webhook):", details.package_type);
    return;
  }

  const svc = createServiceClient();

  // Record purchase on seageo1.
  const { error } = await (svc.from("package_purchases") as any).insert({
    user_id: userId,
    stripe_payment_intent_id: session.payment_intent as string,
    queries_added: details.queries_added,
    package_type: details.package_type,
    status: "completed",
  });
  if (error) console.error("[stripe-webhook] package_purchases insert error:", error);

  // Credit the query wallet (never expires).
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

  console.log(`[stripe-webhook] Wallet credited: ${details.package_type} (+${details.queries_added})`);
}
