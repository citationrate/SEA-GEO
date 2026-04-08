import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserPlanLimits, addToWallet } from "@/lib/usage";

// TODO: Integrate Stripe for real payments — currently purchase is simulated (admin grants via SQL)

const purchaseSchema = z.object({
  package_id: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { package_id } = parsed.data;
    const svc = createServiceClient();
    const period = new Date().toISOString().slice(0, 7);

    // Fetch package
    const { data: pkg } = await (svc.from("packages") as any)
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "Pacchetto non trovato." }, { status: 404 });
    }

    // Validate user plan matches package requirement
    const plan = await getUserPlanLimits(user.id);
    const userPlanId = plan.id ?? "demo";
    if (pkg.plan_required && userPlanId !== pkg.plan_required) {
      return NextResponse.json({
        error: `Questo pacchetto richiede il piano ${pkg.plan_required}.`,
      }, { status: 403 });
    }

    // Check max_per_month limit (Base packages)
    if (pkg.max_per_month !== null) {
      const { count } = await (svc.from("package_purchases") as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("package_id", package_id)
        .eq("period", period);

      if ((count ?? 0) >= Number(pkg.max_per_month)) {
        return NextResponse.json({
          error: "Hai già acquistato questo pacchetto questo mese.",
        }, { status: 403 });
      }
    }

    // Add purchased credits to the AVI wallet (seageo1.query_wallet) — same path
    // used by the Stripe webhook on AVI domain for real package purchases.
    await addToWallet(
      user.id,
      Number(pkg.browsing_prompts) || 0,
      Number(pkg.no_browsing_prompts) || 0,
      Number(pkg.comparisons) || 0,
    );

    // Record purchase log (seageo1.package_purchases)
    await (svc.from("package_purchases") as any).insert({
      user_id: user.id,
      package_id,
      period,
      price_paid: Number(pkg.price),
    });

    return NextResponse.json({
      ok: true,
      added_browsing: Number(pkg.browsing_prompts) || 0,
      added_no_browsing: Number(pkg.no_browsing_prompts) || 0,
      added_comparisons: Number(pkg.comparisons) || 0,
    });
  } catch (err) {
    console.error("[packages/purchase] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
