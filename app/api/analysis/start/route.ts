import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { extractFromResponse } from "@/lib/engine/extractor";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN_COUNT = 3;

// Cache for normalized competitor names within a single run
const normCache = new Map<string, string | null>();

/**
 * Normalize a competitor name: ensures it's a brand (not a product/model),
 * deduplicates case-insensitively, and filters out the target brand.
 */
async function normalizeCompetitorName(
  rawName: string,
  targetBrand: string,
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  // Check cache (case-insensitive)
  const cacheKey = trimmed.toLowerCase();
  if (normCache.has(cacheKey)) return normCache.get(cacheKey)!;

  // Quick filter: skip if it IS the target brand (case-insensitive)
  if (cacheKey === targetBrand.toLowerCase()) {
    normCache.set(cacheKey, null);
    return null;
  }

  // Quick filter: skip generic descriptions
  const genericPatterns = /^(brand|competitor|aziend|prodott|servizi|scarpe|telefon|auto |il |la |un |una )/i;
  if (genericPatterns.test(trimmed)) {
    normCache.set(cacheKey, null);
    return null;
  }

  // Use GPT-4o-mini to normalize brand vs product
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `\u00C8 "${trimmed}" un brand/azienda o un prodotto specifico? Se \u00E8 un prodotto, dimmi solo il nome del brand padre. Rispondi SOLO con il nome corretto del brand, nessun altro testo.`,
      }],
    });

    let normalized = (completion.choices[0]?.message?.content ?? trimmed).trim();

    // Remove quotes/punctuation that GPT might add
    normalized = normalized.replace(/^["']+|["']+$/g, "").replace(/\.$/,"").trim();

    // If empty after normalization, skip
    if (!normalized) {
      normCache.set(cacheKey, null);
      return null;
    }

    // Final check: is the normalized name the target brand?
    if (normalized.toLowerCase() === targetBrand.toLowerCase()) {
      normCache.set(cacheKey, null);
      return null;
    }

    // Proper casing: capitalize first letter of each word
    const proper = normalized.split(/\s+/).map(
      (w) => w.charAt(0).toUpperCase() + w.slice(1)
    ).join(" ");

    normCache.set(cacheKey, proper);
    return proper;
  } catch {
    // Fallback: use the raw name if GPT call fails
    normCache.set(cacheKey, trimmed);
    return trimmed;
  }
}

const startSchema = z.object({
  project_id: z.string().uuid(),
  models_used: z.array(z.enum(["gpt-4o", "gpt-4o-mini"])).min(1),
});

