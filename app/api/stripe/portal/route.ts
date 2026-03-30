import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getStripe } from "@/lib/stripe/client";

export async function POST() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {
    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("stripe_customer_id")
      .eq("id", user!.id)
      .single();

    const customerId = profile?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json({ error: "Nessun account Stripe collegato" }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com"}/piano`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe/portal]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
