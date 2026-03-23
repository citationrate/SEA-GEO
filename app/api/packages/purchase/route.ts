import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserPlanLimits } from "@/lib/usage";

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
    const effectiveUserPlan = userPlanId === "agency" ? "pro" : userPlanId;

    if (pkg.plan_required && effectiveUserPlan !== pkg.plan_required) {
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

    // Ensure usage_monthly row exists
    const { data: existing } = await (svc.from("usage_monthly") as any)
      .select("extra_browsing_prompts, extra_no_browsing_prompts, extra_comparisons")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle();

    const extraBrowsing = (Number(existing?.extra_browsing_prompts) || 0) + Number(pkg.browsing_prompts);
    const extraNoBrowsing = (Number(existing?.extra_no_browsing_prompts) || 0) + Number(pkg.no_browsing_prompts);
    const extraComparisons = (Number(existing?.extra_comparisons) || 0) + Number(pkg.comparisons);

    if (existing) {
      await (svc.from("usage_monthly") as any)
        .update({
          extra_browsing_prompts: extraBrowsing,
          extra_no_browsing_prompts: extraNoBrowsing,
          extra_comparisons: extraComparisons,
        })
        .eq("user_id", user.id)
        .eq("period", period);
    } else {
      await (svc.from("usage_monthly") as any)
        .insert({
          user_id: user.id,
          period,
          browsing_prompts_used: 0,
          no_browsing_prompts_used: 0,
          prompts_used: 0,
          comparisons_used: 0,
          extra_browsing_prompts: Number(pkg.browsing_prompts),
          extra_no_browsing_prompts: Number(pkg.no_browsing_prompts),
          extra_comparisons: Number(pkg.comparisons),
        });
    }

    // Record purchase
    await (svc.from("package_purchases") as any).insert({
      user_id: user.id,
      package_id,
      period,
      price_paid: Number(pkg.price),
    });

    return NextResponse.json({
      ok: true,
      extra_browsing_prompts: extraBrowsing,
      extra_no_browsing_prompts: extraNoBrowsing,
      extra_comparisons: extraComparisons,
    });
  } catch (err) {
    console.error("[packages/purchase] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
