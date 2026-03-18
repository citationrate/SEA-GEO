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
  error?: string;
}

/** Map short model IDs to actual API model identifiers */
export const API_MODEL_ID: Record<string, string> = {
  "claude-haiku": "claude-haiku-4-5-20251001",
  "claude-sonnet": "claude-sonnet-4-5",
  "claude-opus": "claude-opus-4-5",
  "gemini-2.5-pro": "gemini-2.5-pro-preview-03-25",
  "perplexity-sonar": "sonar",
  "perplexity-sonar-pro": "sonar-pro",
  "copilot-gpt4": "gpt-4o",
};

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

      // web_search_20260209 max_uses budget by model tier
      const ANTHROPIC_SEARCH_MAX_USES: Record<string, number> = {
        "claude-haiku": 2,
        "claude-sonnet": 3,
        "claude-opus": 5,
      };

      return await retryCall(2, async () => {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Try web search when browsing=true, with graceful fallback
        if (browsing) {
          try {
            // Using web_search_20250305 (stable) — web_search_20260209 dynamic filtering
            // consumed too many tokens internally, causing response truncation even at 4096.
            // max_tokens: 16384 to ensure full response even with tool_use overhead.
            const msg = await anthropic.messages.create({
              model: apiModel,
              max_tokens: 16384,
              messages: [{ role: "user", content: prompt }],
              tools: [{
                type: "web_search_20250305",
                name: "web_search",
                max_uses: ANTHROPIC_SEARCH_MAX_USES[model] ?? 3,
                user_location: {
                  type: "approximate",
                  country: "IT",
                  timezone: "Europe/Rome",
                },
              }],
            } as any);

            // Log stop reason and web search activity
            console.log(`[Anthropic] model=${model} browsing=true stop_reason=${msg.stop_reason} blocks=${msg.content.length} usage_out=${msg.usage?.output_tokens}`);
            if (msg.stop_reason === "max_tokens") {
              console.warn(`[Anthropic] TRUNCATED: model=${model} hit max_tokens with web search`);
            }

            // Extract text from the last text block (web search responses have multiple content blocks)
            const textBlocks = msg.content.filter((b: any) => b.type === "text");
            const text = textBlocks[textBlocks.length - 1]?.type === "text"
              ? (textBlocks[textBlocks.length - 1] as any).text
              : "";

            // Log web search activity
            for (const block of msg.content) {
              if (block.type === "tool_use" && (block as any).name === "web_search") {
                console.log(`[Anthropic WEB SEARCH] Query: ${(block as any).input?.query}`);
              }
            }

            if (text) {
              const searchSources = extractFromAnthropicSearch(msg.content as any[], brandDomain ?? undefined);
              const textSources = extractFromText(text, brandDomain ?? undefined);
              return { text, sources: mergeSources(searchSources, textSources) };
            }
          } catch (browsingErr) {
            console.error("[callAIModel] Anthropic web search failed, falling back to standard:", browsingErr instanceof Error ? browsingErr.message : browsingErr);
          }
        }

        // Standard call (no web search) — also used as fallback when browsing fails
        const msg = await anthropic.messages.create({
          model: apiModel,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        console.log(`[Anthropic] model=${model} browsing=false stop_reason=${msg.stop_reason} usage_out=${msg.usage?.output_tokens}`);
        if (msg.stop_reason === "max_tokens") {
          console.warn(`[Anthropic] TRUNCATED: model=${model} hit max_tokens`);
        }
        const block = msg.content[0];
        const text = block.type === "text" ? block.text : "";
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
          if (text) {
            console.log(`[Gemini] text extracted via resp.text(), length=${text.length}`);
            return text;
          }
        } catch { /* .text() throws if no text candidates */ }

        const parts = candidate?.content?.parts;
        if (parts?.length > 0) {
          const text = parts.map((p: any) => p.text ?? "").join("");
          if (text) {
            console.log(`[Gemini] text extracted via parts, length=${text.length}`);
            return text;
          }
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
              const textSources = extractFromText(text, brandDomain ?? undefined);
              return { text, sources: mergeSources(groundingSources, textSources) };
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
        const citationSources: ExtractedSource[] = [];
        const citations: string[] = data.citations ?? [];
        const seenDomains = new Set<string>();
        for (const url of citations) {
          try {
            const domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
            if (domain && !seenDomains.has(domain)) {
              seenDomains.add(domain);
              citationSources.push({
                url,
                domain,
                title: undefined,
                source_type: classifyDomainForPerplexity(domain, brandDomain ?? undefined),
                context: "Perplexity citation",
              });
            }
          } catch { /* invalid URL */ }
        }

        const textSources = extractFromText(text, brandDomain ?? undefined);
        return { text, sources: mergeSources(citationSources, textSources) };
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

    if (browsing) {
      try {
        const response = await openai.responses.create({
          model: apiModel,
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
        model: apiModel,
        max_completion_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      } as any);
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    }

    const completion = await openai.chat.completions.create({
      model: apiModel,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return { text, sources: extractFromText(text, brandDomain ?? undefined) };
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
