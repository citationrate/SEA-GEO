import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {
    const { brandA, brandB, customDriver, sector, language } = await request.json();
    if (!brandA || !brandB || !customDriver) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const lang = language === "en" ? "en" : "it";
    const isEnglish = lang === "en";

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: isEnglish
          ? `Generate 3 comparative questions between "${brandA}" and "${brandB}" on the topic: "${customDriver}".

Context: sector ${sector || "generic"}.

The questions must:
- Be specific and searchable (trigger web search in AI)
- Use pattern A (direct comparison), B (conditional choice), C (generic recommendation)
- Include "today" or "according to customers" or "based on real experiences"
- Be in natural English
- NEVER ask abstract opinions

Return ONLY a JSON array, no text before or after:
[
  {"pattern": "A", "text": "..."},
  {"pattern": "B", "text": "..."},
  {"pattern": "C", "text": "..."}
]`
          : `Genera 3 domande comparative tra "${brandA}" e "${brandB}" sul tema: "${customDriver}".

Contesto: settore ${sector || "generico"}, mercato italiano.

Le domande devono:
- Essere specifiche e searchable (triggherano web search nelle AI)
- Usare pattern A (confronto diretto), B (scelta condizionata), C (raccomandazione generica)
- Includere "ad oggi" o "secondo i clienti" o "in base alle esperienze reali"
- Essere in italiano naturale
- MAI chiedere opinioni astratte

Restituisci SOLO un JSON array, senza testo prima o dopo:
[
  {"pattern": "A", "text": "..."},
  {"pattern": "B", "text": "..."},
  {"pattern": "C", "text": "..."}
]`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const queries = JSON.parse(jsonMatch?.[0] ?? cleaned);

    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error("Invalid response");
    }

    return NextResponse.json(queries);
  } catch (err) {
    console.error("[generate-queries] error:", err);
    // Fallback templates
    const { brandA, brandB, customDriver } = await request.json().catch(() => ({ brandA: "", brandB: "", customDriver: "" }));
    return NextResponse.json([
      { pattern: "A", text: `${brandA} vs ${brandB}: quale è migliore per ${customDriver} secondo le recensioni e i dati reali ad oggi?` },
      { pattern: "B", text: `Tra ${brandA} e ${brandB}, chi offre ${customDriver} migliore in base alle esperienze dei clienti ad oggi?` },
      { pattern: "C", text: `${brandA} o ${brandB}: confronto ${customDriver} basato su dati e recensioni recenti` },
    ]);
  }
}
