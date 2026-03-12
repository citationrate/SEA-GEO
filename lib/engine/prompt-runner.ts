import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL_MAP } from "./models";
import {
  type ExtractedSource,
  extractFromAnnotations,
  extractFromGrounding,
  extractFromText,
  mergeSources,
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
  const apiModel = API_MODEL_ID[model] ?? model;
  try {
    const modelDef = MODEL_MAP.get(model);
    const provider = modelDef?.provider ?? "openai";

    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: apiModel,
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
        }));
        return "";
      };

      return await retryCall(2, async () => {
        if (browsing) {
          try {
            const geminiModel = genai.getGenerativeModel({
              model: apiModel,
              tools: [{ googleSearch: {} } as any],
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
        const geminiModel = genai.getGenerativeModel({ model: apiModel });
        const result = await geminiModel.generateContent(prompt);
        const text = extractGeminiText(result);
        if (text) return { text, sources: extractFromText(text, brandDomain ?? undefined) };
        throw new Error("Gemini returned empty response");
      }, "Gemini");
    }

    if (provider === "perplexity") {
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
            max_tokens: 1500,
            temperature: 0.7,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new RetryableError(`Perplexity ${res.status}: ${body}`, res.status);
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }, "Perplexity");
    }

    if (provider === "azure") {
      return await retryCall(2, async () => {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
        const deployment = apiModel;
        const res = await fetch(
          `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`,
          {
            method: "POST",
            headers: {
              "api-key": process.env.AZURE_OPENAI_KEY ?? "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              max_tokens: 1500,
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
      return await retryCall(2, async () => {
        const client = new OpenAI({
          apiKey: process.env.XAI_API_KEY ?? "",
          baseURL: "https://api.x.ai/v1",
        });
        const completion = await client.chat.completions.create({
          model: apiModel,
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });
        const text = completion.choices[0]?.message?.content ?? "";
        return { text, sources: extractFromText(text, brandDomain ?? undefined) };
      }, "xAI");
    }

    // OpenAI (default)
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
        max_completion_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      } as any);
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, sources: extractFromText(text, brandDomain ?? undefined) };
    }

    const completion = await openai.chat.completions.create({
      model: apiModel,
      temperature: 0.7,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return { text, sources: extractFromText(text, brandDomain ?? undefined) };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[callAIModel] ${model} failed:`, errMsg);
    return { ...empty, error: `[${model}] ${errMsg}` };
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
