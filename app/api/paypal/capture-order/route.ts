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

    // PayPal flow is deprecated post-unification (2026-04-08). New AVI package
    // purchases go through Stripe → seageo1.query_wallet via addToWallet().
    // This route is kept only for legacy capture acknowledgement and no longer
    // credits any wallet/usage table — the table usage_monthly was dropped.
    console.warn("[capture-order] PayPal flow deprecated; not crediting any wallet for", purchase.id, "pkg:", purchase.package_id, JSON.stringify(pkg));

    // Mark purchase as completed
    await (svc.from("package_purchases") as any)
      .update({ status: "completed" })
      .eq("id", purchase.id);

    console.log("[capture-order] Package credited:", purchase.package_id, "user:", user.id);

    return NextResponse.json({
      ok: true,
      deprecated: true,
      package_id: purchase.package_id,
    });
  } catch (err: any) {
    console.error("[paypal/capture-order] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella conferma del pagamento" }, { status: 500 });
  }
}
