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
  query_id: string;
  segment_id: string;
}

/**
 * Calcola l'AI Visibility Index (0-100) dai risultati di analisi.
 *
 * - Presence (35%): % prompt con brand_mentioned=true
 * - Rank (25%): media di (1/brand_rank) dove menzionato, 0 altrimenti → scala 0-100
 * - Sentiment (20%): media dei sentiment_score (non null), default 0.5 → scala 0-100
 * - Stability (20%): per ogni coppia query+segment, quante delle 3 run concordano → media
 */
export function calculateAVI(analyses: AnalysisRow[]): AVIResult {
  if (analyses.length === 0) {
    return {
      avi_score: 0,
      components: { presence_score: 0, rank_score: 0, sentiment_score: 0, stability_score: 0 },
    };
  }

  // --- Presence (35%): % prompt con brand menzionato ---
  const mentionedCount = analyses.filter((a) => a.brand_mentioned).length;
  const presence_score = (mentionedCount / analyses.length) * 100;

  // --- Rank (25%): media di 1/brand_rank per i menzionati, 0 per non menzionati ---
  const rankValues = analyses.map((a) => {
    if (!a.brand_mentioned || a.brand_rank === null || a.brand_rank <= 0) return 0;
    return 1 / a.brand_rank;
  });
  const avgRankInverse = rankValues.reduce((s, v) => s + v, 0) / rankValues.length;
  const rank_score = avgRankInverse * 100; // 1/1=1→100, 1/2=0.5→50, etc.

  // --- Sentiment (20%): media dei sentiment_score non null, default 0.5 ---
  const withSentiment = analyses.filter((a) => a.sentiment_score !== null);
  let sentimentAvg = 0.5;
  if (withSentiment.length > 0) {
    sentimentAvg = withSentiment.reduce((sum, a) => sum + a.sentiment_score!, 0) / withSentiment.length;
  }
  // Normalizza da -1..1 a 0..100
  const sentiment_score = ((sentimentAvg + 1) / 2) * 100;

  // --- Stability (20%): per ogni coppia query+segment, calcola concordanza tra run ---
  const pairGroups = new Map<string, boolean[]>();
  for (const a of analyses) {
    const key = `${a.query_id}__${a.segment_id}`;
    const group = pairGroups.get(key) ?? [];
    group.push(a.brand_mentioned);
    pairGroups.set(key, group);
  }

  let stability_score = 100;
  if (pairGroups.size > 0) {
    const pairScores: number[] = [];
    for (const runs of Array.from(pairGroups.values())) {
      if (runs.length <= 1) {
        pairScores.push(100);
        continue;
      }
      // Conta quante concordano col risultato di maggioranza
      const trueCount = runs.filter(Boolean).length;
      const majority = Math.max(trueCount, runs.length - trueCount);
      pairScores.push((majority / runs.length) * 100);
    }
    stability_score = pairScores.reduce((s, v) => s + v, 0) / pairScores.length;
  }

  // --- AVI composito ---
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
