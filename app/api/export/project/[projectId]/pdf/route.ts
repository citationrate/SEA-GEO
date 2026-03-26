import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";

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

  // Fetch all completed runs for this project
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

  // Fetch AVI history for all runs
  const { data: aviHistory } = await supabase
    .from("avi_history")
    .select("*")
    .in("run_id", runIds)
    .order("computed_at", { ascending: true });
  const aviList = (aviHistory ?? []) as any[];
  const aviMap = new Map(aviList.map((a) => [a.run_id, a]));

  // Fetch all prompts for all runs
  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .in("run_id", runIds);
  const promptIds = (prompts ?? []).map((p: any) => p.id);

  // Fetch analyses
  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };
  const analysesList = (analyses ?? []) as any[];

  // Aggregate competitors across all runs
  const compMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.competitors_found ?? []).forEach((c: string) => compMap.set(c, (compMap.get(c) ?? 0) + 1))
  );
  const compList = Array.from(compMap.entries()).sort((a, b) => b[1] - a[1]);

  // Aggregate topics
  const topicMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.topics ?? []).forEach((tp: string) => topicMap.set(tp, (topicMap.get(tp) ?? 0) + 1))
  );
  const topicList = Array.from(topicMap.entries()).sort((a, b) => b[1] - a[1]);

  // Overall stats
  const totalMentioned = analysesList.filter((x) => x.brand_mentioned).length;
  const mentionRate = analysesList.length > 0 ? Math.round((totalMentioned / analysesList.length) * 100) : 0;
  const latestAvi = aviList.length > 0 ? aviList[aviList.length - 1] : null;

  const dateRange = from || to
    ? `${from ?? "..."} → ${to ?? "..."}`
    : `${allRuns[0].completed_at ? new Date(allRuns[0].completed_at).toLocaleDateString(locale) : ""} → ${allRuns[allRuns.length - 1].completed_at ? new Date(allRuns[allRuns.length - 1].completed_at).toLocaleDateString(locale) : ""}`;

  // Build AVI trend rows
  const trendRows = allRuns.map((r) => {
    const a = aviMap.get(r.id);
    const date = r.completed_at ? new Date(r.completed_at).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : `v${r.version}`;
    return { version: `v${r.version}`, date, avi: a?.avi_score ?? "—", presence: a?.presence_score ?? "—", sentiment: a?.sentiment_score ?? "—" };
  });

  const brandName = (proj?.target_brand ?? proj?.name ?? "project").replace(/[^a-zA-Z0-9]/g, "-");
  const todayStr = new Date().toISOString().split("T")[0];

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>AVI Project Report - ${proj?.name ?? ""}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #f5f5f0; background: #0a0a0a; padding: 48px; font-size: 13px; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #4ade80; }
  .header h1 { font-size: 28px; font-weight: 500; letter-spacing: -0.02em; color: #f5f5f0; margin-bottom: 6px; }
  .header .subtitle { font-family: 'JetBrains Mono', monospace; color: #888; font-size: 12px; letter-spacing: 0.02em; }
  h2 { font-size: 14px; font-weight: 500; color: #f5f5f0; margin: 32px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #4ade80; }
  h2 .count { font-family: 'JetBrains Mono', monospace; color: #888; font-weight: 400; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #111; border: 1px solid #1f1f1f; border-radius: 2px; padding: 16px; text-align: center; }
  .stat .val { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 600; color: #f5f5f0; }
  .stat .val.avi-val { color: #4ade80; }
  .stat .lbl { font-size: 10px; font-weight: 500; color: #888; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { text-align: left; padding: 8px 12px; background: #111; border-bottom: 1px solid #1f1f1f; color: #888; font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; }
  td { padding: 7px 12px; border-bottom: 1px solid #1f1f1f; color: #f5f5f0; }
  tr:nth-child(even) td { background: #0d0d0d; }
  tr:nth-child(odd) td { background: #0a0a0a; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 4px 10px; border-radius: 2px; background: #111; border: 1px solid #1f1f1f; font-size: 11px; font-weight: 500; color: #f5f5f0; }
  .chip-count { font-family: 'JetBrains Mono', monospace; color: #888; font-size: 10px; margin-left: 4px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #1f1f1f; font-family: 'JetBrains Mono', monospace; color: #333; font-size: 10px; text-align: center; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  @media print { body { padding: 24px; } h2 { break-after: avoid; } }
</style>
</head>
<body>

<div class="header">
  <h1>AI Visibility Index — Project Report</h1>
  <p class="subtitle">${proj?.name ?? ""} · ${proj?.target_brand ?? ""} · ${allRuns.length} ${t("results.analyses")} · ${dateRange}</p>
</div>

<div class="grid">
  <div class="stat"><div class="val avi-val">${latestAvi?.avi_score ?? "—"}</div><div class="lbl">AVI Score (latest)</div></div>
  <div class="stat"><div class="val">${mentionRate}%</div><div class="lbl">${t("dashboard.brandMentions")}</div></div>
  <div class="stat"><div class="val">${allRuns.length}</div><div class="lbl">${t("results.analyses")}</div></div>
  <div class="stat"><div class="val">${compList.length}</div><div class="lbl">${t("sidebar.competitors")}</div></div>
</div>

<h2>AVI Trend <span class="count">(${trendRows.length} runs)</span></h2>
<table>
  <thead><tr><th>Version</th><th>${t("results.date")}</th><th>AVI</th><th>${t("dashboard.presence")}</th><th>${t("dashboard.sentiment")}</th></tr></thead>
  <tbody>${trendRows.map((r) => `<tr>
    <td class="mono">${r.version}</td>
    <td class="mono" style="color:#888">${r.date}</td>
    <td class="mono" style="color:#4ade80;font-weight:600">${typeof r.avi === "number" ? Math.round(r.avi * 10) / 10 : r.avi}</td>
    <td class="mono">${typeof r.presence === "number" ? Math.round(r.presence) : r.presence}</td>
    <td class="mono">${typeof r.sentiment === "number" ? Math.round(r.sentiment) : r.sentiment}</td>
  </tr>`).join("")}</tbody>
</table>

<h2>${t("sidebar.competitors")} <span class="count">(${compList.length})</span></h2>
${compList.length > 0 ? `
<table>
  <thead><tr><th>${t("sidebar.competitors")}</th><th>${t("sources.citationsLabel")}</th></tr></thead>
  <tbody>${compList.slice(0, 30).map(([name, count]) => `<tr><td>${name}</td><td class="mono">${count}</td></tr>`).join("")}</tbody>
</table>` : `<p style="color:#888;padding:16px 0">${t("dashboard.noCompetitorFound")}</p>`}

<h2>Topic <span class="count">(${topicList.length})</span></h2>
<div class="chips">
  ${topicList.slice(0, 40).map(([name, count]) => `<span class="chip">${name}<span class="chip-count">(${count})</span></span>`).join("")}
</div>

<div class="footer">
  AI Visibility Index · Project Report · ${new Date().toLocaleDateString(locale)} · ai.citationrate.com
</div>

</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="AVI-Project-Report-${brandName}-${todayStr}.html"`,
    },
  });
}
