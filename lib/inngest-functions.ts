import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import { extractFromResponse } from "./engine/extractor";
import { calculateAVI } from "./engine/avi";
import { type ExtractedSource, mergeSources } from "./engine/sources-extractor";
import { canonicalizeCompetitorName } from "./engine/competitor-names";
import { callAIModel, type AIModelResult } from "./engine/prompt-runner";
import { filterAvailableModels } from "./engine/models";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ─── Helpers ─── */

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function buildPrompt(query: string, segmentContext: string, language: string): string {
  const langMap: Record<string, string> = {
    it: "Rispondi in italiano.",
    en: "Answer in English.",
    fr: "Réponds en français.",
    de: "Antworte auf Deutsch.",
    es: "Responde en español.",
  };
  const lang = langMap[language] ?? langMap.en;
  return `${lang}\n\nContesto utente: ${segmentContext}\n\nDomanda: ${query}`;
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
  // NOTE: Do NOT filter Italian articles (il/la/un/una/i/le/gli) — many real Italian
  // brands start with articles: "Il Mulino Bianco", "La Molisana", "Le Conserve", etc.
  const genericPatterns = /^(brand[s]?\b|competitor[s]?\b|aziend[ae]\b|prodott[oi]\b|servizi[o]?\b)/i;
  if (genericPatterns.test(trimmed)) {
    console.log(`[normalizeCompetitor] FILTERED generic pattern: "${trimmed}"`);
    normCache.set(cacheKey, null);
    return null;
  }

  // Reject if the entire name is a single generic Italian/English word (no proper noun)
  const SINGLE_WORD_GENERICS = new Set([
    "brand", "brands", "competitor", "competitors", "azienda", "aziende",
    "prodotto", "prodotti", "servizio", "servizi", "scarpe", "telefono",
    "auto", "il", "la", "un", "una", "i", "le", "gli",
  ]);
  if (SINGLE_WORD_GENERICS.has(cacheKey)) {
    console.log(`[normalizeCompetitor] FILTERED single generic word: "${trimmed}"`);
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

  // IMPORTANT: Supabase returns NUMERIC columns as strings — always coerce with Number()
  const analysisRows = rows.map((r: any) => {
    const pe = promptMap.get(r.prompt_executed_id);
    return {
      brand_mentioned: Boolean(r.brand_mentioned),
      brand_rank: r.brand_rank != null ? Number(r.brand_rank) : null,
      sentiment_score: r.sentiment_score != null ? Number(r.sentiment_score) : null,
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
    console.error("[inngest] avi_history upsert error:", aviError.message);
  } else {
    console.log(`[inngest] avi_history upsert OK for run ${runId}: AVI=${result.avi_score}`);
  }
}

/* ─── Competitor AVI computation from competitor_mentions ─── */

async function computeCompetitorAVI(
  supabase: SupabaseClient,
  runId: string,
  projectId: string,
  totalPrompts: number,
) {
  console.log(`[inngest] computeCompetitorAVI CALLED — runId=${runId}, projectId=${projectId}, totalPrompts=${totalPrompts}`);
  try {
  const { data: mentions, error: mentionsError } = await (supabase.from("competitor_mentions") as any)
    .select("*")
    .eq("run_id", runId);

  if (mentionsError) {
    console.error("[inngest] competitor_mentions query error:", mentionsError.message);
    return;
  }

  const rows = (mentions ?? []) as any[];
  console.log(`[inngest] competitor_mentions rows for run ${runId}:`, rows.length);
  if (rows.length === 0) {
    console.log(`[inngest] computeCompetitorAVI: 0 mentions found, skipping`);
    return;
  }

  // Group by competitor name
  const byCompetitor = new Map<string, any[]>();
  for (const m of rows) {
    const name = m.competitor_name;
    if (!byCompetitor.has(name)) byCompetitor.set(name, []);
    byCompetitor.get(name)!.push(m);
  }

  const upsertRows: any[] = [];
  for (const [name, mentionRows] of Array.from(byCompetitor.entries())) {
    const count = mentionRows.length;

    // Prominence: mentions / total_prompts × 100
    const prominence = Math.min(100, (count / totalPrompts) * 100);

    // Rank score: SUM(rank > 0 ? MAX(0, 100-(rank-1)*20) : 0) / total_prompts
    // IMPORTANT: Number() coercion for Supabase NUMERIC columns returned as strings
    const rankSum = mentionRows.reduce((s: number, m: any) => {
      const rank = m.rank != null ? Number(m.rank) : 0;
      if (rank > 0) {
        return s + Math.max(0, 100 - (rank - 1) * 20);
      }
      return s;
    }, 0);
    const rankScore = Math.min(100, rankSum / totalPrompts);

    // Sentiment score: SUM((sentiment+1)*50) / total_prompts
    const sentimentSum = mentionRows.reduce((s: number, m: any) => {
      if (m.sentiment != null) {
        const sentiment = Number(m.sentiment);
        return s + (sentiment + 1) * 50;
      }
      return s;
    }, 0);
    const sentimentScore = Math.min(100, sentimentSum / totalPrompts);

    // Consistency: mention_count / total_prompts × 100
    const consistency = Math.min(100, (count / totalPrompts) * 100);

    // AVI = prominence×0.40 + rank_score×0.35 + sentiment_score×0.25
    const aviScore = Math.round(
      (prominence * 0.40) + (rankScore * 0.35) + (sentimentScore * 0.25)
    );

    upsertRows.push({
      project_id: projectId,
      run_id: runId,
      competitor_name: name,
      avi_score: Math.min(100, Math.max(0, aviScore)),
      prominence_score: prominence,
      rank_score: rankScore,
      sentiment_score: sentimentScore,
      consistency_score: consistency,
      mention_count: count,
      computed_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length > 0) {
    console.log(`[inngest] competitor_avi: upserting ${upsertRows.length} rows for run ${runId}`, upsertRows.map(r => `${r.competitor_name}=${r.avi_score}`).join(", "));
    const { error } = await (supabase.from("competitor_avi") as any)
      .upsert(upsertRows, { onConflict: "run_id,competitor_name" });
    if (error) console.error("[inngest] competitor_avi upsert error:", error.message);
    else console.log("[inngest] competitor_avi upsert OK");
  } else {
    console.log(`[inngest] competitor_avi: no upsert rows built for run ${runId}, skipping`);
  }
  } catch (e: any) {
    console.error(`[inngest] computeCompetitorAVI CRASHED for run ${runId}:`, e?.message ?? e);
  }
}

/* ─── Single prompt execution ─── */

interface PromptTask {
  runId: string;
  projectId: string;
  queryId: string;
  queryText: string;
  queryFunnelStage: string | null;
  segmentId: string | null;
  segmentContext: string;
  model: string;
  runNumber: number;
  targetBrand: string;
  brandDomain: string | null;
  knownCompetitors: string[];
  language: string;
  browsing: boolean;
  sector: string | null;
  brandType: string | null;
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
      segment_id: task.segmentId || null,
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
    const crashMsg = e?.message ?? String(e);
    console.error("[executePrompt] callAIModel crashed:", crashMsg);
    aiResult = { text: "", sources: [], error: `[${task.model}] ${crashMsg}` };
  }

  const rawText = aiResult.text;
  const isSkipped = aiResult.error?.includes("SKIPPED");
  const promptError: string | null = rawText ? null : (aiResult.error ?? "Risposta vuota dal modello");

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

  const extraction = await extractFromResponse(rawText, task.targetBrand, task.knownCompetitors, task.sector ?? undefined, task.brandType ?? undefined, task.language ?? undefined, task.brandDomain);

  // Detailed extraction logging
  console.log(`[executePrompt] model=${task.model} brand="${task.targetBrand}" brand_mentioned=${extraction.brand_mentioned} competitors_raw=${extraction.competitors_found.length} topics=${extraction.topics.length} responseLen=${rawText.length}`);
  if (extraction.competitors_found.length > 0) {
    console.log(`[executePrompt] competitors extracted: ${extraction.competitors_found.map(c => `"${c.name}" (${c.type})`).join(", ")}`);
  }

  // Validation: warn if long response but no brand/competitors detected
  if (rawText.length > 100 && !extraction.brand_mentioned && extraction.competitors_found.length === 0) {
    console.warn(`[executePrompt] EXTRACTION WARNING: model=${task.model} brand="${task.targetBrand}" text=${rawText.length}chars but brand_mentioned=false, competitors=0. First 300 chars: ${rawText.slice(0, 300)}`);
  }

  // Save response_analysis (normalize competitor names consistently)
  const normalizedCompNames = extraction.competitors_found
    .map(c => {
      const n = normalizeCompetitorName(c.name, task.targetBrand, normCache);
      if (!n) {
        console.log(`[executePrompt] competitor FILTERED by normalization: "${c.name}"`);
      }
      return n ? canonicalizeCompetitorName(n) : null;
    })
    .filter((n): n is string => n != null && n !== task.targetBrand);
  if (normalizedCompNames.length < extraction.competitors_found.length) {
    console.log(`[executePrompt] competitors after normalization: ${normalizedCompNames.length}/${extraction.competitors_found.length} kept: [${normalizedCompNames.join(", ")}]`);
  }

  await (supabase.from("response_analysis") as any)
    .insert({
      prompt_executed_id: promptRecord.id,
      brand_mentioned: extraction.brand_mentioned,
      brand_rank: extraction.brand_rank,
      brand_occurrences: extraction.brand_occurrences,
      sentiment_score: extraction.sentiment_score,
      tone_score: extraction.tone_score,
      position_score: extraction.position_score,
      recommendation_score: extraction.recommendation_score,
      topics: extraction.topics,
      competitors_found: normalizedCompNames,
      avi_score: null,
      avi_components: null,
    });

  // Save competitor_mentions (with same normalization as competitors table)
  if (extraction.competitors_found.length > 0) {
    const mentions = extraction.competitors_found
      .map((c) => {
        const normalized = normalizeCompetitorName(c.name, task.targetBrand, normCache);
        if (!normalized) return null;
        const canonical = canonicalizeCompetitorName(normalized);
        if (canonical === task.targetBrand) return null;
        return {
          run_id: task.runId,
          project_id: task.projectId,
          competitor_name: canonical,
          prompt_executed_id: promptRecord.id,
          rank: c.rank ?? null,
          sentiment: c.sentiment ?? null,
          recommendation: c.recommendation ?? null,
          competitor_type: c.type ?? "direct",
        };
      })
      .filter(Boolean);
    if (mentions.length > 0) {
      const { error: mentionErr } = await (supabase.from("competitor_mentions") as any)
        .insert(mentions);
      if (mentionErr) console.error("[inngest] competitor_mentions insert error:", mentionErr.message);
    }
  }

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

  // Batch upsert competitors (with normalization + canonical)
  const compRows: any[] = [];
  for (const rawComp of extraction.competitors_found || []) {
    const normalizedName = normalizeCompetitorName(rawComp.name, task.targetBrand, normCache);
    if (!normalizedName || normalizedName === task.targetBrand) continue;
    const canonicalName = canonicalizeCompetitorName(normalizedName);
    if (canonicalName === task.targetBrand) continue;
    compRows.push({
      project_id: task.projectId,
      name: canonicalName,
      is_manual: false,
      discovered_at_run_id: task.runId,
      mention_count: 1,
    });
  }

  if (compRows.length > 0) {
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
    onFailure: async ({ event: failEvent }) => {
      // Last-resort handler: if all retries exhausted, mark run as failed
      try {
        const originalData = (failEvent.data as any)?.event?.data;
        if (!originalData?.runId) return;
        const supabase = createServiceClient();
        const errorMsg = (failEvent.data as any)?.error?.message ?? "Errore sconosciuto (retries esauriti)";
        await (supabase.from("analysis_runs") as any)
          .update({
            status: "failed",
            error_message: errorMsg.substring(0, 1000),
            completed_at: new Date().toISOString(),
          })
          .eq("id", originalData.runId);
        console.error(`[inngest/onFailure] run ${originalData.runId} marked failed:`, errorMsg);
      } catch (e) {
        console.error("[inngest/onFailure] could not update run status:", e);
      }
    },
  },
  { event: "analysis/start" },
  async ({ event, step }) => {
    const { runId, projectId, modelsUsed: rawModels, runCount, browsing = false } = event.data as {
      runId: string;
      projectId: string;
      modelsUsed: string[];
      runCount: number;
      browsing?: boolean;
    };

    // Filter out models whose provider credentials are not configured
    const modelsUsed = filterAvailableModels(rawModels);
    if (modelsUsed.length === 0) {
      const supabase = createServiceClient();
      await supabase.from("analysis_runs").update({
        status: "failed",
        error_message: "Nessun modello disponibile — verifica le credenziali API",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return { status: "failed", reason: "no available models" };
    }

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
    const sector = project.sector ?? null;
    const brandTypeVal = project.brand_type ?? null;

    // Build all prompt tasks
    // If no segments configured, use a default generic audience fallback (null segment_id)
    const DEFAULT_SEGMENT = {
      id: null as string | null,
      prompt_context: "Pubblico generale, senza un profilo demografico specifico.",
    };
    const effectiveSegments = segments.length > 0 ? segments : [DEFAULT_SEGMENT];

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
              sector,
              brandType: brandTypeVal,
            });
          }
        }
      }
    }

    // Step 2: execute prompts in batches
    const batchSize = 15;
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
      await computeCompetitorAVI(supabase, runId, projectId, allTasks.length);
      await (supabase.from("analysis_runs") as any)
        .update({
          status: "completed",
          completed_prompts: allTasks.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      // Increment monthly query usage for the project owner
      // Query cost = num_queries × num_models × num_runs
      const queryCost = (queries?.length ?? 0) * modelsUsed.length * runCount;
      if (queryCost > 0 && project.user_id) {
        const { data: profile } = await (supabase.from("profiles") as any)
          .select("queries_used_this_month, queries_reset_at")
          .eq("id", project.user_id)
          .single();

        // Reset counter if it's a new month
        const resetAt = profile?.queries_reset_at ? new Date(profile.queries_reset_at) : new Date(0);
        const now = new Date();
        const isNewMonth = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

        const currentUsage = isNewMonth ? 0 : (profile?.queries_used_this_month ?? 0);
        await (supabase.from("profiles") as any)
          .update({
            queries_used_this_month: currentUsage + queryCost,
            queries_reset_at: isNewMonth ? now.toISOString() : undefined,
          })
          .eq("id", project.user_id);
      }
    });

    return { runId, totalPrompts: allTasks.length, status: "completed" };
  }
);
