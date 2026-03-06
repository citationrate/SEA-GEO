import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = createServiceClient();
  const runId = params.runId;

  // Fetch the run to get project_id
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, project_id")
    .eq("id", runId)
    .single();

  if (!run) {
    return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  }

  const projectId = (run as any).project_id;

  // Fetch all prompts_executed for this run (with query_id, segment_id, run_number)
  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("id, query_id, segment_id, run_number")
    .eq("run_id", runId);

  if (!prompts?.length) {
    return NextResponse.json({ error: "Nessun prompt trovato per questa run" }, { status: 400 });
  }

  const promptIds = (prompts as any[]).map((p) => p.id);
  const promptMap = new Map((prompts as any[]).map((p) => [p.id, p]));

  // Fetch all response_analysis for these prompts
  const { data: analyses } = await supabase
    .from("response_analysis")
    .select("*")
    .in("prompt_executed_id", promptIds);

  if (!analyses?.length) {
    return NextResponse.json({ error: "Nessuna analisi trovata" }, { status: 400 });
  }

  const rows = analyses as any[];
  const total = rows.length;

  // --- Presence: count(brand_mentioned=true) / total ---
  const mentionedCount = rows.filter((a) => a.brand_mentioned).length;
  const presence_score = mentionedCount / total;

  // --- Rank: se brand_mentioned, 1-(brand_rank-1)/10, altrimenti 0. Media di tutti. ---
  const rankValues = rows.map((a) => {
    if (!a.brand_mentioned || a.brand_rank === null || a.brand_rank <= 0) return 0;
    return Math.max(0, 1 - (a.brand_rank - 1) / 10);
  });
  const rank_score = rankValues.reduce((s, v) => s + v, 0) / rankValues.length;

  // --- Sentiment: (media sentiment_score + 1) / 2 ---
  const withSentiment = rows.filter((a) => a.sentiment_score !== null);
  let sentiment_score = 0.5; // default neutral
  if (withSentiment.length > 0) {
    const avg = withSentiment.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSentiment.length;
    sentiment_score = (avg + 1) / 2;
  }

  // --- Stability: per ogni query_id+segment_id, % di run che concordano sulla menzione. Media. ---
  const pairGroups = new Map<string, boolean[]>();
  for (const a of rows) {
    const prompt = promptMap.get(a.prompt_executed_id);
    if (!prompt) continue;
    const key = `${prompt.query_id}__${prompt.segment_id}`;
    const group = pairGroups.get(key) ?? [];
    group.push(a.brand_mentioned);
    pairGroups.set(key, group);
  }

  let stability_score = 1;
  if (pairGroups.size > 0) {
    const pairScores: number[] = [];
    for (const runs of Array.from(pairGroups.values())) {
      if (runs.length <= 1) {
        pairScores.push(1);
        continue;
      }
      const trueCount = runs.filter(Boolean).length;
      const majority = Math.max(trueCount, runs.length - trueCount);
      pairScores.push(majority / runs.length);
    }
    stability_score = pairScores.reduce((s, v) => s + v, 0) / pairScores.length;
  }

  // --- AVI composito: presence*35 + rank*25 + sentiment*20 + stability*20 ---
  const avi_score = Math.round(
    presence_score * 35 +
    rank_score * 25 +
    sentiment_score * 20 +
    stability_score * 20
  );

  const components = {
    presence_score: Math.round(presence_score * 10000) / 100,
    rank_score: Math.round(rank_score * 10000) / 100,
    sentiment_score: Math.round(sentiment_score * 10000) / 100,
    stability_score: Math.round(stability_score * 10000) / 100,
  };

  // Upsert into avi_history: delete existing then insert
  await (supabase.from("avi_history") as any)
    .delete()
    .eq("run_id", runId);

  const { error: insertError } = await (supabase.from("avi_history") as any)
    .insert({
      project_id: projectId,
      run_id: runId,
      avi_score,
      presence_score: components.presence_score,
      rank_score: components.rank_score,
      sentiment_score: components.sentiment_score,
      stability_score: components.stability_score,
      computed_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error("Failed to insert avi_history:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update response_analysis rows with AVI
  for (const row of rows) {
    await (supabase.from("response_analysis") as any)
      .update({ avi_score, avi_components: components })
      .eq("id", row.id);
  }

  return NextResponse.json({
    run_id: runId,
    avi_score,
    components,
  });
}
