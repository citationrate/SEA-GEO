import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  project_id: z.string().uuid(),
  funnel_stage: z.enum(["TOFU", "MOFU"]).default("TOFU"),
  exclude_texts: z.array(z.string()).default([]),
  mode: z.enum(["generali", "specifiche"]).optional(),
  theme: z.string().optional(),
  theme_context: z.string().optional(),
  categoria: z.string().optional(),
  mercato: z.string().optional(),
  luogo: z.string().optional(),
  punti_di_forza: z.array(z.string()).optional(),
  obiezioni: z.array(z.string()).optional(),
  lang: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    const { project_id, funnel_stage, exclude_texts, mode, theme, theme_context, categoria, mercato, luogo, punti_di_forza, obiezioni, lang } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const p = project as any;

    // Load existing DB queries + the texts the client wants to exclude.
    const { data: dbQueries } = await supabase
      .from("queries")
      .select("text")
      .eq("project_id", project_id);
    const excludeAll = [
      ...(dbQueries ?? []).map((q: any) => q.text),
      ...exclude_texts,
    ];

    const langMap: Record<string, string> = { it: "italiano", en: "English", fr: "français", de: "Deutsch", es: "español" };
    const outputLang = lang ? (langMap[lang] ?? "English") : (p.language === "it" ? "italiano" : "English");
    const isSpecific = mode === "specifiche" && typeof theme === "string" && theme.trim().length > 0;
    const themeSanitized = isSpecific ? sanitizeInput(theme!) : "";

    const today = new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });

    const contextLines: string[] = [];
    if (isSpecific) {
      contextLines.push(`- Tema fissato: ${themeSanitized}`);
      if (theme_context) contextLines.push(`- Contesto del tema: ${sanitizeInput(theme_context, 4000)}`);
    }
    if (categoria) contextLines.push(`- Categoria: ${sanitizeInput(categoria)}`);
    if (mercato) contextLines.push(`- Mercato: ${sanitizeInput(mercato)}`);
    if (luogo) contextLines.push(`- Localizzazione: ${sanitizeInput(luogo)}`);
    if (punti_di_forza?.length) contextLines.push(`- Caratteristiche distintive: ${punti_di_forza.map((s) => sanitizeInput(s)).filter(Boolean).join(", ")}`);
    if (obiezioni?.length) contextLines.push(`- Considerazioni clienti: ${obiezioni.map((s) => sanitizeInput(s)).filter(Boolean).join(", ")}`);

    const prompt = `Oggi è ${today}. Sei un esperto di AI Search Optimization.

Genera ESATTAMENTE UNA query (${funnel_stage}) in ${outputLang} per il settore del brand "${p.target_brand}" (settore: ${p.sector ?? "non specificato"}).

${contextLines.length ? `Contesto:\n${contextLines.join("\n")}\n` : ""}
Query già usate (NON ripeterle, nemmeno parafrasate):
${excludeAll.map((t) => `- ${t}`).join("\n")}

REGOLE:
- La query deve far emergere AZIENDE/FORNITORI commerciali (non enti pubblici, sindacati, autorità).
- NON menzionare "${p.target_brand}" né competitor noti.
- ${funnel_stage === "TOFU" ? "TOFU: domanda di scoperta generica del settore che chiede CHI fornisce il servizio." : "MOFU: domanda su un bisogno specifico che chiede CHI può aiutare."}
${isSpecific ? `- VINCOLO ASSOLUTO: la query DEVE menzionare il tema "${themeSanitized}" o un sinonimo stretto. Niente drift verso prodotti/servizi adiacenti del brand.\n` : ""}
Rispondi SOLO con un JSON: {"text": "...", "funnel_stage": "${funnel_stage}"}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) return NextResponse.json({ error: "Generazione fallita" }, { status: 502 });

    const obj = JSON.parse(objMatch[0]);
    if (typeof obj.text !== "string" || obj.text.trim().length < 10) {
      return NextResponse.json({ error: "Generazione fallita" }, { status: 502 });
    }

    return NextResponse.json({
      query: {
        text: obj.text.trim(),
        funnel_stage: obj.funnel_stage === "MOFU" ? "MOFU" : funnel_stage,
      },
    });
  } catch (err: any) {
    console.error("[QUERY-REGEN-ONE] ERROR:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella rigenerazione" }, { status: 500 });
  }
}

function sanitizeInput(value: string, maxLength = 500): string {
  return value
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, maxLength);
}
