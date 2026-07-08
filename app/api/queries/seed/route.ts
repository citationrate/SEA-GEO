import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeSite, type AnalyzeLang } from "@/lib/site-analysis";

const ANALYZE_LANGS = new Set<AnalyzeLang>(["it", "en", "fr", "de", "es"]);

export const maxDuration = 60;

// Seed query (BX): genera N query non-branded + le salva, tutto server-side in
// una sola richiesta. Chiamata in fire-and-forget (keepalive) da /start così
// l'utente atterra subito sulla dashboard mentre le query si popolano.
const schema = z.object({
  project_id: z.string().uuid(),
  count: z.number().int().min(1).max(20).default(5),
  // Tema/argomento opzionale su cui focalizzare le domande (personalizzazione
  // "Ibrido": seed rapido di default, ma l'utente può indirizzare i topic).
  theme: z.string().trim().max(160).optional(),
});

const LANG_NAME: Record<string, string> = { it: "italiano", en: "English", fr: "français", de: "Deutsch", es: "español" };

// Famiglia BRANDED (sul nome del brand) = la "vittoria": l'AI quasi sempre ti
// cita. Entra nell'AVI col blend 50/50. Template per lingua, niente trattini.
const BRANDED_TEMPLATES: Record<string, (b: string) => Array<{ text: string; funnel_stage: "tofu" | "mofu" }>> = {
  it: (b) => [
    { text: `Cosa offre ${b} e per cosa si distingue?`, funnel_stage: "tofu" },
    { text: `${b} è affidabile? Cosa dicono le recensioni?`, funnel_stage: "mofu" },
  ],
  en: (b) => [
    { text: `What does ${b} offer and what makes it stand out?`, funnel_stage: "tofu" },
    { text: `Is ${b} reliable? What do reviews say about it?`, funnel_stage: "mofu" },
  ],
  fr: (b) => [
    { text: `Que propose ${b} et qu'est-ce qui le distingue ?`, funnel_stage: "tofu" },
    { text: `${b} est-il fiable ? Que disent les avis ?`, funnel_stage: "mofu" },
  ],
  de: (b) => [
    { text: `Was bietet ${b} und wodurch hebt es sich ab?`, funnel_stage: "tofu" },
    { text: `Ist ${b} zuverlässig? Was sagen die Bewertungen?`, funnel_stage: "mofu" },
  ],
  es: (b) => [
    { text: `¿Qué ofrece ${b} y en qué se distingue?`, funnel_stage: "tofu" },
    { text: `¿${b} es fiable? ¿Qué dicen las reseñas?`, funnel_stage: "mofu" },
  ],
};

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    const { project_id, count, theme } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("target_brand, sector, brand_type, language, website_url, market_context, known_competitors, country, site_analysis")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const p = project as any;
    // Demo cap a 2 (coerente con ai-generate).
    const { data: prof } = await (supabase.from("profiles") as any).select("plan").eq("id", user.id).single();
    const finalCount = (prof?.plan ?? "demo") === "demo" ? Math.min(count, 2) : count;
    const langName = LANG_NAME[p.language] || "italiano";

    // KB-2: contesto extra dal progetto (competitor + profilo-sito) per query più
    // mirate sull'offerta reale. Tutto opzionale: se manca, il prompt resta come prima.
    const competitors: string[] = Array.isArray(p.known_competitors)
      ? p.known_competitors.filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0).slice(0, 6)
      : [];
    let sa = p.site_analysis && typeof p.site_analysis === "object" ? (p.site_analysis as Record<string, unknown>) : null;

    // Suite gap fix: progetti creati da /start nascono con site_analysis = null,
    // quindi senza crawl le query non-branded uscivano solo dal macro-settore.
    // Se manca il profilo-sito ma c'è un URL, lo generiamo ora (crawl + Haiku) e
    // lo PERSISTIAMO sul progetto: ne beneficiano anche il wizard e la pipeline
    // d'analisi (che leggono site_analysis). Best-effort: se fallisce, si ripiega
    // sul prompt basato sul solo settore, come prima.
    if (!sa && typeof p.website_url === "string" && p.website_url.trim()) {
      try {
        const lang: AnalyzeLang = ANALYZE_LANGS.has(p.language as AnalyzeLang) ? (p.language as AnalyzeLang) : "it";
        const result = await analyzeSite(p.website_url, lang);
        if (result.ok) {
          sa = result.analysis as unknown as Record<string, unknown>;
          await (supabase.from("projects") as any)
            .update({ site_analysis: result.analysis })
            .eq("id", project_id)
            .eq("user_id", user.id);
        }
      } catch (e) {
        console.warn("[queries/seed] site analysis failed, falling back to sector-only:", e instanceof Error ? e.message : e);
      }
    }
    const mainService = sa && typeof sa.main_service === "string" ? sa.main_service : "";
    const valueProp = sa && typeof sa.value_proposition === "string" ? sa.value_proposition : "";
    const sectorKeywords = sa && Array.isArray(sa.sector_keywords)
      ? (sa.sector_keywords as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 6)
      : [];

    // Prodotto vs servizio: il 58% dei progetti è "manufacturer" (fa prodotti),
    // ma il vecchio prompt spingeva sempre verso "aziende o servizi", spingendo
    // il modello a inventare fornitori-di-servizio anche per un prodotto fisico.
    // Scegliamo il sostantivo di ricerca giusto in base a brand_type.
    const brandType = typeof p.brand_type === "string" ? p.brand_type.toLowerCase() : "";
    const providerNoun =
      ["manufacturer", "retailer", "pharma", "ecommerce", "product"].includes(brandType)
        ? "brand, marchi o aziende produttrici"
        : ["service", "financial", "agency", "consulting", "saas", "legal", "law"].includes(brandType)
        ? "aziende, studi o professionisti"
        : "aziende, brand o servizi";

    // ANCORA DEL DOMINIO: settore/tema/brand attuali hanno la precedenza. I
    // blocchi derivati dal sito (site_analysis, market_context) vanno usati SOLO
    // per il lessico e IGNORATI se descrivono un settore diverso — sono spesso
    // residui di una versione precedente del progetto (brand/URL cambiati, o
    // progetto AVI riusato dalla suite) e sono la causa principale del drift
    // tipo "studi di architettura specializzati in <prodotto nuovo>".
    const prompt = `Sei un esperto di ricerca AI. Genera ESATTAMENTE ${finalCount} domande che un potenziale cliente digiterebbe a un assistente AI (tipo ChatGPT) per trovare ${providerNoun} nel settore "${p.sector || "generico"}".

⚠️ ANCORA DEL DOMINIO (ha PRIORITÀ su tutto il resto):
- Argomento autorevole = settore "${p.sector || "generico"}"${theme ? ` + tema specifico dell'utente "${theme}"` : ""}. Il brand è "${p.target_brand}" (serve solo a capire il dominio, NON va nominato nelle domande).
- OGNI domanda deve restare dentro questo settore/tema. Se un qualsiasi contesto qui sotto (offerta dal sito, temi, contesto di mercato) descrive un settore DIVERSO, IGNORALO del tutto: è un residuo di una versione precedente del progetto, non usarlo per decidere DI COSA parlano le domande. Non fondere mai due settori diversi nella stessa domanda.

