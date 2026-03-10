import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractFromResponse } from "./engine/extractor";
import { MODEL_MAP } from "./engine/models";
import { calculateAVI } from "./engine/avi";
import {
  type ExtractedSource,
  extractFromAnnotations,
  extractFromGrounding,
  extractFromText,
  mergeSources,
} from "./engine/sources-extractor";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ─── Helpers ─── */

interface AIModelResult {
  text: string;
  sources: ExtractedSource[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function buildPrompt(query: string, segmentContext: string, language: string): string {
  const lang = language === "it" ? "Rispondi in italiano." : "Answer in English.";
  const sourceHint = language === "it"
    ? "\n\nImportante: nella tua risposta cita esplicitamente i siti web, portali, blog o piattaforme rilevanti includendo il loro dominio (es: nike.com, amazon.it, trustpilot.com)."
    : "\n\nImportant: in your response explicitly cite relevant websites, portals, blogs or platforms including their domain (e.g.: nike.com, amazon.com, trustpilot.com).";
  return `${lang}\n\nContesto utente: ${segmentContext}\n\nDomanda: ${query}${sourceHint}`;
}

async function callAIModel(prompt: string, model: string, browsing = false, brandDomain?: string | null): Promise<AIModelResult> {
  const empty: AIModelResult = { text: "", sources: [] };
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
      const text = block.type === "text" ? block.text : "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    }

    if (provider === "google") {
      const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");

      const extractGeminiText = (result: any): string => {
        const resp = result.response;
        const candidate = resp.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason && finishReason !== "STOP") {
          console.error(`[Gemini] blocked: finishReason=${finishReason}`, JSON.stringify(candidate?.safetyRatings ?? []));
          return "";
        }

        // Try SDK .text() first, fallback to manual extraction
        try {
          const text = resp.text();
          if (text) return text;
        } catch { /* .text() throws if no text candidates */ }

        // Manual extraction: candidates[0].content.parts[0].text
        const parts = candidate?.content?.parts;
        if (parts?.length > 0) {
          const text = parts.map((p: any) => p.text ?? "").join("");
          if (text) return text;
        }

        console.error("[Gemini] empty response. Raw:", JSON.stringify({
          finishReason,
          candidatesCount: resp.candidates?.length,
          parts: parts?.map((p: any) => ({ type: Object.keys(p), len: p.text?.length })),
        }));
        return "";
      }

      if (browsing) {
        try {
          const geminiModel = genai.getGenerativeModel({
            model,
            tools: [{ googleSearch: {} } as any],
          });
          const result = await geminiModel.generateContent(prompt);
          const text = extractGeminiText(result);
          const groundingSources = extractFromGrounding((result.response as any).candidates || [], brandDomain ?? undefined);
          const textSources = extractFromText(text, brandDomain ?? undefined);
          return { text, sources: mergeSources(groundingSources, textSources) };
        } catch (e: any) {
          console.error("[Gemini grounding] failed:", e?.message);
        }
      }
      const geminiModel = genai.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);
      const text = extractGeminiText(result);
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
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
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    }

    // OpenAI (default)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (browsing) {
      try {
        const response = await openai.responses.create({
          model,
          tools: [{ type: "web_search_preview" }],
          input: prompt,
        });
        const text = response.output_text || "";
        const annotationSources = extractFromAnnotations(response.output || [], brandDomain ?? undefined);
        const textSources = extractFromText(text, brandDomain ?? undefined);
        return { text, sources: mergeSources(annotationSources, textSources) };
      } catch (browsingErr) {
        console.error("[callAIModel] OpenAI browsing failed, falling back:", browsingErr instanceof Error ? browsingErr.message : browsingErr);
      }
    }

    if (model.startsWith("o1") || model.startsWith("o3")) {
      const completion = await openai.chat.completions.create({
        model,
        max_completion_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      } as any);
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    }

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return { text, sources: extractFromText(text, brandDomain ?? undefined) };
  } catch (err) {
    console.error(`[callAIModel] ${model} failed:`, err instanceof Error ? err.message : err);
    return empty;
  }
}

