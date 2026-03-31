import { requireAuth } from "@/lib/api-helpers";
import { createOrder } from "@/lib/paypal";
import { getUserPlanLimits } from "@/lib/usage";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

// Package definitions — must match settings-client.tsx
const PACKAGES: Record<string, {
  name: string;
  price: number;
  plan_required: string;
  browsing_prompts: number;
  no_browsing_prompts: number;
  comparisons: number;
  max_per_month: number | null;
}> = {
  base_100:    { name: "100 Query Extra",    price: 19, plan_required: "base", browsing_prompts: 0,  no_browsing_prompts: 100, comparisons: 0,  max_per_month: 1 },
  base_300:    { name: "300 Query Extra",    price: 49, plan_required: "base", browsing_prompts: 0,  no_browsing_prompts: 300, comparisons: 0,  max_per_month: 1 },
  pro_100:     { name: "100 Query Extra",    price: 29, plan_required: "pro",  browsing_prompts: 30, no_browsing_prompts: 70,  comparisons: 0,  max_per_month: null },
  pro_300:     { name: "300 Query Extra",    price: 89, plan_required: "pro",  browsing_prompts: 90, no_browsing_prompts: 210, comparisons: 0,  max_per_month: null },
  pro_comp_3:  { name: "3 Confronti Extra",  price: 15, plan_required: "pro",  browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 3,  max_per_month: null },
  pro_comp_5:  { name: "5 Confronti Extra",  price: 19, plan_required: "pro",  browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 5,  max_per_month: null },
  pro_comp_10: { name: "10 Confronti Extra", price: 25, plan_required: "pro",  browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 10, max_per_month: null },
};

const schema = z.object({
  packageId: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "packageId richiesto" }, { status: 400 });
    }

    const { packageId } = parsed.data;
    const pkg = PACKAGES[packageId];

    if (!pkg) {
      return NextResponse.json({ error: "Pacchetto non trovato" }, { status: 404 });
    }

    // Validate user plan
    const plan = await getUserPlanLimits(user.id);
    const userPlanId = plan.id ?? "demo";
    if (pkg.plan_required && userPlanId !== pkg.plan_required) {
      return NextResponse.json({
        error: `Questo pacchetto richiede il piano ${pkg.plan_required}.`,
      }, { status: 403 });
    }

    // Check max_per_month limit
    const svc = createServiceClient();
    const period = new Date().toISOString().slice(0, 7);

    if (pkg.max_per_month !== null) {
      const { count } = await (svc.from("package_purchases") as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("package_id", packageId)
        .eq("period", period)
        .eq("status", "completed");

      if ((count ?? 0) >= pkg.max_per_month) {
        return NextResponse.json({
          error: "Hai già acquistato questo pacchetto questo mese.",
        }, { status: 403 });
      }
    }

    // Create PayPal order
    const result = await createOrder(
      pkg.price,
      "EUR",
      pkg.name,
      user.id,
    );

    // Store pending purchase reference
    await (svc.from("package_purchases") as any).insert({
      user_id: user.id,
      package_id: packageId,
      period,
      price_paid: pkg.price,
      paypal_order_id: result.orderId,
      status: "pending",
    });

    return NextResponse.json({
      orderId: result.orderId,
      approvalUrl: result.approvalUrl,
    });
  } catch (err: any) {
    console.error("[paypal/create-order] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella creazione dell'ordine" }, { status: 500 });
  }
}
