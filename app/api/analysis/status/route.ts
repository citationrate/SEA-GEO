import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id");
  if (!runId) return NextResponse.json({ error: "run_id richiesto" }, { status: 400 });

  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  // Ownership check: verify the run belongs to a project owned by the authenticated user
  const { data, error: dbError } = await (supabase
    .from("analysis_runs") as any)
    .select("status, completed_prompts, total_prompts, projects!inner(user_id)")
    .eq("id", runId)
    .eq("projects.user_id", user.id)
    .single();

  if (dbError || !data) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  const { projects: _projects, ...rest } = data;
  return NextResponse.json(rest);
}
