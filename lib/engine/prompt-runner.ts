import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL_MAP } from "./models";
import {
  type ExtractedSource,
  extractFromAnnotations,
  extractFromAnthropicSearch,
  extractFromGrounding,
  extractFromText,
  mergeSources,
  classifyDomainForPerplexity,
} from "./sources-extractor";

export interface AIModelResult {
  text: string;
  sources: ExtractedSource[];
  /** Raw URLs the AI actually consulted (Perplexity citations, Claude web search, Gemini grounding) */
  citationSources?: string[];
  error?: string;
}

/** Map short model IDs to actual API model identifiers */
export const API_MODEL_ID: Record<string, string> = {
  "claude-haiku": "claude-haiku-4-5-20251001",
  "claude-sonnet": "claude-sonnet-4-6",
  "claude-opus": "claude-opus-4-7",
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gpt-5.4-mini": "gpt-5.4-mini-2026-03-17",
  "gpt-5.4": "gpt-5.4-2026-03-05",
  "gpt-5.5": "gpt-5.5",
  "gpt-5.5-pro": "gpt-5.5-pro",
  "perplexity-sonar": "sonar",
  "perplexity-sonar-pro": "sonar-pro",
  "copilot-gpt4": "gpt-4o",
};

/** Models that require the Responses API instead of Chat Completions */
const RESPONSES_API_MODELS = new Set(["gpt-5.4", "gpt-5.4-mini", "gpt-5.5", "gpt-5.5-pro"]);

/**
 * Call an AI model with retry logic and source extraction.
 * Supports OpenAI, Anthropic, Google, Perplexity, Azure, and xAI providers.
 */
