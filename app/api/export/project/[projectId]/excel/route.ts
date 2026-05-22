import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";
import { modelIdToBrand } from "@citationrate/llm-client";

function brandOf(modelId: string | null | undefined): string {
  if (!modelId) return "—";
  return modelIdToBrand(modelId)?.brand ?? modelId;
}

function uniqueBrands(modelIds: string[] | null | undefined): string {
  if (!modelIds || modelIds.length === 0) return "—";
  const brands = new Set(modelIds.map((m) => brandOf(m)));
  return Array.from(brands).join(", ");
}

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const projectId = params.projectId;
  const locale = getLocaleFromRequest(request);
  const t = getServerTranslator(locale);

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand, user_id")
    .eq("id", projectId)
    .single();
  const proj = project as any;
  if (!proj || proj.user_id !== user!.id) {
    return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  }

  // Fetch all completed runs
  let runsQuery = supabase
    .from("analysis_runs")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (from) runsQuery = runsQuery.gte("completed_at", from);
  if (to) runsQuery = runsQuery.lte("completed_at", to + "T23:59:59Z");

  const { data: runs } = await runsQuery;
  const allRuns = (runs ?? []) as any[];

  if (allRuns.length === 0) {
    return NextResponse.json({ error: "Nessuna analisi trovata" }, { status: 404 });
  }

  const runIds = allRuns.map((r) => r.id);

  // Fetch AVI history
  const { data: aviHistory } = await supabase
    .from("avi_history")
    .select("*")
    .in("run_id", runIds)
    .order("computed_at", { ascending: true });
  const aviMap = new Map((aviHistory ?? []).map((a: any) => [a.run_id, a]));

  // Fetch all prompts
  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  const promptsList = (prompts ?? []) as any[];
  const promptIds = promptsList.map((p: any) => p.id);

  // Fetch analyses
  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };
  const analysisMap = new Map((analyses ?? []).map((a: any) => [a.prompt_executed_id, a]));
  const analysesList = (analyses ?? []) as any[];

  // Fetch queries for readable text
  const queryIds = Array.from(new Set((prompts ?? []).map((p: any) => p.query_id).filter(Boolean)));
  const { data: queries } = queryIds.length > 0
    ? await supabase.from("queries").select("id, text").in("id", queryIds)
    : { data: [] };
  const queryTextMap = new Map((queries ?? []).map((q: any) => [q.id, q.text]));

  // Fetch sources e competitor_avi per il "Confronto" (entrambi scoped by run_id).
  const { data: sources } = await supabase.from("sources").select("*").in("run_id", runIds);
  const { data: competitorAvi } = await (supabase.from("competitor_avi") as any)
    .select("run_id, competitor_name, avi_score, prominence_score, rank_score, sentiment_score, mention_count")
    .in("run_id", runIds);

  // Build workbook
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Riepilogo Progetto ──
  const summaryHeader = [
    ["AI Visibility Index — Project Export"],
    [],
    [t("results.project"), proj.name],
    [t("datasets.brand"), proj.target_brand ?? "—"],
    [t("results.analyses"), allRuns.length],
    [from ? "From" : "", from ?? ""],
    [to ? "To" : "", to ?? ""],
    [],
    ["Version", t("results.date"), t("results.status"), t("results.models"), "AVI", t("dashboard.presence"), t("dashboard.position"), t("dashboard.sentiment"), "Stability"],
  ];

  const summaryRows = allRuns.map((r) => {
    const a = aviMap.get(r.id);
    return [
      `v${r.version}`,
      r.completed_at ? new Date(r.completed_at).toLocaleDateString(locale) : "—",
      r.status,
      uniqueBrands(r.models_used),
      a?.avi_score ?? "—",
      a?.presence_score ?? "—",
      a?.rank_score ?? "—",
      a?.sentiment_score ?? "—",
      a?.stability_score ?? "—",
    ];
  });

  const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, wsSummary, t("results.project"));

  // ── Sheet 2: Competitor ──
  const compAgg = new Map<string, { count: number; sentimentSum: number; sentimentN: number; perRun: Map<string, number> }>();
  analysesList.forEach((x) => {
    const runId = promptsList.find((p: any) => p.id === x.prompt_executed_id)?.run_id;
    (x.competitors_found ?? []).forEach((c: string) => {
      const ex = compAgg.get(c);
      if (ex) {
        ex.count++;
        if (x.sentiment_score != null) { ex.sentimentSum += x.sentiment_score; ex.sentimentN++; }
        if (runId) ex.perRun.set(runId, (ex.perRun.get(runId) ?? 0) + 1);
      } else {
        const pr = new Map<string, number>();
        if (runId) pr.set(runId, 1);
        compAgg.set(c, {
          count: 1,
          sentimentSum: x.sentiment_score ?? 0,
          sentimentN: x.sentiment_score != null ? 1 : 0,
          perRun: pr,
        });
      }
    });
  });

  const compHeaders = [t("sidebar.competitors"), t("sources.citationsLabel"), t("runMetrics.avgSentiment")];
  const compRows = Array.from(compAgg.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stats]) => [
      name,
      stats.count,
      stats.sentimentN > 0 ? +(stats.sentimentSum / stats.sentimentN).toFixed(2) : "—",
    ]);
  const wsComp = XLSX.utils.aoa_to_sheet([compHeaders, ...compRows]);
  XLSX.utils.book_append_sheet(wb, wsComp, t("sidebar.competitors"));

  // ── Sheet 3: Prompt Eseguiti ──
  const promptHeaders = [
    "Version", "Query", t("datasets.model"), "Run #",
    t("datasets.brandCited"), t("datasets.rank"), t("dashboard.sentiment"),
    t("sidebar.competitors"), "Topic",
  ];

  const promptRows = promptsList.map((p: any) => {
    const a = analysisMap.get(p.id);
    const run = allRuns.find((r) => r.id === p.run_id);
    return [
      run ? `v${run.version}` : "—",
      queryTextMap.get(p.query_id) ?? p.query_id ?? "—",
      brandOf(p.model),
      p.run_number,
      a?.brand_mentioned ? t("common.yes") : t("common.no"),
      a?.brand_rank ?? "—",
      a?.sentiment_score ?? "—",
      (a?.competitors_found ?? []).join(", "),
      (a?.topics ?? []).join(", "),
    ];
  });
  const wsPrompts = XLSX.utils.aoa_to_sheet([promptHeaders, ...promptRows]);
  XLSX.utils.book_append_sheet(wb, wsPrompts, "Prompt");

  // ── Sheet 4: Topic ──
  const topicAgg = new Map<string, { count: number; perRun: Map<string, number> }>();
  analysesList.forEach((x) => {
    const runId = promptsList.find((p: any) => p.id === x.prompt_executed_id)?.run_id;
    (x.topics ?? []).forEach((tp: string) => {
      const ex = topicAgg.get(tp);
      if (ex) {
        ex.count++;
        if (runId) ex.perRun.set(runId, (ex.perRun.get(runId) ?? 0) + 1);
      } else {
        const pr = new Map<string, number>();
        if (runId) pr.set(runId, 1);
        topicAgg.set(tp, { count: 1, perRun: pr });
      }
    });
  });

  const topicHeaders = ["Topic", "Frequency"];
  const topicRows = Array.from(topicAgg.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, stats]) => [name, stats.count]);
  const wsTopics = XLSX.utils.aoa_to_sheet([topicHeaders, ...topicRows]);
  XLSX.utils.book_append_sheet(wb, wsTopics, "Topic");

  // ── Sheet 5: Confronto AVI (brand vs competitor, per run) ──
  const runVersionMap = new Map(allRuns.map((r) => [r.id, `v${r.version}`]));
  const confrontoHeaders = [
    "Version",
    t("sidebar.competitors"),
    "AVI",
    t("dashboard.presence"),
    t("dashboard.position"),
    t("dashboard.sentiment"),
    "Mention Count",
  ];
  const confrontoRows: any[][] = [];
  // Brand rows: 1 per run con i suoi score AVI
  allRuns.forEach((r) => {
    const a = aviMap.get(r.id);
    confrontoRows.push([
      `v${r.version}`,
      `${proj.target_brand ?? "—"} (brand)`,
      a?.avi_score ?? "—",
      a?.presence_score ?? "—",
      a?.rank_score ?? "—",
      a?.sentiment_score ?? "—",
      "—",
    ]);
  });
  // Competitor rows
  ((competitorAvi ?? []) as any[])
    .sort((a, b) => (b.avi_score ?? 0) - (a.avi_score ?? 0))
    .forEach((c) => {
      confrontoRows.push([
        runVersionMap.get(c.run_id) ?? "—",
        c.competitor_name,
        c.avi_score ?? "—",
        c.prominence_score ?? "—",
        c.rank_score ?? "—",
        c.sentiment_score ?? "—",
        c.mention_count ?? 0,
      ]);
    });
  const wsConfronto = XLSX.utils.aoa_to_sheet([confrontoHeaders, ...confrontoRows]);
  XLSX.utils.book_append_sheet(wb, wsConfronto, "Confronto");

  // ── Sheet 6: Sources ──
  const sourceHeaders = ["Version", "Domain", "URL", t("datasets.model"), "Type", t("sources.citationsLabel")];
  const sourceRows = ((sources ?? []) as any[]).map((s) => [
    runVersionMap.get(s.run_id) ?? "—",
    s.domain ?? "—",
    s.url ?? "—",
    brandOf(s.model),
    s.source_type ?? "—",
    s.citation_count ?? 1,
  ]);
  const wsSources = XLSX.utils.aoa_to_sheet([sourceHeaders, ...sourceRows]);
  XLSX.utils.book_append_sheet(wb, wsSources, t("sources.title"));

  // Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const brandName = (proj?.target_brand ?? proj?.name ?? "project").replace(/[^a-zA-Z0-9]/g, "-");
  const filename = `AVI-Project-${brandName}-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
