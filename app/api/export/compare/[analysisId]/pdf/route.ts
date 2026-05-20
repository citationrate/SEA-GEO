import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";
import { isProUser } from "@/lib/utils/is-pro";
import { htmlToPdf } from "@/lib/pdf/render";
import { STYLES, PDF_FOOTER_HTML, PALETTE, scoreToColor } from "@/lib/pdf/styles";
import {
  buildDocument,
  renderKpiRow,
  renderTable,
  renderEmpty,
  escapeHtml,
} from "@/lib/pdf/templates";
import { modelIdToBrand } from "@citationrate/llm-client";

// PDF export per i confronti 1v1. Specchio dell'Excel route in ../excel/route.ts;
// stessa logica di gating (proprietario) e stessi KPI di base.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { analysisId: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const analysisId = params.analysisId;
  const locale = getLocaleFromRequest(request);
  const t = getServerTranslator(locale);

  let isPro = false;
  if (user) {
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("plan")
      .eq("id", user.id)
      .single();
    isPro = isProUser(profile);
  }

  const { data: analysis } = await (supabase.from("competitive_analyses") as any)
    .select("*")
    .eq("id", analysisId)
    .single();

  if (!analysis) {
    return NextResponse.json({ error: "Confronto non trovato" }, { status: 404 });
  }

  const a = analysis as any;

  if (a.user_id && user && a.user_id !== user.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { data: project } = a.project_id
    ? await supabase
        .from("projects")
        .select("name, target_brand")
        .eq("id", a.project_id)
        .single()
    : { data: null as any };
  const proj = project as any;

  const { data: prompts } = await (supabase.from("competitive_prompts") as any)
    .select("*")
    .eq("analysis_id", analysisId)
    .order("pattern_type", { ascending: true })
    .order("model", { ascending: true })
    .order("run_number", { ascending: true });

  const promptList = (prompts ?? []) as any[];

  const { data: history } = await (supabase.from("competitive_analyses") as any)
    .select("id, win_rate_a, win_rate_b, fmr_a, fmr_b, comp_score_a, status, created_at, mode")
    .eq("brand_a", a.brand_a)
    .eq("brand_b", a.brand_b)
    .eq("driver", a.driver)
    .eq("status", "completed")
    .order("created_at", { ascending: true });
  const historyList = (history ?? []) as any[];

  const num = (v: any) => (v != null ? Number(v) : null);
  const fmt = (v: any) => {
    const n = num(v);
    return n == null || Number.isNaN(n) ? "—" : Math.round(n);
  };

  const compScore = num(a.comp_score_a) ?? 0;
  const compColor = scoreToColor(compScore);
  const verdict =
    compScore >= 60 ? t("compare.dominant")
    : compScore >= 40 ? t("compare.competitive")
    : t("compare.disadvantaged");

  const date = a.created_at
    ? new Date(a.created_at).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const todayStr = new Date().toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const headerBlock = `
    <div class="header">
      <div class="brand-title">AI Visibility Index</div>
      <div class="brand-subtitle">${escapeHtml(t("compare.title"))}</div>
    </div>

    <div class="project-name">${escapeHtml(a.brand_a)} vs ${escapeHtml(a.brand_b)}</div>
    <div class="project-meta">
      ${escapeHtml(t("compare.driver"))}: ${escapeHtml(a.driver ?? "—")}
      ${proj?.name ? ` · ${escapeHtml(t("compare.project"))}: ${escapeHtml(proj.name)}` : ""}
      <br>${escapeHtml(date)}
    </div>

    <div class="big-score-row">
      <span class="big-score-num" style="color:${compColor}">${Math.round(compScore)}</span>
      <span class="big-score-suffix">/ 100</span>
    </div>
    <div class="big-score-label">
      <span class="verdict" style="color:${compColor}">${escapeHtml(verdict)}</span>
      <span> — CompScore</span>
    </div>
  `;

  const kpiBlock = renderKpiRow([
    { val: `${fmt(a.win_rate_a)}%`, label: `Win Rate ${a.brand_a}`, color: PALETTE.primary },
    { val: `${fmt(a.win_rate_b)}%`, label: `Win Rate ${a.brand_b}`, color: PALETTE.red },
    { val: `${fmt(a.fmr_a)}%`, label: `FMR ${a.brand_a}` },
    { val: `${fmt(a.fmr_b)}%`, label: `FMR ${a.brand_b}` },
  ]);

  // Breakdown per modello: per ogni model un riepilogo win/draw.
  const byModel = new Map<string, { total: number; winsA: number; winsB: number; draws: number; fmA: number; fmB: number }>();
  for (const p of promptList) {
    if (p.status !== "completed") continue;
    const model = p.model ?? "—";
    const bucket = byModel.get(model) ?? { total: 0, winsA: 0, winsB: 0, draws: 0, fmA: 0, fmB: 0 };
    bucket.total += 1;
    const rec = num(p.recommendation);
    if (rec === 1) bucket.winsA += 1;
    else if (rec === 2) bucket.winsB += 1;
    else if (rec === 0.5) bucket.draws += 1;
    if (p.first_mention === "A") bucket.fmA += 1;
    else if (p.first_mention === "B") bucket.fmB += 1;
    byModel.set(model, bucket);
  }
  const perModelRows = Array.from(byModel.entries())
    .sort((x, y) => y[1].total - x[1].total)
    .map(([model, b]) => {
      const pct = (n: number) => (b.total > 0 ? `${Math.round((n / b.total) * 100)}%` : "0%");
      return [
        modelIdToBrand(model)?.brand ?? model,
        b.total,
        `${b.winsA} (${pct(b.winsA)})`,
        `${b.winsB} (${pct(b.winsB)})`,
        b.draws,
      ];
    });
  const perModelBlock = `
    <h2 class="section">${escapeHtml(t("datasets.model"))} (${byModel.size})</h2>
    ${perModelRows.length > 0
      ? renderTable(
          [
            { label: t("datasets.model") },
            { label: "Prompts", align: "right" },
            { label: `Win ${a.brand_a}`, align: "right" },
            { label: `Win ${a.brand_b}`, align: "right" },
            { label: t("compare.draw"), align: "right" },
          ],
          perModelRows,
          { alternating: true }
        )
      : renderEmpty("—")}
  `;

  // Riepilogo prompt: lista compatta con preferenza e prima menzione.
  const winnerLabel = (rec: any) => {
    const n = num(rec);
    if (n === 1) return a.brand_a;
    if (n === 2) return a.brand_b;
    if (n === 0.5) return t("compare.draw");
    return "—";
  };
  const firstMentionLabel = (fm: any) => {
    if (fm === "A") return a.brand_a;
    if (fm === "B") return a.brand_b;
    return "—";
  };

  const promptSummaryRows = promptList.map((p, i) => [
    i + 1,
    modelIdToBrand(p.model)?.brand ?? p.model ?? "—",
    p.pattern_type ?? "—",
    winnerLabel(p.recommendation),
    firstMentionLabel(p.first_mention),
  ]);

  const promptSummaryBlock = promptList.length > 0 ? `
    <h2 class="section">${escapeHtml(t("runMetrics.promptsExecuted"))} (${promptList.length})</h2>
    ${renderTable(
      [
        { label: "#", width: "26pt" },
        { label: t("datasets.model") },
        { label: t("compare.pattern") },
        { label: t("compare.preference") },
        { label: t("compare.firstMention") },
      ],
      promptSummaryRows,
      { alternating: true }
    )}
  ` : "";

  // Storico per la stessa coppia + driver
  const historyBlock = historyList.length > 1 ? `
    <h2 class="section">${escapeHtml(t("compare.historicalAnalyses"))} (${historyList.length})</h2>
    ${renderTable(
      [
        { label: t("compare.date") },
        { label: `Win ${a.brand_a}`, align: "right" },
        { label: `Win ${a.brand_b}`, align: "right" },
        { label: `FMR ${a.brand_a}`, align: "right" },
        { label: `FMR ${a.brand_b}`, align: "right" },
        { label: "CompScore", align: "right" },
      ],
      historyList.map((h) => [
        h.created_at ? new Date(h.created_at).toLocaleDateString(locale) : "—",
        `${fmt(h.win_rate_a)}%`,
        `${fmt(h.win_rate_b)}%`,
        `${fmt(h.fmr_a)}%`,
        `${fmt(h.fmr_b)}%`,
        fmt(h.comp_score_a),
      ]),
      { alternating: true }
    )}
  ` : "";

  // Risposte complete: solo Pro. Pattern mutuato dal report AVI run.
  const transcriptBlock = isPro && promptList.length > 0 ? `
    <h2 class="section">${escapeHtml(t("compare.responseDetail"))}</h2>
    ${promptList.map((p, i) => `
      <div class="transcript-item">
        <div class="transcript-header">
          <span class="badge badge-model">${escapeHtml(modelIdToBrand(p.model)?.brand ?? p.model ?? "—")}</span>
          <span class="badge">${escapeHtml(p.pattern_type ?? "—")}</span>
          <span class="badge">#${i + 1}</span>
          <span class="badge" style="color:${compColor}">${escapeHtml(winnerLabel(p.recommendation))}</span>
        </div>
        <div class="transcript-content">
          <div class="transcript-block">
            <span class="lbl">${escapeHtml(t("compare.pattern"))}: ${escapeHtml(p.pattern_type ?? "—")}</span>
            ${escapeHtml(p.query_text ?? "—")}
          </div>
          ${p.response_text ? `
            <div class="transcript-block">
              <span class="lbl">${escapeHtml(t("compare.responseDetail"))}</span>
              ${escapeHtml(p.response_text)}
            </div>
          ` : ""}
          ${Array.isArray(p.key_arguments) && p.key_arguments.length > 0 ? `
            <div class="transcript-block">
              <span class="lbl">${escapeHtml(t("compare.mainArguments"))}</span>
              ${p.key_arguments.map((arg: string) => `<div>• ${escapeHtml(arg)}</div>`).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `).join("")}
  ` : "";

  const bodyHtml = `
    ${headerBlock}
    ${kpiBlock}
    ${perModelBlock}
    ${promptSummaryBlock}
    ${historyBlock}
    ${transcriptBlock}
  `;

  const html = buildDocument({
    title: `AVI Confronto - ${a.brand_a} vs ${a.brand_b}`,
    bodyHtml,
    styles: STYLES,
    lang: locale,
  });

  const footerLabel = `AI Visibility Index · ${a.brand_a} vs ${a.brand_b}`;
  const pdfBuffer = await htmlToPdf(html, {
    footerHTML: PDF_FOOTER_HTML(footerLabel, todayStr, "avi.citationrate.com"),
    headerHTML: "<span></span>",
    displayHeaderFooter: true,
    margin: { top: "12mm", right: "14mm", bottom: "16mm", left: "14mm" },
  });

  const safe = (s: string) => String(s ?? "report").replace(/[^a-zA-Z0-9]+/g, "-");
  const filename = `AVI-Confronto-${safe(a.brand_a)}-vs-${safe(a.brand_b)}-${new Date().toISOString().split("T")[0]}.pdf`;

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
