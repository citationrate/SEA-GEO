export interface AIModel {
  id: string;
  label: string;
  desc: string;
  provider: "openai" | "anthropic" | "google" | "xai" | "perplexity" | "azure";
  /** High token consumption — shows cost warning in UI */
  expensive?: boolean;
  /** Reasoning effort budget for OpenAI reasoning models. Lower = faster + cheaper,
   * higher = deeper analysis but slower. Ignored by non-reasoning providers and by
   * non-reasoning OpenAI models (gpt-5.4, gpt-5.5). */
  reasoningEffort?: "low" | "medium" | "high";
}

export const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini",       desc: "Veloce, risposte concise",                    provider: "openai" },
  { id: "gpt-4o",       label: "GPT-4o",             desc: "Preciso, risposte elaborate",                 provider: "openai" },
  { id: "gpt-5.4",      label: "GPT-5.4",            desc: "Generazione precedente, alta qualità",        provider: "openai" },
  { id: "gpt-5.5",      label: "GPT-5.5",            desc: "Ultimo modello OpenAI, contesto 1M token",    provider: "openai" },
  // Anthropic (short IDs — canonical)
  { id: "claude-haiku",   label: "Claude Haiku 4.5",   desc: "Veloce e diretto",                          provider: "anthropic" },
  { id: "claude-sonnet",  label: "Claude Sonnet 4.6",  desc: "Bilanciato e preciso",                      provider: "anthropic" },
  { id: "claude-opus",    label: "Claude Opus 4.7",    desc: "Massima qualità, agenti long-horizon",      provider: "anthropic", expensive: true },
  // Anthropic (legacy full IDs — kept for backward compat with existing DB data, hidden from UI)
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  desc: "Veloce e diretto",              provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Bilanciato e preciso",                   provider: "anthropic" },
  { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   desc: "Massima qualità",                        provider: "anthropic" },
  { id: "claude-opus-4-6",   label: "Claude Opus 4.6",   desc: "Massima qualità",                        provider: "anthropic" },
  { id: "claude-opus-4-7",   label: "Claude Opus 4.7",   desc: "Massima qualità",                        provider: "anthropic" },
  // Google
  { id: "gemini-2.5-flash",   label: "Gemini 2.5 Flash",   desc: "Veloce, aggiornato",                   provider: "google" },
  // Legacy model IDs — kept for backward compat with existing DB data, hidden from UI
  { id: "gpt-4o-mini",        label: "GPT-4o Mini",         desc: "Veloce, risposte concise",             provider: "openai" },
  { id: "gemini-2.5-pro",     label: "Gemini 2.5 Pro",      desc: "Massima precisione",                   provider: "google" },
  { id: "gemini-3.1-pro",     label: "Gemini 3.1 Pro",     desc: "Massima precisione",                    provider: "google" },
  // xAI
  { id: "grok-4.3",                label: "Grok 4.3",       desc: "Massima qualità con web search nativo",  provider: "xai", expensive: true },
  { id: "grok-4.20-non-reasoning", label: "Grok 4.20 Fast", desc: "Veloce ed economico, web search nativo", provider: "xai" },
  // Legacy (kept for backward compat with existing DB data, hidden from UI)
  // grok-4-1-fast retired by xAI on 2026-05-15 (see docs.x.ai/developers/migration/may-15-retirement)
  { id: "grok-4-1-fast",   label: "Grok 4.1 Fast",   desc: "Generazione precedente (ritirato 15/05/2026)", provider: "xai" },
  { id: "grok-3",          label: "Grok 3",          desc: "Generazione precedente",                     provider: "xai" },
  { id: "grok-3-mini",     label: "Grok 3 Mini",     desc: "Generazione precedente",                     provider: "xai" },
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
  "claude-opus-4-6",
  "claude-opus-4-7",
  "gemini-2.5-pro",
  "gpt-4o-mini",
  "grok-3",
  "grok-3-mini",
  "grok-4-1-fast",
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
 * descriptionKey is a i18n translation key (e.g. "modelDescriptions.gpt-54-mini").
 */
export interface ProviderGroup {
  id: string;
  label: string;
  badge: string;
  color: string;
  models: { id: string; label: string; descriptionKey: string; expensive?: boolean; proOnly?: boolean; enterpriseOnly?: boolean }[];
  comingSoon?: boolean;
}

