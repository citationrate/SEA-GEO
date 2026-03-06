export interface AVIComponents {
  presence_score: number;
  rank_score: number;
  sentiment_score: number;
  stability_score: number;
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
}

/**
 * Calcola l'AI Visibility Index (0-100) dai risultati di analisi.
 *
 * Componenti:
 * - Presence (35%): percentuale di risposte in cui il brand è menzionato
 * - Rank (25%): posizione media del brand nelle risposte (1=top → 100, non citato=0)
 * - Sentiment (20%): sentiment medio normalizzato a 0-100
 * - Stability (20%): consistenza della menzione tra i diversi run
 */
export function calculateAVI(analyses: AnalysisRow[]): AVIResult {
  if (analyses.length === 0) {
    return {
      avi_score: 0,
      components: { presence_score: 0, rank_score: 0, sentiment_score: 0, stability_score: 0 },
    };
  }

  // --- Presence (35%): % di risposte con brand menzionato ---
  const mentionedCount = analyses.filter((a) => a.brand_mentioned).length;
  const presence_score = (mentionedCount / analyses.length) * 100;

  // --- Rank (25%): media posizione → punteggio ---
  // brand_rank = 1 → 100, rank 10+ → 0, non citato (null) → 0
  let rank_score = 0;
  const allRankScores = analyses.map((a) => {
    if (a.brand_rank === null || a.brand_rank <= 0) return 0;
    return Math.max(0, Math.min(100, ((10 - a.brand_rank) / 9) * 100));
  });
  rank_score = allRankScores.reduce((s, v) => s + v, 0) / allRankScores.length;

  // --- Sentiment (20%): media normalizzata (input -1..1 → 0..100) ---
  const withSentiment = analyses.filter((a) => a.sentiment_score !== null);
  let sentiment_score = 50;
  if (withSentiment.length > 0) {
    const avgSentiment = withSentiment.reduce((sum, a) => sum + a.sentiment_score!, 0) / withSentiment.length;
    sentiment_score = ((avgSentiment + 1) / 2) * 100;
  }

  // --- Stability (20%): consistenza tra run diversi ---
  // Raggruppa per run_number, calcola % menzione per ogni run, poi deviazione standard
  const runGroups = new Map<number, boolean[]>();
  for (const a of analyses) {
    const group = runGroups.get(a.run_number) ?? [];
    group.push(a.brand_mentioned);
    runGroups.set(a.run_number, group);
  }

  let stability_score = 100;
  if (runGroups.size > 1) {
    const runRates = Array.from(runGroups.values()).map(
      (group) => group.filter(Boolean).length / group.length
    );
    const mean = runRates.reduce((s, r) => s + r, 0) / runRates.length;
    const variance = runRates.reduce((s, r) => s + (r - mean) ** 2, 0) / runRates.length;
    const stdDev = Math.sqrt(variance);
    stability_score = Math.max(0, Math.min(100, (1 - stdDev * 2) * 100));
  }

  // --- AVI composito (35/25/20/20) ---
  const avi_score = Math.round(
    presence_score * 0.35 +
    rank_score * 0.25 +
    sentiment_score * 0.20 +
    stability_score * 0.20
  );

  return {
    avi_score: Math.max(0, Math.min(100, avi_score)),
    components: {
      presence_score: Math.round(presence_score * 100) / 100,
      rank_score: Math.round(rank_score * 100) / 100,
      sentiment_score: Math.round(sentiment_score * 100) / 100,
      stability_score: Math.round(stability_score * 100) / 100,
    },
  };
}
