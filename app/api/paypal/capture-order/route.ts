import { requireAuth } from "@/lib/api-helpers";
import { captureOrder } from "@/lib/paypal";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

// Package definitions — must match create-order/route.ts
const PACKAGES: Record<string, {
  browsing_prompts: number;
  no_browsing_prompts: number;
  comparisons: number;
}> = {
  base_100:    { browsing_prompts: 0,  no_browsing_prompts: 100, comparisons: 0 },
  base_300:    { browsing_prompts: 0,  no_browsing_prompts: 300, comparisons: 0 },
  pro_100:     { browsing_prompts: 30, no_browsing_prompts: 70,  comparisons: 0 },
  pro_300:     { browsing_prompts: 90, no_browsing_prompts: 210, comparisons: 0 },
  pro_comp_3:  { browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 3 },
  pro_comp_5:  { browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 5 },
  pro_comp_10: { browsing_prompts: 0,  no_browsing_prompts: 0,   comparisons: 10 },
};

const schema = z.object({
  orderId: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "orderId richiesto" }, { status: 400 });
    }

    const { orderId } = parsed.data;

    // Capture payment on PayPal
    const capture = await captureOrder(orderId);
    if (capture.status !== "COMPLETED") {
      return NextResponse.json({ error: "Pagamento non completato" }, { status: 400 });
    }

    const svc = createServiceClient();

    // Find the pending purchase
    const { data: purchase } = await (svc.from("package_purchases") as any)
      .select("*")
      .eq("paypal_order_id", orderId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();

    if (!purchase) {
      return NextResponse.json({ error: "Acquisto non trovato" }, { status: 404 });
    }

    // Lookup package credits
    const pkg = PACKAGES[purchase.package_id];
    if (!pkg) {
      // Fallback: mark as completed anyway (payment was captured)
      await (svc.from("package_purchases") as any)
        .update({ status: "completed" })
        .eq("id", purchase.id);
      return NextResponse.json({ error: "Pacchetto non riconosciuto, pagamento registrato" }, { status: 400 });
    }

    // Credit package to user's usage
    const period = purchase.period;
    const { data: existing } = await (svc.from("usage_monthly") as any)
      .select("extra_browsing_prompts, extra_no_browsing_prompts, extra_comparisons")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle();

    const extraBrowsing = (Number(existing?.extra_browsing_prompts) || 0) + pkg.browsing_prompts;
    const extraNoBrowsing = (Number(existing?.extra_no_browsing_prompts) || 0) + pkg.no_browsing_prompts;
    const extraComparisons = (Number(existing?.extra_comparisons) || 0) + pkg.comparisons;

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
          extra_browsing_prompts: pkg.browsing_prompts,
          extra_no_browsing_prompts: pkg.no_browsing_prompts,
          extra_comparisons: pkg.comparisons,
        });
    }

    // Mark purchase as completed
    await (svc.from("package_purchases") as any)
      .update({ status: "completed" })
      .eq("id", purchase.id);

    console.log("[capture-order] Package credited:", purchase.package_id, "user:", user.id);

    return NextResponse.json({
      ok: true,
      extra_browsing_prompts: extraBrowsing,
      extra_no_browsing_prompts: extraNoBrowsing,
      extra_comparisons: extraComparisons,
    });
  } catch (err: any) {
    console.error("[paypal/capture-order] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella conferma del pagamento" }, { status: 500 });
  }
}
