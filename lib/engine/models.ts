export interface AIModel {
  id: string;
  label: string;
  desc: string;
  provider: "openai" | "anthropic" | "google" | "xai" | "perplexity" | "azure";
  /** High token consumption — shows cost warning in UI */
  expensive?: boolean;
}

export const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: "gpt-4o-mini",  label: "GPT-4o Mini",       desc: "Veloce, risposte concise",                    provider: "openai" },
  { id: "gpt-4o",       label: "GPT-4o",             desc: "Preciso, risposte elaborate",                 provider: "openai" },
  { id: "gpt-5.4",      label: "GPT-5.4",            desc: "Ultimo modello OpenAI, massima qualità",      provider: "openai" },
  // Anthropic (short IDs — canonical)
  { id: "claude-haiku",   label: "Claude Haiku 4.5",   desc: "Veloce e diretto",                          provider: "anthropic" },
  { id: "claude-sonnet",  label: "Claude Sonnet 4.5",  desc: "Bilanciato e preciso",                      provider: "anthropic" },
  { id: "claude-opus",    label: "Claude Opus 4.5",    desc: "Massima qualità",                           provider: "anthropic", expensive: true },
  // Anthropic (legacy full IDs — kept for backward compat with existing DB data, hidden from UI)
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  desc: "Veloce e diretto",              provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Bilanciato e preciso",                   provider: "anthropic" },
  { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   desc: "Massima qualità",                        provider: "anthropic" },
  // Google
  { id: "gemini-2.5-flash",   label: "Gemini 2.5 Flash",   desc: "Veloce, aggiornato",                   provider: "google" },
  { id: "gemini-2.5-pro",     label: "Gemini 2.5 Pro",     desc: "Massima precisione",                    provider: "google" },
  // xAI
  { id: "grok-3",       label: "Grok 3",       desc: "Preciso e aggiornato",                              provider: "xai" },
  { id: "grok-3-mini",  label: "Grok 3 Mini",  desc: "Veloce e diretto",                                  provider: "xai" },
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

/** Models hidden from UI selectors (legacy IDs kept for backward compat with DB data). */
const LEGACY_MODEL_IDS = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
]);

/** Models explicitly on hold (not yet ready for production). */
const MODELS_ON_HOLD = new Set(["copilot-gpt4"]);

/** Check if a model's required env vars are configured (server-side only). */
export function isModelAvailable(modelId: string): boolean {
  if (MODELS_ON_HOLD.has(modelId)) return false;
  if (LEGACY_MODEL_IDS.has(modelId)) return false;
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

/**
 * Canonical provider groups for UI model selectors.
 * Single source of truth — used by both project creation and comparison forms.
 * descriptionKey is a i18n translation key (e.g. "modelDescriptions.gpt-4o-mini").
 */
export interface ProviderGroup {
  id: string;
  label: string;
  badge: string;
  color: string;
  models: { id: string; label: string; descriptionKey: string; expensive?: boolean }[];
  comingSoon?: boolean;
}

export const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    id: "openai", label: "OpenAI", badge: "ChatGPT", color: "text-green-500",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", descriptionKey: "modelDescriptions.gpt-4o-mini" },
      { id: "gpt-4o", label: "GPT-4o", descriptionKey: "modelDescriptions.gpt-4o" },
      { id: "gpt-5.4", label: "GPT-5.4", descriptionKey: "modelDescriptions.gpt-5.4" },
    ],
  },
  {
    id: "google", label: "Google", badge: "Gemini", color: "text-blue-500",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", descriptionKey: "modelDescriptions.gemini-2.5-flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", descriptionKey: "modelDescriptions.gemini-2.5-pro" },
    ],
  },
  {
    id: "anthropic", label: "Anthropic", badge: "Claude", color: "text-orange-500",
    models: [
      { id: "claude-haiku", label: "Claude Haiku 4.5", descriptionKey: "modelDescriptions.claude-haiku" },
      { id: "claude-sonnet", label: "Claude Sonnet 4.5", descriptionKey: "modelDescriptions.claude-sonnet" },
      { id: "claude-opus", label: "Claude Opus 4.5", descriptionKey: "modelDescriptions.claude-opus", expensive: true },
    ],
  },
  {
    id: "xai", label: "xAI", badge: "Grok", color: "text-gray-400",
    models: [
      { id: "grok-3", label: "Grok 3", descriptionKey: "modelDescriptions.grok-3" },
      { id: "grok-3-mini", label: "Grok 3 Mini", descriptionKey: "modelDescriptions.grok-3-mini" },
    ],
  },
  {
    id: "perplexity", label: "Perplexity", badge: "Sonar", color: "text-cyan-500",
    models: [
      { id: "perplexity-sonar", label: "Sonar", descriptionKey: "modelDescriptions.perplexity-sonar" },
      { id: "perplexity-sonar-pro", label: "Sonar Pro", descriptionKey: "modelDescriptions.perplexity-sonar-pro" },
    ],
  },
  {
    id: "microsoft", label: "Microsoft", badge: "Copilot", color: "text-sky-500", comingSoon: true,
    models: [
      { id: "copilot-gpt4", label: "Copilot GPT-4o", descriptionKey: "modelDescriptions.copilot-gpt4" },
    ],
  },
];
