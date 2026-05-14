/**
 * Brand context shared loader.
 *
 * Tutti gli endpoint AI che assistono la wizard di generazione query (3 oggi:
 * brand-questions, ai-generate, ai-regenerate-one) condividono lo stesso
 * bisogno: caricare le 5-6 informazioni chiave del progetto e formattarle
 * come blocco di testo per il prompt.
 *
 * Centralizzarlo qui evita 3 query DB scritte 3 volte in modo leggermente
 * diverso e — più importante — assicura che quando aggiungiamo un nuovo
 * campo (es. "audience_type" futuro) basti toccare un solo posto.
 */

export interface BrandContext {
  id: string;
  target_brand: string | null;
  sector: string | null;
  brand_type: string | null;
  market_context: string | null;
  website_url: string | null;
  country: string | null;
  language: string | null;
  site_analysis: Record<string, any> | null;
  known_competitors: string[] | null;
}

/**
 * Carica il contesto del brand da Supabase. Ritorna `null` se il progetto
 * non esiste, è cancellato, o non appartiene all'utente — il chiamante
 * deve degradare gracefully (l'AI può comunque generare, solo con meno
 * grounding).
 */
export async function loadBrandContext(
  supabase: any,
  projectId: string | undefined | null,
  userId: string,
): Promise<BrandContext | null> {
  if (!projectId) return null;
  try {
    const { data: project } = await supabase
      .from("projects")
      .select(
        "id, target_brand, sector, brand_type, market_context, website_url, country, language, site_analysis, known_competitors",
      )
      .eq("id", projectId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    return (project as BrandContext | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Formatta il contesto per prompt LLM. Ritorna stringhe già pronte da
 * .join("\n") nel blocco "user" del messaggio.
 *
 * `purpose` controlla il livello di dettaglio:
 * - "minimal" → solo brand + sector + brand_type (per chiamate corte come
 *   brand-questions o ai-regenerate-one)
 * - "full" → tutto incluso market_context e known_competitors (per
 *   ai-generate dove il modello deve costruire query approfondite)
 */
export function brandContextLines(
  ctx: BrandContext | null,
  purpose: "minimal" | "full" = "minimal",
): string[] {
  if (!ctx) return [];
  const lines: string[] = [];
  if (ctx.target_brand) lines.push(`Brand: ${ctx.target_brand}`);
  if (ctx.sector) lines.push(`Brand sector: ${ctx.sector}`);
  if (ctx.brand_type) lines.push(`Brand type: ${ctx.brand_type}`);
  if (purpose === "full") {
    if (ctx.market_context) lines.push(`Market context: ${ctx.market_context}`);
    if (ctx.country) lines.push(`Country: ${ctx.country}`);
    if (ctx.known_competitors && ctx.known_competitors.length > 0) {
      lines.push(`Known competitors: ${ctx.known_competitors.join(", ")}`);
    }
  }
  return lines;
}

/**
 * Indovina l'audience naturale del brand dal `brand_type`. Serve come
 * fallback quando l'utente non specifica nulla — la maggior parte dei
 * brand_type ha un'audience implicita molto chiara.
 *
 * Da usare come hint nel prompt, NON come hard rule (il brand_type può
 * essere errato o assente — meglio non bloccarci sopra).
 */
export function inferDefaultAudience(ctx: BrandContext | null): "b2c" | "b2b" | "mixed" | "unknown" {
  if (!ctx?.brand_type) return "unknown";
  const t = ctx.brand_type.toLowerCase();
  if (t === "manufacturer" || t === "retailer" || t === "local" || t === "publisher" || t === "pharma" || t === "utility") return "b2c";
  if (t === "platform") return "mixed";
  if (t === "service" || t === "financial") return "mixed";
  return "unknown";
}
