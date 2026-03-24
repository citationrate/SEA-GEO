import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["demo", "free", "base", "pro", "agency"]),
});

export async function POST(request: Request) {
  try {
    // Verify caller is admin
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const { data: callerProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = (callerProfile as any)?.is_admin === true || user.email?.endsWith("@seageo.it");
    if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const svc = createServiceClient();
    const { error: dbError } = await (svc.from("profiles") as any).update({ plan: parsed.data.plan }).eq("id", parsed.data.user_id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    // Reset usage counters for current period on plan change
    const period = new Date().toISOString().slice(0, 7);
    const { data: existing } = await (svc.from("usage_monthly") as any)
      .select("id")
      .eq("user_id", parsed.data.user_id)
      .eq("period", period)
      .maybeSingle();

    if (existing) {
      await (svc.from("usage_monthly") as any)
        .update({ browsing_prompts_used: 0, no_browsing_prompts_used: 0, comparisons_used: 0, prompts_used: 0 })
        .eq("user_id", parsed.data.user_id)
        .eq("period", period);
    } else {
      await (svc.from("usage_monthly") as any)
        .insert({ user_id: parsed.data.user_id, period, browsing_prompts_used: 0, no_browsing_prompts_used: 0, comparisons_used: 0, prompts_used: 0 });
    }

    return NextResponse.json({ ok: true, plan: parsed.data.plan, usage_reset: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
