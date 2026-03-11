import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Database, Lock } from "lucide-react";
import { isProUser } from "@/lib/utils/is-pro";
import { DatasetClient } from "./dataset-client";

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
    return (
      <div className="space-y-6 max-w-[1200px] animate-fade-in">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Dataset</h1>
            <p className="text-sm text-muted-foreground">Dati raw delle risposte AI</p>
          </div>
        </div>
        <div className="card p-16 text-center border border-dashed border-[#c4a882]/30 space-y-4">
          <Lock className="w-12 h-12 text-[#c4a882]/40 mx-auto" />
          <h2 className="font-display font-semibold text-xl text-foreground">
            Funzionalità Pro
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Il Dataset ti permette di esplorare ogni singola risposta AI, filtrata per progetto,
            analisi, modello, tipo di query e layer. Ideale per analisi qualitative e debug.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 bg-[#c4a882] text-background font-semibold text-sm px-6 py-2.5 rounded-[2px] hover:bg-[#c4a882]/85 transition-colors mt-2"
          >
            Upgrade a Pro
          </a>
        </div>
      </div>
    );
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
