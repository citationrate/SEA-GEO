export interface AIModel {
  id: string;
  label: string;
  tier: string;
  costPerQuery: number;
  provider: "openai" | "anthropic" | "google" | "xai";
}

export const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: "gpt-4o-mini",  label: "GPT-4o mini",       tier: "Economy",       costPerQuery: 0.001,  provider: "openai" },
  { id: "gpt-4o",       label: "GPT-4o",             tier: "Premium",       costPerQuery: 0.01,   provider: "openai" },
  { id: "o1-mini",      label: "o1 mini",            tier: "Reasoning",     costPerQuery: 0.004,  provider: "openai" },
  { id: "o3-mini",      label: "o3 mini",            tier: "Reasoning",     costPerQuery: 0.004,  provider: "openai" },
  { id: "o3",           label: "o3",                 tier: "Reasoning Max", costPerQuery: 0.06,   provider: "openai" },
  // Anthropic
  { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  tier: "Economy",  costPerQuery: 0.001,  provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", tier: "Premium",  costPerQuery: 0.008,  provider: "anthropic" },
  { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   tier: "Max",      costPerQuery: 0.04,   provider: "anthropic" },
  // Google
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "Economy",   costPerQuery: 0.001,  provider: "google" },
  { id: "gemini-2.0-pro",   label: "Gemini 2.0 Pro",   tier: "Premium",   costPerQuery: 0.007,  provider: "google" },
  { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   tier: "Max",       costPerQuery: 0.015,  provider: "google" },
  // xAI
  { id: "grok-2",  label: "Grok 2",  tier: "Premium", costPerQuery: 0.008, provider: "xai" },
  { id: "grok-3",  label: "Grok 3",  tier: "Max",     costPerQuery: 0.02,  provider: "xai" },
];

export const MODEL_MAP = new Map(AI_MODELS.map((m) => [m.id, m]));

export const ALL_MODEL_IDS = AI_MODELS.map((m) => m.id);

export const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  openai:    { label: "OpenAI",    color: "text-green-500" },
  anthropic: { label: "Anthropic", color: "text-orange-500" },
  google:    { label: "Google",    color: "text-blue-500" },
  xai:       { label: "xAI",       color: "text-gray-400" },
};
