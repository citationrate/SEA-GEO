import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeSite, type AnalyzeLang } from "@/lib/site-analysis";

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Setup Overview: analizza il sito del brand, identifica i topic principali
// (prodotti/servizi), e crea:
// 1. Un argomento "[Brand] Overview" con domande bilanciate su tutti i topic
// 2. Una lista di topic suggeriti che l'utente può scegliere come argomenti
//
// Le domande sono SEMPRE:
// - Unbranded (mai il nome del brand nella domanda)
// - Progettate per produrre risposte con citazione di brand/aziende
// - Naturali (come un utente vero cercherebbe)
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  project_id: z.string().uuid(),
  count: z.number().int().min(3).max(20).default(8),
});

const LANG_NAME: Record<string, string> = { it: "italiano", en: "English", fr: "français", de: "Deutsch", es: "español" };
const ANALYZE_LANGS = new Set<AnalyzeLang>(["it", "en", "fr", "de", "es"]);

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    const { project_id, count } = parsed.data;

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("target_brand, sector, language, website_url, market_context, known_competitors, country, site_analysis")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
    const p = project as any;

    // Site analysis: usa quella esistente o analizza on-demand
    let sa = p.site_analysis;
    if (!sa && p.website_url) {
      const lang = ANALYZE_LANGS.has(p.language) ? (p.language as AnalyzeLang) : "it";
      sa = await analyzeSite(p.website_url, lang);
      if (sa) {
        await (supabase.from("projects") as any)
          .update({ site_analysis: sa })
          .eq("id", project_id);
      }
    }

    const langName = LANG_NAME[p.language] || "italiano";
    const brand = (p.target_brand || "").trim();
    const mainService = sa?.main_service || "";
    const valueProp = sa?.value_proposition || "";
    const sectorKeywords = Array.isArray(sa?.sector_keywords) ? sa.sector_keywords.slice(0, 10) : [];
    const competitors = Array.isArray(p.known_competitors) ? p.known_competitors.slice(0, 6) : [];

    // ── Step 1: Identifica i topic principali del brand ─────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const topicsPrompt = `Sei un esperto di marketing digitale. Analizza questo brand e identifica i 4-8 principali prodotti/servizi/categorie che offre.

Brand: ${brand}
Settore: ${p.sector || "generico"}
${mainService ? `Offerta principale: ${mainService}` : ""}
${sectorKeywords.length ? `Keyword settore: ${sectorKeywords.join(", ")}` : ""}
${p.website_url ? `Sito: ${p.website_url}` : ""}

Rispondi SOLO con un JSON array di stringhe, ogni stringa è il nome di un prodotto/servizio/categoria principale. Nomi brevi e specifici (2-4 parole max). Scrivi in ${langName}.
Esempio per un brand di scarpe: ["Stivaletti Chelsea", "Derby classiche", "Mocassini", "Sneakers", "Scarpe da cerimonia"]
Esempio per un SaaS: ["Email marketing", "Landing page builder", "CRM", "Analytics"]`;

    const topicsMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: topicsPrompt }],
    });
    const topicsRaw = topicsMsg.content[0]?.type === "text" ? topicsMsg.content[0].text : "[]";
    const topicsCleaned = topicsRaw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    let suggestedTopics: string[] = [];
    try {
      const arr = JSON.parse(topicsCleaned.match(/\[[\s\S]*\]/)?.[0] || topicsCleaned);
      if (Array.isArray(arr)) suggestedTopics = arr.filter((t: unknown) => typeof t === "string" && t.trim().length > 0).slice(0, 8);
    } catch { /* noop */ }

    // ── Step 2: Genera domande overview bilanciate ──────────────────────
    const overviewPrompt = `Sei un esperto di AI Search Optimization. Genera ESATTAMENTE ${count} domande che un potenziale cliente scriverebbe a ChatGPT, Gemini o Perplexity cercando prodotti/servizi nel settore "${p.sector || "generico"}".

