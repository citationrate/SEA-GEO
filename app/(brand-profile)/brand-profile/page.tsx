import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpRunLimit } from "@/lib/brand-profile/plans";
import { BrandProfileList } from "./brand-profile-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Brand Profile" };

export default async function BrandProfilePage() {
  const auth = createServerClient();
  // SECURITY: getUser() validates the JWT; getSession() only reads the cookie
  // and can return a stale identity after cross-account handoffs.
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const data = createDataClient();
  const { data: profile } = await (data.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan = ((profile as any)?.plan as string | undefined)?.toLowerCase() ?? "demo";
  const runLimit = bpRunLimit(plan);

  const cr = createCitationRateServiceClient();
  const { data: usage } = await (cr.from("user_usage") as any)
    .select("brand_profile_runs_used")
    .eq("user_id", user.id)
    .maybeSingle();
  const runsUsed = Number((usage as any)?.brand_profile_runs_used ?? 0);

  const bp = data.schema("brand_profile" as any);
  const { data: runs } = await (bp.from("runs") as any)
    .select("id, brand_name, sector, country, status, started_at, completed_at, total_prompts")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const items = (runs ?? []).map((r: any) => ({
    id: r.id,
    brand_name: r.brand_name,
    sector: r.sector,
    country: r.country,
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    total_prompts: r.total_prompts,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <BrandProfileList runs={items} plan={plan} runsUsed={runsUsed} runLimit={runLimit} />
    </div>
  );
}
