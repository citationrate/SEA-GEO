import { requireAuth } from "@/lib/api-helpers";
import { captureOrder } from "@/lib/paypal";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

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

    // Fetch the package definition
    const { data: pkg } = await (svc.from("packages") as any)
      .select("*")
      .eq("id", purchase.package_id)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "Pacchetto non trovato" }, { status: 404 });
    }

    // Credit package to user's usage
    const period = purchase.period;
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

    // Mark purchase as completed
    await (svc.from("package_purchases") as any)
      .update({ status: "completed" })
      .eq("id", purchase.id);

    return NextResponse.json({
      ok: true,
      extra_browsing_prompts: extraBrowsing,
      extra_no_browsing_prompts: extraNoBrowsing,
      extra_comparisons: extraComparisons,
    });
  } catch (err) {
    console.error("[paypal/capture-order] error:", err);
    return NextResponse.json({ error: "Errore nella conferma del pagamento" }, { status: 500 });
  }
}