/* ─── Competitor normalization ─── */

function normalizeCompetitorName(
  rawName: string,
  targetBrand: string,
  normCache: Map<string, string | null>,
): string | null {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (normCache.has(cacheKey)) return normCache.get(cacheKey)!;

  if (cacheKey === targetBrand.toLowerCase()) {
    normCache.set(cacheKey, null);
    return null;
  }

  // Reject generic descriptions that aren't brand names
  const genericPatterns = /^(brand|competitor|aziend|prodott|servizi|scarpe|telefon|auto |il |la |un |una |i |le |gli )/i;
  if (genericPatterns.test(trimmed)) {
    normCache.set(cacheKey, null);
    return null;
  }

  // Strip AI noise: "Esselunga È Un Brand/azienda" → "Esselunga"
  let cleaned = trimmed
    .replace(/\s+(è un|è una|è il|is a|is an|brand padre|il brand|\/azienda|azienda|\(.*?\)).*$/i, "")
    .replace(/\s*[–—-]\s+.*$/, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\.$/, "")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    normCache.set(cacheKey, null);
    return null;
  }

  // Capitalize properly (preserve existing casing for acronyms like "H&M", "IKEA")
  const isAllCaps = cleaned === cleaned.toUpperCase() && cleaned.length > 3;
  const proper = isAllCaps
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
    : cleaned;

  normCache.set(cacheKey, proper);
  return proper;
}

/* ─── AVI computation using canonical calculateAVI ─── */

