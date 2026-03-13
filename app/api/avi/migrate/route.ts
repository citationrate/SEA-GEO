import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createServiceClient();

  const { error } = await (supabase.rpc as any)("exec_sql", {
    query: `
      CREATE OR REPLACE FUNCTION compute_and_save_avi(p_run_id UUID)
      RETURNS VOID AS $$
      DECLARE
        v_project_id UUID;
        v_total INT;
        v_mentioned INT;
        v_presence NUMERIC;
        v_rank NUMERIC;
        v_sentiment NUMERIC;
        v_consistency NUMERIC;
        v_avi INT;
        v_pair RECORD;
        v_pair_scores NUMERIC[];
        v_pair_score NUMERIC;
        v_group_true INT;
        v_group_total INT;
      BEGIN
        -- Get project_id
        SELECT project_id INTO v_project_id
        FROM analysis_runs WHERE id = p_run_id;

        IF v_project_id IS NULL THEN RETURN; END IF;

        -- Total analyses for this run
        SELECT COUNT(*) INTO v_total
        FROM response_analysis ra
        JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
        WHERE pe.run_id = p_run_id;

        IF v_total = 0 THEN RETURN; END IF;

        -- Presenza: (prompt con brand / totale prompt) × 100
        SELECT COUNT(*) INTO v_mentioned
        FROM response_analysis ra
        JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
        WHERE pe.run_id = p_run_id AND ra.brand_mentioned = true;

        v_presence := (v_mentioned::NUMERIC / v_total) * 100;

        -- Rank score: avg of max(0, 100-(rank-1)*20) su tutti i prompt, 0 se non menzionato
        SELECT COALESCE(
          AVG(CASE
            WHEN ra.brand_mentioned = true AND ra.brand_rank IS NOT NULL AND ra.brand_rank > 0
            THEN GREATEST(0, 100.0 - (ra.brand_rank - 1)::NUMERIC * 20)
            ELSE 0
          END), 0
        ) INTO v_rank
        FROM response_analysis ra
        JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
        WHERE pe.run_id = p_run_id;

        -- Sentiment: AVG((sentiment+1)*50) su tutti i prompt, 0 se non menzionato
        SELECT COALESCE(
          AVG(CASE
            WHEN ra.brand_mentioned = true AND ra.sentiment_score IS NOT NULL
            THEN (ra.sentiment_score + 1) * 50
            ELSE 0
          END), 0
        ) INTO v_sentiment
        FROM response_analysis ra
        JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
        WHERE pe.run_id = p_run_id;

        -- Consistency (ex Stability): per query+segment pair, % agreement
        v_pair_scores := ARRAY[]::NUMERIC[];

        FOR v_pair IN
          SELECT pe.query_id, pe.segment_id,
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE ra.brand_mentioned = true) AS mentioned
          FROM response_analysis ra
          JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
          WHERE pe.run_id = p_run_id
          GROUP BY pe.query_id, pe.segment_id
        LOOP
          IF v_pair.total <= 1 THEN
            v_pair_scores := array_append(v_pair_scores, 1.0);
          ELSE
            v_group_true := v_pair.mentioned;
            v_group_total := v_pair.total;
            v_pair_score := GREATEST(v_group_true, v_group_total - v_group_true)::NUMERIC / v_group_total;
            v_pair_scores := array_append(v_pair_scores, v_pair_score);
          END IF;
        END LOOP;

        IF array_length(v_pair_scores, 1) > 0 THEN
          SELECT AVG(unnest) INTO v_consistency FROM unnest(v_pair_scores);
        ELSE
          v_consistency := 1;
        END IF;

        -- AVI = presenza×0.40 + posizione×0.35 + sentiment×0.25 (consistency esclusa)
        v_avi := ROUND(v_presence * 0.40 + v_rank * 0.35 + v_sentiment * 0.25);

        -- Upsert
        INSERT INTO avi_history (project_id, run_id, avi_score, presence_score, rank_score, sentiment_score, stability_score, computed_at)
        VALUES (v_project_id, p_run_id, v_avi, v_presence, v_rank, v_sentiment, v_consistency, NOW())
        ON CONFLICT (project_id, run_id) DO UPDATE SET
          avi_score = EXCLUDED.avi_score,
          presence_score = EXCLUDED.presence_score,
          rank_score = EXCLUDED.rank_score,
          sentiment_score = EXCLUDED.sentiment_score,
          stability_score = EXCLUDED.stability_score,
          computed_at = EXCLUDED.computed_at;
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "compute_and_save_avi function updated" });
}
