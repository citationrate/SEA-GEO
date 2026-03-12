import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = createServiceClient();
  const runId = params.runId;

  // Fetch run
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run) {
    return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  }

  const r = run as any;

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand")
    .eq("id", r.project_id)
    .single();

  const proj = project as any;

  // Fetch AVI
  const { data: avi } = await supabase
    .from("avi_history")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  const aviData = avi as any;

  // Fetch prompts + analyses
  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  const promptIds = (prompts ?? []).map((p: any) => p.id);

  const { data: analyses } = promptIds.length > 0
    ? await supabase
        .from("response_analysis")
        .select("*")
        .in("prompt_executed_id", promptIds)
    : { data: [] };

  const analysisMap = new Map((analyses ?? []).map((a: any) => [a.prompt_executed_id, a]));

  // Fetch sources
  const { data: sources } = promptIds.length > 0
    ? await supabase
        .from("sources")
        .select("*")
        .in("prompt_executed_id", promptIds)
    : { data: [] };

  // Fetch queries for human-readable text
  const queryIds = Array.from(new Set((prompts ?? []).map((p: any) => p.query_id).filter(Boolean)));
  const { data: queries } = queryIds.length > 0
    ? await supabase.from("queries").select("id, text").in("id", queryIds)
    : { data: [] };
  const queryTextMap = new Map((queries ?? []).map((q: any) => [q.id, q.text]));

  // Fetch segments for human-readable context
  const segmentIds = Array.from(new Set((prompts ?? []).map((p: any) => p.segment_id).filter(Boolean)));
  const { data: segments } = segmentIds.length > 0
    ? await supabase.from("segments").select("id, label").in("id", segmentIds)
    : { data: [] };
  const segmentLabelMap = new Map((segments ?? []).map((s: any) => [s.id, s.label]));

  // Build workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Riepilogo AVI
  const summaryRows = [
    ["SeaGeo - Export Analisi"],
    [],
    ["Progetto", proj?.name ?? "—"],
    ["Brand", proj?.target_brand ?? "—"],
    ["Versione Run", `v${r.version}`],
    ["Status", r.status],
    ["Data", r.completed_at ? new Date(r.completed_at).toLocaleString("it-IT") : "—"],
    ["Modelli", (r.models_used ?? []).join(", ")],
    ["Prompt Totali", r.total_prompts],
    ["Prompt Completati", r.completed_prompts],
    [],
    ["--- AVI Score ---"],
    ["AVI Score", aviData?.avi_score ?? "—"],
    ["Presence", aviData?.presence_score ?? "—"],
    ["Rank", aviData?.rank_score ?? "—"],
    ["Sentiment", aviData?.sentiment_score ?? "—"],
    ["Stability", aviData?.stability_score ?? "—"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Riepilogo AVI");

  // Sheet 2: Dettaglio Prompt
  const promptHeaders = [
    "Query", "Segmento", "Modello", "Run #",
    "Brand Menzionato", "Rank", "Occorrenze", "Sentiment",
    "Competitor", "Topic", "Risposta (troncata)",
  ];
  const promptRows = (prompts ?? []).map((p: any) => {
    const a = analysisMap.get(p.id);
    return [
      queryTextMap.get(p.query_id) ?? p.query_id ?? "—",
      segmentLabelMap.get(p.segment_id) ?? p.segment_id ?? "—",
      p.model,
      p.run_number,
      a?.brand_mentioned ? "Sì" : "No",
      a?.brand_rank ?? "—",
      a?.brand_occurrences ?? 0,
      a?.sentiment_score ?? "—",
      (a?.competitors_found ?? []).join(", "),
      (a?.topics ?? []).join(", "),
      (p.raw_response ?? "").substring(0, 500),
    ];
  });
  const wsPrompts = XLSX.utils.aoa_to_sheet([promptHeaders, ...promptRows]);
  XLSX.utils.book_append_sheet(wb, wsPrompts, "Dettaglio Prompt");

  // Sheet 3: Competitor
  const analysesList = (analyses ?? []) as any[];
  const allCompetitors = new Map<string, { count: number; sentimentSum: number; sentimentN: number }>();
  analysesList.forEach((a) => {
    (a.competitors_found ?? []).forEach((c: string) => {
      const existing = allCompetitors.get(c);
      if (existing) {
        existing.count++;
        if (a.sentiment_score != null) { existing.sentimentSum += a.sentiment_score; existing.sentimentN++; }
      } else {
        allCompetitors.set(c, {
          count: 1,
          sentimentSum: a.sentiment_score ?? 0,
          sentimentN: a.sentiment_score != null ? 1 : 0,
        });
      }
    });
  });
  const compHeaders = ["Competitor", "Citazioni", "Sentiment Medio"];
  const compRows = Array.from(allCompetitors.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stats]) => [
      name,
      stats.count,
      stats.sentimentN > 0 ? (stats.sentimentSum / stats.sentimentN).toFixed(2) : "—",
    ]);
  const wsComp = XLSX.utils.aoa_to_sheet([compHeaders, ...compRows]);
  XLSX.utils.book_append_sheet(wb, wsComp, "Competitor");

  // Sheet 4: Topic
  const allTopics = new Map<string, number>();
  analysesList.forEach((a) => {
    (a.topics ?? []).forEach((t: string) => {
      allTopics.set(t, (allTopics.get(t) ?? 0) + 1);
    });
  });
  const topicHeaders = ["Topic", "Frequenza"];
  const topicRows = Array.from(allTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => [name, count]);
  const wsTopics = XLSX.utils.aoa_to_sheet([topicHeaders, ...topicRows]);
  XLSX.utils.book_append_sheet(wb, wsTopics, "Topic");

  // Sheet 5: Fonti
  const sourceHeaders = ["Dominio", "URL", "Label", "Tipo", "Citazioni", "Brand Owned"];
  const sourceRows = (sources ?? []).map((s: any) => [
    s.domain ?? "—",
    s.url ?? "—",
    s.label ?? "—",
    s.source_type ?? "—",
    s.citation_count ?? 1,
    s.is_brand_owned ? "Sì" : "No",
  ]);
  const wsSources = XLSX.utils.aoa_to_sheet([sourceHeaders, ...sourceRows]);
  XLSX.utils.book_append_sheet(wb, wsSources, "Fonti");

  // Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `seageo-analisi-v${r.version}-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
