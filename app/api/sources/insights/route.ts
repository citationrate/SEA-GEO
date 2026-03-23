import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { domains, brand, lang } = await request.json();
    if (!Array.isArray(domains) || !brand) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const summary = domains.slice(0, 30).map(
      (d: any) => `${d.domain} (${d.source_type}, ${d.citations}x)`
    ).join(", ");

    const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
    const outputLang = langName[lang] ?? "English";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Analyze this AI citation profile for the brand "${brand}":
${summary}

Tell me the 3 most important insights about how AI models build their knowledge about this brand.
Respond in ${outputLang} with this JSON format:
{
  "insights": [
    { "title": "short title", "description": "explanation in 1-2 sentences" },
    { "title": "short title", "description": "explanation in 1-2 sentences" },
    { "title": "short title", "description": "explanation in 1-2 sentences" }
  ]
}

Respond ONLY with valid JSON.`,
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
