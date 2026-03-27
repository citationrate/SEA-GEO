import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createClient } from "@supabase/supabase-js";
import { cancelSubscription } from "@/lib/stripe/client";
import { z } from "zod";

function getCitationRateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing CitationRate env vars");
  return createClient(url, key);
}

async function verifyAdmin(supabase: any, user: any) {
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return (profile as any)?.is_admin === true || user.email?.endsWith("@seageo.it");
}

/* GET — list all users with subscription data */
export async function GET() {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;
    if (!(await verifyAdmin(supabase, user))) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const cr = getCitationRateClient();
    const { data: profiles, error: dbErr } = await cr
      .from("profiles")
      .select("id, email, full_name, plan, subscription_status, subscription_period, stripe_subscription_id, stripe_customer_id, created_at")
      .order("created_at", { ascending: false });

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ profiles: profiles ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

/* POST — admin actions on a user's subscription */
const actionSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(["activate", "deactivate", "cancel_stripe"]),
  plan: z.enum(["pro", "agency"]).optional(),
  period: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;
    if (!(await verifyAdmin(supabase, user))) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const { user_id, action, plan, period } = parsed.data;
    const cr = getCitationRateClient();

    switch (action) {
      case "activate": {
        if (!plan || !period) return NextResponse.json({ error: "plan and period required" }, { status: 400 });
        await cr.from("profiles").update({
          plan,
          subscription_status: "active",
          subscription_period: period,
        } as any).eq("id", user_id);
        // Also update seageo1
        await (supabase!.from("profiles") as any).update({ plan }).eq("id", user_id);
        break;
      }
      case "deactivate": {
        await cr.from("profiles").update({
          plan: "free",
          subscription_status: "inactive",
          subscription_period: null,
        } as any).eq("id", user_id);
        await (supabase!.from("profiles") as any).update({ plan: "free" }).eq("id", user_id);
        break;
      }
      case "cancel_stripe": {
        const { data: profile } = await cr.from("profiles").select("stripe_subscription_id").eq("id", user_id).single();
        const subId = (profile as any)?.stripe_subscription_id;
        if (!subId) return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });
        await cancelSubscription(subId);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
