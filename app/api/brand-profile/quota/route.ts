import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpRunLimit } from "@/lib/brand-profile/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the live BP quota state for the current user:
 *   { monthly_used, monthly_limit, extras_balance, plan }
 *
 * Source of truth lives on CitationRate (auth project). The frontend uses
 * this to keep the sidebar runs counter and the Piano page in sync without
 * a full page reload.
 */

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const cr = createCitationRateServiceClient();
  const [{ data: profile }, { data: usage }] = await Promise.all([
    (cr.from("profiles") as any).select("plan").eq("id", user.id).single(),
    (cr.from("user_usage") as any)
      .select("brand_profile_runs_used, brand_profile_extra_runs_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const plan = ((profile as any)?.plan as string | undefined)?.toLowerCase() ?? "demo";
  const monthlyUsed = Number((usage as any)?.brand_profile_runs_used ?? 0);
  const extrasBalance = Number((usage as any)?.brand_profile_extra_runs_balance ?? 0);

  return NextResponse.json(
    {
      plan,
      monthly_used: monthlyUsed,
      monthly_limit: bpRunLimit(plan),
      extras_balance: extrasBalance,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