export const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    id: "openai", label: "OpenAI", badge: "ChatGPT", color: "text-green-500",
    models: [
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", descriptionKey: "modelDescriptions.gpt-54-mini" },
      { id: "gpt-5.5", label: "GPT-5.5", descriptionKey: "modelDescriptions.gpt-55" },
    ],
  },
  {
    id: "google", label: "Google", badge: "Gemini", color: "text-blue-500",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", descriptionKey: "modelDescriptions.gemini-25-flash" },
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", descriptionKey: "modelDescriptions.gemini-31-pro", proOnly: true },
    ],
  },
  {
    id: "anthropic", label: "Anthropic", badge: "Claude", color: "text-orange-500",
    models: [
      { id: "claude-haiku", label: "Claude Haiku 4.5", descriptionKey: "modelDescriptions.claude-haiku" },
      { id: "claude-sonnet", label: "Claude Sonnet 4.6", descriptionKey: "modelDescriptions.claude-sonnet-46" },
      { id: "claude-opus", label: "Claude Opus 4.7", descriptionKey: "modelDescriptions.claude-opus-47", expensive: true, proOnly: true },
    ],
  },
  {
    id: "xai", label: "xAI", badge: "Grok", color: "text-gray-400",
    models: [
      { id: "grok-4.20-non-reasoning", label: "Grok 4.20 Fast", descriptionKey: "modelDescriptions.grok-4-20-fast" },
      { id: "grok-4.3", label: "Grok 4.3", descriptionKey: "modelDescriptions.grok-4-3", expensive: true, proOnly: true },
    ],
  },
  {
    id: "perplexity", label: "Perplexity", badge: "Sonar", color: "text-cyan-500",
    models: [
      { id: "perplexity-sonar", label: "Sonar", descriptionKey: "modelDescriptions.perplexity-sonar" },
      { id: "perplexity-sonar-pro", label: "Sonar Pro", descriptionKey: "modelDescriptions.perplexity-sonar-pro", proOnly: true },
    ],
  },
  {
    id: "microsoft", label: "Microsoft", badge: "Copilot", color: "text-sky-500", comingSoon: true,
    models: [
      { id: "copilot-gpt4", label: "Copilot GPT-4o", descriptionKey: "modelDescriptions.copilot-gpt4" },
    ],
  },
];

/** Models that require a Pro subscription */
export const PRO_ONLY_MODEL_IDS = new Set(
  PROVIDER_GROUPS.flatMap((g) => g.models.filter((m) => m.proOnly).map((m) => m.id))
);

/** Models that require an Enterprise subscription. Disjoint from PRO_ONLY_MODEL_IDS:
 * a model is gated either at Pro or at Enterprise, never both. */
export const ENTERPRISE_ONLY_MODEL_IDS = new Set(
  PROVIDER_GROUPS.flatMap((g) => g.models.filter((m) => m.enterpriseOnly).map((m) => m.id))
);

/** Models currently exposed in user-facing selectors (excludes coming-soon
 * groups + legacy IDs kept only for read compat with old DB rows). Used to
 * sanitize models_config at write time so orphan/legacy IDs (e.g. "gpt-5.4"
 * from before the OpenAI selector was reshuffled into Mini/5.5/5.5-Pro) are
 * silently dropped on the next project edit. */
export const VISIBLE_MODEL_IDS = new Set(
  PROVIDER_GROUPS.filter((g) => !g.comingSoon).flatMap((g) => g.models.map((m) => m.id))
);

/**
 * Demo plan: fixed models, not selectable.
 * 4 motori = impatto emotivo del confronto cross-AI ("ChatGPT non ti cita,
 * Perplexity sì, Gemini ti mette 4°"). Costo API: ~$0.024 per analisi
 * (2 query × 4 modelli × $0.003), sostenibile a budget demo (10 prompts).
 */
export const DEMO_MODEL_IDS = [
  "gpt-5.4-mini",
  "gemini-2.5-flash",
  "claude-haiku",
  "perplexity-sonar",
] as const;

/**
 * Provider-level selection for the snello project creation form.
 * User picks providers (ChatGPT / Gemini / Claude / Grok / Sonar) without
 * choosing the specific model: the resolution is automatic per plan.
 *
 * - Demo / Base: tier "value" (mid-price, with browsing + articolato)
 * - Pro: Grok upgrades to reasoning (grok-4.3); others identical to Base
 *
 * Mantenuto separato da PROVIDER_GROUPS (legacy granular UI) per evitare
 * di toccare la pagina di confronto/edit che continua a usare quella.
 */
export interface AviProviderCard {
  id: "openai" | "google" | "anthropic" | "xai" | "perplexity";
  label: string;
  badge: string;
  color: string;
}

