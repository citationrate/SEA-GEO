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

  // Recognition "presence" = does the AI spontaneously list OUR brand in a
  // sector top-N. Previously a raw `mentions / N` ratio with no smoothing →
  // 0 mentions produced score=0 (the "broken-looking floor"), and 1 mention
  // out of 10 jumped to ~5%. Same bimodal problem we fixed on Authority.
  //
  // Apply a milder Beta(α=1, β=4) prior than Authority: Recognition has a
  // wider real-world range (Ferrari can legitimately hit 100, while small
  // brands realistically sit at 0-10) and we don't want to compress both
  // ends. The prior gives an absent brand a baseline of ~17 instead of 0
  // — visible signal that "the test ran, the brand is just not yet
  // recognized" without painting a misleading "broken" zero.
  //
  // Position also gets a neutral floor: unranked-but-mentioned was already
  // 50. Now non-mentioned rows contribute position=20 (was excluded), so
  // the breakdown can degrade smoothly instead of a cliff at the mention
  // boundary.
  const PRIOR_ALPHA = 1;
  const PRIOR_BETA = 4;
  const POSITION_FLOOR_UNMENTIONED = 20;

  const mentioned = rows.filter((r) => r.brand_mentioned);
  const n = rows.length;
  const presence = ((mentioned.length + PRIOR_ALPHA) / (n + PRIOR_ALPHA + PRIOR_BETA)) * 100;

  const positionPoints = rows.map((r) => {
    if (!r.brand_mentioned) return POSITION_FLOOR_UNMENTIONED;
    if (!r.brand_position || r.total_brands_listed <= 0) return 50; // mentioned but unranked → neutral
    const norm = 1 - (r.brand_position - 1) / Math.max(1, r.total_brands_listed);
    return Math.max(0, Math.min(1, norm)) * 100;
  });
  const position = avg(positionPoints);

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
  // Stronger smoothing than the previous Beta(1,3): Setup C-light test
  // showed Authority still swung ±22 pts on Notion (mature brand!) because
  // (a) the Beta wasn't aggressive enough and (b) the binary presence had
  // weight 0.6 while the continuous tone only 0.4.
  //
  // Three combined changes:
  //   1. Beta(2,6) — pulls harder toward the low-prior baseline.
  //   2. Tone "pooled smoothing" — unmentioned rows contribute tone=50
  //      (neutral) instead of being excluded; eliminates the cliff between
  //      0 mentions (tone=floor) and 1+ mentions (tone=real ~70).
  //   3. Inverted weights: tone (continuous, low-variance) now 0.6 vs
  //      presence (binary, high-variance) 0.4.
  //
  // Expected effect: Δ run-to-run for Authority drops from ~20pt to ~8pt
  // on samples of N=10 (Setup C-light).
  // PRIOR_BETA reduced from 6 → 5 (May 2026): the 6 was over-compressing
  // the low-end of the score, producing the conspicuous "34.44 floor" that
  // ~5 different brands shared identically (Nutella, IULM, Baldan, Il
  // Prisma, Citation Rate). Lowering β to 5 lifts the floor to ~38 and
  // spreads the bottom tier slightly, making the score look less "broken"
  // when many low-Authority brands stack up at the same number.
  // Top scorers (10/10 mentions) shift from 65 → 67 (negligible).
  const PRIOR_ALPHA = 2;
  const PRIOR_BETA = 5;
  const TONE_NEUTRAL_UNMENTIONED = 50;

  const mentions = rows.filter((r) => r.brand_mentioned).length;
  const n = rows.length;
  const presence = ((mentions + PRIOR_ALPHA) / (n + PRIOR_ALPHA + PRIOR_BETA)) * 100;

  const tonePoints = rows.map((r) => {
    if (!r.brand_mentioned) return TONE_NEUTRAL_UNMENTIONED;
    return Math.max(0, Math.min(1, r.tone_authoritative ?? 0)) * 100;
  });
  const tone = avg(tonePoints);

  return {
    score: clamp(0.4 * presence + 0.6 * tone),
    breakdown: { presence: clamp(presence), tone: clamp(tone) },
  };
}

