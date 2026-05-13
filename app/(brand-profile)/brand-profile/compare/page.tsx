import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpComparePlanAllowed } from "@/lib/brand-profile/plans";
import { CompareClient } from "./compare-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrandProfileComparePage() {
  const auth = createServerClient();
  // SECURITY: getUser() validates the JWT; getSession() only reads the cookie
  // and can return a stale identity after cross-account handoffs.
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .single();
  const plan = (profile?.plan as string | undefined)?.toLowerCase() ?? "demo";
  if (!bpComparePlanAllowed(plan)) redirect("/brand-profile");

  const data = createDataClient();
  const bp = data.schema("brand_profile" as any);
  const { data: runs } = await (bp.from("runs") as any)
    .select("id, brand_name, sector, country, status, started_at, completed_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <CompareClient runs={(runs as any) ?? []} />
    </div>
  );
}
