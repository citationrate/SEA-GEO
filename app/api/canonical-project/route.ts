import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Espone il progetto canonico della suite (DB CitationRate) all'utente loggato,
// così i tool AVI/BP possono pre-compilare i loro form (UX unificata).
// Legge via il client CitationRate con sessione utente (RLS: solo i propri).
export async function GET() {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ project: null });

    const { data } = await (auth.from("projects") as any)
      .select("brand, primary_url, sector_label, country, language")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ project: data ?? null });
  } catch {
    return NextResponse.json({ project: null });
  }
}
