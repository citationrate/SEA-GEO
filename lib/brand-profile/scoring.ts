import type {
  AuthorityExtraction,
  ClarityExtraction,
  PillarExtraction,
  RecognitionExtraction,
  RelevanceExtraction,
  SentimentExtraction,
} from "./extractor";
import type { Pillar } from "./prompts";

export interface PillarScores {
  recognition: number;
  clarity: number;
  authority: number;
  relevance: number;
  sentiment: number;
  total: number;
}

export interface PillarBreakdown {
  recognition?: { presence: number; position: number };
  clarity?: { factual: number; no_confusion: number };
  authority?: { presence: number; tone: number };
  relevance?: { product_match: number; coherence: number };
  sentiment?: { sentiment: number; recommendation: number; tone: number };
}

export interface ScoringInput {
  pillar: Pillar;
  data: PillarExtraction["data"];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

function scoreRecognition(rows: RecognitionExtraction[]): { score: number; breakdown: PillarBreakdown["recognition"] } {
  if (rows.length === 0) return { score: 0, breakdown: { presence: 0, position: 0 } };
  const mentioned = rows.filter((r) => r.brand_mentioned);
  const presence = (mentioned.length / rows.length) * 100;

  const positionPoints = mentioned.map((r) => {
    if (!r.brand_position || r.total_brands_listed <= 0) return 50; // mentioned but unranked → neutral
    const norm = 1 - (r.brand_position - 1) / Math.max(1, r.total_brands_listed);
    return Math.max(0, Math.min(1, norm)) * 100;
  });
  const position = mentioned.length === 0 ? 0 : avg(positionPoints);

  return {
    score: clamp(0.5 * presence + 0.5 * position),
    breakdown: { presence: clamp(presence), position: clamp(position) },
  };
}

function scoreClarity(rows: ClarityExtraction[]): { score: number; breakdown: PillarBreakdown["clarity"] } {
  if (rows.length === 0) return { score: 0, breakdown: { factual: 0, no_confusion: 0 } };

  const factualPoints = rows.map((r) => {
    if (!r.brand_mentioned) return 0;
    const claims = r.factual_claims ?? {};
    const filled = [claims.sector, claims.headquarters, claims.ceo, claims.founded_year].filter(
      (v) => v !== undefined && v !== null && v !== "",
    ).length;
    const base = filled >= 2 ? 100 : filled === 1 ? 60 : 20;
    const penalty = Math.min(30, (r.uncertainty_flags?.length ?? 0) * 10);
    return Math.max(0, base - penalty);
  });
  const factual = avg(factualPoints);

  const noConfusionPoints = rows.map((r) => (1 - Math.max(0, Math.min(1, r.confusion_score ?? 0))) * 100);
  const no_confusion = avg(noConfusionPoints);

  return {
    score: clamp(0.6 * factual + 0.4 * no_confusion),
    breakdown: { factual: clamp(factual), no_confusion: clamp(no_confusion) },
  };
}

function scoreAuthority(rows: AuthorityExtraction[]): { score: number; breakdown: PillarBreakdown["authority"] } {
  if (rows.length === 0) return { score: 0, breakdown: { presence: 0, tone: 0 } };

  const presencePoints = rows.map((r) => {
    const hasSignal = (r.experts_listed?.length ?? 0) > 0 || (r.sources_listed?.length ?? 0) > 0;
    return hasSignal ? 100 : 0;
  });
  const presence = avg(presencePoints);

  const tonePoints = rows.map((r) => Math.max(0, Math.min(1, r.tone_authoritative ?? 0)) * 100);
  const tone = avg(tonePoints);

  return {
    score: clamp(0.7 * presence + 0.3 * tone),
    breakdown: { presence: clamp(presence), tone: clamp(tone) },
  };
}

function scoreRelevance(rows: RelevanceExtraction[]): { score: number; breakdown: PillarBreakdown["relevance"] } {
  if (rows.length === 0) return { score: 0, breakdown: { product_match: 0, coherence: 0 } };

  const matchPoints = rows.map((r) => {
    if (!r.brand_mentioned) return 0;
    return (r.products_mentioned?.length ?? 0) > 0 ? 100 : 30;
  });
  const product_match = avg(matchPoints);

  const coherencePoints = rows.map((r) => Math.max(0, Math.min(1, r.claim_coherence ?? 0)) * 100);
  const coherence = avg(coherencePoints);

  return {
    score: clamp(0.7 * product_match + 0.3 * coherence),
    breakdown: { product_match: clamp(product_match), coherence: clamp(coherence) },
  };
}

function scoreSentiment(rows: SentimentExtraction[]): { score: number; breakdown: PillarBreakdown["sentiment"] } {
  if (rows.length === 0) return { score: 0, breakdown: { sentiment: 0, recommendation: 0, tone: 0 } };

  const sentimentPoints = rows.map((r) => {
    if (!r.brand_mentioned) return 0;
    const s = Math.max(-1, Math.min(1, r.sentiment_score ?? 0));
    return ((s + 1) / 2) * 100;
  });
  const sentiment = avg(sentimentPoints);

  const recPoints = rows.map((r) => (r.brand_mentioned ? Math.max(0, Math.min(1, r.recommendation_score ?? 0)) * 100 : 0));
  const recommendation = avg(recPoints);

  const tonePoints = rows.map((r) => (r.brand_mentioned ? Math.max(0, Math.min(1, r.tone_score ?? 0)) * 100 : 0));
  const tone = avg(tonePoints);

  return {
    score: clamp(0.5 * sentiment + 0.3 * recommendation + 0.2 * tone),
    breakdown: { sentiment: clamp(sentiment), recommendation: clamp(recommendation), tone: clamp(tone) },
  };
}

export function computeScores(inputs: ScoringInput[]): { scores: PillarScores; breakdown: PillarBreakdown } {
  const recognitionRows = inputs.filter((i) => i.pillar === "recognition").map((i) => i.data as RecognitionExtraction);
  const clarityRows = inputs.filter((i) => i.pillar === "clarity").map((i) => i.data as ClarityExtraction);
  const authorityRows = inputs.filter((i) => i.pillar === "authority").map((i) => i.data as AuthorityExtraction);
  const relevanceRows = inputs.filter((i) => i.pillar === "relevance").map((i) => i.data as RelevanceExtraction);
  const sentimentRows = inputs.filter((i) => i.pillar === "sentiment").map((i) => i.data as SentimentExtraction);

  const r = scoreRecognition(recognitionRows);
  const c = scoreClarity(clarityRows);
  const a = scoreAuthority(authorityRows);
  const rel = scoreRelevance(relevanceRows);
  const s = scoreSentiment(sentimentRows);

  const total = clamp((r.score + c.score + a.score + rel.score + s.score) / 5);

  return {
    scores: {
      recognition: r.score,
      clarity: c.score,
      authority: a.score,
      relevance: rel.score,
      sentiment: s.score,
      total,
    },
    breakdown: {
      recognition: r.breakdown,
      clarity: c.breakdown,
      authority: a.breakdown,
      relevance: rel.breakdown,
      sentiment: s.breakdown,
    },
  };
}
