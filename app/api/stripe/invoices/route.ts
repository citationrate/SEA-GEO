import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getStripe } from "@/lib/stripe/client";

export async function GET() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {
    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("stripe_customer_id")
      .eq("id", user!.id)
      .single();

    const customerId = profile?.stripe_customer_id;
    if (!customerId) return NextResponse.json([]);

    const invoices = await getStripe().invoices.list({
      customer: customerId,
      limit: 10,
    });

    const result = invoices.data.map((inv) => ({
      id: inv.id,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      amount: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency ?? "eur",
      status: inv.status,
      pdf_url: inv.invoice_pdf ?? null,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[stripe/invoices]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
