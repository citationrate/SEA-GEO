import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractFromResponse } from "./engine/extractor";
import { MODEL_MAP } from "./engine/models";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ─── Helpers ─── */

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function buildPrompt(query: string, segmentContext: string, language: string): string {
  const lang = language === "it" ? "Rispondi in italiano." : "Answer in English.";
  return `${lang}\n\nContesto utente: ${segmentContext}\n\nDomanda: ${query}`;
}

async function callAIModel(prompt: string, model: string): Promise<string> {
  try {
    const modelDef = MODEL_MAP.get(model);
    const provider = modelDef?.provider ?? "openai";

    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });
      const block = msg.content[0];
      return block.type === "text" ? block.text : "";
    }

    if (provider === "google") {
      const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");
      const geminiModel = genai.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    }

    if (provider === "xai") {
      const client = new OpenAI({
        apiKey: process.env.XAI_API_KEY ?? "",
        baseURL: "https://api.x.ai/v1",
      });
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });
      return completion.choices[0]?.message?.content ?? "";
    }

    // OpenAI (default)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (model.startsWith("o1") || model.startsWith("o3")) {
      const completion = await openai.chat.completions.create({
        model,
        max_completion_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      } as any);
      return completion.choices[0]?.message?.content ?? "";
    }

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error(`[callAIModel] ${model} failed:`, err instanceof Error ? err.message : err);
    return "";
  }
}

/* ─── Competitor normalization ─── */

async function normalizeCompetitorName(
  rawName: string,
  targetBrand: string,
  normCache: Map<string, string | null>,
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (normCache.has(cacheKey)) return normCache.get(cacheKey)!;

  if (cacheKey === targetBrand.toLowerCase()) {
    normCache.set(cacheKey, null);
    return null;
  }

  const genericPatterns = /^(brand|competitor|aziend|prodott|servizi|scarpe|telefon|auto |il |la |un |una )/i;
  if (genericPatterns.test(trimmed)) {
    normCache.set(cacheKey, null);
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `È "${trimmed}" un brand/azienda o un prodotto specifico? Se è un prodotto, dimmi solo il nome del brand padre. Rispondi SOLO con il nome corretto del brand, nessun altro testo.`,
      }],
    });

    let normalized = (completion.choices[0]?.message?.content ?? trimmed).trim();
    normalized = normalized.replace(/^["']+|["']+$/g, "").replace(/\.$/, "").trim();

    if (!normalized || normalized.toLowerCase() === targetBrand.toLowerCase()) {
      normCache.set(cacheKey, null);
      return null;
    }

    const proper = normalized.split(/\s+/).map(
      (w) => w.charAt(0).toUpperCase() + w.slice(1)
    ).join(" ");

    normCache.set(cacheKey, proper);
    return proper;
  } catch {
    normCache.set(cacheKey, trimmed);
    return trimmed;
  }
}

/* ─── AVI computation ─── */

