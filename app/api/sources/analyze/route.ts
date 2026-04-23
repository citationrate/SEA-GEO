import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getUserPlanLimits, getCurrentUsage, incrementUrlAnalysesUsed } from "@/lib/usage";
import { resolvePlanLimit, isProOrEnterprise } from "@/lib/plan-limits";

const bodySchema = z.object({
  domain: z.string().min(1),
  contexts: z.array(z.string()),
  citations: z.number(),
  brand: z.string().min(1),
  lang: z.string().optional(),
  project_id: z.string().uuid().optional(),
  cache_only: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { domain, contexts, citations, brand, lang, project_id, cache_only } = parsed.data;

    // Check cached analysis
    if (project_id) {
      const { data: cached } = await (supabase!.from("sources") as any)
        .select("url_analysis")
        .eq("domain", domain)
        .eq("project_id", project_id)
        .not("url_analysis", "is", null)
        .limit(1)
        .maybeSingle();

      if (cached?.url_analysis) {
        return NextResponse.json({ ...cached.url_analysis, cached: true });
      }
    }

    // If cache_only, don't run AI — just return empty
    if (cache_only) {
      return NextResponse.json({ cached: false });
    }

    // Pro plan check + usage limit (Enterprise has unlimited URL analyses
    // via NULL in the plans table — resolvePlanLimit maps that to a large
    // sentinel so the >= check below never fires).
    const plan = await getUserPlanLimits(user.id);
    const planId = plan.id ?? "demo";
    if (!isProOrEnterprise(planId)) {
      return NextResponse.json({ error: "Questa funzione è disponibile dal piano Pro.", code: "PRO_REQUIRED" }, { status: 403 });
    }
    const usage = await getCurrentUsage(user.id);
    const maxUrlAnalyses = resolvePlanLimit((plan as any).max_url_analyses, 50);
    if (usage.urlAnalysesUsed >= maxUrlAnalyses) {
      return NextResponse.json({ error: `Hai raggiunto il limite di ${maxUrlAnalyses} analisi URL questo mese.`, code: "LIMIT_REACHED" }, { status: 403 });
    }

    const contextList = contexts.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join("\n");

    const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
    const outputLang = langName[lang ?? "en"] ?? "English";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      temperature: 0.3,
      max_completion_tokens: 600,
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

    // Save analysis to sources table for this domain
    if (project_id) {
      const { error: saveErr } = await (supabase!.from("sources") as any)
        .update({ url_analysis: analysis })
        .eq("domain", domain)
        .eq("project_id", project_id);
      if (saveErr) {
        console.error("[sources/analyze] save error:", saveErr.message);
      }
    }

    // Increment usage counter ONLY on success
    await incrementUrlAnalysesUsed(user.id).catch((err) =>
      console.error("[sources/analyze] usage increment error:", err)
    );

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("[sources/analyze] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore interno", detail: err?.message }, { status: 500 });
  }
}
