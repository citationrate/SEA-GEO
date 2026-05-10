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

  // Smoothing parallel to scoreAuthority(): flatten the bimodal cliff in
  // factual that pushed the pillar by 8-10 pts run-to-run when one model
  // happened to fill 1 fewer claim. New tiers + a baseline floor when the
  // brand isn't mentioned at all (instead of 0, which double-amplified
  // randomness in low-recognition brands).
  //
  //   not mentioned      → 30  (was 0)
  //   mentioned, 0 facts → 30  (was 20)
  //   mentioned, 1 fact  → 55  (was 60)
  //   mentioned, ≥2 fact → 80  (was 100)
  //
  // Top scorers cap at 80 — same rationale as Authority: a "perfect 100"
  // on a small sample is suspicious, not a real signal of clarity.
  const factualPoints = rows.map((r) => {
    if (!r.brand_mentioned) return 30;
    const claims = r.factual_claims ?? {};
    const filled = [claims.sector, claims.headquarters, claims.ceo, claims.founded_year].filter(
      (v) => v !== undefined && v !== null && v !== "",
    ).length;
    const base = filled >= 2 ? 80 : filled === 1 ? 55 : 30;
    const penalty = Math.min(25, (r.uncertainty_flags?.length ?? 0) * 8);
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

  // Authority "presence" = does the AI cite OUR brand as a source/expert.
  // With only 6 calls per pillar, the raw mentions/N estimate is bimodal:
  // a single flip between consecutive runs swung the pillar by ~50 pts
  // (0 mentions → score 0, 1 mention → score ~30+tone). Caused by
  // perplexity-sonar's web-search results shifting slightly between runs.
  //
  // Fix: Beta(α=1, β=3) prior smoothing on presence + tone floor=40 when
  // zero mentions. The prior pulls toward "low Authority" (which is true
  // for most brands), and the tone floor avoids the cliff where 0 mentions
  // also drops tone to 0. Top scorers (6/6 mentions) still land ~72 — high
  // but not the suspicious "perfect 100" the unsmoothed version produced.
  const PRIOR_ALPHA = 1;
  const PRIOR_BETA = 3;
  const TONE_FLOOR_NO_MENTIONS = 40;

  const mentions = rows.filter((r) => r.brand_mentioned).length;
  const n = rows.length;
  const presence = ((mentions + PRIOR_ALPHA) / (n + PRIOR_ALPHA + PRIOR_BETA)) * 100;

  const tonePoints = rows
    .filter((r) => r.brand_mentioned)
    .map((r) => Math.max(0, Math.min(1, r.tone_authoritative ?? 0)) * 100);
  const tone = tonePoints.length === 0 ? TONE_FLOOR_NO_MENTIONS : avg(tonePoints);

  return {
    score: clamp(0.6 * presence + 0.4 * tone),
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
