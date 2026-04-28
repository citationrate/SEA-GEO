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

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const runId = params.runId;
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

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  const r = run as any;

  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand, sector, urls")
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

  const domainMap = new Map<string, { citations: number; type: string }>();
  (sources ?? []).forEach((s: any) => {
    const d = s.domain ?? "—";
    const ex = domainMap.get(d);
    if (ex) ex.citations += s.citation_count ?? 1;
    else domainMap.set(d, { citations: s.citation_count ?? 1, type: s.source_type ?? "other" });
  });
  const domainList = Array.from(domainMap.entries()).sort((a, b) => b[1].citations - a[1].citations);

  const totalAnalysed = analysesList.length;
  const mentionCount = analysesList.filter((x) => x.brand_mentioned).length;
  const mentionRate = totalAnalysed > 0 ? Math.round((mentionCount / totalAnalysed) * 100) : 0;

  const date = r.completed_at
    ? new Date(r.completed_at).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const todayStr = new Date().toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const aviScore = Number(a?.avi_score ?? 0);
  const aviScoreColor = scoreToColor(aviScore);
  const verdict = scoreVerdict(aviScore, locale);

  const presence = Number(a?.presence_score ?? 0);
  const position = Number(a?.rank_score ?? 0);
  const sentiment = Number(a?.sentiment_score ?? 0);
  const stability = Number(a?.stability_score ?? 0);
  const avgRank = a?.avg_brand_rank != null ? Number(a.avg_brand_rank) : null;

  const positionQualifier =
    position >= 70 ? ls.positionHigh
    : position >= 40 ? ls.positionMid
    : ls.positionLow;

  const stabilityLabel =
    stability > 80 ? t("dashboard.highReliability")
    : stability >= 50 ? t("dashboard.mediumReliability")
    : t("dashboard.lowReliability");

  const projectUrl = Array.isArray(proj?.urls) && proj.urls.length > 0 ? proj.urls[0] : null;

  const headerBlock = `
    <div class="header">
      <div class="brand-title">AI Visibility Index</div>
      <div class="brand-subtitle">${escapeHtml(ls.reportSubtitle)}</div>
    </div>

    <div class="project-name">${escapeHtml(proj?.name ?? proj?.target_brand ?? "")}</div>
    <div class="project-meta">
      ${proj?.target_brand ? `Brand: ${escapeHtml(proj.target_brand)}` : ""}${proj?.target_brand && proj?.sector ? " · " : ""}${proj?.sector ? `${escapeHtml(ls.sector)}: ${escapeHtml(proj.sector)}` : ""}
      ${projectUrl ? `<br>${escapeHtml(projectUrl)}` : ""}
      <br>v${escapeHtml(r.version)} · ${escapeHtml(date)}
    </div>

    <div class="big-score-row">
      <span class="big-score-num" style="color:${aviScoreColor}">${aviScore.toFixed(aviScore % 1 === 0 ? 0 : 1)}</span>
      <span class="big-score-suffix">/ 100</span>
    </div>
    <div class="big-score-label">
      <span class="verdict" style="color:${aviScoreColor}">${escapeHtml(verdict)}</span>
      <span> — ${escapeHtml(t("dashboard.aviIndex"))}</span>
    </div>
  `;

  const kpiBlock = renderKpiRow([
    { val: aviScore.toFixed(aviScore % 1 === 0 ? 0 : 1), label: "AVI Score", color: aviScoreColor },
    { val: `${mentionRate}%`, label: t("dashboard.brandMentions") },
    { val: compList.length, label: t("sidebar.competitors") },
    { val: domainList.length, label: t("sources.title") },
  ]);

  const componentsBlock = a ? `
    <h2 class="section">${escapeHtml(t("runDetail.aviComparison"))}</h2>
    ${renderBars([
      { label: t("dashboard.presence"), value: presence, color: PALETTE.presence },
      { label: t("dashboard.position"), value: position, color: scoreToColor(position), qualifier: positionQualifier },
      { label: t("dashboard.sentiment"), value: sentiment, color: PALETTE.sentiment },
    ])}
    ${avgRank != null ? `<p style="font-size:8.5pt;color:${PALETTE.textMuted};margin-top:6pt;margin-left:102pt">↳ ${escapeHtml(ls.whenCitedRank)} ${avgRank.toFixed(1)}° ${escapeHtml(ls.positionLower)}</p>` : ""}
    <span class="verdict-pill" style="color:${scoreToColor(stability)}">${escapeHtml(stabilityLabel)} (${Math.round(stability)})</span>
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
    ${renderChips(topicList.slice(0, 60).map(([name, count]) => ({ name, count })))}
  ` : "";

  const sourcesBlock = `
    <h2 class="section">${escapeHtml(t("sources.title"))} (${domainList.length})</h2>
    ${domainList.length > 0
      ? renderTable(
          [
            { label: "Domain" },
            { label: "Type" },
            { label: t("sources.citationsLabel"), align: "right" },
          ],
          domainList.slice(0, 50).map(([domain, info]) => [domain, info.type, info.citations]),
          { alternating: true }
        )
      : renderEmpty(t("sources.noSourceFound"))}
  `;

  const promptsCount = (prompts ?? []).length;
  const promptSummaryBlock = promptsCount > 0 ? `
    <h2 class="section">${escapeHtml(t("runMetrics.promptsExecuted"))} (${promptsCount})</h2>
    ${renderTable(
      [
        { label: "#", width: "30pt" },
        { label: t("datasets.model") },
        { label: t("datasets.brand") },
        { label: t("datasets.rank"), align: "right" },
        { label: t("dashboard.sentiment"), align: "right" },
      ],
      (prompts ?? []).map((p: any, i: number) => {
        const x = analysisMap.get(p.id) as any;
        return [
          i + 1,
          p.model,
          x?.brand_mentioned ? "✓" : "—",
          x?.brand_rank ?? "—",
          x?.sentiment_score != null
            ? (x.sentiment_score > 0 ? "+" : "") + Number(x.sentiment_score).toFixed(2)
            : "—",
        ];
      }),
      { alternating: true }
    )}
  ` : "";

  let transcriptBlock = "";
  if (isPro && promptsCount > 0) {
    const tStrings = getTranscriptStrings(locale);
    const transcriptItems: TranscriptItem[] = (prompts ?? []).map((p: any, i: number) => {
      const x = analysisMap.get(p.id) as any;
      return {
        index: i + 1,
        model: p.model,
        brand: x?.brand_mentioned ? "yes" : "",
        rank: x?.brand_rank ?? null,
        fullPrompt: p.full_prompt_text ?? "",
        rawResponse: p.raw_response ?? null,
        errorText: p.error ?? null,
      };
    });
    transcriptBlock = renderTranscriptAppendix(transcriptItems, tStrings);
  }

  const bodyHtml = `
    ${headerBlock}
    ${kpiBlock}
    ${componentsBlock}
    ${competitorBlock}
    ${topicBlock}
    ${sourcesBlock}
    ${promptSummaryBlock}
    ${transcriptBlock}
  `;

  const html = buildDocument({
    title: `AVI Report - ${proj?.name ?? ""} v${r.version}`,
    bodyHtml,
    styles: STYLES,
    lang: locale,
  });

  const footerLabel = `AI Visibility Index · ${proj?.name ?? ""} · v${r.version}`;
  const pdfBuffer = await htmlToPdf(html, {
    footerHTML: PDF_FOOTER_HTML(footerLabel, todayStr, "avi.citationrate.com"),
    headerHTML: "<span></span>",
    displayHeaderFooter: true,
    margin: { top: "12mm", right: "14mm", bottom: "16mm", left: "14mm" },
  });

  const safeBrand = String(proj?.target_brand ?? proj?.name ?? "report").replace(/[^a-zA-Z0-9]+/g, "-");
  const filename = `AVI-Report-${safeBrand}-v${r.version}.pdf`;

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
