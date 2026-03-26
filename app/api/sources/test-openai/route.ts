import { NextResponse } from "next/server";
import OpenAI from "openai";

// Temporary test endpoint — remove after debugging
export async function GET() {
  try {
    const hasKey = !!process.env.OPENAI_API_KEY;
    const keyPrefix = process.env.OPENAI_API_KEY?.slice(0, 8) ?? "MISSING";

    if (!hasKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not set", keyPrefix });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      temperature: 0,
      max_tokens: 10,
      messages: [{ role: "user", content: "Say OK" }],
    });

    return NextResponse.json({
      ok: true,
      keyPrefix,
      model: "gpt-5.4-mini",
      response: completion.choices[0]?.message?.content,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message ?? String(err),
      status: err?.status,
      code: err?.code,
      type: err?.type,
    });
  }
}
