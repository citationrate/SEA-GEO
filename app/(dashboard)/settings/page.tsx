import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { getUserPlanLimits, getCurrentUsage } from "@/lib/usage";
import { SettingsClient } from "./settings-client";
import { SettingsHeader } from "./settings-sections";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;

  // Fetch plan limits and current usage
  const planLimits = await getUserPlanLimits(user.id);
  const usage = await getCurrentUsage(user.id);

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <SettingsHeader />

      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        fullName={p.full_name ?? ""}
        plan={p.plan ?? "demo"}
        notifyAnalysisComplete={p.notify_analysis_complete ?? true}
        usage={{
          browsingPromptsUsed: usage.browsingPromptsUsed,
          browsingPromptsLimit: Number(planLimits.browsing_prompts) || 0,
          noBrowsingPromptsUsed: usage.noBrowsingPromptsUsed,
          noBrowsingPromptsLimit: Number(planLimits.no_browsing_prompts) || 40,
          comparisonsUsed: usage.comparisonsUsed,
          comparisonsLimit: Number(planLimits.max_comparisons) || 0,
          maxModels: Number(planLimits.max_models_per_project) || 2,
        }}
      />
    </div>
  );
}
