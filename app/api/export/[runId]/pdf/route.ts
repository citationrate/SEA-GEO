import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = createServiceClient();
  const runId = params.runId;

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  const r = run as any;

  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand")
    .eq("id", r.project_id)
    .single();
  const proj = project as any;

  const { data: avi } = await supabase
    .from("avi_history")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  const a = avi as any;

  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  const promptIds = (prompts ?? []).map((p: any) => p.id);

  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };

  const { data: sources } = promptIds.length > 0
    ? await supabase.from("sources").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };

  const analysisMap = new Map((analyses ?? []).map((x: any) => [x.prompt_executed_id, x]));
  const analysesList = (analyses ?? []) as any[];

  // Competitor aggregation
  const compMap = new Map<string, number>();
  analysesList.forEach((x) => (x.competitors_found ?? []).forEach((c: string) => compMap.set(c, (compMap.get(c) ?? 0) + 1)));
  const compList = Array.from(compMap.entries()).sort((a, b) => b[1] - a[1]);

  // Topic aggregation
  const topicMap = new Map<string, number>();
  analysesList.forEach((x) => (x.topics ?? []).forEach((t: string) => topicMap.set(t, (topicMap.get(t) ?? 0) + 1)));
  const topicList = Array.from(topicMap.entries()).sort((a, b) => b[1] - a[1]);

  // Source aggregation by domain
  const domainMap = new Map<string, { citations: number; type: string }>();
  (sources ?? []).forEach((s: any) => {
    const d = s.domain ?? "sconosciuto";
    const ex = domainMap.get(d);
    if (ex) { ex.citations += (s.citation_count ?? 1); }
    else { domainMap.set(d, { citations: s.citation_count ?? 1, type: s.source_type ?? "other" }); }
  });
  const domainList = Array.from(domainMap.entries()).sort((a, b) => b[1].citations - a[1].citations);

  const totalAnalysed = analysesList.length;
  const mentionCount = analysesList.filter((x) => x.brand_mentioned).length;
  const mentionRate = totalAnalysed > 0 ? Math.round((mentionCount / totalAnalysed) * 100) : 0;

  const date = r.completed_at ? new Date(r.completed_at).toLocaleDateString("it-IT") : "N/D";

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>SeaGeo Report - ${proj?.name ?? ""} v${r.version}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 700; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #00d4ff; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; text-align: center; }
  .stat .val { font-size: 28px; font-weight: 800; color: #00b4d8; }
  .stat .lbl { font-size: 11px; color: #888; margin-top: 2px; }
  .avi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .avi-box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .bar-label { width: 90px; font-size: 12px; color: #666; }
  .bar-track { flex: 1; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; background: #00b4d8; }
  .bar-val { width: 36px; text-align: right; font-weight: 700; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-cyan { background: #e0f7fa; color: #00838f; }
  .badge-green { background: #e8f5e9; color: #2e7d32; }
  .badge-red { background: #ffebee; color: #c62828; }
  .badge-gray { background: #f5f5f5; color: #666; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 4px 10px; border-radius: 6px; background: #f0f0f0; font-size: 12px; font-weight: 500; }
  .chip-count { color: #999; font-size: 10px; margin-left: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; color: #999; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } h2 { break-after: avoid; } }
</style>
</head>
<body>
<h1>SeaGeo Report</h1>
<p class="subtitle">${proj?.name ?? ""} &middot; ${proj?.target_brand ?? ""} &middot; Analisi v${r.version} &middot; ${date}</p>

<div class="grid">
  <div class="stat"><div class="val">${a?.avi_score ?? "—"}</div><div class="lbl">AVI Score</div></div>
  <div class="stat"><div class="val">${mentionRate}%</div><div class="lbl">Menzioni Brand</div></div>
  <div class="stat"><div class="val">${compList.length}</div><div class="lbl">Competitor</div></div>
  <div class="stat"><div class="val">${domainList.length}</div><div class="lbl">Fonti</div></div>
</div>

${a ? `
<h2>AVI Components</h2>
<div class="avi-box">
  ${[
    { label: "Prominence", val: a.presence_score ?? 0 },
    { label: "Rank", val: a.rank_score ?? 0 },
    { label: "Sentiment", val: a.sentiment_score ?? 0 },
    { label: "Consistency", val: a.stability_score ?? 0 },
  ].map((c) => `
  <div class="bar-row">
    <span class="bar-label">${c.label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, c.val)}%"></div></div>
    <span class="bar-val">${Math.round(c.val)}</span>
  </div>`).join("")}
</div>
` : ""}

<h2>Competitor (${compList.length})</h2>
${compList.length > 0 ? `
<table>
  <thead><tr><th>Competitor</th><th>Citazioni</th></tr></thead>
  <tbody>${compList.map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join("")}</tbody>
</table>` : "<p style='color:#888'>Nessun competitor trovato</p>"}

<h2>Topic (${topicList.length})</h2>
<div class="chips">
  ${topicList.map(([name, count]) => `<span class="chip">${name}<span class="chip-count">(${count})</span></span>`).join("")}
</div>

<h2>Fonti (${domainList.length})</h2>
${domainList.length > 0 ? `
<table>
  <thead><tr><th>Dominio</th><th>Tipo</th><th>Citazioni</th></tr></thead>
  <tbody>${domainList.slice(0, 30).map(([domain, info]) => `<tr><td>${domain}</td><td><span class="badge badge-gray">${info.type}</span></td><td>${info.citations}</td></tr>`).join("")}</tbody>
</table>` : "<p style='color:#888'>Nessuna fonte trovata</p>"}

<h2>Prompt Eseguiti (${(prompts ?? []).length})</h2>
<table>
  <thead><tr><th>#</th><th>Modello</th><th>Brand</th><th>Rank</th><th>Sentiment</th><th>Competitor</th></tr></thead>
  <tbody>${(prompts ?? []).map((p: any, i: number) => {
    const x = analysisMap.get(p.id) as any;
    return `<tr>
      <td>${i + 1}</td>
      <td>${p.model}</td>
      <td>${x?.brand_mentioned ? '<span class="badge badge-green">S\u00EC</span>' : '<span class="badge badge-gray">No</span>'}</td>
      <td>${x?.brand_rank ?? "—"}</td>
      <td>${x?.sentiment_score != null ? (x.sentiment_score > 0 ? "+" : "") + x.sentiment_score.toFixed(2) : "—"}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(x?.competitors_found ?? []).join(", ") || "—"}</td>
    </tr>`;
  }).join("")}</tbody>
</table>

<div class="footer">
  Generato da SeaGeo &middot; ${new Date().toLocaleDateString("it-IT")} &middot; AI Visibility Intelligence Platform
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
