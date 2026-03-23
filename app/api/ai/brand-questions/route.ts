import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  console.log("[BRAND-QUESTIONS] Request received:", JSON.stringify(body).slice(0, 300));
  const { categoria, mercato, punti_di_forza, competitor, obiezioni, lang } = body;

  if (!categoria) {
    console.log("[BRAND-QUESTIONS] Missing categoria");
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  const context = [
    `Category: ${categoria}`,
    mercato ? `Market: ${mercato}` : null,
    punti_di_forza?.length ? `Strengths: ${punti_di_forza.join(", ")}` : null,
    competitor?.length ? `Competitors: ${competitor.join(", ")}` : null,
    obiezioni?.length ? `Common objections: ${obiezioni.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
  const outputLang = langName[lang] ?? "English";

  console.log("[BRAND-QUESTIONS] ANTHROPIC_API_KEY set:", !!process.env.ANTHROPIC_API_KEY);
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("[BRAND-QUESTIONS] Calling Haiku with context:", context);
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are an expert in brand marketing and AI visibility. Analyze the following brand context and generate exactly 3 short, specific questions that would help you better understand the brand to generate AI queries more representative of its real market. The questions must be in ${outputLang}, practical, and refer to real user purchasing behaviors. Respond ONLY with a JSON array: ["question1", "question2", "question3"]`,
      messages: [{ role: "user", content: context }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ questions: [] });
    }

    const questions = JSON.parse(match[0]);
    return NextResponse.json({ questions: Array.isArray(questions) ? questions.slice(0, 3) : [] });
  } catch (err: any) {
    console.error("[BRAND-QUESTIONS] ERROR:", err?.message ?? err, err?.status, err?.stack?.slice(0, 300));
    return NextResponse.json({ error: "Error generating questions" }, { status: 500 });
  }
}
