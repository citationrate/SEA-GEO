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
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan, is_admin, email, stripe_customer_id")
    .eq("id", user.id)
    .single();

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
    } else {
      params.customer_email = user.email ?? (profile as any)?.email;
    }
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[bp-extras-checkout] Stripe error:", e);
    return apiError(e?.message || "Errore Stripe", 500);
  }
}
