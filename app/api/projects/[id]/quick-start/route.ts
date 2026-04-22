import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createDataClient } from "@/lib/supabase/server";
import { checkAndIncrementHaikuLimit, HAIKU_DAILY_LIMIT } from "@/lib/haiku-rate-limit";

const previewSchema = z.object({
  action: z.literal("preview"),
  language: z.enum(["it", "en", "fr", "de", "es"]).optional(),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  queries: z
    .array(
      z.object({
        text: z.string().min(5).max(500),
        funnel_stage: z.enum(["tofu", "mofu"]),
      }),
    )
    .min(1)
    .max(12),
  competitors: z.array(z.string().min(1).max(100)).max(10).optional(),
});

const bodySchema = z.discriminatedUnion("action", [previewSchema, confirmSchema]);

const LANG_LABEL: Record<string, string> = {
  it: "italiano",
  en: "English",
  fr: "français",
  de: "Deutsch",
  es: "español",
};

/** Fallback queries when Haiku is unavailable — generic but usable. */
function fallbackQueries(brand: string, sector: string | null, lang: string): Array<{ text: string; funnel_stage: "tofu" | "mofu" }> {
  const s = sector?.trim() || "settore";
  const byLang: Record<string, Array<{ text: string; funnel_stage: "tofu" | "mofu" }>> = {
    it: [
      { text: `Quali sono le migliori aziende nel ${s}?`, funnel_stage: "tofu" },
      { text: `Chi sono i leader di mercato nel ${s}?`, funnel_stage: "tofu" },
      { text: `Quale azienda scegliere per ${s}: quali sono le più affidabili?`, funnel_stage: "mofu" },
      { text: `Cerco un fornitore nel ${s}: chi mi consigliate e perché?`, funnel_stage: "mofu" },
    ],
    en: [
      { text: `Who are the top companies in ${s}?`, funnel_stage: "tofu" },
      { text: `Which brands lead the ${s} market?`, funnel_stage: "tofu" },
      { text: `Which company should I choose for ${s} and why?`, funnel_stage: "mofu" },
      { text: `Looking for a reliable ${s} provider — who do you recommend?`, funnel_stage: "mofu" },
    ],
    fr: [
      { text: `Quelles sont les meilleures entreprises dans le ${s} ?`, funnel_stage: "tofu" },
      { text: `Qui sont les leaders du marché ${s} ?`, funnel_stage: "tofu" },
      { text: `Quelle entreprise choisir pour ${s} et pourquoi ?`, funnel_stage: "mofu" },
      { text: `Je cherche un fournisseur ${s} fiable — que recommandez-vous ?`, funnel_stage: "mofu" },
    ],
    de: [
      { text: `Welche sind die besten Unternehmen im ${s}?`, funnel_stage: "tofu" },
      { text: `Wer führt den Markt im ${s}?`, funnel_stage: "tofu" },
      { text: `Welches Unternehmen sollte ich für ${s} wählen und warum?`, funnel_stage: "mofu" },
      { text: `Suche einen zuverlässigen ${s}-Anbieter — wen empfehlen Sie?`, funnel_stage: "mofu" },
    ],
    es: [
      { text: `¿Cuáles son las mejores empresas en el ${s}?`, funnel_stage: "tofu" },
      { text: `¿Quiénes lideran el mercado de ${s}?`, funnel_stage: "tofu" },
      { text: `¿Qué empresa debería elegir para ${s} y por qué?`, funnel_stage: "mofu" },
      { text: `Busco un proveedor de ${s} fiable — ¿qué recomendáis?`, funnel_stage: "mofu" },
    ],
  };
  return byLang[lang] ?? byLang.en;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Ownership + soft-delete check
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const p = project as any;

  // Plan gate — demo users cannot use AI generation.
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan = profile?.plan ?? "demo";
  if (plan === "demo") {
    return NextResponse.json({ error: "AI query generation requires Base or Pro plan" }, { status: 403 });
  }

  if (parsed.data.action === "preview") {
    return handlePreview(p, user.id, parsed.data.language);
  }
  return handleConfirm(p, parsed.data.queries, parsed.data.competitors ?? []);
}

