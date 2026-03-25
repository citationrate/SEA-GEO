import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { OnboardingTour } from "@/components/onboarding-tour";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createDataClient();

  // Auto-create profile in seageo1 if first visit from CitationRate auth
  let { data: profile } = await (supabase.from("profiles") as any)
    .select("*").eq("id", user.id).maybeSingle();

  if (!profile) {
    await (supabase.from("profiles") as any).insert({
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string) ?? null,
      plan: "demo",
    });
    ({ data: profile } = await (supabase.from("profiles") as any)
      .select("*").eq("id", user.id).single());
  }

  return (
    <MobileNavProvider>
      <div className="flex h-screen bg-ink overflow-hidden">
        <Sidebar profile={profile as any} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
        <OnboardingTour onboardingCompleted={!!(profile as any)?.onboarding_completed} />
      </div>
    </MobileNavProvider>
  );
}
