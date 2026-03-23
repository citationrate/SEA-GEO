import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    // Verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const { data, error: dbError } = await supabase
      .from("analysis_runs")
      .select("id, version, status, created_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
