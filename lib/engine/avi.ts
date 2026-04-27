export interface AVIComponents {
  presence_score: number;
  rank_score: number;
  sentiment_score: number;
  stability_score: number;
  /** Mean brand_rank across prompts where brand was mentioned. NULL if 0 mentions. */
  avg_brand_rank: number | null;
}

export interface AVIResult {
  avi_score: number;
  components: AVIComponents;
}

interface AnalysisRow {
  brand_mentioned: boolean;
  brand_rank: number | null;
  sentiment_score: number | null;
  run_number: number;
  query_id: string;
  segment_id: string;
}

/**
 * Calcola l'AI Visibility Index (0-100) dai risultati di analisi.
 *
 * Formula definitiva:
 *   AVI = Presenza × 40% + Posizione × 35% + Sentiment × 25%
 *
 * Tutti i valori vengono mediati su TUTTI i prompt, usando 0 per quelli senza brand:
 * - Presenza (40%): (prompt con brand / totale prompt) × 100
 * - Posizione (35%): AVG(brand_rank > 0 ? MAX(0, 100-(rank-1)×20) : 0) su tutti i prompt
 * - Sentiment (25%): AVG(brand_mentioned ? (sentiment+1)×50 : 0) su tutti i prompt
 *
 * Consistency (Affidabilità) è calcolata ma NON inclusa nella formula AVI.
 * È una metrica separata di affidabilità del dato:
 *   (1 - stddev(brand_mentioned ? 1 : 0)) × 100
 */
export function calculateAVI(analyses: AnalysisRow[]): AVIResult {
  if (analyses.length === 0) {
    return {
      avi_score: 0,
      components: { presence_score: 0, rank_score: 0, sentiment_score: 0, stability_score: 0, avg_brand_rank: null },
    };
  }

  // --- Consistency (Affidabilità): (1 - stddev(brand_mentioned ? 1 : 0)) × 100 ---
  const mentionValues: number[] = analyses.map((a) => (a.brand_mentioned ? 1 : 0));
  const mean = mentionValues.reduce((s, v) => s + v, 0) / mentionValues.length;
  const variance = mentionValues.reduce((s, v) => s + (v - mean) ** 2, 0) / mentionValues.length;
  const stddev = Math.sqrt(variance);
  const stability_score = (1 - stddev) * 100;

  // --- Check: if brand not mentioned in ANY prompt, AVI = 0 ---
  const mentionedCount = analyses.filter((a) => a.brand_mentioned).length;
  if (mentionedCount === 0) {
    return {
      avi_score: 0,
      components: {
        presence_score: 0,
        rank_score: 0,
        sentiment_score: 0,
        stability_score: Math.round(stability_score * 100) / 100,
        avg_brand_rank: null,
      },
    };
  }

  // --- Presenza (40%): % prompt con brand menzionato ---
  const presence_score = (mentionedCount / analyses.length) * 100;

  // --- Posizione (35%): AVG su TUTTI i prompt, 0 per non menzionati ---
  const rankValues = analyses.map((a) => {
    if (!a.brand_mentioned || a.brand_rank === null || a.brand_rank <= 0) return 0;
    return Math.max(0, 100 - (a.brand_rank - 1) * 20);
  });
  const rank_score = rankValues.reduce((s, v) => s + v, 0) / rankValues.length;

  // --- Sentiment (25%): AVG su TUTTI i prompt, 0 per non menzionati ---
  const sentimentValues = analyses.map((a) => {
    if (!a.brand_mentioned) return 0;
    if (a.sentiment_score === null) return 0;
    return (a.sentiment_score + 1) * 50;
  });
  const sentiment_score = sentimentValues.reduce((s, v) => s + v, 0) / sentimentValues.length;

  // --- Posizione media (raw): media di brand_rank sui prompt che lo menzionano.
  // Diversa da rank_score (normalizzato 0-100, con 0 per i non-menzionanti).
  // Serve a rispondere alla domanda "quando vengo citato, in che posizione sono?".
  const ranksWhenCited = analyses
    .filter((a) => a.brand_mentioned && a.brand_rank !== null && a.brand_rank > 0)
    .map((a) => a.brand_rank as number);
  const avg_brand_rank = ranksWhenCited.length > 0
    ? Math.round((ranksWhenCited.reduce((s, v) => s + v, 0) / ranksWhenCited.length) * 10) / 10
    : null;

  // --- AVI composito: Presenza 40% + Posizione 35% + Sentiment 25% ---
  const avi_score = Math.round(
    (presence_score * 0.40 +
    rank_score * 0.35 +
    sentiment_score * 0.25) * 10
  ) / 10;

  return {
    avi_score: Math.max(0, Math.min(100, avi_score)),
    components: {
      presence_score: Math.round(presence_score * 100) / 100,
      rank_score: Math.round(rank_score * 100) / 100,
      sentiment_score: Math.round(sentiment_score * 100) / 100,
      stability_score: Math.round(stability_score * 100) / 100,
      avg_brand_rank,
    },
  };
}
