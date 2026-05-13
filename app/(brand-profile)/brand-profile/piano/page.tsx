import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { isShowcase } from "@/lib/showcase";
import { PianoClient } from "./piano-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Piano · Brand Profile" };

export default async function BrandProfilePianoPage() {
  const auth = createServerClient();
  // SECURITY: getUser() validates the JWT; getSession() only reads the cookie
  // and can return a stale identity after cross-account handoffs.
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  const plan = ((profile as any)?.plan as string | undefined)?.toLowerCase() ?? "demo";
  const planExpires = (profile as any)?.plan_expires_at as string | null | undefined;

  // Showcase accounts (vetrina) shouldn't see the pricing/upgrade flow.
  // Same rationale as the CS suite /piano redirect.
  if (isShowcase(plan, (profile as any)?.email ?? user.email)) {
    redirect("/brand-profile");
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <PianoClient plan={plan} planExpires={planExpires ?? null} />
    </div>
  );
}
