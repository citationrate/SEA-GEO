import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

// Seed query (BX): genera N query non-branded + le salva, tutto server-side in
// una sola richiesta. Chiamata in fire-and-forget (keepalive) da /start così
// l'utente atterra subito sulla dashboard mentre le query si popolano.
const schema = z.object({
  project_id: z.string().uuid(),
  count: z.number().int().min(1).max(20).default(5),
});

const LANG_NAME: Record<string, string> = { it: "italiano", en: "English", fr: "français", de: "Deutsch", es: "español" };

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    const { project_id, count } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("target_brand, sector, language, website_url, market_context")
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

    const prompt = `Sei un esperto di ricerca AI. Genera ESATTAMENTE ${finalCount} domande che un potenziale cliente digiterebbe a un assistente AI (tipo ChatGPT) per trovare aziende o servizi nel settore "${p.sector || "generico"}".
Regole:
- NON menzionare il brand "${p.target_brand}". Sono domande generiche di scoperta, non sul brand.
- Scrivi le domande in ${langName}.
- Mix di TOFU (scoperta ampia, es. "quali sono le migliori aziende che...") e MOFU (valutazione/confronto, es. "come scegliere tra...").
${p.market_context ? `- Contesto di mercato: ${p.market_context}` : ""}
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

    if (rows.length > 0) {
      await (supabase.from("queries") as any).insert(rows);
    }
    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("[queries/seed] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore seed query" }, { status: 500 });
  }
}
