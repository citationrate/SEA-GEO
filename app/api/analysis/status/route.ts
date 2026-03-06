import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id");
  if (!runId) return NextResponse.json({ error: "run_id richiesto" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("status, completed_prompts, total_prompts")
    .eq("id", runId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  return NextResponse.json(data);
}
