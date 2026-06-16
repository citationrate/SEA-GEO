/**
 * Mini tool email configuration.
 * D7_TIPS: sent immediately after first use of a mini tool — tips on how to use it better.
 * D7_CROSS: sent +3 days after first use — suggests related tools.
 *
 * Template bodies are stored in DB (email_templates) and use {toolName}, {nome}, {brand} placeholders.
 * This file defines the tool graph (which tools relate to which) and the tips per tool.
 */

export interface MiniToolConfig {
  id: string;
  label: string;
  tipsSubject: string;
  tipsPreview: string;
  crossSellTools: string[]; // IDs of related tools to suggest
  crossSellSubject: string;
}

export const MINI_TOOL_CONFIG: Record<string, MiniToolConfig> = {
  ai_traffic: {
    id: "ai_traffic",
    label: "Traffico AI",
    tipsSubject: "3 cose da fare con Traffico AI",
    tipsPreview: "Hai aperto Traffico AI — ecco come sfruttarlo al meglio.",
    crossSellTools: ["ai_volumes", "search_console"],
    crossSellSubject: "Dopo Traffico AI: scopri anche questi tool",
  },
  ai_volumes: {
    id: "ai_volumes",
    label: "Volumi AI",
    tipsSubject: "Come leggere i Volumi AI",
    tipsPreview: "Hai usato Volumi AI — ecco come interpretare i dati.",
    crossSellTools: ["cite_gap", "ai_traffic"],
    crossSellSubject: "Hai visto i volumi — ora trova le opportunità",
  },
  entity_clarity: {
    id: "entity_clarity",
    label: "Entità AI",
    tipsSubject: "La tua entità AI: cosa fare adesso",
    tipsPreview: "Hai analizzato la tua entità — ecco i prossimi passi.",
    crossSellTools: ["content_optimizer", "schema_studio"],
    crossSellSubject: "Migliora la tua entità con questi tool",
  },
  cite_gap: {
    id: "cite_gap",
    label: "Gap citazioni",
    tipsSubject: "Come chiudere i gap di citazione",
    tipsPreview: "Hai trovato i tuoi gap — ecco come colmarli.",
    crossSellTools: ["content_optimizer", "competitor_gap"],
    crossSellSubject: "Gap trovati — ora ottimizza e confronta",
  },
  competitor_gap: {
    id: "competitor_gap",
    label: "Gap competitor",
    tipsSubject: "Cosa fare con il Gap competitor",
    tipsPreview: "Hai confrontato i competitor — ecco come superarli.",
    crossSellTools: ["cite_gap", "content_optimizer"],
    crossSellSubject: "Vai oltre il confronto: colma i gap",
  },
  content_optimizer: {
    id: "content_optimizer",
    label: "Content Optimizer",
    tipsSubject: "3 quick win dal Content Optimizer",
    tipsPreview: "Hai analizzato i contenuti — ecco cosa correggere subito.",
    crossSellTools: ["schema_studio", "audit_tecnico"],
    crossSellSubject: "Contenuti ottimizzati? Ora struttura e tecnica",
  },
  schema_studio: {
    id: "schema_studio",
    label: "Dati strutturati",
    tipsSubject: "Come implementare i dati strutturati",
    tipsPreview: "Hai generato lo schema — ecco come metterlo live.",
    crossSellTools: ["audit_tecnico", "content_optimizer"],
    crossSellSubject: "Schema pronto — verifica il sito e i contenuti",
  },
  audit_tecnico: {
    id: "audit_tecnico",
    label: "Audit tecnico",
    tipsSubject: "Priorità dall'audit tecnico",
    tipsPreview: "Hai fatto l'audit — ecco cosa fixare per primo.",
    crossSellTools: ["schema_studio", "bot_ai"],
    crossSellSubject: "Audit fatto — ora schema e bot AI",
  },
  bot_ai: {
    id: "bot_ai",
    label: "Bot AI",
    tipsSubject: "Gestisci i bot AI sul tuo sito",
    tipsPreview: "Hai controllato i bot — ecco le best practice.",
    crossSellTools: ["audit_tecnico", "ai_traffic"],
    crossSellSubject: "Bot sotto controllo — verifica tecnica e traffico",
  },
  search_console: {
    id: "search_console",
    label: "Search Console",
    tipsSubject: "I filtri AI di Search Console",
    tipsPreview: "Hai aperto Search Console — ecco i filtri più utili.",
    crossSellTools: ["ai_volumes", "cite_gap"],
    crossSellSubject: "Da Search Console a opportunità concrete",
  },
  bing: {
    id: "bing",
    label: "Visibilità Bing",
    tipsSubject: "Bing e Copilot: perché conta",
    tipsPreview: "Hai controllato Bing — ecco perché monitorarlo.",
    crossSellTools: ["search_console", "ai_traffic"],
    crossSellSubject: "Bing visto — ora confronta con Google e traffico AI",
  },
};

/**
 * Get cross-sell tool labels from IDs.
 */
export function getCrossSellLabels(toolId: string): string[] {
  const config = MINI_TOOL_CONFIG[toolId];
  if (!config) return [];
  return config.crossSellTools
    .map((id) => MINI_TOOL_CONFIG[id]?.label)
    .filter(Boolean);
}
