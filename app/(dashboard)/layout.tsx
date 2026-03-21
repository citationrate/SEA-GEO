import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { isProUser } from "@/lib/utils/is-pro";
import { OnboardingTour } from "@/components/onboarding-tour";

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
      : ((profile as any)?.plan ?? "demo"),
  };

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <Sidebar profile={enrichedProfile} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
      <OnboardingTour onboardingCompleted={!!(enrichedProfile as any)?.onboarding_completed} />
    </div>
  );
}
