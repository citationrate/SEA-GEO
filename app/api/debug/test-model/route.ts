import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * GET /api/debug/test-model?model=gpt-5.4
 * Tests a model directly with all 3 API paths and returns results.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const model = url.searchParams.get("model") || "gpt-5.4";
  const apiModel = model === "gpt-5.4" ? "gpt-5.4-2026-03-05" : model;
  const prompt = "Confronto tra Apple e Samsung: quale offre migliori smartphone nel 2026?";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: Record<string, any> = { model, apiModel, prompt };

  // Test 1: Responses API + web_search
  try {
    const t0 = Date.now();
    const response = await openai.responses.create({
      model: apiModel,
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    });
    const text = response.output_text || "";
    results.responsesWithSearch = {
      ok: !!text,
      textLen: text.length,
      preview: text.substring(0, 200),
      ms: Date.now() - t0,
    };
  } catch (err: any) {
    results.responsesWithSearch = {
      ok: false,
      error: err?.message || String(err),
      status: err?.status,
      code: err?.code,
    };
  }

  // Test 2: Responses API without tools
  try {
    const t0 = Date.now();
    const response = await openai.responses.create({
      model: apiModel,
      input: prompt,
    });
    const text = response.output_text || "";
    results.responsesPlain = {
      ok: !!text,
      textLen: text.length,
      preview: text.substring(0, 200),
      ms: Date.now() - t0,
    };
  } catch (err: any) {
    results.responsesPlain = {
      ok: false,
      error: err?.message || String(err),
      status: err?.status,
      code: err?.code,
    };
  }

  // Test 3: Chat Completions API
  try {
    const t0 = Date.now();
    const completion = await openai.chat.completions.create({
      model: apiModel,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    results.chatCompletions = {
      ok: !!text,
      textLen: text.length,
      preview: text.substring(0, 200),
      ms: Date.now() - t0,
    };
  } catch (err: any) {
    results.chatCompletions = {
      ok: false,
      error: err?.message || String(err),
      status: err?.status,
      code: err?.code,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
