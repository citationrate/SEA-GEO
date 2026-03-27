import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { getUserPlanLimits, getCurrentUsage } from "@/lib/usage";
import { PianoClient } from "./piano-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piano — AVI" };

export default async function PianoPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();

  // Profile
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("plan, subscription_status, subscription_period, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;
  const plan = p.plan ?? "demo";

  // Usage
  const planLimits = await getUserPlanLimits(user.id);
  const usage = await getCurrentUsage(user.id);

  // Projects count
  const { count: projectsCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("deleted_at", null);

  // Analyses this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: analysesThisMonth } = await supabase
    .from("analysis_runs")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gte("created_at", monthStart.toISOString());

  // Extra comparisons from packages
  const extraComparisons = usage.extraComparisons;

  return (
    <PianoClient
      plan={plan}
      subscriptionStatus={p.subscription_status || "inactive"}
      subscriptionPeriod={p.subscription_period || null}
      hasActiveSubscription={!!p.stripe_subscription_id}
      projectsCount={projectsCount ?? 0}
      analysesThisMonth={analysesThisMonth ?? 0}
      queriesUsed={usage.browsingPromptsUsed + usage.noBrowsingPromptsUsed}
      queriesLimit={
        (Number(planLimits.browsing_prompts) || 0) +
        (Number(planLimits.no_browsing_prompts) || 0) +
        usage.extraBrowsingPrompts +
        usage.extraNoBrowsingPrompts
      }
      comparisonsUsed={usage.comparisonsUsed}
      comparisonsLimit={(Number(planLimits.max_comparisons) || 0) + extraComparisons}
      extraComparisons={extraComparisons}
    />
  );
}
