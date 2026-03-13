import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createServiceClient();

  // Step 1: Create competitor_avi table
  const { error: tableError } = await (supabase.rpc as any)("exec_sql", {
    query: `
      CREATE TABLE IF NOT EXISTS competitor_avi (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        competitor_name TEXT NOT NULL,
        avi_score INT NOT NULL DEFAULT 0,
        presence_score NUMERIC NOT NULL DEFAULT 0,
        rank_score NUMERIC NOT NULL DEFAULT 0,
        sentiment_score NUMERIC NOT NULL DEFAULT 0,
        consistency_score NUMERIC NOT NULL DEFAULT 0,
        mention_count INT NOT NULL DEFAULT 0,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, run_id, competitor_name)
      );

      CREATE INDEX IF NOT EXISTS idx_competitor_avi_run ON competitor_avi(run_id);
      CREATE INDEX IF NOT EXISTS idx_competitor_avi_project ON competitor_avi(project_id);
    `,
  });

  if (tableError) {
    return NextResponse.json({ error: tableError.message, step: "table" }, { status: 500 });
  }

  // Step 2: Create compute_competitor_avi function
  const { error: fnError } = await (supabase.rpc as any)("exec_sql", {
    query: `
      CREATE OR REPLACE FUNCTION compute_competitor_avi(p_run_id UUID)
      RETURNS VOID AS $$
      DECLARE
        v_project_id UUID;
        v_comp RECORD;
        v_total INT;
        v_presence NUMERIC;
        v_rank NUMERIC;
        v_sentiment NUMERIC;
        v_consistency NUMERIC;
        v_avi INT;
        v_pair RECORD;
        v_pair_scores NUMERIC[];
        v_pair_score NUMERIC;
      BEGIN
        SELECT project_id INTO v_project_id
        FROM analysis_runs WHERE id = p_run_id;
        IF v_project_id IS NULL THEN RETURN; END IF;

        -- Total analyses for this run
        SELECT COUNT(*) INTO v_total
        FROM response_analysis ra
        JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
        WHERE pe.run_id = p_run_id;

        IF v_total = 0 THEN RETURN; END IF;

        -- Delete old competitor_avi for this run
        DELETE FROM competitor_avi WHERE run_id = p_run_id;

        -- For each competitor found in this run
        FOR v_comp IN
          SELECT DISTINCT unnest(ra.competitors_found) AS name
          FROM response_analysis ra
          JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
          WHERE pe.run_id = p_run_id
        LOOP
          -- Presence: % of responses that mention this competitor
          SELECT COUNT(*) FILTER (WHERE v_comp.name = ANY(ra.competitors_found))::NUMERIC / v_total
          INTO v_presence
          FROM response_analysis ra
          JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
          WHERE pe.run_id = p_run_id;

          -- Rank: competitors don't have brand_rank, so use inverse of position in competitors_found
          -- Approximate: count how often they appear early in the list
          SELECT COALESCE(AVG(
            CASE WHEN pos > 0 THEN GREATEST(0, 1.0 - (pos - 1)::NUMERIC / 10) ELSE 0 END
          ), 0) INTO v_rank
          FROM (
            SELECT array_position(ra.competitors_found, v_comp.name) AS pos
            FROM response_analysis ra
            JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
            WHERE pe.run_id = p_run_id AND v_comp.name = ANY(ra.competitors_found)
          ) sub;

          -- Sentiment: avg sentiment of responses mentioning this competitor, normalized
          SELECT COALESCE((AVG(ra.sentiment_score) + 1) / 2, 0.5) INTO v_sentiment
          FROM response_analysis ra
          JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
          WHERE pe.run_id = p_run_id
            AND v_comp.name = ANY(ra.competitors_found)
            AND ra.sentiment_score IS NOT NULL;

          -- Consistency: per query+segment, do they consistently mention this competitor?
          v_pair_scores := ARRAY[]::NUMERIC[];
          FOR v_pair IN
            SELECT pe.query_id, pe.segment_id,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE v_comp.name = ANY(ra.competitors_found)) AS mentioned
            FROM response_analysis ra
            JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
            WHERE pe.run_id = p_run_id
            GROUP BY pe.query_id, pe.segment_id
            HAVING COUNT(*) FILTER (WHERE v_comp.name = ANY(ra.competitors_found)) > 0
          LOOP
            IF v_pair.total <= 1 THEN
              v_pair_scores := array_append(v_pair_scores, 1.0);
            ELSE
              v_pair_score := v_pair.mentioned::NUMERIC / v_pair.total;
              v_pair_scores := array_append(v_pair_scores, v_pair_score);
            END IF;
          END LOOP;

          IF array_length(v_pair_scores, 1) > 0 THEN
            SELECT AVG(unnest) INTO v_consistency FROM unnest(v_pair_scores);
          ELSE
            v_consistency := 0;
          END IF;

          -- AVI = presenza×0.40 + posizione×0.35 + sentiment×0.25 (consistency esclusa)
          v_avi := ROUND(v_presence * 40 + v_rank * 35 + v_sentiment * 25);

          INSERT INTO competitor_avi (project_id, run_id, competitor_name, avi_score, presence_score, rank_score, sentiment_score, consistency_score, mention_count, computed_at)
          VALUES (v_project_id, p_run_id, v_comp.name, v_avi,
                  v_presence, v_rank, v_sentiment, v_consistency,
                  (SELECT COUNT(*) FROM response_analysis ra
                   JOIN prompts_executed pe ON pe.id = ra.prompt_executed_id
                   WHERE pe.run_id = p_run_id AND v_comp.name = ANY(ra.competitors_found)),
                  NOW());
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  if (fnError) {
    return NextResponse.json({ error: fnError.message, step: "function" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "competitor_avi table and function created" });
}
