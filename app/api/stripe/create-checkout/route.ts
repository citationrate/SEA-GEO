import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createSubscriptionCheckout, createOneTimeCheckout, isPackagePrice } from "@/lib/stripe/client";
import { z } from "zod";

const schema = z.object({
  priceId: z.string().min(1),
  mode: z.enum(["subscription", "payment"]),
  quantity: z.number().int().positive().optional().default(1),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const { priceId, mode } = parsed.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";
    const successUrl = `${appUrl}/piano?success=true`;
    const cancelUrl = `${appUrl}/piano?cancelled=true`;

    // Get stripe_customer_id if exists
    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("stripe_customer_id")
      .eq("id", user!.id)
      .single();
    const stripeCustomerId = profile?.stripe_customer_id || undefined;

    let session;
    if (mode === "subscription") {
      session = await createSubscriptionCheckout(user!.id, user!.email!, priceId, successUrl, cancelUrl, stripeCustomerId);
    } else {
      if (!isPackagePrice(priceId)) {
        return NextResponse.json({ error: "Invalid package price" }, { status: 400 });
      }
      session = await createOneTimeCheckout(user!.id, user!.email!, priceId, successUrl, cancelUrl, stripeCustomerId);
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[create-checkout]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
