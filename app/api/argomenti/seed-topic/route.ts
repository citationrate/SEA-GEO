import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Seed Topic: genera domande specifiche per un argomento/topic di un brand.
// Es: topic "Stivaletti Chelsea" per Velasca → genera domande su quel topic.
// Stesse regole: unbranded, must-produce-brand-citations, naturali.
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  project_id: z.string().uuid(),
  argomento_id: z.string().uuid(),
  topic: z.string().min(1).max(200),
  count: z.number().int().min(2).max(15).default(5),
});

const LANG_NAME: Record<string, string> = { it: "italiano", en: "English", fr: "français", de: "Deutsch", es: "español" };

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    const { project_id, argomento_id, topic, count } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("target_brand, sector, language, known_competitors, site_analysis")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
    const p = project as any;

    // Verifica che l'argomento esista
    const { data: arg } = await (supabase.from("argomenti") as any)
      .select("id").eq("id", argomento_id).eq("project_id", project_id).is("deleted_at", null).maybeSingle();
    if (!arg) return NextResponse.json({ error: "Argomento non trovato" }, { status: 404 });

    const langName = LANG_NAME[p.language] || "italiano";
    const brand = (p.target_brand || "").trim();
    const competitors = Array.isArray(p.known_competitors) ? p.known_competitors.slice(0, 6) : [];
    const sa = p.site_analysis;

    const prompt = `Sei un esperto di AI Search Optimization. Genera ESATTAMENTE ${count} domande che un utente scriverebbe a ChatGPT, Gemini o Perplexity cercando specificamente "${topic}" nel settore "${p.sector || "generico"}".

REGOLE TASSATIVE:
1. UNBRANDED: NON menzionare MAI "${brand}" né nessun altro brand specifico nelle domande.
2. CITAZIONE BRAND: Ogni domanda DEVE essere formulata in modo che la risposta dell'AI conterrà SEMPRE nomi di brand/aziende. Usa formule come "quali brand consigli per", "che marchi sono i migliori per", "chi produce i migliori".
3. NATURALE: Scrivi come parlerebbe un utente vero. Domande brevi, dirette, colloquiali.
4. SPECIFICHE SUL TOPIC: Tutte le ${count} domande devono riguardare SOLO "${topic}". Non divagare su altri prodotti/servizi.
5. MIX TOFU/MOFU:
   - TOFU: "quali sono i brand migliori per ${topic}?", "chi produce i migliori ${topic}?"
   - MOFU: "come scegliere ${topic} di qualità?", "quali ${topic} hanno il miglior rapporto qualità-prezzo?"

${sa?.main_service ? `Contesto: l'azienda offre ${sa.main_service}.` : ""}
${competitors.length ? `Competitor nel settore (NON nominarli nelle domande): ${competitors.join(", ")}.` : ""}

Scrivi in ${langName}.
Rispondi SOLO con un array JSON: [{"text": "...", "funnel_stage": "TOFU"|"MOFU"}]`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    let queries: Array<{ text: string; funnel_stage: string }> = [];
    try {
      const arr = JSON.parse(cleaned.match(/\[[\s\S]*\]/)?.[0] || cleaned);
      if (Array.isArray(arr)) queries = arr;
    } catch { /* noop */ }

    const valid = queries.filter((q) => typeof q.text === "string" && q.text.trim().length > 10).slice(0, count);

    // Salva le query sotto l'argomento
    let inserted = 0;
    if (valid.length > 0) {
      const rows = valid.map((q) => ({
        project_id,
        argomento_id,
        text: q.text.trim(),
        funnel_stage: (q.funnel_stage === "MOFU" ? "mofu" : "tofu") as "tofu" | "mofu",
        set_type: "generale",
        is_active: true,
      }));
      const { error: insertErr } = await (supabase.from("queries") as any).insert(rows);
      if (!insertErr) inserted = rows.length;
    }

    return NextResponse.json({ ok: true, inserted, queries: valid });
  } catch (err) {
    console.error("[seed-topic] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore generazione domande" }, { status: 500 });
  }
}
