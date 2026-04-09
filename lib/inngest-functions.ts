import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import { extractFromResponse } from "./engine/extractor";
import { calculateAVI } from "./engine/avi";
import { type ExtractedSource, mergeSources } from "./engine/sources-extractor";
import { canonicalizeCompetitorName, extractBrandOnly } from "./engine/competitor-names";
import { callAIModel, type AIModelResult } from "./engine/prompt-runner";
import { filterAvailableModels } from "./engine/models";
import { consumeWalletQueries, incrementBrowsingPromptsUsed, incrementNoBrowsingPromptsUsed } from "./usage";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ─── Helpers ─── */

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function buildPrompt(query: string, segmentContext: string, language: string): string {
  const langMap: Record<string, { instruction: string; contextLabel: string; questionLabel: string }> = {
    it: { instruction: "IMPORTANT: You MUST respond ONLY in Italian (italiano). Every word of your response must be in Italian.", contextLabel: "Contesto utente", questionLabel: "Domanda" },
    en: { instruction: "IMPORTANT: You MUST respond ONLY in English. Every word of your response must be in English.", contextLabel: "User context", questionLabel: "Question" },
    fr: { instruction: "IMPORTANT: You MUST respond ONLY in French (français). Every word of your response must be in French.", contextLabel: "Contexte utilisateur", questionLabel: "Question" },
    de: { instruction: "IMPORTANT: You MUST respond ONLY in German (Deutsch). Every word of your response must be in German.", contextLabel: "Benutzerkontext", questionLabel: "Frage" },
    es: { instruction: "IMPORTANT: You MUST respond ONLY in Spanish (español). Every word of your response must be in Spanish.", contextLabel: "Contexto del usuario", questionLabel: "Pregunta" },
  };
  const l = langMap[language] ?? langMap.en;
  // If no audience segment is configured, omit the "User context" line entirely
  // so the AI gets just the bare question (target/segment is opt-in, set
  // manually before launch).
  const ctx = (segmentContext ?? "").trim();
  if (!ctx) {
    return `${l.instruction}\n\n${l.questionLabel}: ${query}`;
  }
  return `${l.instruction}\n\n${l.contextLabel}: ${ctx}\n\n${l.questionLabel}: ${query}`;
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

  // Reject government bodies, institutions, regulatory agencies — not commercial competitors
  const INSTITUTIONAL_KEYWORDS = [
    "inail", "inps", "ivass", "mise", "ministero", "ministro",
    "autorità", "autorita", "garante", "consob", "agcm", "anac",
    "tribunale", "corte", "cassazione", "appello", "giudice",
    "comune", "regione", "provincia", "prefettura", "questura",
    "camera", "senato", "parlamento", "governo",
    "portale", "sportello", "ufficio pubblico",
    "confindustria", "confcommercio", "confesercenti",
    "ania", "abi", "ordine degli", "ordine dei",
    "asl", "inpdap", "agenzia delle entrate", "agenzia entrate",
    "guardia di finanza", "carabinieri", "polizia",
    "suap", "consiglio di stato", "tar ",
  ];
  if (INSTITUTIONAL_KEYWORDS.some(kw => cacheKey.includes(kw))) {
    console.log(`[normalizeCompetitor] FILTERED institutional: "${trimmed}"`);
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

/* ─── Institutional blocklist (final safety net) ─── */

const INSTITUTIONAL_BLOCKLIST = [
  "inail", "inps", "ivass", "consap", "ministero",
  "agenzia delle", "autorità", "autorita", "garante", "tribunale",
  "corte", "comune di", "regione", "provincia",
  "prefettura", "camera dei", "senato", "parlamento",
  "anmil", "inca", "cgil", "cisl", "uil",
  "patronato", "caf ", "adiconsum", "codacons",
  "altroconsumo", "federconsumatori", "uci ",
  "portale", "sportello", "ufficio pubblico",
  "consob", "agcm", "anac", "mise",
  "confindustria", "confcommercio", "confesercenti",
  "ania", "abi", "ordine degli", "ordine dei",
  "asl", "inpdap", "agenzia entrate",
  "guardia di finanza", "carabinieri", "polizia",
  "cassazione", "appello",
];

function isInstitutional(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return INSTITUTIONAL_BLOCKLIST.some(kw => lower.includes(kw));
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
/* Aligned with brand AVI methodology — same 6-parameter weighted formula */

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

  // Use response_analysis count as denominator (same as brand AVI)
  const { count: analysisCount } = await supabase
    .from("response_analysis")
    .select("*", { count: "exact", head: true })
    .in("prompt_executed_id",
      (await supabase.from("prompts_executed").select("id").eq("run_id", runId)).data?.map((p: any) => p.id) ?? []
    );
  const denominator = analysisCount ?? totalPrompts;

  // Group by competitor name
  const byCompetitor = new Map<string, any[]>();
  for (const m of rows) {
    const name = m.competitor_name;
    if (!byCompetitor.has(name)) byCompetitor.set(name, []);
    byCompetitor.get(name)!.push(m);
  }

  // Get run numbers for consistency calculation
  const { data: promptsData } = await supabase
    .from("prompts_executed")
    .select("id, run_number")
    .eq("run_id", runId);
  const promptRunMap = new Map((promptsData ?? []).map((p: any) => [p.id, p.run_number]));
  const uniqueRuns = new Set((promptsData ?? []).map((p: any) => p.run_number));
  const totalRuns = uniqueRuns.size || 1;

  const upsertRows: any[] = [];
  for (const [name, mentionRows] of Array.from(byCompetitor.entries())) {
    const count = mentionRows.length;

    // Check if new aligned metrics are available (competitor_tone column populated)
    const hasAlignedMetrics = mentionRows.some((m: any) => m.competitor_tone != null && Number(m.competitor_tone) !== 0);

    // --- Presence (30%): mentions / denominator (0 to 1) → × 100 ---
    const presence_score = (count / denominator) * 100;

    // --- Rank (25%): AVG(rank > 0 ? MAX(0, 100-(rank-1)×20) : 0) / denominator ---
    const rankSum = mentionRows.reduce((s: number, m: any) => {
      const rank = m.competitor_rank != null ? Number(m.competitor_rank) : (m.rank != null ? Number(m.rank) : 0);
      if (rank > 0) return s + Math.max(0, 100 - (rank - 1) * 20);
      return s;
    }, 0);
    const rank_score = rankSum / denominator;

    if (hasAlignedMetrics) {
      // ─── NEW aligned formula (6 parameters, same as brand AVI) ───

      // --- Sentiment (20%): AVG((competitor_sentiment+1)×50) / denominator ---
      const sentimentSum = mentionRows.reduce((s: number, m: any) => {
        const sent = m.competitor_sentiment != null ? Number(m.competitor_sentiment) : 0;
        return s + (sent + 1) * 50;
      }, 0);
      const sentiment_score = sentimentSum / denominator;

      // --- Tone (10%): AVG(competitor_tone × 100) / denominator ---
      const toneSum = mentionRows.reduce((s: number, m: any) => {
        const tone = m.competitor_tone != null ? Number(m.competitor_tone) : 0;
        return s + tone * 100;
      }, 0);
      const tone_score = toneSum / denominator;

      // --- Recommendation (10%): AVG(competitor_recommendation × 100) / denominator ---
      const recSum = mentionRows.reduce((s: number, m: any) => {
        const rec = m.competitor_recommendation != null ? Number(m.competitor_recommendation) : 0;
        return s + rec * 100;
      }, 0);
      const recommendation_score = recSum / denominator;

      // --- Consistency (5%): 1 - stddev(presence per run) ---
      const presencePerRun: number[] = [];
      for (const runNum of Array.from(uniqueRuns)) {
        const runMentions = mentionRows.filter((m: any) => promptRunMap.get(m.prompt_executed_id) === runNum);
        const promptsInRun = (promptsData ?? []).filter((p: any) => p.run_number === runNum).length || 1;
        presencePerRun.push(runMentions.length / promptsInRun);
      }
      const meanPresence = presencePerRun.reduce((s, v) => s + v, 0) / presencePerRun.length;
      const variancePresence = presencePerRun.reduce((s, v) => s + (v - meanPresence) ** 2, 0) / presencePerRun.length;
      const consistency_score = (1 - Math.sqrt(variancePresence)) * 100;

      // AVI = presence×0.30 + rank×0.25 + sentiment×0.20 + tone×0.10 + recommendation×0.10 + consistency×0.05
      const aviScore = Math.round(
        (presence_score * 0.30 +
        rank_score * 0.25 +
        sentiment_score * 0.20 +
        tone_score * 0.10 +
        recommendation_score * 0.10 +
        consistency_score * 0.05) * 10
      ) / 10;

      upsertRows.push({
        project_id: projectId,
        run_id: runId,
        competitor_name: name,
        avi_score: Math.max(0, Math.min(100, aviScore)),
        prominence_score: Math.round(presence_score * 100) / 100,
        rank_score: Math.round(rank_score * 100) / 100,
        sentiment_score: Math.round(sentiment_score * 100) / 100,
        consistency_score: Math.round(consistency_score * 100) / 100,
        mention_count: count,
        computed_at: new Date().toISOString(),
      });
    } else {
      // ─── LEGACY fallback (old 3-parameter formula for pre-existing data) ───

      const sentimentSum = mentionRows.reduce((s: number, m: any) => {
        if (m.sentiment != null) {
          const sentiment = Number(m.sentiment);
          return s + (sentiment + 1) * 50;
        }
        return s;
      }, 0);
      const sentiment_score = sentimentSum / denominator;

      const consistency = (count / denominator) * 100;

      const aviScore = Math.round(
        (presence_score * 0.40 + rank_score * 0.35 + sentiment_score * 0.25) * 10
      ) / 10;

      upsertRows.push({
        project_id: projectId,
        run_id: runId,
        competitor_name: name,
        avi_score: Math.max(0, Math.min(100, aviScore)),
        prominence_score: Math.round(presence_score * 100) / 100,
        rank_score: Math.round(rank_score * 100) / 100,
        sentiment_score: Math.round(sentiment_score * 100) / 100,
        consistency_score: Math.round(consistency * 100) / 100,
        mention_count: count,
        computed_at: new Date().toISOString(),
      });
    }
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

  language: string;
  browsing: boolean;
  sector: string | null;
  brandType: string | null;
  sectorKeywords: string[];
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
  const citationSources: string[] = aiResult.citationSources ?? [];
  const isSkipped = aiResult.error?.includes("SKIPPED");
  const promptError: string | null = rawText ? null : (aiResult.error ?? "Risposta vuota dal modello");

  // Update prompt with response + save raw citation URLs
  await (supabase.from("prompts_executed") as any)
    .update({
      raw_response: rawText || null,
      response_length: rawText.length,
      executed_at: new Date().toISOString(),
      error: promptError,
      citation_urls: citationSources,
    })
    .eq("id", promptRecord.id);

  if (!rawText) return;

  // Enrich sector with site_analysis keywords for better extraction
  const enrichedSector = task.sectorKeywords.length > 0
    ? `${task.sector ?? "generic"} (keywords: ${task.sectorKeywords.join(", ")})`
    : task.sector ?? undefined;
  const extraction = await extractFromResponse(rawText, task.targetBrand, enrichedSector, task.brandType ?? undefined, task.language ?? undefined, task.brandDomain);

  // Detailed extraction logging
  console.log(`[executePrompt] model=${task.model} brand="${task.targetBrand}" brand_mentioned=${extraction.brand_mentioned} competitors_raw=${extraction.competitors_found.length} topics=${extraction.topics.length} responseLen=${rawText.length}`);
  if (extraction.competitors_found.length > 0) {
    console.log(`[executePrompt] competitors extracted: ${extraction.competitors_found.map(c => `"${c.name}" (${c.type})`).join(", ")}`);
  }

  // Validation: warn if long response but no brand/competitors detected
  if (rawText.length > 100 && !extraction.brand_mentioned && extraction.competitors_found.length === 0) {
    console.warn(`[executePrompt] EXTRACTION WARNING: model=${task.model} brand="${task.targetBrand}" text=${rawText.length}chars but brand_mentioned=false, competitors=0. First 300 chars: ${rawText.slice(0, 300)}`);
  }

  // Save response_analysis (normalize competitor names consistently + institutional filter)
  const normalizedCompNames = extraction.competitors_found
    .map(c => {
      const n = normalizeCompetitorName(c.name, task.targetBrand, normCache);
      if (!n) {
        console.log(`[executePrompt] competitor FILTERED by normalization: "${c.name}"`);
      }
      return n ? canonicalizeCompetitorName(extractBrandOnly(n)) : null;
    })
    .filter((n): n is string => n != null && n !== task.targetBrand)
    .filter(n => {
      if (isInstitutional(n)) {
        console.log(`[executePrompt] competitor FILTERED by institutional blocklist: "${n}"`);
        return false;
      }
      return true;
    });
  if (normalizedCompNames.length < extraction.competitors_found.length) {
    console.log(`[executePrompt] competitors after normalization+filter: ${normalizedCompNames.length}/${extraction.competitors_found.length} kept: [${normalizedCompNames.join(", ")}]`);
  }

  // Check if brand domain appears in AI-consulted citation URLs (any provider)
  const brandInCitations = citationSources.length > 0 && task.brandDomain
    ? citationSources.some(url => {
        try {
          const citationDomain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
          const brand = task.brandDomain!.replace(/^(?:https?:\/\/)?(?:www\.)?/, "").replace(/\/.*$/, "").toLowerCase();
          return citationDomain.includes(brand) || brand.includes(citationDomain);
        } catch { return false; }
      })
    : false;

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
      brand_in_citations: brandInCitations,
    });

  // Save competitor_mentions (with same normalization + institutional filter as competitors table)
  if (extraction.competitors_found.length > 0) {
    const mentions = extraction.competitors_found
      .map((c) => {
        const normalized = normalizeCompetitorName(c.name, task.targetBrand, normCache);
        if (!normalized) return null;
        const canonical = canonicalizeCompetitorName(extractBrandOnly(normalized));
        if (canonical === task.targetBrand) return null;
        if (isInstitutional(canonical)) return null;
        return {
          run_id: task.runId,
          project_id: task.projectId,
          competitor_name: canonical,
          prompt_executed_id: promptRecord.id,
          rank: c.rank ?? null,
          sentiment: c.sentiment ?? null,
          recommendation: c.recommendation ?? null,
          competitor_type: c.type ?? "direct",
          competitor_rank: c.rank ?? null,
          competitor_sentiment: c.sentiment ?? 0,
          competitor_tone: c.tone ?? 0,
          competitor_recommendation: c.recommendation ?? 0,
        };
      })
      .filter(Boolean);
    if (mentions.length > 0) {
      const { error: mentionErr } = await (supabase.from("competitor_mentions") as any)
        .insert(mentions);
      if (mentionErr) {
        // If insert fails (likely new columns don't exist yet), retry without them
        console.warn("[inngest] competitor_mentions insert failed, retrying without new columns:", mentionErr.message);
        const fallbackMentions = (mentions as any[]).map(({ competitor_rank, competitor_sentiment, competitor_tone, competitor_recommendation, ...rest }) => rest);
        const { error: fallbackErr } = await (supabase.from("competitor_mentions") as any)
          .insert(fallbackMentions);
        if (fallbackErr) console.error("[inngest] competitor_mentions fallback insert error:", fallbackErr.message);
      }
    }
  }

  // Merge sources: API sources (highest priority) + extractor sources (no duplicate extractFromText)
  const extractorSources: ExtractedSource[] = (extraction.sources || []).map((s: any) => ({
    url: s.url || s.domain,
    domain: s.domain,
    title: s.label,
    source_type: s.source_type || "other",
    source_origin: "text_mention" as const,
    context: s.context,
  }));
  const mergedSources = mergeSources(aiResult.sources, extractorSources);

  // Batch upsert sources (source_origin preserved from ExtractedSource via mergeSources)
  const sourceRows = mergedSources
    .filter(s => s.domain && task.projectId)
    .map(s => ({
      project_id: task.projectId,
      run_id: task.runId,
      url: s.url || "https://" + s.domain,
      domain: s.domain,
      source_type: s.source_type || "other",
      source_origin: s.source_origin || "text_mention",
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
    const canonicalName = canonicalizeCompetitorName(extractBrandOnly(normalizedName));
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
    // Batch-increment mention_count for all competitors in one RPC call
    const compNames = compRows.map(c => c.name);
    await (supabase.rpc as any)("batch_increment_competitor_count", {
      p_project_id: task.projectId,
      p_names: compNames,
    });
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
    // Batch-increment frequency for all topics in one RPC call
    const topicNames = topicRows.map(t => t.name);
    await (supabase.rpc as any)("batch_increment_topic_frequency", {
      p_project_id: task.projectId,
      p_names: topicNames,
    });
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
    const { runId, projectId, modelsUsed: rawModels, runCount, browsing = true, billing } = event.data as {
      runId: string;
      projectId: string;
      modelsUsed: string[];
      runCount: number;
      browsing?: boolean;
      billing?: { userId: string; querySource: string; promptCost: number };
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
        .eq("project_id", projectId)
        .eq("is_active", true);

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

    // Step 1b: deduct credits now that the analysis is confirmed viable.
    // This runs INSIDE Inngest so credits aren't lost if the trigger failed.
    if (billing) {
      await step.run("deduct-credits", async () => {
        if (billing.querySource === "wallet") {
          await consumeWalletQueries(
            billing.userId,
            browsing ? billing.promptCost : 0,
            browsing ? 0 : billing.promptCost,
          );
        } else if (browsing) {
          await incrementBrowsingPromptsUsed(billing.userId, billing.promptCost);
        } else {
          await incrementNoBrowsingPromptsUsed(billing.userId, billing.promptCost);
        }
      });
    }

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

    const language = project.language;
    const sector = project.sector ?? null;
    const brandTypeVal = project.brand_type ?? null;
    const siteAnalysis = project.site_analysis ?? null;
    const sectorKeywords: string[] = siteAnalysis?.sector_keywords ?? [];

    // Build all prompt tasks.
    // Audience segments are now manual-only: if the user hasn't created any
    // segment for the project, we run each query once with no user context
    // (the prompt will just be the bare question, no "Contesto utente:" line).
    const DEFAULT_SEGMENT = {
      id: null as string | null,
      prompt_context: "",
    };
    const effectiveSegments = segments.length > 0 ? segments : [DEFAULT_SEGMENT];

    const allTasks: PromptTask[] = [];
    for (const query of queries) {
      // If query was AI-generated with a persona (set_type="persona"), it already
      // has persona context embedded in its text — skip manual segments to avoid
      // double-persona conflicts. Use only the default generic segment.
      const querySegments = (query as any).set_type === "persona"
        ? [DEFAULT_SEGMENT]
        : effectiveSegments;

      for (const segment of querySegments) {
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

              language,
              browsing,
              sector,
              brandType: brandTypeVal,
              sectorKeywords,
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
          // Update progress dopo OGNI prompt (non solo a fine batch) usando il
          // count reale di prompts_executed → idempotente rispetto ai retry
          // di Inngest e niente "salti" da 15 nella barra del client.
          const { count } = await supabase
            .from("prompts_executed")
            .select("*", { count: "exact", head: true })
            .eq("run_id", runId);
          if (typeof count === "number") {
            await (supabase.from("analysis_runs") as any)
              .update({ completed_prompts: Math.min(count, allTasks.length) })
              .eq("id", runId);
          }
        }
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
