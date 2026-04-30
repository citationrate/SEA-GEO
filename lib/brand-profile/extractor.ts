import Anthropic from "@anthropic-ai/sdk";
import type { Pillar } from "./prompts";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface RecognitionExtraction {
  brand_mentioned: boolean;
  brand_position: number | null;
  total_brands_listed: number;
  mentioned_brands: string[];
}

export interface ClarityExtraction {
  brand_mentioned: boolean;
  factual_claims: {
    sector?: string;
    headquarters?: string;
    ceo?: string;
    founded_year?: number;
  };
  confusion_score: number;
  uncertainty_flags: string[];
}

export interface AuthorityExtraction {
  brand_mentioned: boolean;
  experts_listed: string[];
  sources_listed: string[];
  tone_authoritative: number;
}

export interface RelevanceExtraction {
  brand_mentioned: boolean;
  products_mentioned: string[];
  claim_coherence: number;
  recommended: boolean;
}

export interface SentimentExtraction {
  brand_mentioned: boolean;
  sentiment_score: number;
  recommendation_score: number;
  tone_score: number;
}

export type PillarExtraction =
  | { pillar: "recognition"; data: RecognitionExtraction }
  | { pillar: "clarity"; data: ClarityExtraction }
  | { pillar: "authority"; data: AuthorityExtraction }
  | { pillar: "relevance"; data: RelevanceExtraction }
  | { pillar: "sentiment"; data: SentimentExtraction };

interface ExtractionContext {
  pillar: Pillar;
  brand: string;
  sector: string;
  prompt_text: string;
  response_raw: string;
}

const SCHEMAS: Record<Pillar, Record<string, unknown>> = {
  recognition: {
    type: "object",
    properties: {
      brand_mentioned: { type: "boolean" },
      brand_position: {
        type: ["integer", "null"],
        description: "1-based rank if brand appears in a list, null otherwise",
      },
      total_brands_listed: { type: "integer" },
      mentioned_brands: { type: "array", items: { type: "string" } },
    },
    required: ["brand_mentioned", "brand_position", "total_brands_listed", "mentioned_brands"],
  },
  clarity: {
    type: "object",
    properties: {
      brand_mentioned: { type: "boolean" },
      factual_claims: {
        type: "object",
        properties: {
          sector: { type: "string" },
          headquarters: { type: "string" },
          ceo: { type: "string" },
          founded_year: { type: "integer" },
        },
      },
      confusion_score: {
        type: "number",
        description: "0..1, how much the response confuses the brand with namesakes or unrelated entities",
      },
      uncertainty_flags: { type: "array", items: { type: "string" } },
    },
    required: ["brand_mentioned", "factual_claims", "confusion_score", "uncertainty_flags"],
  },
  authority: {
    type: "object",
    properties: {
      brand_mentioned: { type: "boolean" },
      experts_listed: { type: "array", items: { type: "string" } },
      sources_listed: { type: "array", items: { type: "string" } },
      tone_authoritative: {
        type: "number",
        description: "0..1, how authoritative the response sounds (citations, expert references)",
      },
    },
    required: ["brand_mentioned", "experts_listed", "sources_listed", "tone_authoritative"],
  },
  relevance: {
    type: "object",
    properties: {
      brand_mentioned: { type: "boolean" },
      products_mentioned: { type: "array", items: { type: "string" } },
      claim_coherence: {
        type: "number",
        description: "0..1, how coherent the brand's products described are with its actual sector",
      },
      recommended: { type: "boolean" },
    },
    required: ["brand_mentioned", "products_mentioned", "claim_coherence", "recommended"],
  },
  sentiment: {
    type: "object",
    properties: {
      brand_mentioned: { type: "boolean" },
      sentiment_score: { type: "number", description: "-1..1" },
      recommendation_score: { type: "number", description: "0..1" },
      tone_score: { type: "number", description: "0..1" },
    },
    required: ["brand_mentioned", "sentiment_score", "recommendation_score", "tone_score"],
  },
};

function systemPrompt(pillar: Pillar, brand: string): string {
  const role = `You are a precise extraction model. Analyze the AI response below and extract structured data about the brand "${brand}". Respond ONLY by calling the extract tool with valid JSON matching the schema. Do not invent data: when uncertain, leave optional fields empty or set numeric scores to neutral midpoints.`;
  const pillarHint: Record<Pillar, string> = {
    recognition: `For RECOGNITION: detect whether "${brand}" appears in the response (case- and accent-insensitive). If listed in a numbered or bulleted list, brand_position is the 1-based rank; otherwise null. mentioned_brands lists ALL brands referenced in the response (excluding "${brand}" if present, max 30).`,
    clarity: `For CLARITY: extract any factual claim about "${brand}" (sector, headquarters city, CEO/founder, founding year). confusion_score is HIGH when the response confuses "${brand}" with a namesake (different sector, wrong country, etc.). uncertainty_flags lists hedging words used ("probably", "I'm not sure", "I think").`,
    authority: `For AUTHORITY: list named experts and named sources/publications the response cites. tone_authoritative reflects how scholarly/cited the response feels.`,
    relevance: `For RELEVANCE: list concrete products/services the response attributes to "${brand}" (or to the sector if "${brand}" not mentioned). claim_coherence reflects whether those products fit the brand's actual sector. recommended=true only if the response explicitly recommends "${brand}".`,
    sentiment: `For SENTIMENT: sentiment_score is -1 (very negative) to +1 (very positive) about "${brand}". recommendation_score is 0..1 (would recommend). tone_score is 0..1 (warm/positive language). If "${brand}" not mentioned, all scores 0.`,
  };
  return `${role}\n\n${pillarHint[pillar]}`;
}

export async function extractByPillar(ctx: ExtractionContext): Promise<PillarExtraction> {
  const sys = systemPrompt(ctx.pillar, ctx.brand);
  const userMsg = `Prompt sent to the AI:\n${ctx.prompt_text}\n\nAI response to analyze:\n${ctx.response_raw}`;

  const resp = await client().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: sys,
    tools: [
      {
        name: "extract",
        description: `Extract ${ctx.pillar} signals from the AI response`,
        input_schema: SCHEMAS[ctx.pillar] as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "extract" },
    messages: [{ role: "user", content: userMsg }],
  });

  const toolUse = resp.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) throw new Error(`Haiku did not return a tool_use block for pillar=${ctx.pillar}`);
  const data = toolUse.input as PillarExtraction["data"];

  return { pillar: ctx.pillar, data } as PillarExtraction;
}
