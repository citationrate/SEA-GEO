import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/app/(dashboard)/settings/settings-client";
import { SettingsHeader } from "@/app/(dashboard)/settings/settings-sections";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Impostazioni · Brand Profile" };

// Proxy della pagina /settings dentro il route group (brand-profile) così
// l'utente che clicca "Impostazioni" dalla sidebar BP non perde il
// contesto BP (sidebar AVI vs sidebar BP). Riutilizziamo gli stessi
// SettingsClient + SettingsHeader del route /settings di AVI.
export default async function BrandProfileSettingsPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <SettingsHeader />
      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        fullName={p.full_name ?? ""}
        plan={p.plan ?? "demo"}
        notifyAnalysisComplete={p.notify_analysis_complete ?? true}
        avatarUrl={p.avatar_url ?? null}
      />
    </div>
  );
}
