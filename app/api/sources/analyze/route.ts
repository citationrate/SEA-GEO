import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

const bodySchema = z.object({
  domain: z.string().min(1),
  contexts: z.array(z.string()),
  citations: z.number(),
  brand: z.string().min(1),
  lang: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { domain, contexts, citations, brand, lang } = parsed.data;

    const contextList = contexts.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join("\n");

    const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
    const outputLang = langName[lang ?? "en"] ?? "English";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `The domain "${domain}" is cited ${citations} times in AI responses analyzed for the brand "${brand}".

Citation contexts:
${contextList}

Analyze and respond in ${outputLang} with this JSON format:
{
  "why_cited": "why AI models cite this site",
  "authority": "what authority this site has in the sector"
}

Respond ONLY with valid JSON.`,
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
