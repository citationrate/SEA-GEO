import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { domains, brand } = await request.json();
    if (!Array.isArray(domains) || !brand) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    const summary = domains.slice(0, 30).map(
      (d: any) => `${d.domain} (${d.source_type}, ${d.citations}x)`
    ).join(", ");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Analizza questo profilo di citazioni delle AI per il brand "${brand}":
${summary}

Dimmi i 3 insight pi\u00F9 importanti su come le AI costruiscono la loro conoscenza su questo brand.
Rispondi in italiano con questo formato JSON:
{
  "insights": [
    { "title": "titolo breve", "description": "spiegazione in 1-2 frasi" },
    { "title": "titolo breve", "description": "spiegazione in 1-2 frasi" },
    { "title": "titolo breve", "description": "spiegazione in 1-2 frasi" }
  ]
}

Rispondi SOLO con JSON valido.`,
      }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let result = { insights: [] };
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch { /* use default */ }
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
