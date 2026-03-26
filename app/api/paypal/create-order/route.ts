import { requireAuth } from "@/lib/api-helpers";
import { createOrder } from "@/lib/paypal";
import { getUserPlanLimits } from "@/lib/usage";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

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
    const svc = createServiceClient();

    // Fetch package from DB
    const { data: pkg } = await (svc.from("packages") as any)
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "Pacchetto non trovato" }, { status: 404 });
    }

    // Validate user plan
    const plan = await getUserPlanLimits(user.id);
    const userPlanId = plan.id ?? "demo";
    const effectiveUserPlan = userPlanId === "agency" ? "pro" : userPlanId;

    if (pkg.plan_required && effectiveUserPlan !== pkg.plan_required) {
      return NextResponse.json({
        error: `Questo pacchetto richiede il piano ${pkg.plan_required}.`,
      }, { status: 403 });
    }

    // Check max_per_month limit
    if (pkg.max_per_month !== null) {
      const period = new Date().toISOString().slice(0, 7);
      const { count } = await (svc.from("package_purchases") as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("package_id", packageId)
        .eq("period", period);

      if ((count ?? 0) >= Number(pkg.max_per_month)) {
        return NextResponse.json({
          error: "Hai già acquistato questo pacchetto questo mese.",
        }, { status: 403 });
      }
    }

    // Create PayPal order
    const result = await createOrder(
      Number(pkg.price),
      "EUR",
      pkg.name || `Pacchetto ${packageId}`,
      user.id,
    );

    // Store pending purchase reference
    const period = new Date().toISOString().slice(0, 7);
    await (svc.from("package_purchases") as any).insert({
      user_id: user.id,
      package_id: packageId,
      period,
      price_paid: Number(pkg.price),
      paypal_order_id: result.orderId,
      status: "pending",
    });

    return NextResponse.json({
      orderId: result.orderId,
      approvalUrl: result.approvalUrl,
    });
  } catch (err) {
    console.error("[paypal/create-order] error:", err);
    return NextResponse.json({ error: "Errore nella creazione dell'ordine" }, { status: 500 });
  }
}
