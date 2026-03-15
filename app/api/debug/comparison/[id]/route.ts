import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * DEBUG ROUTE — GET /api/debug/comparison/[id]
 *
 * Returns raw DB values for every competitive_prompts row in this analysis,
 * showing exactly what is stored in the recommendation column and how
 * the KPI calculation would interpret it.
 *
 * Remove this route once the win rate bug is resolved.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceClient();
  const analysisId = params.id;

  // 1. Fetch the analysis itself
  const { data: analysis, error: analysisErr } = await (supabase.from("competitive_analyses") as any)
    .select("*")
    .eq("id", analysisId)
    .single();

  if (analysisErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found", detail: analysisErr?.message }, { status: 404 });
  }

  // 2. Fetch ALL prompt rows (not just completed) to see full picture
  const { data: allRows, error: rowsErr } = await (supabase.from("competitive_prompts") as any)
    .select("id, pattern_type, model, run_number, status, recommendation, first_mention, response_text")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });

  if (rowsErr) {
    return NextResponse.json({ error: "Failed to fetch prompts", detail: rowsErr.message }, { status: 500 });
  }

  const rows = (allRows ?? []) as any[];

  // 3. Build per-row debug info
  const debugRows = rows.map((row: any) => {
    const rawRec = row.recommendation;
    const rawType = typeof rawRec;
    const asNumber = rawRec != null ? Number(rawRec) : null;
    const isNull = rawRec === null || rawRec === undefined;

    let mapsTo = "EXCLUDED (not completed)";
    if (row.status === "completed") {
      if (isNull) mapsTo = "NULL — not evaluated";
      else if (asNumber === 0) mapsTo = "0 — no recommendation";
      else if (asNumber === 0.5) mapsTo = "0.5 — draw/tie";
      else if (asNumber === 1) mapsTo = `1 — brand A wins (${analysis.brand_a})`;
      else if (asNumber === 2) mapsTo = `2 — brand B wins (${analysis.brand_b})`;
      else mapsTo = `UNEXPECTED value: ${asNumber}`;
    }

    let countsAsWin = "none";
    if (row.status === "completed" && asNumber != null && asNumber > 0) {
      if (asNumber === 1) countsAsWin = "WIN for brand A";
      else if (asNumber === 2) countsAsWin = "WIN for brand B";
      else if (asNumber === 0.5) countsAsWin = "DRAW (counted in validRec but not as win)";
    } else if (row.status === "completed") {
      countsAsWin = "EXCLUDED from validRec (rec is 0 or null)";
    }

    return {
      id: row.id,
      model: row.model,
      pattern: row.pattern_type,
      run: row.run_number,
      status: row.status,
      has_response: !!row.response_text,
      response_preview: row.response_text?.substring(0, 80) ?? null,
      recommendation: {
        raw_value: rawRec,
        raw_typeof: rawType,
        raw_json: JSON.stringify(rawRec),
        as_number: asNumber,
        strict_eq_1: rawRec === 1,
        strict_eq_2: rawRec === 2,
        number_eq_1: asNumber === 1,
        number_eq_2: asNumber === 2,
        is_null: isNull,
      },
      maps_to: mapsTo,
      counts_as: countsAsWin,
      first_mention: row.first_mention,
    };
  });

  // 4. Simulate the KPI calculation exactly as inngest does it
  const completed = debugRows.filter((r: any) => r.status === "completed");
  const total = completed.length;

  const recommendations = completed.map((r: any) => r.recommendation.as_number);
  const firstMentions = completed.map((r: any) => r.first_mention);

  const validRec = recommendations.filter((r: any) => r != null && r > 0);
  const validTotal = validRec.length || 1;
  const winsA = validRec.filter((r: any) => r === 1).length;
  const winsB = validRec.filter((r: any) => r === 2).length;
  const draws = validRec.filter((r: any) => r === 0.5).length;
  const zeros = recommendations.filter((r: any) => r === 0).length;
  const nulls = recommendations.filter((r: any) => r === null).length;

  const winRateA = total > 0 ? Math.round((winsA / validTotal) * 1000) / 10 : 0;
  const winRateB = total > 0 ? Math.round((winsB / validTotal) * 1000) / 10 : 0;
  const fmrA = total > 0 ? Math.round((firstMentions.filter((fm: any) => fm === "A").length / total) * 1000) / 10 : 0;
  const fmrB = total > 0 ? Math.round((firstMentions.filter((fm: any) => fm === "B").length / total) * 1000) / 10 : 0;
  const compScoreA = Math.round((0.6 * winRateA + 0.4 * fmrA) * 10) / 10;

  return NextResponse.json({
    analysis: {
      id: analysis.id,
      brand_a: analysis.brand_a,
      brand_b: analysis.brand_b,
      driver: analysis.driver,
      status: analysis.status,
      stored_kpis: {
        win_rate_a: analysis.win_rate_a,
        win_rate_b: analysis.win_rate_b,
        fmr_a: analysis.fmr_a,
        fmr_b: analysis.fmr_b,
        comp_score_a: analysis.comp_score_a,
        win_rate_a_typeof: typeof analysis.win_rate_a,
      },
    },
    summary: {
      total_rows: rows.length,
      completed: total,
      pending: rows.filter((r: any) => r.status === "pending").length,
      errored: rows.filter((r: any) => r.status === "error").length,
      recommendation_breakdown: {
        wins_brand_a: winsA,
        wins_brand_b: winsB,
        draws,
        no_recommendation: zeros,
        null_not_evaluated: nulls,
        valid_rec_total: validRec.length,
      },
      calculated_kpis: {
        win_rate_a: winRateA,
        win_rate_b: winRateB,
        fmr_a: fmrA,
        fmr_b: fmrB,
        comp_score_a: compScoreA,
      },
      match_stored: {
        win_rate_a_matches: Number(analysis.win_rate_a) === winRateA,
        win_rate_b_matches: Number(analysis.win_rate_b) === winRateB,
      },
    },
    rows: debugRows,
  });
}
