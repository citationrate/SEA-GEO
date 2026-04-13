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
    await handleCheckoutCompleted(event.id, event.data.object as Stripe.Checkout.Session);
  } catch (err: any) {
    // C8: Always return 200 to prevent Stripe retry storms. Log error server-side.
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ received: true, error: "logged" });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(eventId: string, session: Stripe.Checkout.Session) {
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

  // C3: Idempotency check — skip if this Stripe event was already processed.
  const { data: existingPurchase } = await (svc.from("package_purchases") as any)
    .select("id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();
  if (existingPurchase) {
    console.log("[stripe-webhook] Duplicate event, already processed:", eventId);
    return;
  }

  // Record purchase on seageo1 (include stripe_event_id for idempotency).
  const { error } = await (svc.from("package_purchases") as any).insert({
    user_id: userId,
    stripe_payment_intent_id: session.payment_intent as string,
    stripe_event_id: eventId,
    queries_added: details.queries_added,
    package_type: details.package_type,
    status: "completed",
  });
  if (error) {
    // If insert fails due to duplicate stripe_event_id (unique constraint), it's idempotent — skip.
    if (error.code === "23505") {
      console.log("[stripe-webhook] Duplicate insert (unique constraint), skipping:", eventId);
      return;
    }
    console.error("[stripe-webhook] package_purchases insert error:", error);
  }

  // H2: Credit the query wallet with error handling for manual recovery.
  const pt = details.package_type;
  const isCompare = pt.startsWith("confronti");
  const isPro = pt.startsWith("queries_pro");
  const isBase = pt.startsWith("queries_base");

  try {
    await addToWallet(
      userId,
      isPro ? details.queries_added : 0,
      isBase ? details.queries_added : 0,
      isCompare ? details.queries_added : 0,
    );
    console.log(`[stripe-webhook] Wallet credited: ${details.package_type} (+${details.queries_added})`);
  } catch (walletErr) {
    // Log all details for manual recovery — user paid but wallet credit failed.
    console.error("[stripe-webhook] CRITICAL: Wallet credit failed after payment!", {
      eventId,
      userId,
      paymentIntent: session.payment_intent,
      packageType: details.package_type,
      queriesAdded: details.queries_added,
      error: walletErr instanceof Error ? walletErr.message : walletErr,
    });
    // Do NOT rethrow — return 200 so Stripe doesn't retry (would create duplicate purchase).
  }
}
