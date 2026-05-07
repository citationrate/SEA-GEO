import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { BrandProfileSidebar } from "@/components/layout/brand-profile-sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { bpAccessAllowed } from "@/lib/brand-profile/plans";

export default async function BrandProfileLayout({ children }: { children: React.ReactNode }) {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data: aal } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      redirect("/auth/mfa-challenge");
    }
  } catch {
    /* listFactors/AAL not available — fail open */
  }

  // Soft-launch gate: only admins (CR profiles.is_admin) or whitelisted emails
  // can reach Brand Profile. Everyone else is bounced back to AVI.
  const cr = createCitationRateServiceClient();
  const { data: crProfile } = await (cr.from("profiles") as any)
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!bpAccessAllowed({ email: user.email, isAdmin: (crProfile as any)?.is_admin })) {
    redirect("/dashboard");
  }

  const supabase = createDataClient();
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
      <div className="flex h-screen bg-ink overflow-hidden print:block print:h-auto print:overflow-visible">
        <div data-bp-no-print>
          <BrandProfileSidebar profile={profile as any} />
        </div>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden print:overflow-visible">
          <div data-bp-no-print>
            <TopBar />
          </div>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
