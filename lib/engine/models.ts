export interface AIModel {
  id: string;
  label: string;
  desc: string;
  provider: "openai" | "anthropic" | "google" | "xai" | "perplexity" | "azure";
}

export const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: "gpt-4o-mini",  label: "GPT-4o Mini",       desc: "Veloce, risposte concise",                    provider: "openai" },
  { id: "gpt-4o",       label: "GPT-4o",             desc: "Preciso, risposte elaborate",                 provider: "openai" },
  { id: "gpt-5.4",      label: "GPT-5.4",            desc: "Nuova generazione, massima qualità",          provider: "openai" },
  { id: "o1-mini",      label: "o1 Mini",            desc: "Ragionamento approfondito",                   provider: "openai" },
  { id: "o3-mini",      label: "o3 Mini",            desc: "Ragionamento avanzato, risposte dettagliate", provider: "openai" },
  { id: "o3",           label: "o3",                 desc: "Massima capacita di ragionamento",             provider: "openai" },
  // Anthropic (short IDs)
  { id: "claude-haiku",   label: "Claude Haiku 4.5",   desc: "Veloce e diretto",                          provider: "anthropic" },
  { id: "claude-sonnet",  label: "Claude Sonnet 4.5",  desc: "Bilanciato e preciso",                      provider: "anthropic" },
  { id: "claude-opus",    label: "Claude Opus 4.5",    desc: "Massima qualità",                           provider: "anthropic" },
  // Anthropic (legacy full IDs for backward compat)
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  desc: "Veloce e diretto",              provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Bilanciato e preciso",                   provider: "anthropic" },
  { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   desc: "Massima qualità",                        provider: "anthropic" },
  // Google
  { id: "gemini-2.5-flash",   label: "Gemini 2.5 Flash",   desc: "Veloce, aggiornato",                   provider: "google" },
  { id: "gemini-2.5-pro",     label: "Gemini 2.5 Pro",     desc: "Massima precisione",                    provider: "google" },
  // xAI
  { id: "grok-3",       label: "Grok 3",       desc: "Preciso e aggiornato",                              provider: "xai" },
  { id: "grok-3-mini",  label: "Grok 3 Mini",  desc: "Veloce e diretto",                                  provider: "xai" },
  { id: "grok-2",       label: "Grok 2",       desc: "Accesso a dati recenti e web",                      provider: "xai" },
  // Perplexity
  { id: "perplexity-sonar",      label: "Sonar",      desc: "Web search in tempo reale",                  provider: "perplexity" },
  { id: "perplexity-sonar-pro",  label: "Sonar Pro",  desc: "Web search avanzato, fonti più ricche",      provider: "perplexity" },
  // Azure (Microsoft Copilot)
  { id: "copilot-gpt4",  label: "Copilot (GPT-4o)",  desc: "Via Azure OpenAI",                             provider: "azure" },
];

export const MODEL_MAP = new Map(AI_MODELS.map((m) => [m.id, m]));

export const ALL_MODEL_IDS = AI_MODELS.map((m) => m.id);

/** Required env vars per provider. If any are missing/empty, models for that provider are unavailable. */
const PROVIDER_ENV_REQUIREMENTS: Record<string, string[]> = {
  openai:     ["OPENAI_API_KEY"],
  anthropic:  ["ANTHROPIC_API_KEY"],
  google:     ["GOOGLE_AI_API_KEY"],
  xai:        ["XAI_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  azure:      ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY"],
};

/** Models explicitly on hold (not yet ready for production). */
const MODELS_ON_HOLD = new Set(["copilot-gpt4"]);

/** Check if a model's required env vars are configured (server-side only). */
export function isModelAvailable(modelId: string): boolean {
  if (MODELS_ON_HOLD.has(modelId)) return false;
  const model = MODEL_MAP.get(modelId);
  if (!model) return false;
  const required = PROVIDER_ENV_REQUIREMENTS[model.provider];
  if (!required) return true;
  return required.every((key) => !!process.env[key]);
}

/** Filter out models whose provider credentials are not configured. */
export function filterAvailableModels(modelIds: string[]): string[] {
  return modelIds.filter(isModelAvailable);
}

export const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  openai:     { label: "OpenAI",     color: "text-green-500" },
  anthropic:  { label: "Anthropic",  color: "text-orange-500" },
  google:     { label: "Google",     color: "text-blue-500" },
  xai:        { label: "xAI",        color: "text-gray-400" },
  perplexity: { label: "Perplexity", color: "text-cyan-500" },
  azure:      { label: "Microsoft",  color: "text-sky-500" },
};
