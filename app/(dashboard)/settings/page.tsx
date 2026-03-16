import { createServerClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import { SettingsHeader } from "./settings-sections";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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
        plan={p.plan ?? "free"}
        notifyAnalysisComplete={p.notify_analysis_complete ?? true}
      />
    </div>
  );
}
