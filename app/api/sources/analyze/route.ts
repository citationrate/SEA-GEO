import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getUserPlanLimits, getCurrentUsage, incrementUrlAnalysesUsed } from "@/lib/usage";

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

    // Pro plan check + usage limit
    const plan = await getUserPlanLimits(user.id);
    const planId = plan.id ?? "demo";
    const effectivePlan = planId === "agency" ? "pro" : planId;
    if (effectivePlan !== "pro") {
      return NextResponse.json({ error: "Questa funzione è disponibile dal piano Pro.", code: "PRO_REQUIRED" }, { status: 403 });
    }
    const usage = await getCurrentUsage(user.id);
    const maxUrlAnalyses = Number((plan as any).max_url_analyses) || 50;
    if (usage.urlAnalysesUsed >= maxUrlAnalyses) {
      return NextResponse.json({ error: `Hai raggiunto il limite di ${maxUrlAnalyses} analisi URL questo mese.`, code: "LIMIT_REACHED" }, { status: 403 });
    }

    const { domain, contexts, citations, brand, lang } = parsed.data;

    const contextList = contexts.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join("\n");

    const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
    const outputLang = langName[lang ?? "en"] ?? "English";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
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

    // Increment usage counter
    await incrementUrlAnalysesUsed(user.id).catch((err) =>
      console.error("[sources/analyze] usage increment error:", err)
    );

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("[sources/analyze] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore interno", detail: err?.message }, { status: 500 });
  }
}
