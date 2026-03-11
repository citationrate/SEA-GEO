import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { topics, brand } = await req.json();

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: "topics required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const topicList = topics.map((t: { name: string; count: number }) => `${t.name} (${t.count})`).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Sei un analista di brand visibility AI. Dato un elenco di topic emersi dalle risposte AI riguardo al brand "${brand}", devi:

1. Raggruppare ogni topic in UNA macro-categoria. Usa categorie come:
   - "Competitivo" (confronti tra brand, alternative, vs)
   - "Prodotto" (caratteristiche, qualità, ingredienti, formati)
   - "Salute & Benessere" (salute, nutrizione, dieta, senza zucchero)
   - "Occasioni d'uso" (momenti, eventi, stagioni, sport)
   - "Distribuzione" (acquisto, dove comprare, supermercati, online)
   - "Prezzo & Valore" (costo, offerte, rapporto qualità-prezzo)
   - "Brand & Marketing" (pubblicità, immagine, storia, valori)
   - "Recensioni & Opinioni" (opinioni, recensioni, consigli)
   Puoi creare altre categorie se necessario, ma mantieni max 6-8 categorie totali.

2. Generare una frase di sintesi (max 2 righe) che descriva i topic principali.

Rispondi SOLO con JSON valido:
{
  "categories": [
    {
      "name": "Nome Categoria",
      "topics": ["topic1", "topic2"]
    }
  ],
  "summary": "I topic più discussi intorno a ${brand} riguardano principalmente..."
}`,
        },
        {
          role: "user",
          content: `Topic emersi per il brand "${brand}": ${topicList}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[topics/categorize]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore" },
      { status: 500 },
    );
  }
}
