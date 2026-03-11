import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    // Verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const { data, error } = await supabase
      .from("analysis_runs")
      .select("id, version, status, created_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