Regole:
- NON menzionare il brand "${p.target_brand}". Sono domande generiche di scoperta, non sul brand.
- Scrivi le domande in ${langName}.
- Mix di TOFU (scoperta ampia, es. "quali sono le migliori aziende che...") e MOFU (valutazione/confronto, es. "come scegliere tra...").
${theme ? `- Focalizza TUTTE le domande sul tema "${theme}": restano domande di scoperta generiche (senza nominare il brand), ma calate su questo tema.` : ""}
${p.market_context ? `- Contesto di mercato (usa SOLO se coerente col settore "${p.sector || "generico"}", altrimenti ignora): ${p.market_context}` : ""}
${mainService ? `- Offerta reale dal sito (rende le domande più pertinenti, ma usala SOLO se coerente col settore/tema sopra; altrimenti ignorala): ${mainService}.` : ""}
${valueProp ? `- Proposta di valore (solo per lessico/tono, se coerente): ${valueProp}.` : ""}
${sectorKeywords.length ? `- Temi dal sito (usa SOLO quelli coerenti col settore/tema): ${sectorKeywords.join(", ")}.` : ""}
${competitors.length ? `- Concorrenti noti nello spazio (servono solo a orientare il TIPO di domande di scoperta; NON nominarli nelle domande): ${competitors.join(", ")}.` : ""}
Rispondi SOLO con un array JSON, nessun altro testo: [{"text": "...", "funnel_stage": "TOFU"|"MOFU"}]`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    let parsedQueries: Array<{ text: string; funnel_stage: string }> = [];
    try {
      const arr = JSON.parse(jsonMatch?.[0] ?? cleaned);
      if (Array.isArray(arr)) parsedQueries = arr;
    } catch { /* niente query → no-op */ }

    const rows = parsedQueries
      .filter((q) => typeof q.text === "string" && q.text.trim().length > 10)
      .slice(0, finalCount)
      .map((q) => ({
        project_id,
        text: q.text.trim(),
        funnel_stage: (q.funnel_stage === "MOFU" ? "mofu" : "tofu") as "tofu" | "mofu",
        set_type: "generale",
      }));

    // Branded: per i piani a pagamento le domande sul brand NON sono più
    // auto-iniettate qui — si scelgono dal selettore dedicato nel wizard. In
    // DEMO ne teniamo UNA sola, così nell'esperienza demo la citazione sul
    // brand (la "vittoria" che entra nel blend AVI) è comunque presente.
    const brandName = (p.target_brand || "").trim();
    const isDemo = (prof?.plan ?? "demo") === "demo";
    // Rigenerando (Ibrido: "genera altre domande") il seed viene richiamato più
    // volte: non ri-aggiungere la branded se il progetto ne ha già una.
    let hasBranded = false;
    if (brandName && isDemo) {
      const { count: brandedCount } = await (supabase.from("queries") as any)
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .eq("set_type", "branded");
      hasBranded = (brandedCount ?? 0) > 0;
    }
    const brandedRows = (brandName && isDemo && !hasBranded)
      ? (BRANDED_TEMPLATES[p.language] || BRANDED_TEMPLATES.it)(brandName).slice(0, 1).map((q) => ({
          project_id,
          text: q.text,
          funnel_stage: q.funnel_stage,
          set_type: "branded",
        }))
      : [];

    const allRows = [...brandedRows, ...rows];
    if (allRows.length > 0) {
      await (supabase.from("queries") as any).insert(allRows);
    }
    return NextResponse.json({ ok: true, inserted: allRows.length, branded: brandedRows.length });
  } catch (err) {
    console.error("[queries/seed] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore seed query" }, { status: 500 });
  }
}
