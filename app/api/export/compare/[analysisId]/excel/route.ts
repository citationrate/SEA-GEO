import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getServerTranslator, getLocaleFromRequest } from "@/lib/i18n/server";
import { isProUser } from "@/lib/utils/is-pro";
import { modelIdToBrand } from "@citationrate/llm-client";

// Excel export per i confronti 1v1. Specchio funzionale del PDF in
// ../pdf/route.ts — qualunque KPI nuovo aggiunto al detail page deve
// finire qui per non lasciare l'export indietro.

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

  // Ownership gate: la pagina mostra a chiunque arrivi sull'URL,
  // ma il file scaricabile resta limitato al proprietario.
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

  // Storico per la stessa coppia + driver (utile a chi rivede il trend).
  const { data: history } = await (supabase.from("competitive_analyses") as any)
    .select("id, win_rate_a, win_rate_b, fmr_a, fmr_b, comp_score_a, status, created_at, mode")
    .eq("brand_a", a.brand_a)
    .eq("brand_b", a.brand_b)
    .eq("driver", a.driver)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  const num = (v: any) => (v != null ? Number(v) : null);
  const fmt = (v: any) => {
    const n = num(v);
    return n == null || Number.isNaN(n) ? "—" : Math.round(n);
  };

  const wb = XLSX.utils.book_new();

  // Sheet 1 — Riepilogo
  const compScore = num(a.comp_score_a);
  const verdictKey = compScore == null
    ? "—"
    : compScore >= 60 ? t("compare.dominant")
    : compScore >= 40 ? t("compare.competitive")
    : t("compare.disadvantaged");

  const summaryRows = [
    ["AI Visibility Index — Confronto 1v1"],
    [],
    [t("compare.comparison"), `${a.brand_a} vs ${a.brand_b}`],
    [t("compare.driver"), a.driver ?? "—"],
    [t("compare.project"), proj?.name ?? "—"],
    [t("results.status"), a.status ?? "—"],
    [t("compare.date"), a.created_at ? new Date(a.created_at).toLocaleString(locale) : "—"],
    [],
    ["--- CompScore ---"],
    ["CompScore", compScore != null ? Math.round(compScore) : "—"],
    [t("compare.status"), verdictKey],
    [],
    ["--- Win Rate ---"],
    [`Win Rate ${a.brand_a}`, fmt(a.win_rate_a) + "%"],
    [`Win Rate ${a.brand_b}`, fmt(a.win_rate_b) + "%"],
    [],
    ["--- First Mention Rate ---"],
    [`FMR ${a.brand_a}`, fmt(a.fmr_a) + "%"],
    [`FMR ${a.brand_b}`, fmt(a.fmr_b) + "%"],
    [],
    ["Prompts Total", promptList.length],
    ["Prompts Completed", promptList.filter((p) => p.status === "completed").length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Riepilogo");

  // Sheet 2 — Prompt Detail
  // recommendation: 1 = brand_a vince, 2 = brand_b vince, 0.5 = pareggio.
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

  const promptBaseHeaders = [
    "#", "Pattern", t("datasets.model"), "Run #", "Query",
    t("compare.preference"), t("compare.firstMention"),
    "Argomenti chiave", t("results.status"),
  ];
  const promptHeaders = isPro ? [...promptBaseHeaders, "Risposta completa"] : promptBaseHeaders;

  const promptRows = promptList.map((p, i) => {
    const row: (string | number)[] = [
      i + 1,
      p.pattern_type ?? "—",
      modelIdToBrand(p.model)?.brand ?? p.model ?? "—",
      p.run_number ?? 1,
      p.query_text ?? "—",
      winnerLabel(p.recommendation),
      firstMentionLabel(p.first_mention),
      Array.isArray(p.key_arguments) ? p.key_arguments.join(" • ") : "",
      p.status ?? "—",
    ];
    if (isPro) row.push(p.response_text ?? "");
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([promptHeaders, ...promptRows]), "Prompt Detail");

  // Sheet 3 — Breakdown per modello
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
  const modelHeaders = [
    t("datasets.model"),
    "Prompts",
    `Win ${a.brand_a}`,
    `Win ${a.brand_b}`,
    t("compare.draw"),
    `FMR ${a.brand_a}`,
    `FMR ${a.brand_b}`,
  ];
  const modelRows = Array.from(byModel.entries())
    .sort((x, y) => y[1].total - x[1].total)
    .map(([model, b]) => {
      const winRateA = b.total > 0 ? Math.round((b.winsA / b.total) * 100) : 0;
      const winRateB = b.total > 0 ? Math.round((b.winsB / b.total) * 100) : 0;
      const fmrA = b.total > 0 ? Math.round((b.fmA / b.total) * 100) : 0;
      const fmrB = b.total > 0 ? Math.round((b.fmB / b.total) * 100) : 0;
      return [
        modelIdToBrand(model)?.brand ?? model,
        b.total,
        `${b.winsA} (${winRateA}%)`,
        `${b.winsB} (${winRateB}%)`,
        b.draws,
        `${fmrA}%`,
        `${fmrB}%`,
      ];
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([modelHeaders, ...modelRows]), "Per Modello");

  // Sheet 4 — Storico (stessa coppia + driver)
  const historyList = (history ?? []) as any[];
  const historyHeaders = [
    t("compare.date"),
    "Mode",
    `Win ${a.brand_a}`,
    `Win ${a.brand_b}`,
    `FMR ${a.brand_a}`,
    `FMR ${a.brand_b}`,
    "CompScore",
  ];
  const historyRows = historyList.map((h) => [
    h.created_at ? new Date(h.created_at).toLocaleDateString(locale) : "—",
    h.mode ?? "—",
    `${fmt(h.win_rate_a)}%`,
    `${fmt(h.win_rate_b)}%`,
    `${fmt(h.fmr_a)}%`,
    `${fmt(h.fmr_b)}%`,
    fmt(h.comp_score_a),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([historyHeaders, ...historyRows]), "Storico");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const safe = (s: string) => String(s ?? "report").replace(/[^a-zA-Z0-9]+/g, "-");
  const filename = `AVI-Confronto-${safe(a.brand_a)}-vs-${safe(a.brand_b)}-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
