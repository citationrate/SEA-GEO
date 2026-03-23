import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { topics, brand, lang } = await req.json();

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: "topics required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const topicList = topics.map((t: { name: string; count: number }) => `${t.name} (${t.count})`).join(", ");

    const langMap: Record<string, { name: string; categories: Record<string, string>; summaryPrefix: string; userPrefix: string }> = {
      it: {
        name: "Italian",
        categories: {
          competitive: "Competitivo", product: "Prodotto", health: "Salute & Benessere",
          occasions: "Occasioni d'uso", distribution: "Distribuzione", price: "Prezzo & Valore",
          brandMarketing: "Brand & Marketing", reviews: "Recensioni & Opinioni",
        },
        summaryPrefix: `I topic più discussi intorno a ${brand} riguardano principalmente...`,
        userPrefix: `Topic emersi per il brand "${brand}"`,
      },
      en: {
        name: "English",
        categories: {
          competitive: "Competitive", product: "Product", health: "Health & Wellness",
          occasions: "Use Cases", distribution: "Distribution", price: "Price & Value",
          brandMarketing: "Brand & Marketing", reviews: "Reviews & Opinions",
        },
        summaryPrefix: `The most discussed topics around ${brand} mainly concern...`,
        userPrefix: `Topics found for brand "${brand}"`,
      },
      fr: {
        name: "French",
        categories: {
          competitive: "Compétitif", product: "Produit", health: "Santé & Bien-être",
          occasions: "Occasions d'usage", distribution: "Distribution", price: "Prix & Valeur",
          brandMarketing: "Marque & Marketing", reviews: "Avis & Opinions",
        },
        summaryPrefix: `Les sujets les plus discutés autour de ${brand} concernent principalement...`,
        userPrefix: `Thèmes identifiés pour la marque "${brand}"`,
      },
      de: {
        name: "German",
        categories: {
          competitive: "Wettbewerb", product: "Produkt", health: "Gesundheit & Wohlbefinden",
          occasions: "Anwendungsf\u00e4lle", distribution: "Vertrieb", price: "Preis & Wert",
          brandMarketing: "Marke & Marketing", reviews: "Bewertungen & Meinungen",
        },
        summaryPrefix: `Die meistdiskutierten Themen rund um ${brand} betreffen haupts\u00e4chlich...`,
        userPrefix: `Themen f\u00fcr die Marke "${brand}"`,
      },
      es: {
        name: "Spanish",
        categories: {
          competitive: "Competitivo", product: "Producto", health: "Salud & Bienestar",
          occasions: "Casos de uso", distribution: "Distribuci\u00f3n", price: "Precio & Valor",
          brandMarketing: "Marca & Marketing", reviews: "Rese\u00f1as & Opiniones",
        },
        summaryPrefix: `Los temas m\u00e1s discutidos sobre ${brand} se refieren principalmente a...`,
        userPrefix: `Temas encontrados para la marca "${brand}"`,
      },
    };

    const l = langMap[lang] ?? langMap.it;
    const catExamples = Object.values(l.categories).map((c) => `"${c}"`).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an AI brand visibility analyst. Given a list of topics from AI responses about the brand "${brand}", you must:

1. Group each topic into ONE macro-category. Use categories like: ${catExamples}.
   You may create other categories if needed, but keep max 6-8 total.

2. Generate a summary sentence (max 2 lines) describing the main topics.

IMPORTANT: All category names and the summary MUST be in ${l.name}.

Respond ONLY with valid JSON:
{
  "categories": [
    {
      "name": "Category Name",
      "topics": ["topic1", "topic2"]
    }
  ],
  "summary": "${l.summaryPrefix}"
}`,
        },
        {
          role: "user",
          content: `${l.userPrefix}: ${topicList}`,
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