export const AVI_PROVIDER_CARDS: readonly AviProviderCard[] = [
  { id: "openai",     label: "OpenAI",     badge: "ChatGPT",   color: "text-green-500"  },
  { id: "google",     label: "Google",     badge: "Gemini",    color: "text-blue-500"   },
  { id: "anthropic",  label: "Anthropic",  badge: "Claude",    color: "text-orange-500" },
  { id: "xai",        label: "xAI",        badge: "Grok",      color: "text-gray-400"   },
  { id: "perplexity", label: "Perplexity", badge: "Sonar",     color: "text-cyan-500"   },
];

type AviPlan = "demo" | "base" | "pro" | "enterprise";

const PROVIDER_DEFAULT_MODELS: Record<AviProviderCard["id"], Record<AviPlan, string>> = {
  openai: {
    demo: "gpt-5.4-mini", base: "gpt-5.4-mini", pro: "gpt-5.4-mini", enterprise: "gpt-5.4-mini",
  },
  google: {
    demo: "gemini-2.5-flash", base: "gemini-2.5-flash", pro: "gemini-2.5-flash", enterprise: "gemini-2.5-flash",
  },
  anthropic: {
    demo: "claude-haiku", base: "claude-haiku", pro: "claude-haiku", enterprise: "claude-haiku",
  },
  xai: {
    demo: "grok-4.20-non-reasoning", base: "grok-4.20-non-reasoning", pro: "grok-4.3", enterprise: "grok-4.3",
  },
  perplexity: {
    demo: "perplexity-sonar", base: "perplexity-sonar", pro: "perplexity-sonar", enterprise: "perplexity-sonar",
  },
};

export function providersToModelIds(providers: string[], plan: AviPlan): string[] {
  return providers
    .map((p) => {
      const mapping = PROVIDER_DEFAULT_MODELS[p as AviProviderCard["id"]];
      return mapping ? mapping[plan] : null;
    })
    .filter((id): id is string => id !== null);
}

/** Providers preselected for Demo plan (fixed, mirrors DEMO_MODEL_IDS). */
export const AVI_DEMO_PROVIDERS: readonly AviProviderCard["id"][] = [
  "openai",
  "google",
  "anthropic",
  "perplexity",
];

/**
 * Brand-level label for a model id. Used in UI pills to hide the specific
 * model version behind the user-facing brand name (ChatGPT, Claude, Gemini,
 * Grok, Sonar). The exact model label stays available via MODEL_MAP for
 * tooltips / debugging.
 */
export function modelIdToBrand(modelId: string): { brand: string; logo: string } | null {
  const id = modelId.toLowerCase();
  if (id.startsWith("gpt-") || id.startsWith("copilot-")) return { brand: "ChatGPT", logo: "/brand-logos/chatgpt.png" };
  if (id.startsWith("claude-")) return { brand: "Claude", logo: "/brand-logos/claude.svg" };
  if (id.startsWith("gemini-")) return { brand: "Gemini", logo: "/brand-logos/gemini.svg" };
  if (id.startsWith("grok-")) return { brand: "Grok", logo: "/brand-logos/grok.png" };
  if (id.startsWith("perplexity-") || id.startsWith("sonar")) return { brand: "Sonar", logo: "/brand-logos/perplexity.svg" };
  return null;
}

/** Reverse mapping: dal modello al provider id (per /edit dove i progetti
 *  esistenti hanno gia' models_config valorizzato). */
export function modelIdToProviderId(modelId: string): AviProviderCard["id"] | null {
  const id = modelId.toLowerCase();
  if (id.startsWith("gpt-") || id.startsWith("copilot-")) return "openai";
  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gemini-")) return "google";
  if (id.startsWith("grok-")) return "xai";
  if (id.startsWith("perplexity-") || id.startsWith("sonar")) return "perplexity";
  return null;
}

/** Same mapping for provider IDs (used by AVI_PROVIDER_CARDS). */
export function providerIdToLogo(providerId: AviProviderCard["id"]): string {
  switch (providerId) {
    case "openai":     return "/brand-logos/chatgpt.png";
    case "anthropic":  return "/brand-logos/claude.svg";
    case "google":     return "/brand-logos/gemini.svg";
    case "xai":        return "/brand-logos/grok.png";
    case "perplexity": return "/brand-logos/perplexity.svg";
  }
}

/** Comparison module: fixed models, always no-browsing, Pro only */
export const COMPARISON_MODEL_IDS = [
  "claude-haiku",
  "gpt-5.4-mini",
  "gemini-2.5-flash",
  "grok-4.20-non-reasoning",
  "perplexity-sonar",
] as const;
