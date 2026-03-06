import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { extractFromResponse } from "@/lib/engine/extractor";

const RUN_COUNT = 3;

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

                // Save discovered competitors
                for (const comp of extraction.competitors_found) {
                  const { data: existing } = await supabase
                    .from("competitors")
                    .select("id")
                    .eq("project_id", project_id)
                    .eq("name", comp)
                    .single();

                  if (!existing) {
                    await (supabase.from("competitors") as any)
                      .insert({
                        project_id,
                        name: comp,
                        is_manual: false,
                        discovered_at_run_id: run.id,
                      });
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

      // Calculate AVI via dedicated endpoint
      let aviResult = null;
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const aviRes = await fetch(`${baseUrl}/api/analysis/${run.id}/avi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (aviRes.ok) {
          aviResult = await aviRes.json();
        } else {
          console.error("AVI endpoint failed:", await aviRes.text());
        }
      } catch (err) {
        console.error("Failed to call AVI endpoint:", err instanceof Error ? err.message : err);
      }

      return NextResponse.json({
        run_id: run.id,
        total_prompts: totalPrompts,
        completed: completedPrompts,
        avi: aviResult,
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