REGOLE TASSATIVE:
1. UNBRANDED: NON menzionare MAI "${brand}" né nessun altro brand specifico nelle domande.
2. CITAZIONE BRAND: Ogni domanda DEVE essere formulata in modo che la risposta dell'AI conterrà SEMPRE nomi di brand/aziende. Usa formule come "quali brand consigli", "che aziende offrono", "quali sono i marchi migliori per".
3. NATURALE: Scrivi come parlerebbe un utente vero, non in modo artificiale o troppo lungo.
4. BILANCIATA: Distribuisci le domande sui principali prodotti/servizi del brand: ${suggestedTopics.length ? suggestedTopics.join(", ") : "prodotti/servizi del settore"}.
5. MIX TOFU/MOFU:
   - TOFU (scoperta): "quali sono i brand migliori per...", "che marchi consigli per..."
   - MOFU (confronto): "come scegliere tra...", "quali brand hanno il miglior rapporto qualità-prezzo per..."

${mainService ? `L'azienda offre: ${mainService}.` : ""}
${valueProp ? `Proposta di valore: ${valueProp}.` : ""}
${sectorKeywords.length ? `Temi rilevanti: ${sectorKeywords.join(", ")}.` : ""}
${competitors.length ? `Competitor nel settore (NON nominarli nelle domande, servono solo come contesto): ${competitors.join(", ")}.` : ""}

Scrivi le domande in ${langName}.
Rispondi SOLO con un array JSON: [{"text": "...", "funnel_stage": "TOFU"|"MOFU", "topic": "..."}]
Il campo "topic" indica a quale prodotto/servizio si riferisce la domanda.`;

    const overviewMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: overviewPrompt }],
    });
    const overviewRaw = overviewMsg.content[0]?.type === "text" ? overviewMsg.content[0].text : "[]";
    const overviewCleaned = overviewRaw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    let generatedQueries: Array<{ text: string; funnel_stage: string; topic?: string }> = [];
    try {
      const arr = JSON.parse(overviewCleaned.match(/\[[\s\S]*\]/)?.[0] || overviewCleaned);
      if (Array.isArray(arr)) generatedQueries = arr;
    } catch { /* noop */ }

    const validQueries = generatedQueries
      .filter((q) => typeof q.text === "string" && q.text.trim().length > 10)
      .slice(0, count);

    // ── Step 3: Crea argomento "[Brand] Overview" ───────────────────────
    const overviewName = `${brand} Overview`;

    // Check se esiste già
    const { data: existingArg } = await (supabase.from("argomenti") as any)
      .select("id")
      .eq("project_id", project_id)
      .ilike("name", overviewName)
      .is("deleted_at", null);

    let argomentoId: string;
    if (existingArg && existingArg.length > 0) {
      argomentoId = existingArg[0].id;
    } else {
      const { data: newArg } = await (supabase.from("argomenti") as any)
        .insert({ project_id, name: overviewName, description: `Panoramica completa: ${suggestedTopics.join(", ")}` })
        .select("id")
        .single();
      argomentoId = newArg?.id;
    }

    // ── Step 4: Salva le query sotto l'argomento overview ───────────────
    let inserted = 0;
    if (argomentoId && validQueries.length > 0) {
      const rows = validQueries.map((q) => ({
        project_id,
        argomento_id: argomentoId,
        text: q.text.trim(),
        funnel_stage: (q.funnel_stage === "MOFU" ? "mofu" : "tofu") as "tofu" | "mofu",
        set_type: "generale",
        is_active: true,
      }));
      const { error: insertErr } = await (supabase.from("queries") as any).insert(rows);
      if (!insertErr) inserted = rows.length;
    }

    return NextResponse.json({
      ok: true,
      argomento_id: argomentoId,
      argomento_name: overviewName,
      inserted,
      suggested_topics: suggestedTopics,
      queries: validQueries,
    });
  } catch (err) {
    console.error("[setup-overview] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore setup overview" }, { status: 500 });
  }
}