function scoreRelevance(rows: RelevanceExtraction[]): { score: number; breakdown: PillarBreakdown["relevance"] } {
  if (rows.length === 0) return { score: 0, breakdown: { product_match: 0, coherence: 0 } };

  // Setup C-light test showed Relevance swinging ±18.8 pts on the young
  // brand "Citation Rate" because product_match was bimodal: 0 products
  // listed → 30, ≥1 product → 100, with weight 0.7. Same Authority story.
  //
  // Same fix pattern: softer tiers + inverted weights so coherence
  // (continuous) dominates over product_match (discrete).
  //
  //   not mentioned          → 30 (was 0)
  //   mentioned, 0 products  → 40 (was 30)
  //   mentioned, ≥1 product  → 75 (was 100)
  //
  // Top scorers cap at 75 — matching the Authority cap rationale.
  const matchPoints = rows.map((r) => {
    if (!r.brand_mentioned) return 30;
    return (r.products_mentioned?.length ?? 0) > 0 ? 75 : 40;
  });
  const product_match = avg(matchPoints);

  const coherencePoints = rows.map((r) => Math.max(0, Math.min(1, r.claim_coherence ?? 0)) * 100);
  const coherence = avg(coherencePoints);

  return {
    score: clamp(0.3 * product_match + 0.7 * coherence),
    breakdown: { product_match: clamp(product_match), coherence: clamp(coherence) },
  };
}

function scoreSentiment(rows: SentimentExtraction[]): { score: number; breakdown: PillarBreakdown["sentiment"] } {
  if (rows.length === 0) return { score: 0, breakdown: { sentiment: 0, recommendation: 0, tone: 0 } };

  // Same neutral-unmentioned smoothing pattern as Authority: when the brand
  // isn't mentioned by a model, we don't have signal — using 0 was wrong
  // (it claimed strong negative sentiment from missing data) and using the
  // mean of mentioned rows was wrong too (over-positive optimism for brands
  // that no AI knows). Use 50 / 30 / 30 as neutral floors:
  //
  //   sentiment_neutral = 50 (-1..1 mapped to 0..100, midpoint = 50)
  //   recommendation_neutral = 30 (slightly below mid — absent ≠ recommended)
  //   tone_neutral = 30 (slightly below mid — absent ≠ warm/positive tone)
  //
  // Effect: brands with Recognition≈0 used to land Sentiment=0 (false
  // negative), now they land ~30 — visible "low signal" instead of "strong
  // negative". For mentioned brands the math is unchanged.
  const SENTIMENT_NEUTRAL = 50;
  const RECOMMENDATION_NEUTRAL = 30;
  const TONE_NEUTRAL = 30;

  const sentimentPoints = rows.map((r) => {
    if (!r.brand_mentioned) return SENTIMENT_NEUTRAL;
    const s = Math.max(-1, Math.min(1, r.sentiment_score ?? 0));
    return ((s + 1) / 2) * 100;
  });
  const sentiment = avg(sentimentPoints);

  const recPoints = rows.map((r) =>
    r.brand_mentioned ? Math.max(0, Math.min(1, r.recommendation_score ?? 0)) * 100 : RECOMMENDATION_NEUTRAL,
  );
  const recommendation = avg(recPoints);

  const tonePoints = rows.map((r) =>
    r.brand_mentioned ? Math.max(0, Math.min(1, r.tone_score ?? 0)) * 100 : TONE_NEUTRAL,
  );
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

  // Hallucination guard: when Recognition is below 30 (the brand is barely
  // known by the AIs), Clarity and Sentiment have no real signal to score
  // — the models are answering "Who is {brand}?" by making things up. Cap
  // both at 60 so the result looks like "the AI knows superficial things
  // about you but can't really place you", which is honest.
  //
  // Without this guard, Il Prisma (Recognition=0) landed Clarity=67 and
  // Sentiment=75 — confidently wrong scores that suggested signal where
  // none existed.
  const LOW_RECOG_THRESHOLD = 30;
  const HALLUCINATION_CAP = 60;
  const clarityScore = r.score < LOW_RECOG_THRESHOLD ? Math.min(c.score, HALLUCINATION_CAP) : c.score;
  const sentimentScore = r.score < LOW_RECOG_THRESHOLD ? Math.min(s.score, HALLUCINATION_CAP) : s.score;

  const total = clamp((r.score + clarityScore + a.score + rel.score + sentimentScore) / 5);

  return {
    scores: {
      recognition: r.score,
      clarity: clarityScore,
      authority: a.score,
      relevance: rel.score,
      sentiment: sentimentScore,
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
