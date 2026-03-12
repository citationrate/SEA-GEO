import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { isProUser } from "@/lib/utils/is-pro";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  // Merge is_pro from user metadata into profile for downstream components
  const enrichedProfile = {
    ...(profile as any),
    plan: isProUser(profile as any, user.user_metadata)
      ? ((profile as any)?.plan === "agency" ? "agency" : "pro")
      : ((profile as any)?.plan ?? "free"),
  };

  // Check if onboarding should show (first-time user, no projects)
  const onboardingCompleted = (profile as any)?.onboarding_completed === true;
  let showOnboarding = false;
  if (!onboardingCompleted) {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);
    showOnboarding = (count ?? 0) === 0;
  }

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <Sidebar profile={enrichedProfile} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar profile={enrichedProfile} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
      {showOnboarding && <OnboardingModal />}
    </div>
  );
}
