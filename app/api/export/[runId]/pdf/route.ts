import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = createServiceClient();
  const runId = params.runId;
  const locale = getLocaleFromRequest(request);
  const t = getServerTranslator(locale);

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

  const date = r.completed_at ? new Date(r.completed_at).toLocaleDateString(locale) : "N/D";

  // AVI component colors
  const compColors: Record<string, string> = {
    presence: "#e8956d",
    position: "#7eb3d4",
    sentiment: "#7eb89a",
  };

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>SeaGeo Report - ${proj?.name ?? ""} v${r.version}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #f5f5f0;
    background: #0a0a0a;
    padding: 48px;
    font-size: 13px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Header */
  .header {
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid #4ade80;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: #f5f5f0;
    margin-bottom: 6px;
  }
  .header .subtitle {
    font-family: 'JetBrains Mono', monospace;
    color: #888888;
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  /* Section headers */
  h2 {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: #f5f5f0;
    margin: 32px 0 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid #4ade80;
  }
  h2 .count {
    font-family: 'JetBrains Mono', monospace;
    color: #888888;
    font-weight: 400;
    font-size: 12px;
  }

  /* KPI Grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat {
    background: #111111;
    border: 1px solid #1f1f1f;
    border-radius: 2px;
    padding: 16px;
    text-align: center;
  }
  .stat .val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: 600;
    color: #f5f5f0;
    letter-spacing: -0.02em;
  }
  .stat .val.avi-val { color: #4ade80; }
  .stat .lbl {
    font-size: 10px;
    font-weight: 500;
    color: #888888;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-top: 4px;
  }

  /* AVI Components */
  .avi-box {
    background: #111111;
    border: 1px solid #1f1f1f;
    border-radius: 2px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
  }
  .bar-label {
    width: 90px;
    font-size: 11px;
    font-weight: 500;
    color: #888888;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .bar-track {
    flex: 1;
    height: 6px;
    background: #1f1f1f;
    border-radius: 1px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 1px;
  }
  .bar-val {
    width: 36px;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 12px;
    color: #f5f5f0;
  }

  /* Stability badge */
  .stability-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .stability-high { background: rgba(78,184,126,0.15); color: #4ade80; border: 1px solid rgba(78,184,126,0.3); }
  .stability-medium { background: rgba(212,168,23,0.15); color: #d4a817; border: 1px solid rgba(212,168,23,0.3); }
  .stability-low { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 12px;
  }
  th {
    text-align: left;
    padding: 8px 12px;
    background: #111111;
    border-bottom: 1px solid #1f1f1f;
    color: #888888;
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid #1f1f1f;
    color: #f5f5f0;
  }
  tr:nth-child(even) td { background: #0d0d0d; }
  tr:nth-child(odd) td { background: #0a0a0a; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .badge-yes { background: #4ade80; color: #0a0a0a; }
  .badge-no { background: #1f1f1f; color: #888888; }
  .badge-type { background: #1f1f1f; color: #888888; }

  /* Chips */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 4px 10px;
    border-radius: 2px;
    background: #111111;
    border: 1px solid #1f1f1f;
    font-size: 11px;
    font-weight: 500;
    color: #f5f5f0;
  }
  .chip-count {
    font-family: 'JetBrains Mono', monospace;
    color: #888888;
    font-size: 10px;
    margin-left: 4px;
  }

  /* Footer */
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #1f1f1f;
    font-family: 'JetBrains Mono', monospace;
    color: #333333;
    font-size: 10px;
    text-align: center;
    letter-spacing: 0.04em;
  }

  @media print {
    body { padding: 24px; }
    h2 { break-after: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>SeaGeo Report</h1>
  <p class="subtitle">${proj?.name ?? ""} &middot; ${proj?.target_brand ?? ""} &middot; v${r.version} &middot; ${date}</p>
</div>

<div class="grid">
  <div class="stat"><div class="val avi-val">${a?.avi_score ?? "—"}</div><div class="lbl">AVI Score</div></div>
  <div class="stat"><div class="val">${mentionRate}%</div><div class="lbl">${t("dashboard.brandMentions")}</div></div>
  <div class="stat"><div class="val">${compList.length}</div><div class="lbl">${t("sidebar.competitors")}</div></div>
  <div class="stat"><div class="val">${domainList.length}</div><div class="lbl">${t("sources.title")}</div></div>
</div>

${a ? `
<h2>${t("runDetail.aviComparison")}</h2>
<div class="avi-box">
  ${[
    { label: t("dashboard.presence"), val: a.presence_score ?? 0, color: compColors.presence },
    { label: t("dashboard.position"), val: a.rank_score ?? 0, color: compColors.position },
    { label: t("dashboard.sentiment"), val: a.sentiment_score ?? 0, color: compColors.sentiment },
  ].map((c) => `
  <div class="bar-row">
    <span class="bar-label">${c.label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, c.val)}%;background:${c.color}"></div></div>
    <span class="bar-val">${Math.round(c.val)}</span>
  </div>`).join("")}
</div>
<div class="stability-badge ${
  (a.stability_score ?? 0) > 80 ? 'stability-high' : (a.stability_score ?? 0) >= 50 ? 'stability-medium' : 'stability-low'
}">
  ${(a.stability_score ?? 0) > 80 ? t("dashboard.highReliability") : (a.stability_score ?? 0) >= 50 ? t("dashboard.mediumReliability") : t("dashboard.lowReliability")} (${Math.round(a.stability_score ?? 0)})
</div>
` : ""}

<h2>${t("sidebar.competitors")} <span class="count">(${compList.length})</span></h2>
${compList.length > 0 ? `
<table>
  <thead><tr><th>${t("sidebar.competitors")}</th><th>${t("sources.citationsLabel")}</th></tr></thead>
  <tbody>${compList.map(([name, count]) => `<tr><td>${name}</td><td style="font-family:'JetBrains Mono',monospace">${count}</td></tr>`).join("")}</tbody>
</table>` : `<p style="color:#888888;padding:16px 0">${t("dashboard.noCompetitorFound")}</p>`}

<h2>Topic <span class="count">(${topicList.length})</span></h2>
<div class="chips">
  ${topicList.map(([name, count]) => `<span class="chip">${name}<span class="chip-count">(${count})</span></span>`).join("")}
</div>

<h2>${t("sources.title")} <span class="count">(${domainList.length})</span></h2>
${domainList.length > 0 ? `
<table>
  <thead><tr><th>Domain</th><th>Type</th><th>${t("sources.citationsLabel")}</th></tr></thead>
  <tbody>${domainList.slice(0, 30).map(([domain, info]) => `<tr><td>${domain}</td><td><span class="badge badge-type">${info.type}</span></td><td style="font-family:'JetBrains Mono',monospace">${info.citations}</td></tr>`).join("")}</tbody>
</table>` : `<p style="color:#888888;padding:16px 0">${t("sources.noSourceFound")}</p>`}

<h2>${t("runMetrics.promptsExecuted")} <span class="count">(${(prompts ?? []).length})</span></h2>
<table>
  <thead><tr><th>#</th><th>${t("datasets.model")}</th><th>${t("datasets.brand")}</th><th>${t("datasets.rank")}</th><th>${t("dashboard.sentiment")}</th><th>${t("sidebar.competitors")}</th></tr></thead>
  <tbody>${(prompts ?? []).map((p: any, i: number) => {
    const x = analysisMap.get(p.id) as any;
    return `<tr>
      <td style="font-family:'JetBrains Mono',monospace;color:#888888">${i + 1}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${p.model}</td>
      <td>${x?.brand_mentioned ? '<span class="badge badge-yes">S\u00EC</span>' : '<span class="badge badge-no">No</span>'}</td>
      <td style="font-family:'JetBrains Mono',monospace">${x?.brand_rank ?? "—"}</td>
      <td style="font-family:'JetBrains Mono',monospace;${x?.sentiment_score != null ? (x.sentiment_score > 0 ? 'color:#4ade80' : x.sentiment_score < 0 ? 'color:#ef4444' : 'color:#888888') : 'color:#444444'}">${x?.sentiment_score != null ? (x.sentiment_score > 0 ? "+" : "") + x.sentiment_score.toFixed(2) : "—"}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888888;font-size:11px">${(x?.competitors_found ?? []).join(", ") || "—"}</td>
    </tr>`;
  }).join("")}</tbody>
</table>

<div class="footer">
  SeaGeo &middot; ${new Date().toLocaleDateString(locale)} &middot; AI Visibility Intelligence Platform
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
