import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpAccessAllowed } from "@/lib/brand-profile/plans";
import { getBpExtraPack, bpExtraPriceIdFromPack } from "@/lib/brand-profile/extra-packs";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ pack_id: z.string().min(1).max(40) });

/**
 * Creates a Stripe Checkout (mode=payment) for a BP extra-runs pack.
 *
 * Validation enforces that the requested pack is in scope for the user's
 * current plan: the metadata is informational, but the checkout's price ID
 * is resolved server-side from the catalog so the user can't tamper.
 *
 * Successful payment lands on POST /api/webhooks/stripe (already wired for
 * AVI one-time purchases) which dispatches to the BP extras handler when
 * `metadata.type === "bp_extra"`.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return apiError("Payload non valido", 400);
  }

  const cr = createCitationRateServiceClient();
  // NB: profiles has no `email` column — the auth email lives on
  // auth.users.email and we already have it via the requireAuth() user
  // object. Including a non-existent column makes PostgREST 400 the
  // whole row, so `profile` falls back to null and the plan check below
  // misreads everyone as "demo" → 403 "riservato al piano PRO".
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan, is_admin, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!bpAccessAllowed({ email: user.email, isAdmin: (profile as any)?.is_admin })) {
    return apiError("Brand Profile non disponibile durante il soft launch", 403);
  }

  const plan = (profile?.plan as string | undefined)?.toLowerCase() ?? "demo";
  const pack = getBpExtraPack(body.pack_id);
  if (!pack) return apiError("Pacchetto non trovato", 400);
  if (pack.plan !== plan) {
    return apiError(
      `Questo pacchetto è riservato al piano ${pack.plan.toUpperCase()}. Il tuo piano attuale è ${plan.toUpperCase()}.`,
      403,
    );
  }

  const priceId = bpExtraPriceIdFromPack(pack);
  if (!priceId) return apiError("Prezzo non configurato — contatta il supporto", 500);

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://avi.citationrate.com";

  const successUrl = `${origin}/brand-profile/piano?bp_extras=success&pack=${pack.id}`;
  const cancelUrl = `${origin}/brand-profile/piano?bp_extras=cancel`;

  try {
    const stripe = getStripe();
    const params: any = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        type: "bp_extra",
        pack_id: pack.id,
        plan_at_purchase: plan,
      },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
    };
    const stripeCustomerId = (profile as any)?.stripe_customer_id as string | undefined;
    if (stripeCustomerId) {
      params.customer = stripeCustomerId;
      params.customer_update = { address: "auto", name: "auto" };
    } else if (user.email) {
      params.customer_email = user.email;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (createErr: any) {
      // Recover from a stale stripe_customer_id (test-mode leftover from
      // the test→live migration, or a customer deleted in the dashboard).
      // Stripe surfaces this as a "No such customer: 'cus_xxx'" 400. We
      // null the bad ID on the profile and retry once with customer_email
      // so the user can complete the purchase without a manual support
      // ticket. A future invoice webhook will repopulate stripe_customer_id
      // with the new live customer Stripe creates for this checkout.
      const msg = String(createErr?.message || "");
      const isMissingCustomer =
        createErr?.code === "resource_missing" ||
        /no such customer/i.test(msg);
      if (!isMissingCustomer || !stripeCustomerId) throw createErr;

      console.warn("[bp-extras-checkout] Stale stripe_customer_id, recovering:", {
        userId: user.id,
        badCustomer: stripeCustomerId,
      });
      await (cr.from("profiles") as any)
        .update({ stripe_customer_id: null })
        .eq("id", user.id);

      delete params.customer;
      delete params.customer_update;
      if (user.email) params.customer_email = user.email;
      session = await stripe.checkout.sessions.create(params);
    }

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[bp-extras-checkout] Stripe error:", e);
    return apiError(e?.message || "Errore Stripe", 500);
  }
}
