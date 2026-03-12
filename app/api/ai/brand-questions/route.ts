import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { categoria, mercato, punti_di_forza, competitor, obiezioni } = body;

  if (!categoria) {
    return NextResponse.json({ error: "Categoria richiesta" }, { status: 400 });
  }

  const context = [
    `Categoria: ${categoria}`,
    mercato ? `Mercato: ${mercato}` : null,
    punti_di_forza?.length ? `Punti di forza: ${punti_di_forza.join(", ")}` : null,
    competitor?.length ? `Competitor: ${competitor.join(", ")}` : null,
    obiezioni?.length ? `Obiezioni comuni: ${obiezioni.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `Sei un esperto di brand marketing e AI visibility. Analizza il seguente contesto brand e genera esattamente 3 domande brevi e specifiche che ti aiuterebbero a capire meglio il brand per generare query AI più rappresentative del suo mercato reale. Le domande devono essere in italiano, pratiche, e riferite a comportamenti d'acquisto reali degli utenti. Rispondi SOLO con un array JSON: ["domanda1", "domanda2", "domanda3"]`,
      messages: [{ role: "user", content: context }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ questions: [] });
    }

    const questions = JSON.parse(match[0]);
    return NextResponse.json({ questions: Array.isArray(questions) ? questions.slice(0, 3) : [] });
  } catch (err) {
    console.error("AI brand questions error:", err);
    return NextResponse.json({ error: "Errore generazione domande" }, { status: 500 });
  }
}