function buildPrompt(query: string, segmentContext: string, language: string): string {
  const lang = language === "it" ? "Rispondi in italiano." : "Answer in English.";
  return `${lang}

Contesto utente: ${segmentContext}

Domanda: ${query}`;
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Ricalcola l'AVI leggendo TUTTI i response_analysis completati per questa run
 * e fa upsert in avi_history. Chiamata dopo ogni prompt completato.
 */
async function computeAndUpsertAVI(
  supabase: SupabaseClient,
  runId: string,
  projectId: string,
) {
  // Step 1: fetch all prompts_executed for this run
  const { data: runPrompts } = await supabase
    .from("prompts_executed")
    .select("id, query_id, segment_id, run_number")
    .eq("run_id", runId);

  const promptsList = (runPrompts ?? []) as any[];
  const promptIds = promptsList.map((p: any) => p.id);
  if (promptIds.length === 0) return;

  const promptMap = new Map(promptsList.map((p: any) => [p.id, p]));

  // Step 2: fetch all response_analysis for these prompts
  const { data: analyses } = await supabase
    .from("response_analysis")
    .select("*")
    .in("prompt_executed_id", promptIds);

  const rows = (analyses ?? []) as any[];
  if (rows.length === 0) return;

  const total = rows.length;

  // presence_score: count(brand_mentioned=true) / total
  const presence_score = rows.filter((r: any) => r.brand_mentioned).length / total;

  // rank_score: media di Math.max(0, 1-(brand_rank-1)/10), 0 se null
  const rank_score = rows.reduce((s: number, r: any) => {
    if (r.brand_rank === null || r.brand_rank <= 0) return s;
    return s + Math.max(0, 1 - (r.brand_rank - 1) / 10);
  }, 0) / total;

  // sentiment_score: (media sentiment non null, default 0) normalizzato (v+1)/2
  const withSent = rows.filter((r: any) => r.sentiment_score !== null);
  const sentAvg = withSent.length > 0
    ? withSent.reduce((s: number, r: any) => s + r.sentiment_score, 0) / withSent.length
    : 0;
  const sentiment_score = (sentAvg + 1) / 2;

  // stability_score: per query_id+segment_id, % run che concordano. Media.
  const pairs = new Map<string, boolean[]>();
  for (const r of rows) {
    const pe = promptMap.get(r.prompt_executed_id);
    if (!pe) continue;
    const key = `${pe.query_id}__${pe.segment_id}`;
    const group = pairs.get(key) ?? [];
    group.push(r.brand_mentioned);
    pairs.set(key, group);
  }
  let stability_score = 1;
  if (pairs.size > 0) {
    const scores: number[] = [];
    for (const group of Array.from(pairs.values())) {
      if (group.length <= 1) { scores.push(1); continue; }
      const trueCount = group.filter(Boolean).length;
      scores.push(Math.max(trueCount, group.length - trueCount) / group.length);
    }
    stability_score = scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  const avi_score = Math.round(
    presence_score * 35 + rank_score * 25 + sentiment_score * 20 + stability_score * 20
  );

  // Upsert: insert or update if run_id already exists
  const { error: aviError } = await (supabase.from("avi_history") as any)
    .upsert({
      project_id: projectId,
      run_id: runId,
      avi_score,
      presence_score: Math.round(presence_score * 10000) / 100,
      rank_score: Math.round(rank_score * 10000) / 100,
      sentiment_score: Math.round(sentiment_score * 10000) / 100,
      stability_score: Math.round(stability_score * 10000) / 100,
      computed_at: new Date().toISOString(),
    }, { onConflict: "project_id,run_id" });

  if (aviError) {
    console.error("avi_history upsert error:", aviError.message);
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, models_used } = parsed.data;

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // Fetch queries and active segments
    const { data: queries } = await supabase
      .from("queries")
      .select("*")
      .eq("project_id", project_id);

    const { data: segments } = await supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", project_id)
      .eq("is_active", true);

    if (!queries?.length) return NextResponse.json({ error: "Nessuna query configurata" }, { status: 400 });
    if (!segments?.length) return NextResponse.json({ error: "Nessun segmento attivo" }, { status: 400 });

    // Count existing runs for version number
    const { count: existingRuns } = await supabase
      .from("analysis_runs")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);

    const totalPrompts = queries.length * segments.length * models_used.length * RUN_COUNT;

    // Create analysis run
    const { data: run, error: runError } = await (supabase.from("analysis_runs") as any)
      .insert({
        project_id,
        version: (existingRuns ?? 0) + 1,
        status: "running",
        models_used,
        run_count: RUN_COUNT,
        total_prompts: totalPrompts,
        completed_prompts: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

    const proj = project as any;
    const targetBrand = proj.target_brand;
    const knownCompetitors = proj.known_competitors ?? [];
    const language = proj.language;

    // Process all combinations in background-like sequential execution
    let completedPrompts = 0;
    normCache.clear();

    try {
      for (const query of queries as any[]) {
        for (const segment of segments as any[]) {
          for (const model of models_used) {
            for (let runNum = 1; runNum <= RUN_COUNT; runNum++) {
              const promptText = buildPrompt(query.text, segment.prompt_context, language);

              // Insert prompt_executed record
              const { data: promptRecord } = await (supabase.from("prompts_executed") as any)
                .insert({
                  run_id: run.id,
                  query_id: query.id,
                  segment_id: segment.id,
                  model,
                  run_number: runNum,
                  full_prompt_text: promptText,
                  raw_response: null,
                  response_length: null,
                  executed_at: null,
                  error: null,
                })
                .select("id")
                .single();

              if (!promptRecord) continue;

              let rawResponse = "";
              let promptError: string | null = null;

              try {
                rawResponse = await callOpenAI(promptText, model);
              } catch (err) {
                promptError = err instanceof Error ? err.message : "Errore chiamata AI";
              }

              // Update prompt with response
              await (supabase.from("prompts_executed") as any)
                .update({
                  raw_response: rawResponse || null,
                  response_length: rawResponse.length,
                  executed_at: new Date().toISOString(),
                  error: promptError,
                })
                .eq("id", promptRecord.id);

              // Extract structured data if we got a response
              if (rawResponse && !promptError) {
                const extraction = await extractFromResponse(rawResponse, targetBrand, knownCompetitors);

                // Save response_analysis
                await (supabase.from("response_analysis") as any)
                  .insert({
                    prompt_executed_id: promptRecord.id,
                    brand_mentioned: extraction.brand_mentioned,
                    brand_rank: extraction.brand_rank,
                    brand_occurrences: extraction.brand_occurrences,
                    sentiment_score: extraction.sentiment_score,
                    topics: extraction.topics,
                    competitors_found: extraction.competitors_found,
                    avi_score: null,
                    avi_components: null,
                  });

                // Save sources
                for (const source of extraction.sources) {
                  await (supabase.from("sources") as any)
                    .insert({
                      prompt_executed_id: promptRecord.id,
                      ...source,
                    });
                }

                // Save discovered competitors (with normalization)
                for (const rawComp of extraction.competitors_found) {
                  const normalizedName = await normalizeCompetitorName(rawComp, targetBrand);
                  if (!normalizedName) continue;

                  // Case-insensitive dedup: check if already exists
                  const { data: existingRows } = await supabase
                    .from("competitors")
                    .select("id, name, topic_context" as any)
                    .eq("project_id", project_id);

                  const existing = (existingRows ?? []).find(
                    (r: any) => r.name.toLowerCase() === normalizedName.toLowerCase()
                  );

                  if (!existing) {
                    await (supabase.from("competitors") as any)
                      .insert({
                        project_id,
                        name: normalizedName,
                        is_manual: false,
                        discovered_at_run_id: run.id,
                        topic_context: extraction.topics ?? [],
                        query_type: query.funnel_stage ?? null,
                      });
                  } else {
                    // Merge new topics into existing topic_context
                    const existingTopics: string[] = (existing as any).topic_context ?? [];
                    const merged = Array.from(new Set([...existingTopics, ...(extraction.topics ?? [])]));
                    await (supabase.from("competitors") as any)
                      .update({ topic_context: merged })
                      .eq("id", (existing as any).id);
                  }
                }

                // Save discovered topics
                for (const topic of extraction.topics) {
                  const { data: existing } = await supabase
                    .from("topics")
                    .select("id")
                    .eq("project_id", project_id)
                    .eq("name", topic)
                    .single();

                  if (!existing) {
                    await (supabase.from("topics") as any)
                      .insert({
                        project_id,
                        name: topic,
                        first_seen_run_id: run.id,
                      });
                  }
                }

                // Recalculate and upsert AVI after each response_analysis
                await computeAndUpsertAVI(supabase as any, run.id, project_id);
              }

              // Update progress
              completedPrompts++;
              await (supabase.from("analysis_runs") as any)
                .update({ completed_prompts: completedPrompts })
                .eq("id", run.id);
            }
          }
        }
      }

      // Mark run as completed
      await (supabase.from("analysis_runs") as any)
        .update({
          status: "completed",
          completed_prompts: completedPrompts,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      // Final AVI recalculation via SQL function
      await (supabase.rpc as any)("compute_and_save_avi", { p_run_id: run.id });

      return NextResponse.json({
        run_id: run.id,
        total_prompts: totalPrompts,
        completed: completedPrompts,
      }, { status: 200 });

    } catch (err) {
      // Mark run as failed
      await (supabase.from("analysis_runs") as any)
        .update({
          status: "failed",
          completed_prompts: completedPrompts,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return NextResponse.json({
        error: err instanceof Error ? err.message : "Errore durante l'analisi",
        run_id: run.id,
        completed: completedPrompts,
      }, { status: 500 });
    }

  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
