import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id");
  if (!runId) return NextResponse.json({ error: "run_id richiesto" }, { status: 400 });

  const { supabase, error } = await requireAuth();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("analysis_runs")
    .select("status, completed_prompts, total_prompts")
    .eq("id", runId)
    .single();

  if (dbError || !data) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  return NextResponse.json(data);
}
