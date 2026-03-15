import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isProUser } from "@/lib/utils/is-pro";
import { DatasetClient } from "./dataset-client";
import { DatasetsPaywall } from "./datasets-paywall";

export const metadata = { title: "Dataset" };

export default async function DatasetsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = isProUser(profile as any, user.user_metadata);

  if (!isPro) {
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
