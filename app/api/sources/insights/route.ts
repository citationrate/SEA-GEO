import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import OpenAI from "openai";
import crypto from "crypto";

const LANG_NAME: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };

function computeHash(domains: any[]): string {
  const payload = domains
    .map((d: any) => `${d.domain}:${d.source_type}:${d.citations}`)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(payload).digest("hex");
}

async function generateInsights(brand: string, summary: string, lang: string) {
  const outputLang = LANG_NAME[lang] ?? "English";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.3,
    max_completion_tokens: 500,
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
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]).insights ?? []; } catch { /* fall through */ }
  }
  return [];
}

async function translateInsights(insights: any[], lang: string) {
  const outputLang = LANG_NAME[lang] ?? "English";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.2,
    max_completion_tokens: 500,
    messages: [{
      role: "user",
      content: `Translate these insights to ${outputLang}. Keep the same JSON format.
${JSON.stringify({ insights })}

Respond ONLY with valid JSON.`,
    }],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]).insights ?? insights; } catch { /* fall through */ }
  }
  return insights;
}

export async function POST(request: Request) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { domains, brand, lang, projectId } = await request.json();
    if (!Array.isArray(domains) || !brand) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const domainsSlice = domains.slice(0, 30);
    const hash = computeHash(domainsSlice);
    const svc = createServiceClient();

    // Try to read cached insights from project
    if (projectId) {
      const { data: project } = await (svc.from("projects") as any)
        .select("source_insights, source_insights_hash, source_insights_lang")
        .eq("id", projectId)
        .single();

      if (project?.source_insights_hash === hash && project?.source_insights) {
        const cached = project.source_insights as any[];
        // Same sources — return cached (translate if language changed)
        if (project.source_insights_lang === lang) {
          return NextResponse.json({ insights: cached, cached: true });
        }
        // Different language — translate cached insights
        const translated = await translateInsights(cached, lang);
        await (svc.from("projects") as any)
          .update({ source_insights: translated, source_insights_lang: lang })
          .eq("id", projectId);
        return NextResponse.json({ insights: translated, cached: true, translated: true });
      }
    }

    // Generate fresh insights
    const summary = domainsSlice.map(
      (d: any) => `${d.domain} (${d.source_type}, ${d.citations}x)`
    ).join(", ");

    const insights = await generateInsights(brand, summary, lang);

    // Save to project cache
    if (projectId && insights.length > 0) {
      await (svc.from("projects") as any)
        .update({
          source_insights: insights,
          source_insights_hash: hash,
          source_insights_lang: lang,
        })
        .eq("id", projectId);
    }

    return NextResponse.json({ insights });
  } catch (err: any) {
    console.error("[sources/insights] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore interno", detail: err?.message }, { status: 500 });
  }
}
