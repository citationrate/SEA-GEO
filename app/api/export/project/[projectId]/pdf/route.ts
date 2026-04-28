import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";
import { isProUser } from "@/lib/utils/is-pro";
import { htmlToPdf } from "@/lib/pdf/render";
import { STYLES, PDF_FOOTER_HTML, PALETTE, scoreToColor, scoreVerdict } from "@/lib/pdf/styles";
import {
  buildDocument,
  renderKpiRow,
  renderBars,
  renderTable,
  renderChips,
  renderEmpty,
  renderTranscriptAppendix,
  getTranscriptStrings,
  getLocaleStrings,
  escapeHtml,
  type TranscriptItem,
} from "@/lib/pdf/templates";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_TRANSCRIPT_ITEMS_PROJECT = 800;

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const projectId = params.projectId;
  const locale = getLocaleFromRequest(request);
  const t = getServerTranslator(locale);
  const ls = getLocaleStrings(locale);

  let isPro = false;
  if (user) {
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("plan")
      .eq("id", user.id)
      .single();
    isPro = isProUser(profile);
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand, sector, urls, user_id")
    .eq("id", projectId)
    .single();
  const proj = project as any;
  if (!proj || proj.user_id !== user!.id) {
    return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  }

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
  const runMap = new Map(allRuns.map((r) => [r.id, r]));

  const { data: aviHistory } = await supabase
    .from("avi_history")
    .select("*")
    .in("run_id", runIds)
    .order("computed_at", { ascending: true });
  const aviList = (aviHistory ?? []) as any[];
  const aviMap = new Map(aviList.map((a) => [a.run_id, a]));

  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  const promptsList = (prompts ?? []) as any[];
  const promptIds = promptsList.map((p) => p.id);

  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };
  const analysesList = (analyses ?? []) as any[];
  const analysisMap = new Map(analysesList.map((x: any) => [x.prompt_executed_id, x]));

  const compMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.competitors_found ?? []).forEach((c: string) => compMap.set(c, (compMap.get(c) ?? 0) + 1))
  );
  const compList = Array.from(compMap.entries()).sort((a, b) => b[1] - a[1]);

  const topicMap = new Map<string, number>();
  analysesList.forEach((x) =>
    (x.topics ?? []).forEach((tp: string) => topicMap.set(tp, (topicMap.get(tp) ?? 0) + 1))
  );
  const topicList = Array.from(topicMap.entries()).sort((a, b) => b[1] - a[1]);

  const totalMentioned = analysesList.filter((x) => x.brand_mentioned).length;
  const mentionRate = analysesList.length > 0 ? Math.round((totalMentioned / analysesList.length) * 100) : 0;
  const latestAvi = aviList.length > 0 ? aviList[aviList.length - 1] : null;
  const latestAviScore = Number(latestAvi?.avi_score ?? 0);
  const aviScoreColor = scoreToColor(latestAviScore);
  const verdict = scoreVerdict(latestAviScore, locale);

  const todayStr = new Date().toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateRange = from || to
    ? `${from ?? "..."} → ${to ?? "..."}`
    : `${allRuns[0].completed_at ? new Date(allRuns[0].completed_at).toLocaleDateString(locale) : ""} → ${allRuns[allRuns.length - 1].completed_at ? new Date(allRuns[allRuns.length - 1].completed_at).toLocaleDateString(locale) : ""}`;

  const projectUrl = Array.isArray(proj?.urls) && proj.urls.length > 0 ? proj.urls[0] : null;

  const headerBlock = `
    <div class="header">
      <div class="brand-title">AI Visibility Index</div>
      <div class="brand-subtitle">${escapeHtml(ls.projectReportSubtitle)}</div>
    </div>

    <div class="project-name">${escapeHtml(proj?.name ?? proj?.target_brand ?? "")}</div>
    <div class="project-meta">
      ${proj?.target_brand ? `Brand: ${escapeHtml(proj.target_brand)}` : ""}${proj?.target_brand && proj?.sector ? " · " : ""}${proj?.sector ? `${escapeHtml(ls.sector)}: ${escapeHtml(proj.sector)}` : ""}
      ${projectUrl ? `<br>${escapeHtml(projectUrl)}` : ""}
      <br>${allRuns.length} ${escapeHtml(t("results.analyses"))} · ${escapeHtml(dateRange)}
    </div>

    <div class="big-score-row">
      <span class="big-score-num" style="color:${aviScoreColor}">${latestAviScore.toFixed(latestAviScore % 1 === 0 ? 0 : 1)}</span>
      <span class="big-score-suffix">/ 100</span>
    </div>
    <div class="big-score-label">
      <span class="verdict" style="color:${aviScoreColor}">${escapeHtml(verdict)}</span>
      <span> — AVI Score (${escapeHtml(ls.latest)})</span>
    </div>
  `;

  const kpiBlock = renderKpiRow([
    { val: latestAviScore.toFixed(latestAviScore % 1 === 0 ? 0 : 1), label: "AVI Score", color: aviScoreColor },
    { val: `${mentionRate}%`, label: t("dashboard.brandMentions") },
    { val: allRuns.length, label: t("results.analyses") },
    { val: compList.length, label: t("sidebar.competitors") },
  ]);

  const trendBlock = `
    <h2 class="section">AVI Trend (${allRuns.length})</h2>
    ${renderTable(
      [
        { label: "Version" },
        { label: t("results.date") },
        { label: "AVI", align: "right" },
        { label: t("dashboard.presence"), align: "right" },
        { label: t("dashboard.position"), align: "right" },
        { label: t("dashboard.sentiment"), align: "right" },
      ],
      allRuns.map((r) => {
        const ah = aviMap.get(r.id) as any;
        const date = r.completed_at
          ? new Date(r.completed_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })
          : `v${r.version}`;
        return [
          `v${r.version}`,
          date,
          ah?.avi_score != null ? Number(ah.avi_score).toFixed(1) : "—",
          ah?.presence_score != null ? Math.round(Number(ah.presence_score)) : "—",
          ah?.rank_score != null ? Math.round(Number(ah.rank_score)) : "—",
          ah?.sentiment_score != null ? Math.round(Number(ah.sentiment_score)) : "—",
        ];
      }),
      { alternating: true }
    )}
  `;

  const componentsBlock = latestAvi ? `
    <h2 class="section">${escapeHtml(t("runDetail.aviComparison"))} — ${escapeHtml(ls.latest)}</h2>
    ${renderBars([
      { label: t("dashboard.presence"), value: Number(latestAvi.presence_score ?? 0), color: PALETTE.presence },
      { label: t("dashboard.position"), value: Number(latestAvi.rank_score ?? 0), color: scoreToColor(Number(latestAvi.rank_score ?? 0)) },
      { label: t("dashboard.sentiment"), value: Number(latestAvi.sentiment_score ?? 0), color: PALETTE.sentiment },
    ])}
  ` : "";

  const competitorBlock = `
    <h2 class="section">${escapeHtml(t("sidebar.competitors"))} (${compList.length})</h2>
    ${compList.length > 0
      ? renderTable(
          [
            { label: t("sidebar.competitors") },
            { label: t("sources.citationsLabel"), align: "right" },
          ],
          compList.slice(0, 80).map(([name, count]) => [name, count]),
          { alternating: true }
        )
      : renderEmpty(t("dashboard.noCompetitorFound"))}
  `;

  const topicBlock = topicList.length > 0 ? `
    <h2 class="section">Topic (${topicList.length})</h2>
    ${renderChips(topicList.slice(0, 80).map(([name, count]) => ({ name, count })))}
  ` : "";

  let transcriptBlock = "";
  if (isPro && promptsList.length > 0) {
    const tStrings = getTranscriptStrings(locale);

    const sortedPrompts = [...promptsList].sort((a, b) => {
      const ra = runMap.get(a.run_id) as any;
      const rb = runMap.get(b.run_id) as any;
      const ta = ra?.completed_at ? new Date(ra.completed_at).getTime() : 0;
      const tb = rb?.completed_at ? new Date(rb.completed_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return da - db;
    });

    const cap = MAX_TRANSCRIPT_ITEMS_PROJECT;
    const capped = sortedPrompts.slice(0, cap);
    const truncated = sortedPrompts.length > cap;

    const items: TranscriptItem[] = capped.map((p, i) => {
      const x = analysisMap.get(p.id) as any;
      const r = runMap.get(p.run_id) as any;
      return {
        index: i + 1,
        model: p.model,
        brand: x?.brand_mentioned ? "yes" : "",
        rank: x?.brand_rank ?? null,
        fullPrompt: p.full_prompt_text ?? "",
        rawResponse: p.raw_response ?? null,
        runVersion: r?.version ?? null,
        runDate: r?.completed_at
          ? new Date(r.completed_at).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
          : null,
      };
    });

    transcriptBlock = renderTranscriptAppendix(items, tStrings);
    if (truncated) {
      transcriptBlock += `<p style="color:${PALETTE.textMuted};font-size:8.5pt;font-style:italic;margin-top:12pt">${escapeHtml(`(${sortedPrompts.length - cap}+ ${ls.transcriptOmitted})`)}</p>`;
    }
  }

  const bodyHtml = `
    ${headerBlock}
    ${kpiBlock}
    ${trendBlock}
    ${componentsBlock}
    ${competitorBlock}
    ${topicBlock}
    ${transcriptBlock}
  `;

  const html = buildDocument({
    title: `AVI Project Report - ${proj?.name ?? ""}`,
    bodyHtml,
    styles: STYLES,
    lang: locale,
  });

  const footerLabel = `AI Visibility Index · ${proj?.name ?? ""} · Project Report`;
  const pdfBuffer = await htmlToPdf(html, {
    footerHTML: PDF_FOOTER_HTML(footerLabel, todayStr, "avi.citationrate.com"),
    headerHTML: "<span></span>",
    displayHeaderFooter: true,
    margin: { top: "12mm", right: "14mm", bottom: "16mm", left: "14mm" },
  });

  const safeBrand = String(proj?.target_brand ?? proj?.name ?? "project").replace(/[^a-zA-Z0-9]+/g, "-");
  const todayFile = new Date().toISOString().split("T")[0];
  const filename = `AVI-Project-Report-${safeBrand}-${todayFile}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
