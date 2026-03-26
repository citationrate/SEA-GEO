import { requireAuth } from "@/lib/api-helpers";
import { createSubscription } from "@/lib/paypal";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "planId richiesto" }, { status: 400 });
    }

    const { planId } = parsed.data;

    const result = await createSubscription(planId, user.id, user.email ?? "");

    return NextResponse.json({
      subscriptionId: result.subscriptionId,
      approvalUrl: result.approvalUrl,
    });
  } catch (err) {
    console.error("[paypal/create-subscription] error:", err);
    return NextResponse.json({ error: "Errore nella creazione dell'abbonamento" }, { status: 500 });
  }
}
