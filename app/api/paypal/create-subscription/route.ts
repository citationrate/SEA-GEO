import { requireAuth } from "@/lib/api-helpers";
import { createSubscription } from "@/lib/paypal";
import { NextResponse } from "next/server";
import { z } from "zod";

const PLAN_IDS: Record<string, string | undefined> = {
  "base-monthly": process.env.PAYPAL_PLAN_BASE_MONTHLY,
  "base-annual":  process.env.PAYPAL_PLAN_BASE_ANNUAL,
  "pro-monthly":  process.env.PAYPAL_PLAN_PRO_MONTHLY,
  "pro-annual":   process.env.PAYPAL_PLAN_PRO_ANNUAL,
};

const schema = z.object({
  plan: z.enum(["base", "pro"]),
  billingCycle: z.enum(["monthly", "annual"]),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parametri non validi: plan (base|pro) e billingCycle (monthly|annual) richiesti" }, { status: 400 });
    }

    const { plan, billingCycle } = parsed.data;
    const planId = PLAN_IDS[`${plan}-${billingCycle}`];

    if (!planId) {
      console.error("[paypal/create-subscription] Missing plan ID for:", `${plan}-${billingCycle}`);
      return NextResponse.json({ error: "Piano non configurato" }, { status: 500 });
    }

    const result = await createSubscription(planId, user.id, user.email ?? "");

    return NextResponse.json({
      subscriptionId: result.subscriptionId,
      approvalUrl: result.approvalUrl,
    });
  } catch (err: any) {
    console.error("[paypal/create-subscription] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella creazione dell'abbonamento" }, { status: 500 });
  }
}
