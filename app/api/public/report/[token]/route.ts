import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  // M1: Rate limit — 10 requests per IP per minute
  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`public-report:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createServiceClient();

  // Find run by share token
  const { data: run } = await (supabase.from("analysis_runs") as any)
    .select("*")
    .eq("share_token", params.token)
    .single();

  if (!run) {
    return NextResponse.json({ error: "Report non trovato" }, { status: 404 });
  }

  const r = run as any;

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand")
    .eq("id", r.project_id)
    .single();

  // Fetch AVI
  const { data: avi } = await supabase
    .from("avi_history")
    .select("*")
    .eq("run_id", r.id)
    .maybeSingle();

  // Fetch prompts + analyses
  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .eq("run_id", r.id)
    .order("created_at", { ascending: true });

  const promptIds = (prompts ?? []).map((p: any) => p.id);

  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };

  // Competitor aggregation
  const analysesList = (analyses ?? []) as any[];
  const compMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.competitors_found ?? []).forEach((c: string) =>
      compMap.set(c, (compMap.get(c) ?? 0) + 1)
    )
  );
  const competitors = Array.from(compMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Topic aggregation
  const topicMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.topics ?? []).forEach((t: string) =>
      topicMap.set(t, (topicMap.get(t) ?? 0) + 1)
    )
  );
  const topics = Array.from(topicMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Metrics
  const totalAnalysed = analysesList.length;
  const mentionCount = analysesList.filter((x) => x.brand_mentioned).length;
  const mentionRate = totalAnalysed > 0 ? Math.round((mentionCount / totalAnalysed) * 100) : 0;

  const proj = project as any;
  const aviData = avi as any;

  return NextResponse.json({
    project: { name: proj?.name ?? "", brand: proj?.target_brand ?? "" },
    run: {
      version: r.version,
      status: r.status,
      completedAt: r.completed_at,
      modelsUsed: r.models_used ?? [],
      totalPrompts: r.total_prompts,
      completedPrompts: r.completed_prompts,
    },
    avi: aviData ? {
      score: aviData.avi_score,
      presence: aviData.presence_score,
      rank: aviData.rank_score,
      sentiment: aviData.sentiment_score,
      consistency: aviData.stability_score,
    } : null,
    mentionRate,
    competitors,
    topics,
  });
}
