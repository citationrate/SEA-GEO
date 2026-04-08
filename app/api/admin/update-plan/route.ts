import { createServiceClient } from "@/lib/supabase/service";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["demo", "base", "pro"]),
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

    // Update plan on BOTH projects:
    //   - CitationRate profiles is the source of truth
    //   - seageo1 profiles is a shadow copy used by AVI's ensureProfile()
    const sgSvc = createServiceClient();
    const crSvc = createCitationRateServiceClient();

    const { error: crError } = await (crSvc.from("profiles") as any)
      .update({ plan: parsed.data.plan })
      .eq("id", parsed.data.user_id);
    if (crError) return NextResponse.json({ error: crError.message }, { status: 500 });

    await (sgSvc.from("profiles") as any)
      .update({ plan: parsed.data.plan })
      .eq("id", parsed.data.user_id);

    // Reset usage counters and start a fresh 30-day cycle on plan change.
    // (Stripe webhook on suite.citationrate.com will overwrite cycle_start/end
    //  with the real subscription period on the next invoice.paid event.)
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await (crSvc.from("user_usage") as any).upsert(
      {
        user_id: parsed.data.user_id,
        cycle_start: now.toISOString(),
        cycle_end: end.toISOString(),
        cs_audits_used: 0,
        browsing_prompts_used: 0,
        no_browsing_prompts_used: 0,
        prompts_used: 0,
        comparisons_used: 0,
        url_analyses_used: 0,
        context_analyses_used: 0,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );

    return NextResponse.json({ ok: true, plan: parsed.data.plan, usage_reset: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