async function handlePreview(project: any, userId: string, uiLanguage?: string) {
  // UI language (from the caller) takes priority over the project's target
  // market language so the queries render in the language the user is
  // reading. Matches the behavior of /api/queries/ai-generate.
  const lang = uiLanguage || project.language || "it";
  const langLabel = LANG_LABEL[lang] ?? "English";

  // Rate limit Haiku before any API call.
  const limit = await checkAndIncrementHaikuLimit(createDataClient(), userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily AI limit reached", limit: HAIKU_DAILY_LIMIT },
      { status: 429 },
    );
  }

  const brand = project.target_brand ?? project.name ?? "the brand";
  const sector = project.sector ?? null;
  const site = project.site_analysis ?? {};
  const sectorKeywords: string[] = Array.isArray(site.sector_keywords) ? site.sector_keywords : [];
  const mainService: string = site.main_service ?? "";
  const targetAudience: string = site.target_audience ?? "";
  const valueProp: string = site.value_proposition ?? "";
  const siteCompetitors: string[] = Array.isArray(site.competitor_signals) ? site.competitor_signals : [];
  const knownCompetitors: string[] = Array.isArray(project.known_competitors) ? project.known_competitors : [];

  const prompt = `You are an AI Search Optimization expert. Generate a Quick Start configuration for a brand visibility analysis.

Brand context:
- Brand: ${brand}
- Sector: ${sector ?? "not specified"}
- Website: ${project.website_url ?? "not specified"}
- Country: ${project.country ?? "not specified"}
- Main service: ${mainService || "not specified"}
- Target audience: ${targetAudience || "not specified"}
- Value proposition: ${valueProp || "not specified"}
- Sector keywords: ${sectorKeywords.join(", ") || "none"}
- Known competitors: ${[...knownCompetitors, ...siteCompetitors].slice(0, 8).join(", ") || "none detected"}

Task:
1) Generate exactly 4 realistic queries a potential customer would type into ChatGPT / Gemini / Perplexity when looking for a provider in this sector.
   - 2 TOFU queries: generic, unbranded, asking WHICH COMPANIES / WHO PROVIDES this service. DO NOT mention "${brand}" or any competitor.
   - 2 MOFU queries: describe a concrete customer need that "${brand}" could solve, and ask WHICH COMPANY / WHO can help. Still unbranded (no brand name), but specific enough that a good AI assistant might surface "${brand}".
   - Avoid generic "what is" questions. Always steer toward commercial providers, not public entities or general info.
   - LANGUAGE REQUIREMENT: ALL 4 queries MUST be written entirely in ${langLabel}. This is non-negotiable. Even if the brand originates from a different country (e.g. ${brand} is Italian), the queries must still be in ${langLabel}. Do not mix languages. Do not output queries in Italian or any other language unless ${langLabel} is that language.
2) Suggest 3 to 5 realistic third-party competitors (company names only) that genuinely compete with "${brand}" in this sector.
   - EXCLUDE any sub-brand, product line, subsidiary, or brand in "${brand}"'s own portfolio.
   - Return a plausible list even if uncertain — the user will review and edit.

Return ONLY valid JSON, no preamble, no markdown fence:
{
  "queries": [
    {"text": "...", "funnel_stage": "tofu"},
    {"text": "...", "funnel_stage": "tofu"},
    {"text": "...", "funnel_stage": "mofu"},
    {"text": "...", "funnel_stage": "mofu"}
  ],
  "competitors": ["Company A", "Company B", "Company C"]
}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);

    const queries = Array.isArray(parsed?.queries)
      ? parsed.queries
          .filter((q: any) => typeof q?.text === "string" && q.text.trim().length >= 5)
          .slice(0, 6)
          .map((q: any) => ({
            text: String(q.text).trim().slice(0, 500),
            funnel_stage: q.funnel_stage === "mofu" ? "mofu" : "tofu",
          }))
      : [];
    const competitors = Array.isArray(parsed?.competitors)
      ? parsed.competitors
          .filter((c: any) => typeof c === "string" && c.trim().length > 1)
          .slice(0, 6)
          .map((c: string) => c.trim().slice(0, 100))
      : [];

    if (queries.length < 2) {
      // Haiku returned something unusable — fall back.
      return NextResponse.json({
        queries: fallbackQueries(brand, sector, lang),
        competitors,
        fallback: true,
      });
    }

    return NextResponse.json({ queries, competitors, fallback: false });
  } catch (err) {
    console.error("[quick-start/preview] Haiku failed, using fallback:", err);
    return NextResponse.json({
      queries: fallbackQueries(brand, sector, lang),
      competitors: [],
      fallback: true,
    });
  }
}

async function handleConfirm(
  project: any,
  queries: Array<{ text: string; funnel_stage: "tofu" | "mofu" }>,
  competitors: string[],
) {
  const supabase = createDataClient();

  // Load existing query texts to skip duplicates (case-insensitive compare in JS).
  const { data: existing } = await (supabase.from("queries") as any)
    .select("text")
    .eq("project_id", project.id);
  const existingTexts = new Set<string>(
    (existing ?? []).map((q: any) => String(q.text).trim().toLowerCase()),
  );

  const toInsert = queries
    .map((q) => ({ text: q.text.trim(), funnel_stage: q.funnel_stage }))
    .filter((q) => q.text.length >= 5 && !existingTexts.has(q.text.toLowerCase()));

  let inserted: Array<{ id: string; text: string; funnel_stage: string }> = [];
  if (toInsert.length > 0) {
    const rows = toInsert.map((q) => ({
      project_id: project.id,
      text: q.text,
      funnel_stage: q.funnel_stage,
      is_active: true,
      set_type: "quickstart",
    }));

    const { data, error: dbError } = await (supabase.from("queries") as any)
      .insert(rows)
      .select("id, text, funnel_stage");

    if (dbError) {
      console.error("[quick-start/confirm] insert failed:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    inserted = data ?? [];
  }

  // Merge user-kept competitors into known_competitors (dedup, case-insensitive).
  if (competitors.length > 0) {
    const current: string[] = Array.isArray(project.known_competitors) ? project.known_competitors : [];
    const existingLower = new Set(current.map((c) => c.toLowerCase()));
    const additions = competitors
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !existingLower.has(c.toLowerCase()));
    if (additions.length > 0) {
      const merged = [...current, ...additions].slice(0, 20);
      const { error: updErr } = await (supabase.from("projects") as any)
        .update({ known_competitors: merged })
        .eq("id", project.id);
      if (updErr) {
        console.error("[quick-start/confirm] competitor merge failed:", updErr.message);
        // non-fatal
      }
    }
  }

  return NextResponse.json({
    inserted: inserted.length,
    duplicates: queries.length - inserted.length,
    queries: inserted,
  });
}
