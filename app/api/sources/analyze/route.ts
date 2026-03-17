import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

const bodySchema = z.object({
  domain: z.string().min(1),
  contexts: z.array(z.string()),
  citations: z.number(),
  brand: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { domain, contexts, citations, brand } = parsed.data;

    const contextList = contexts.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Questo dominio "${domain}" viene citato ${citations} volte nelle risposte AI analizzate per il brand "${brand}".

Contesti di citazione:
${contextList}

Analizza e rispondi in italiano con questo formato JSON:
{
  "why_cited": "perch\u00E9 le AI citano questo sito",
  "authority": "che autorit\u00E0 ha questo sito nel settore"
}

Rispondi SOLO con JSON valido.`,
      }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let analysis = { why_cited: "", authority: "" };
    if (jsonMatch) {
      try { analysis = JSON.parse(jsonMatch[0]); } catch { /* use default */ }
    }

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
