import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  console.log("[BRAND-QUESTIONS] Request received:", JSON.stringify(body).slice(0, 300));
  const { categoria, mercato, punti_di_forza, competitor, obiezioni, lang, mode, theme, theme_context } = body;

  const isSpecific = mode === "specifiche" && typeof theme === "string" && theme.trim().length > 0;

  if (!isSpecific && !categoria) {
    console.log("[BRAND-QUESTIONS] Missing categoria");
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  const context = isSpecific
    ? [
        `Topic to investigate: ${String(theme).trim()}`,
        theme_context ? `User's investigation goal (point of view): ${String(theme_context).trim()}` : null,
        categoria ? `Brand category (background): ${categoria}` : null,
        mercato ? `Market: ${mercato}` : null,
      ].filter(Boolean).join("\n")
    : [
        `Category: ${categoria}`,
        mercato ? `Market: ${mercato}` : null,
        punti_di_forza?.length ? `Strengths: ${punti_di_forza.join(", ")}` : null,
        competitor?.length ? `Competitors: ${competitor.join(", ")}` : null,
        obiezioni?.length ? `Common objections: ${obiezioni.join(", ")}` : null,
      ].filter(Boolean).join("\n");

  const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
  const outputLang = langName[lang] ?? "English";

  const systemPrompt = isSpecific
    ? `You are an expert in brand marketing and AI visibility. The user wants AI search queries focused on ONE specific topic of their brand — NOT general brand-360° queries. They may also have provided an "investigation goal" describing the point of view they want to study (e.g. "I want to see who is cited when a customer is unhappy with their current provider"). Your job is to surface 3 short questions that help SHARPEN the user's investigation so query generation reflects exactly the point of view they care about.

Generate exactly 3 short questions, ONE for each axis:
1. SEARCHER PROFILE: who is the implicit person searching in this investigation? (e.g. novice runner vs. veteran, unhappy switcher vs. first-time buyer, price-sensitive vs. premium)
2. SEARCH MOMENT: in what concrete situation / trigger is this person searching? (e.g. training for first marathon, switching after bad experience, planning a launch)
3. DECISIVE CRITERIA: what criteria will make or break their choice in this investigation? (e.g. local presence, sustainability, budget tier, after-sales service)

If the user already provided an "investigation goal", base the questions on its frame — do not contradict it. Questions must be in ${outputLang}. The user's answers are optional. Respond ONLY with a JSON array: ["searcher question", "moment question", "criteria question"]`
    : `You are an expert in brand marketing and AI visibility. Analyze the following brand context and generate exactly 3 short, specific questions that would help you better understand the brand to generate AI queries more representative of its real market. The questions must be in ${outputLang}, practical, and refer to real user purchasing behaviors. Respond ONLY with a JSON array: ["question1", "question2", "question3"]`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
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
