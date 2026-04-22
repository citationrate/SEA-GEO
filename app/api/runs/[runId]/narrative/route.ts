import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createDataClient } from "@/lib/supabase/server";
import { checkAndIncrementHaikuLimit, HAIKU_DAILY_LIMIT } from "@/lib/haiku-rate-limit";

const schema = z.object({
  target_brand: z.string().min(1).max(200),
  avi_score: z.number().min(0).max(100),
  presence_score: z.number().nullable().optional(),
  rank_score: z.number().nullable().optional(),
  sentiment_score: z.number().nullable().optional(),
  top_competitor: z.string().nullable().optional(),
  top_competitor_avi: z.number().nullable().optional(),
  locale: z.enum(["it", "en", "fr", "de", "es"]).default("it"),
});

const LANG_NAMES: Record<string, string> = {
  it: "Italian",
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
};

export async function POST(request: Request, { params }: { params: { runId: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Ownership check: make sure the requesting user owns the project that owns this run
  const supabase = createDataClient();
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("project_id")
    .eq("id", params.runId)
    .single();
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", (run as any).project_id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const d = parsed.data;

  // Cache lookup: narrative for a completed run × language is stable, so we
  // serve from DB on any subsequent open.
  const { data: cached } = await (supabase.from("run_narratives") as any)
    .select("insight_text")
    .eq("run_id", params.runId)
    .eq("language", d.locale)
    .maybeSingle();
  if (cached?.insight_text) {
    return NextResponse.json({ insight: cached.insight_text, cached: true });
  }

  // Not cached — count against the daily Haiku quota before calling.
  const limit = await checkAndIncrementHaikuLimit(supabase, user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily AI insight limit reached", limit: HAIKU_DAILY_LIMIT },
      { status: 429 },
    );
  }

  const langName = LANG_NAMES[d.locale] ?? LANG_NAMES.en;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are an AI visibility analyst. Generate ONE short actionable insight sentence (max 2 sentences, max 280 chars) in ${langName} about this brand's AI visibility run.

Data:
- Brand: ${d.target_brand}
- AVI score: ${Math.round(d.avi_score)}/100
- Presence: ${d.presence_score != null ? Math.round(d.presence_score) : "n/a"}%
- Rank score: ${d.rank_score != null ? Math.round(d.rank_score) : "n/a"}/100
- Sentiment: ${d.sentiment_score != null ? Math.round(d.sentiment_score) : "n/a"}/100
- Top competitor: ${d.top_competitor ?? "none detected"}${d.top_competitor_avi != null ? ` (AVI ${Math.round(d.top_competitor_avi)})` : ""}

Rules:
- Do NOT repeat the raw numbers verbatim (they are already shown above the insight).
- Focus on the *meaning*: is the brand ahead, behind, strong in one dimension but weak in another?
- Be concrete and actionable. Avoid generic filler like "interesting results".
- Respond in ${langName}, no quotes, no preamble.

Return ONLY JSON: {"insight": "..."}`,
        },
      ],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsedJson = JSON.parse(jsonMatch?.[0] ?? cleaned);
    const insight = typeof parsedJson?.insight === "string" ? parsedJson.insight.trim() : null;
    if (!insight) return NextResponse.json({ error: "No insight generated" }, { status: 500 });

    // Persist to cache (best-effort — if the upsert fails we still return the
    // freshly generated insight so the user sees something).
    const { error: upsertErr } = await (supabase.from("run_narratives") as any).upsert(
      {
        run_id: params.runId,
        language: d.locale,
        insight_text: insight,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "run_id,language" },
    );
    if (upsertErr) {
      console.error("[runs/narrative] cache upsert failed:", upsertErr.message);
    }

    return NextResponse.json({ insight, cached: false });
  } catch (err) {
    console.error("[runs/narrative] error:", err);
    return NextResponse.json({ error: "Narrative generation failed" }, { status: 500 });
  }
}