async function computeAndUpsertAVI(
  supabase: SupabaseClient,
  runId: string,
  projectId: string,
) {
  const { data: runPrompts } = await supabase
    .from("prompts_executed")
    .select("id, query_id, segment_id, run_number")
    .eq("run_id", runId);

  const promptsList = (runPrompts ?? []) as any[];
  const promptIds = promptsList.map((p: any) => p.id);
  if (promptIds.length === 0) return;

  const promptMap = new Map(promptsList.map((p: any) => [p.id, p]));

  const { data: analyses } = await supabase
    .from("response_analysis")
    .select("*")
    .in("prompt_executed_id", promptIds);

  const rows = (analyses ?? []) as any[];
  if (rows.length === 0) return;

  const total = rows.length;
  const presence_score = rows.filter((r: any) => r.brand_mentioned).length / total;

  const rank_score = rows.reduce((s: number, r: any) => {
    if (r.brand_rank === null || r.brand_rank <= 0) return s;
    return s + Math.max(0, 1 - (r.brand_rank - 1) / 10);
  }, 0) / total;

  const withSent = rows.filter((r: any) => r.sentiment_score !== null);
  const sentAvg = withSent.length > 0
    ? withSent.reduce((s: number, r: any) => s + r.sentiment_score, 0) / withSent.length
    : 0;
  const sentiment_score = (sentAvg + 1) / 2;

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

/* ─── Single prompt execution ─── */

interface PromptTask {
  runId: string;
  projectId: string;
  queryId: string;
  queryText: string;
  queryFunnelStage: string | null;
  segmentId: string;
  segmentContext: string;
  model: string;
  runNumber: number;
  targetBrand: string;
  knownCompetitors: string[];
  language: string;
}

async function executePrompt(
  supabase: SupabaseClient,
  task: PromptTask,
  normCache: Map<string, string | null>,
) {
  const promptText = buildPrompt(task.queryText, task.segmentContext, task.language);

  // Insert prompt_executed record
  const { data: promptRecord } = await (supabase.from("prompts_executed") as any)
    .insert({
      run_id: task.runId,
      query_id: task.queryId,
      segment_id: task.segmentId,
      model: task.model,
      run_number: task.runNumber,
      full_prompt_text: promptText,
      raw_response: null,
      response_length: null,
      executed_at: null,
      error: null,
    })
    .select("id")
    .single();

  if (!promptRecord) return;

  const rawResponse = await callAIModel(promptText, task.model);
  const promptError: string | null = rawResponse ? null : "Risposta vuota dal modello";

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
  if (!rawResponse) return;

  const extraction = await extractFromResponse(rawResponse, task.targetBrand, task.knownCompetitors);

  console.log("Competitors found:", extraction.competitors_found);
  console.log("Sources found:", extraction.sources);

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

  // Save sources (upsert by project_id + domain)
  for (const source of extraction.sources || []) {
    if (!source.domain) continue;
    await (supabase.from("sources") as any)
      .upsert({
        project_id: task.projectId,
        run_id: task.runId,
        prompt_executed_id: promptRecord.id,
        url: source.url || source.domain,
        domain: source.domain,
        label: source.label,
        source_type: source.source_type || "other",
        is_brand_owned: source.is_brand_owned,
        context: source.context,
        citation_count: 1,
      }, {
        onConflict: "project_id,domain",
        ignoreDuplicates: false,
      });
  }

  // Save discovered competitors (upsert with normalization)
  for (const rawComp of extraction.competitors_found || []) {
    const normalizedName = await normalizeCompetitorName(rawComp, task.targetBrand, normCache);
    if (!normalizedName || normalizedName === task.targetBrand) continue;

    await (supabase.from("competitors") as any)
      .upsert({
        project_id: task.projectId,
        name: normalizedName,
        is_manual: false,
        first_seen_run_id: task.runId,
        discovered_at_run_id: task.runId,
        topic_context: extraction.topics ?? [],
        query_type: task.queryFunnelStage ?? null,
        mention_count: 1,
      }, {
        onConflict: "project_id,name",
        ignoreDuplicates: false,
      });

    // Increment mention_count
    await (supabase.rpc as any)("increment_competitor_count", {
      p_project_id: task.projectId,
      p_name: normalizedName,
    });
  }

  // Save discovered topics (upsert + increment frequency)
  for (const topic of extraction.topics || []) {
    const name = typeof topic === "string" ? topic : (topic as any).name;
    if (!name) continue;

    await (supabase.from("topics") as any)
      .upsert({
        project_id: task.projectId,
        name,
        frequency: 1,
        first_seen_run_id: task.runId,
      }, {
        onConflict: "project_id,name",
        ignoreDuplicates: false,
      });

    await (supabase.rpc as any)("increment_topic_frequency", {
      p_project_id: task.projectId,
      p_name: name,
    });
  }

  // Recalculate AVI
  await computeAndUpsertAVI(supabase, task.runId, task.projectId);
}

/* ─── Inngest Function ─── */

export const runAnalysis = inngest.createFunction(
  {
    id: "run-analysis",
    retries: 3,
  },
  { event: "analysis/start" },
  async ({ event, step }) => {
    const { runId, projectId, modelsUsed, runCount } = event.data as {
      runId: string;
      projectId: string;
      modelsUsed: string[];
      runCount: number;
    };

    // Step 1: load project data
    const loadedData = await step.run("load-data", async () => {
      const supabase = createServiceClient();

      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      const { data: queries } = await supabase
        .from("queries")
        .select("*")
        .eq("project_id", projectId);

      const { data: segments } = await supabase
        .from("audience_segments")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);

      return {
        project: project as any,
        queries: (queries ?? []) as any[],
        segments: (segments ?? []) as any[],
      };
    });

    const { project, queries, segments } = loadedData;
    const targetBrand = project.target_brand;
    const knownCompetitors = project.known_competitors ?? [];
    const language = project.language;

    // Build all prompt tasks
    const allTasks: PromptTask[] = [];
    for (const query of queries) {
      for (const segment of segments) {
        for (const model of modelsUsed) {
          for (let runNum = 1; runNum <= runCount; runNum++) {
            allTasks.push({
              runId,
              projectId,
              queryId: query.id,
              queryText: query.text,
              queryFunnelStage: query.funnel_stage ?? null,
              segmentId: segment.id,
              segmentContext: segment.prompt_context,
              model,
              runNumber: runNum,
              targetBrand,
              knownCompetitors,
              language,
            });
          }
        }
      }
    }

    // Step 2: execute prompts in batches of 5
    const batches = chunk(allTasks, 15);
    const normCache = new Map<string, string | null>();

    for (let i = 0; i < batches.length; i++) {
      await step.run(`batch-${i}`, async () => {
        const supabase = createServiceClient();
        // Execute batch sequentially (AI calls can't be truly parallel per rate limits)
        for (const task of batches[i]) {
          await executePrompt(supabase, task, normCache);
        }
        // Update progress
        const completedSoFar = Math.min((i + 1) * 15, allTasks.length);
        await (supabase.from("analysis_runs") as any)
          .update({ completed_prompts: completedSoFar })
          .eq("id", runId);
      });
    }

    // Step 3: compute AVI and mark completed
    await step.run("compute-avi", async () => {
      const supabase = createServiceClient();
      await (supabase.rpc as any)("compute_and_save_avi", { p_run_id: runId });
      await (supabase.rpc as any)("compute_competitor_avi", { p_run_id: runId });
      await (supabase.from("analysis_runs") as any)
        .update({
          status: "completed",
          completed_prompts: allTasks.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    });

    return { runId, totalPrompts: allTasks.length, status: "completed" };
  }
);
