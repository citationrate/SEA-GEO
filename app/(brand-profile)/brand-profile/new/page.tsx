import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpRunLimit } from "@/lib/brand-profile/plans";
import { BrandProfileWizard } from "./wizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Nuova run · Brand Profile" };

export default async function NewBrandProfilePage() {
  const auth = createServerClient();
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
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
  const remaining = Math.max(0, runLimit - runsUsed);

  if (runLimit === 0) {
    redirect("/piano?source=brand-profile");
  }
  if (remaining === 0) {
    redirect("/brand-profile?quota=exhausted");
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <BrandProfileWizard plan={plan} remaining={remaining} runLimit={runLimit} />
    </div>
  );
}
