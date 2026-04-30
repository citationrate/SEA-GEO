// Multi-provider LLM caller (OpenAI, Anthropic, Google, Perplexity, xAI, Azure)
export { callAIModel, API_MODEL_ID } from "./prompt-runner";
export type { AIModelResult } from "./prompt-runner";

// Claude Haiku-based response extraction (brand mentions, sentiment, competitors, topics, sources)
export { extractFromResponse } from "./extractor";
export type { ExtractionResult } from "./extractor";

// AI model registry
export {
  AI_MODELS,
  MODEL_MAP,
  ALL_MODEL_IDS,
  PROVIDER_CONFIG,
  PROVIDER_GROUPS,
  PRO_ONLY_MODEL_IDS,
  DEMO_MODEL_IDS,
  COMPARISON_MODEL_IDS,
  isModelAvailable,
  filterAvailableModels,
} from "./models";
export type { AIModel, ProviderGroup } from "./models";

// Source/URL extraction utilities (annotations, web search, grounding, text fallback)
export {
  extractFromAnnotations,
  extractFromAnthropicSearch,
  extractFromGrounding,
  extractFromText,
  mergeSources,
  classifyDomainForPerplexity,
} from "./sources-extractor";
export type { ExtractedSource, SourceOrigin } from "./sources-extractor";

// Competitor name canonicalization
export { extractBrandOnly, canonicalizeCompetitorName } from "./competitor-names";
