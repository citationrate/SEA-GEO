import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isProUser } from "@/lib/utils/is-pro";
import { getUserPlanLimits } from "@/lib/usage";
import { DatasetClient } from "./dataset-client";
import { DatasetsPaywall } from "./datasets-paywall";

export const metadata = { title: "Dataset" };

export default async function DatasetsPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createDataClient();
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = isProUser(profile as any, user.user_metadata);

  // Also check plan limits table as fallback
  const planLimits = await getUserPlanLimits(user.id);
  const hasDatasetAccess = isPro || planLimits.can_access_dataset;

  console.log(`[datasets] user=${user.id} plan=${profile?.plan} isPro=${isPro} can_access_dataset=${planLimits.can_access_dataset}`);

  if (!hasDatasetAccess) {
    return <DatasetsPaywall />;
  }

  // Fetch user projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <DatasetClient
      projects={(projects ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.target_brand,
      }))}
    />
  );
}
