import { createServerClient } from "@/lib/supabase/server";
import { ArrowLeft, Trash2 } from "lucide-react";
import { DeletedProjectsList } from "./deleted-projects-list";

export const metadata = { title: "Progetti eliminati" };

export default async function DeletedProjectsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await (supabase.from("projects") as any)
    .select("id, name, target_brand, deleted_at")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <div>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Impostazioni
        </a>
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Progetti eliminati</h1>
            <p className="text-sm text-muted-foreground">Ripristina o elimina definitivamente i progetti archiviati</p>
          </div>
        </div>
      </div>

      <DeletedProjectsList projects={(projects ?? []) as any[]} />
    </div>
  );
}