export async function callAIModel(
  prompt: string,
  model: string,
  browsing = false,
  brandDomain?: string | null,
): Promise<AIModelResult> {
  const empty: AIModelResult = { text: "", sources: [] };

  // Skip models on hold
  if (model === "copilot-gpt4") {
    return { text: "", sources: [], error: `[${model}] SKIPPED: Copilot non ancora disponibile` };
  }

  const apiModel = API_MODEL_ID[model] ?? model;
  try {
    const modelDef = MODEL_MAP.get(model);
    const provider = modelDef?.provider ?? "openai";

    if (provider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) {
        return { text: "", sources: [], error: `[${model}] SKIPPED: ANTHROPIC_API_KEY non configurata` };
      }

      // Web search adds 10-30K input tokens (search result pages billed as input)
      // Limit search uses to control costs: Opus=1, Sonnet=2, Haiku=3
      const isOpus = model === "claude-opus";
      const isSonnet = model === "claude-sonnet";
      const maxTokens = isOpus ? 2048 : 4096;
      const searchMaxUses = isOpus ? 1 : isSonnet ? 2 : 3;

      return await retryCall(2, async () => {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        if (browsing) {
          try {
            const msg = await anthropic.messages.create({
              model: apiModel,
              max_tokens: maxTokens,
              messages: [{ role: "user", content: prompt }],
              tools: [{
                type: "web_search_20250305",
                name: "web_search",
                max_uses: searchMaxUses,
                user_location: {
                  type: "approximate",
                  country: "IT",
                  timezone: "Europe/Rome",
                },
                blocked_domains: [
                  "facebook.com",
                  "instagram.com",
                  "twitter.com",
                  "tiktok.com",
                ],
              }],
            } as any);

            // Concatenate ALL text blocks — web search splits response across multiple blocks
            const text = msg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n");

            if (msg.stop_reason === "max_tokens") {
              console.warn(`[Anthropic] model=${model} TRUNCATED: hit max_tokens with web search`);
            }

            if (text) {
              const searchSources = extractFromAnthropicSearch(msg.content as any[], brandDomain ?? undefined);
              const citationSources = searchSources.map(s => s.url);
              const textSources = extractFromText(text, brandDomain ?? undefined);
              return { text, sources: mergeSources(searchSources, textSources), citationSources };
            }
          } catch (browsingErr) {
            console.error("[callAIModel] Anthropic web search failed, falling back:", browsingErr instanceof Error ? browsingErr.message : browsingErr);
          }
        }

        const msg = await anthropic.messages.create({
          model: apiModel,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        });

        // Concatenate ALL text blocks (standard calls usually have one, but be safe)
        const text = msg.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n");

        if (msg.stop_reason === "max_tokens") {
          console.warn(`[Anthropic] model=${model} TRUNCATED: hit max_tokens`);
        }

        if (!text) throw new Error("Anthropic returned empty response");
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }, "Anthropic");
    }

    if (provider === "google") {
      if (!process.env.GOOGLE_AI_API_KEY) {
        return { text: "", sources: [], error: `[${model}] SKIPPED: GOOGLE_AI_API_KEY non configurata` };
      }
      const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

      const extractGeminiText = (result: any): string => {
        const resp = result.response;
        const candidate = resp.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason && finishReason !== "STOP") {
          console.error(`[Gemini] blocked: finishReason=${finishReason}`, JSON.stringify(candidate?.safetyRatings ?? []));
          return "";
        }

        try {
          const text = resp.text();
          if (text) return text;
        } catch { /* .text() throws if no text candidates */ }

        const parts = candidate?.content?.parts;
        if (parts?.length > 0) {
          const text = parts.map((p: any) => p.text ?? "").join("");
          if (text) return text;
        }

        console.error("[Gemini] empty response. Raw:", JSON.stringify({
          finishReason,
          candidatesCount: resp.candidates?.length,
          parts: parts?.map((p: any) => ({ type: Object.keys(p), len: p.text?.length })),
          fullResponse: JSON.stringify(resp).slice(0, 500),
        }));
        return "";
      };

      return await retryCall(2, async () => {
        if (browsing) {
          try {
            const geminiModel = genai.getGenerativeModel({
              model: apiModel,
              tools: [{ googleSearch: {} } as any],
              generationConfig: { maxOutputTokens: 4096 },
            });
            const result = await geminiModel.generateContent(prompt);
            const text = extractGeminiText(result);
            if (text) {
              const groundingSources = extractFromGrounding((result.response as any).candidates || [], brandDomain ?? undefined);
              const citationSources = groundingSources.map(s => s.url);
              const textSources = extractFromText(text, brandDomain ?? undefined);
              return { text, sources: mergeSources(groundingSources, textSources), citationSources };
            }
          } catch (e: any) {
            console.error("[Gemini grounding] failed:", e?.message);
          }
        }
        const geminiModel = genai.getGenerativeModel({
          model: apiModel,
          generationConfig: { maxOutputTokens: 4096 },
        });
        const result = await geminiModel.generateContent(prompt);
        const text = extractGeminiText(result);
        if (text) return { text, sources: extractFromText(text, brandDomain ?? undefined) };
        throw new Error("Gemini returned empty response");
      }, "Gemini");
    }

    if (provider === "perplexity") {
      if (!process.env.PERPLEXITY_API_KEY) {
        return { text: "", sources: [], error: `[${model}] SKIPPED: PERPLEXITY_API_KEY non configurata` };
      }
      return await retryCall(2, async () => {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: apiModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 4096,
            temperature: 0.7,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new RetryableError(`Perplexity ${res.status}: ${body}`, res.status);
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        if (!text) {
          console.warn(`[Perplexity] empty text from response. Keys: ${Object.keys(data).join(",")}, choices: ${JSON.stringify(data.choices?.[0]).slice(0, 200)}`);
        }

        // Extract structured citations from Perplexity API response
        const perplexitySources: ExtractedSource[] = [];
        const citationSources: string[] = data.citations ?? [];
        const seenDomains = new Set<string>();
        for (const url of citationSources) {
          try {
            const domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
            if (domain && !seenDomains.has(domain)) {
              seenDomains.add(domain);
              perplexitySources.push({
                url,
                domain,
                title: undefined,
                source_type: classifyDomainForPerplexity(domain, brandDomain ?? undefined),
                source_origin: "ai_consulted",
                context: "Perplexity citation",
              });
            }
          } catch { /* invalid URL */ }
        }

        const textSources = extractFromText(text, brandDomain ?? undefined);
        return { text, sources: mergeSources(perplexitySources, textSources), citationSources };
      }, "Perplexity");
    }

    if (provider === "azure") {
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
      const azureKey = process.env.AZURE_OPENAI_KEY ?? "";
      if (!endpoint || !azureKey) {
        return { text: "", sources: [], error: `[${model}] SKIPPED: credenziali Azure non configurate` };
      }
      return await retryCall(2, async () => {
        const deployment = apiModel;
        const res = await fetch(
          `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`,
          {
            method: "POST",
            headers: {
              "api-key": azureKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              max_tokens: 4096,
              temperature: 0.7,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new RetryableError(`Azure ${res.status}: ${body}`, res.status);
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }, "Azure");
    }

    if (provider === "xai") {
      if (!process.env.XAI_API_KEY) {
        return { text: "", sources: [], error: `[${model}] SKIPPED: XAI_API_KEY non configurata` };
      }
      return await retryCall(2, async () => {
        const client = new OpenAI({
          apiKey: process.env.XAI_API_KEY!,
          baseURL: "https://api.x.ai/v1",
        });
        const completion = await client.chat.completions.create({
          model: apiModel,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        const text = completion.choices[0]?.message?.content ?? "";
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }, "xAI");
    }

    // OpenAI (default)
    if (!process.env.OPENAI_API_KEY) {
      return { text: "", sources: [], error: `[${model}] SKIPPED: OPENAI_API_KEY non configurata` };
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // GPT-5.4 and similar models: try Responses API first, then fallback to Chat Completions
    const useResponsesApi = RESPONSES_API_MODELS.has(model);

    if (useResponsesApi) {
      const isGpt54 = model === "gpt-5.4";
      if (isGpt54) console.log(`[GPT-5.4 CALLAI] Entered Responses API path. browsing=${browsing}, apiModel=${apiModel}`);
      try {
        const useSearch = browsing;
        const tools = useSearch ? [{ type: "web_search_preview" as const }] : undefined;
        if (isGpt54) console.log(`[GPT-5.4 CALLAI] Calling openai.responses.create with${useSearch ? "" : "out"} tools`);
        const response = await openai.responses.create({
          model: apiModel,
          input: prompt,
          ...(tools ? { tools } : {}),
        });
        const text = response.output_text || "";
        if (isGpt54) console.log(`[GPT-5.4 CALLAI] Response received: text_len=${text.length}, output_items=${response.output?.length ?? 0}, raw=${JSON.stringify(response).slice(0, 300)}`);
        if (text) {
          const sources = useSearch
            ? mergeSources(extractFromAnnotations(response.output || [], brandDomain ?? undefined), extractFromText(text, brandDomain ?? undefined))
            : extractFromText(text, brandDomain ?? undefined);
          return { text, sources };
        }
        return { text: "", sources: [], error: `[${model}] Empty response from Responses API` };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStatus = (err as any)?.status ?? "unknown";
        if (isGpt54) console.error(`[GPT-5.4 CALLAI] CAUGHT ERROR: status=${errStatus}, message=${errMsg}`);
        else console.error(`[OpenAI] model=${model} responses failed:`, errMsg);
        return { text: "", sources: [], error: `[${model}] ${errMsg}` };
      }
    }

    // Standard OpenAI models: try Responses API with web_search when browsing
    if (browsing) {
      try {
        console.log(`[OpenAI] model=${model} apiModel=${apiModel} responses.create with web_search_preview (standard)`);
        const response = await openai.responses.create({
          model: apiModel,
          tools: [{ type: "web_search_preview" }],
          input: prompt,
        });
        const text = response.output_text || "";
        if (text) {
          const annotationSources = extractFromAnnotations(response.output || [], brandDomain ?? undefined);
          const textSources = extractFromText(text, brandDomain ?? undefined);
          return { text, sources: mergeSources(annotationSources, textSources) };
        }
      } catch (browsingErr) {
        console.error(`[OpenAI] model=${model} responses.create+search failed, falling back to chat.completions:`, browsingErr instanceof Error ? browsingErr.message : browsingErr);
      }
    }

    // Fallback: Chat Completions API (standard path)
    try {
      if (model.startsWith("o1") || model.startsWith("o3")) {
        const completion = await openai.chat.completions.create({
          model: apiModel,
          max_completion_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        } as any);
        const text = completion.choices[0]?.message?.content ?? "";
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }

      console.log(`[OpenAI] model=${model} apiModel=${apiModel} chat.completions.create`);
      const completion = await openai.chat.completions.create({
        model: apiModel,
        temperature: 0.7,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    } catch (openaiErr) {
      const errMsg = openaiErr instanceof Error ? openaiErr.message : String(openaiErr);
      console.error(`[OpenAI] model=${model} apiModel=${apiModel} FAILED:`, errMsg);
      return { text: "", sources: [], error: `[${model}] ${errMsg}` };
    }
  } catch (err: any) {
    const statusCode = err?.status ?? err?.statusCode ?? err?.response?.status ?? "";
    const errMsg = err instanceof Error ? err.message : String(err);
    const detail = statusCode ? `[${model}] HTTP ${statusCode}: ${errMsg}` : `[${model}] ${errMsg}`;
    console.error(`[callAIModel] ${model} failed:`, detail);
    return { ...empty, error: detail };
  }
}

/* ─── Retry infrastructure ─── */

class RetryableError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

async function retryCall(
  maxAttempts: number,
  fn: () => Promise<AIModelResult>,
  providerLabel: string,
): Promise<AIModelResult> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const status = e instanceof RetryableError ? e.statusCode : 0;
      if (attempt < maxAttempts) {
        const delay = status === 429 ? 3000 : 2000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  const errMsg = lastError?.message ?? `Errore sconosciuto ${providerLabel}`;
  console.error(`[${providerLabel}] failed after ${maxAttempts} attempts:`, errMsg);
  return { text: "", sources: [], error: `[${providerLabel}] ${errMsg}` };
}
