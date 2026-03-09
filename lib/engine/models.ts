export interface AIModel {
  id: string;
  label: string;
  desc: string;
  provider: "openai" | "anthropic" | "google" | "xai";
}

export const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: "gpt-4o-mini",  label: "GPT-4o mini",       desc: "Veloce ed efficiente, ideale per analisi rapide",   provider: "openai" },
  { id: "gpt-4o",       label: "GPT-4o",             desc: "Bilanciato tra qualita e velocita",                 provider: "openai" },
  { id: "o1-mini",      label: "o1 mini",            desc: "Ottimizzato per ragionamento complesso",            provider: "openai" },
  { id: "o3-mini",      label: "o3 mini",            desc: "Ragionamento avanzato, risposte dettagliate",       provider: "openai" },
  { id: "o3",           label: "o3",                 desc: "Massima capacita di ragionamento",                  provider: "openai" },
  // Anthropic
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  desc: "Rapido e preciso nelle istruzioni",            provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Eccellente comprensione del contesto",         provider: "anthropic" },
  { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   desc: "Il piu sofisticato per analisi profonde",      provider: "anthropic" },
  // Google
  { id: "gemini-2.5-flash",   label: "Gemini 2.5 Flash",   desc: "Velocissimo con ottima qualita",              provider: "google" },
  { id: "gemini-2.5-pro",     label: "Gemini 2.5 Pro",     desc: "Stato dell'arte di Google",                   provider: "google" },
  // xAI
  { id: "grok-2",  label: "Grok 2",  desc: "Accesso a dati recenti e web",            provider: "xai" },
  { id: "grok-3",  label: "Grok 3",  desc: "Massima capacita xAI con reasoning",      provider: "xai" },
];

export const MODEL_MAP = new Map(AI_MODELS.map((m) => [m.id, m]));

export const ALL_MODEL_IDS = AI_MODELS.map((m) => m.id);

export const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  openai:    { label: "OpenAI",    color: "text-green-500" },
  anthropic: { label: "Anthropic", color: "text-orange-500" },
  google:    { label: "Google",    color: "text-blue-500" },
  xai:       { label: "xAI",       color: "text-gray-400" },
};