async function computeAndSaveAVI(
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

  const analysisRows = rows.map((r: any) => {
    const pe = promptMap.get(r.prompt_executed_id);
    return {
      brand_mentioned: r.brand_mentioned,
      brand_rank: r.brand_rank,
      sentiment_score: r.sentiment_score,
      run_number: pe?.run_number ?? 1,
      query_id: pe?.query_id ?? "",
      segment_id: pe?.segment_id ?? "",
    };
  });

  const result = calculateAVI(analysisRows);

  const { error: aviError } = await (supabase.from("avi_history") as any)
    .upsert({
      project_id: projectId,
      run_id: runId,
      avi_score: result.avi_score,
      presence_score: result.components.presence_score,
      rank_score: result.components.rank_score,
      sentiment_score: result.components.sentiment_score,
      stability_score: result.components.stability_score,
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
  brandDomain: string | null;
  knownCompetitors: string[];
  language: string;
  browsing: boolean;
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

  let aiResult: AIModelResult;
  try {
    aiResult = await callAIModel(promptText, task.model, task.browsing, task.brandDomain);
  } catch (e: any) {
    console.error("[executePrompt] callAIModel crashed:", e?.message);
    aiResult = { text: "", sources: [] };
  }

  const rawText = aiResult.text;
  const promptError: string | null = rawText ? null : "Risposta vuota dal modello";

  // Update prompt with response
  await (supabase.from("prompts_executed") as any)
    .update({
      raw_response: rawText || null,
      response_length: rawText.length,
      executed_at: new Date().toISOString(),
      error: promptError,
    })
    .eq("id", promptRecord.id);

  if (!rawText) return;

  const extraction = await extractFromResponse(rawText, task.targetBrand, task.knownCompetitors);

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

  // Merge sources: API sources (highest priority) + extractor sources (no duplicate extractFromText)
  const extractorSources: ExtractedSource[] = (extraction.sources || []).map((s: any) => ({
    url: s.url || s.domain,
    domain: s.domain,
    title: s.label,
    source_type: s.source_type || "other",
    context: s.context,
  }));
  const mergedSources = mergeSources(aiResult.sources, extractorSources);

  // Batch upsert sources
  const sourceRows = mergedSources
    .filter(s => s.domain && task.projectId)
    .map(s => ({
      project_id: task.projectId,
      run_id: task.runId,
      url: s.url || "https://" + s.domain,
      domain: s.domain,
      source_type: s.source_type || "other",
      context: s.context || "",
      citation_count: 1,
    }));

  if (sourceRows.length > 0) {
    const { error } = await (supabase.from("sources") as any)
      .upsert(sourceRows, { onConflict: "project_id,domain" });
    if (error) console.error("Sources upsert error:", error.message);
  }

  // Batch upsert competitors (with normalization)
  const compRows: any[] = [];
  for (const rawComp of extraction.competitors_found || []) {
    const normalizedName = normalizeCompetitorName(rawComp, task.targetBrand, normCache);
    if (!normalizedName || normalizedName === task.targetBrand) continue;
    compRows.push({
      project_id: task.projectId,
      name: normalizedName,
      is_manual: false,
      discovered_at_run_id: task.runId,
      mention_count: 1,
    });
  }

  if (compRows.length > 0) {
    console.log("[inngest] saving competitors for project_id:", task.projectId, "count:", compRows.length, "names:", compRows.map(c => c.name));
    const { error: compUpsertErr } = await (supabase.from("competitors") as any)
      .upsert(compRows, { onConflict: "project_id,name", ignoreDuplicates: false });
    if (compUpsertErr) console.error("[inngest] competitors upsert error:", compUpsertErr.message, compUpsertErr);
    for (const c of compRows) {
      await (supabase.rpc as any)("increment_competitor_count", {
        p_project_id: task.projectId,
        p_name: c.name,
      });
    }
  }

  // Batch upsert topics
  const topicNames = (extraction.topics || [])
    .map((t: any) => typeof t === "string" ? t : t.name)
    .filter(Boolean) as string[];

  const topicRows = topicNames.map(name => ({
    project_id: task.projectId,
    name,
    frequency: 1,
    first_seen_run_id: task.runId,
  }));

  if (topicRows.length > 0) {
    await (supabase.from("topics") as any)
      .upsert(topicRows, { onConflict: "project_id,name", ignoreDuplicates: false });
    for (const t of topicRows) {
      await (supabase.rpc as any)("increment_topic_frequency", {
        p_project_id: task.projectId,
        p_name: t.name,
      });
    }
  }
}

/* ─── Inngest Function ─── */

export const runAnalysis = inngest.createFunction(
  {
    id: "run-analysis",
    retries: 3,
  },
  { event: "analysis/start" },
  async ({ event, step }) => {
    const { runId, projectId, modelsUsed, runCount, browsing = true } = event.data as {
      runId: string;
      projectId: string;
      modelsUsed: string[];
      runCount: number;
      browsing?: boolean;
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

    // Abort if project was soft-deleted
    if (project.deleted_at) {
      const supabase = createServiceClient();
      await (supabase.from("analysis_runs") as any)
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", runId);
      return { runId, status: "cancelled", reason: "project deleted" };
    }

    const targetBrand = project.target_brand;
    const brandDomain = project.website_url ?? null;
    const knownCompetitors = project.known_competitors ?? [];
    const language = project.language;

    // Build all prompt tasks
    // If no segments configured, use a default generic context
    const effectiveSegments = segments.length > 0
      ? segments
      : [{ id: "default", prompt_context: "Utente generico." }];

    const allTasks: PromptTask[] = [];
    for (const query of queries) {
      for (const segment of effectiveSegments) {
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
              brandDomain,
              knownCompetitors,
              language,
              browsing,
            });
          }
        }
      }
    }

    // Step 2: execute prompts in batches
    const batchSize = browsing ? 3 : 15;
    const batches = chunk(allTasks, batchSize);
    const normCache = new Map<string, string | null>();

    for (let i = 0; i < batches.length; i++) {
      await step.run(`batch-${i}`, async () => {
        const supabase = createServiceClient();
        for (const task of batches[i]) {
          await executePrompt(supabase, task, normCache);
        }
        const completedSoFar = Math.min((i + 1) * batchSize, allTasks.length);
        await (supabase.from("analysis_runs") as any)
          .update({ completed_prompts: completedSoFar })
          .eq("id", runId);
      });
    }

    // Step 3: compute AVI once and mark completed
    await step.run("compute-avi", async () => {
      const supabase = createServiceClient();
      await computeAndSaveAVI(supabase, runId, projectId);
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
