import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  project_id: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  tofu_pct: z.number().min(0).max(100).default(60),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, count, tofu_pct } = parsed.data;

    // Load project with all context
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const p = project as any;

    // Load existing queries to avoid duplicates
    const { data: existingQueries } = await supabase
      .from("queries")
      .select("text")
      .eq("project_id", project_id);

    const existingTexts = (existingQueries ?? []).map((q: any) => q.text);

    const nTofu = Math.round(count * (tofu_pct / 100));
    const nMofu = count - nTofu;

    const systemPrompt = buildSystemPrompt(p, existingTexts, count, nTofu, nMofu);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // First generation call
    let queries = await callGeneration(anthropic, systemPrompt, count);

    // If under-count, make a second call for the missing ones
    if (queries.length < count) {
      const missing = count - queries.length;
      const alreadyGenerated = queries.map((q) => q.text);
      const nTofuHave = queries.filter((q) => q.funnel_stage === "TOFU").length;
      const nMofuHave = queries.filter((q) => q.funnel_stage === "MOFU").length;
      const nTofuMissing = Math.max(0, nTofu - nTofuHave);
      const nMofuMissing = Math.max(0, nMofu - nMofuHave);

      const followUpPrompt = buildFollowUpPrompt(p, [...existingTexts, ...alreadyGenerated], missing, nTofuMissing, nMofuMissing);
      const extra = await callGeneration(anthropic, followUpPrompt, missing);
      queries = [...queries, ...extra];
    }

    // Trim to exact count if over
    queries = queries.slice(0, count);

    return NextResponse.json({ queries }, { status: 200 });
  } catch (err) {
    console.error("[ai-generate] error:", err);
    return NextResponse.json({ error: "Errore nella generazione" }, { status: 500 });
  }
}

interface AIQuery {
  text: string;
  funnel_stage: "TOFU" | "MOFU";
}

async function callGeneration(anthropic: Anthropic, prompt: string, expectedCount: number): Promise<AIQuery[]> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((q: any) => typeof q.text === "string" && q.text.trim().length > 10)
      .map((q: any) => ({
        text: q.text.trim(),
        funnel_stage: q.funnel_stage === "MOFU" ? "MOFU" as const : "TOFU" as const,
      }));
  } catch {
    console.error("[ai-generate] JSON parse failed:", cleaned.substring(0, 300));
    return [];
  }
}

function buildSystemPrompt(
  project: any,
  existingTexts: string[],
  count: number,
  nTofu: number,
  nMofu: number,
): string {
  const lang = project.language === "it" ? "italiano" : "English";
  const competitors = (project.known_competitors ?? []).join(", ") || "non specificati";

  const existingBlock = existingTexts.length > 0
    ? `\nQuery già presenti nel progetto (NON duplicarle):\n${existingTexts.map((t: string) => `- ${t}`).join("\n")}\n`
    : "";

  return `Sei un esperto di AI Search Optimization. Il tuo compito è generare query realistiche che utenti reali farebbero a ChatGPT, Gemini o Perplexity quando cercano informazioni nel settore di ${project.target_brand}.

Contesto brand:
- Brand: ${project.target_brand}
- Nome progetto: ${project.name}
- Settore: ${project.sector ?? "non specificato"}
- Tipo brand: ${project.brand_type ?? "non specificato"}
- Mercato: ${project.country ?? "Italia"} / lingua ${lang}
- Sito: ${project.website_url ?? "non specificato"}
- Competitor noti: ${competitors}
- Contesto aggiuntivo: ${project.market_context ?? "nessuno"}
${existingBlock}
Genera esattamente ${count} query uniche e realistiche in ${lang}.
${nTofu} TOFU — domande generiche di scoperta SENZA citare "${project.target_brand}"
${nMofu} MOFU — domande comparative che INCLUDONO "${project.target_brand}" vs almeno un competitor

Regole:
- Ogni query deve essere semanticamente distinta dalle altre
- Usa il linguaggio naturale che un utente reale userebbe su ChatGPT o Gemini
- Adatta tono e vocabolario al settore e tipo di brand
- TOFU: non menzionare mai "${project.target_brand}" esplicitamente
- MOFU: includi "${project.target_brand}" e almeno un competitor noto
- NON usare template ripetitivi come "Quali sono i migliori..." — varia la struttura
- Rispondi SOLO con un JSON array, nessun altro testo

Formato risposta:
[{"text": "...", "funnel_stage": "TOFU"}, {"text": "...", "funnel_stage": "MOFU"}]`;
}

function buildFollowUpPrompt(
  project: any,
  allExisting: string[],
  missing: number,
  nTofuMissing: number,
  nMofuMissing: number,
): string {
  const lang = project.language === "it" ? "italiano" : "English";

  return `Sei un esperto di AI Search Optimization. Devi generare ${missing} query aggiuntive per il brand "${project.target_brand}" (settore: ${project.sector ?? "non specificato"}).

Query già generate (NON duplicarle):
${allExisting.map((t) => `- ${t}`).join("\n")}

Genera esattamente ${missing} query nuove in ${lang}:
${nTofuMissing > 0 ? `${nTofuMissing} TOFU — domande generiche SENZA citare "${project.target_brand}"` : ""}
${nMofuMissing > 0 ? `${nMofuMissing} MOFU — domande comparative CON "${project.target_brand}"` : ""}

Competitor noti: ${(project.known_competitors ?? []).join(", ") || "non specificati"}

Rispondi SOLO con un JSON array:
[{"text": "...", "funnel_stage": "TOFU"|"MOFU"}]`;
}
