import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  console.log("[BRAND-QUESTIONS] Request received:", JSON.stringify(body).slice(0, 300));
  const { project_id, categoria, mercato, punti_di_forza, competitor, obiezioni, lang, mode, theme, theme_context } = body;

  const isSpecific = mode === "specifiche" && typeof theme === "string" && theme.trim().length > 0;

  if (!isSpecific && !categoria) {
    console.log("[BRAND-QUESTIONS] Missing categoria");
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  // Carica contesto brand dal progetto per disambiguare B2C vs B2B e ancorare
  // le domande al brand reale. Senza questo, parole come "materie prime"
  // fanno deragliare il modello su filiera B2B anche se il brand è B2C e la
  // descrizione utente parla esplicitamente di consumatori finali.
  let brandLine = "";
  let sectorLine = "";
  let brandTypeLine = "";
  if (project_id) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("target_brand, sector, brand_type, market_context")
        .eq("id", project_id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();
      const p = project as any;
      if (p?.target_brand) brandLine = `Brand: ${p.target_brand}`;
      if (p?.sector) sectorLine = `Brand sector: ${p.sector}`;
      if (p?.brand_type) brandTypeLine = `Brand type: ${p.brand_type}`;
    } catch { /* ignore — context will degrade gracefully */ }
  }

  const context = isSpecific
    ? [
        brandLine || null,
        sectorLine || null,
        brandTypeLine || null,
        `Topic to investigate: ${String(theme).trim()}`,
        theme_context ? `User's investigation goal (point of view): ${String(theme_context).trim()}` : null,
        categoria ? `Brand category (background): ${categoria}` : null,
        mercato ? `Market: ${mercato}` : null,
      ].filter(Boolean).join("\n")
    : [
        brandLine || null,
        sectorLine || null,
        `Category: ${categoria}`,
        mercato ? `Market: ${mercato}` : null,
        punti_di_forza?.length ? `Strengths: ${punti_di_forza.join(", ")}` : null,
        competitor?.length ? `Competitors: ${competitor.join(", ")}` : null,
        obiezioni?.length ? `Common objections: ${obiezioni.join(", ")}` : null,
      ].filter(Boolean).join("\n");

  const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
  const outputLang = langName[lang] ?? "English";

  const systemPrompt = isSpecific
    ? `You are helping a brand researcher refine the framing of their AVI investigation.

The user has already specified:
- A TOPIC they want to investigate (e.g. "raw materials", "running shoes")
- An INVESTIGATION GOAL in plain language (the point of view they want to study)
- Optionally, the brand context (sector, brand_type)

Your job is to surface 3 short questions that NARROW WITHIN the user's stated frame — NEVER propose alternative frames.

⚠️ HARD RULES — read carefully:
1. The INVESTIGATION GOAL is the primary anchor. Parse it carefully to identify:
   - WHO is the implied searcher (consumer, professional, etc.)
   - WHAT they are doing (browsing, evaluating, comparing, switching, etc.)
   The 3 questions must sub-segment INSIDE that frame, not introduce orthogonal frames.

2. NEVER introduce a buyer/searcher type the user didn't imply.
   - If the goal says "consumers" (utenti, clienti, consumatori, customers, buyers) → the searcher is a consumer. Do NOT suggest formulators, suppliers, manufacturers, startup founders, sourcing managers, distributors.
   - If the goal says "B2B buyers / procurement / sourcing" → stay B2B.
   - If the goal is ambiguous, default to the brand's natural audience (e.g. a luxury consumer brand → consumers; a B2B SaaS → professional buyers).

3. NEVER let the topic word alone drive the framing. A topic like "raw materials" in a consumer perfume brand is a CONSUMER curiosity about ingredients/quality, NOT a B2B sourcing decision. Resist the obvious B2B semantic if the goal and brand context point to B2C.

4. Each question must offer 2-4 concrete options that ALL fit within the user's frame, not options spanning across frames.

5. The 3 questions explore (in this order):
   - Question 1 — SUB-AUDIENCE: which kind of [stated audience], more specifically? Options must all be variants of that audience (e.g. for consumers: "occasional buyer vs. enthusiast vs. connoisseur" — all consumers).
   - Question 2 — MOMENT IN THEIR JOURNEY: when in their journey is this person searching? (must fit the stated audience; if consumers, talk consumer moments — discovery, gifting, replacement — not procurement phases).
   - Question 3 — DECISIVE CRITERIA: which criteria drive their choice in this investigation? (quality cues, price tier, brand heritage, certifications, etc.)

❌ EXAMPLE OF WRONG (consumer perfume brand, topic="raw materials", goal="how consumers search info about quality raw materials in perfumes"):
   "In which phase does the user search for raw materials: startup sourcing, alternative suppliers, or routine restock?" → WRONG, this assumes B2B.

✅ EXAMPLE OF RIGHT for the same case:
   "When do consumers care about raw-material quality: when choosing a gift, when looking for natural/organic options, or when comparing premium fragrances?"

Questions must be in ${outputLang}. The user's answers are optional. Respond ONLY with a JSON array: ["q1", "q2", "q3"]`
    : `You are an expert in brand marketing and AI visibility. Analyze the following brand context and generate exactly 3 short, specific questions that would help you better understand the brand to generate AI queries more representative of its real market. The questions must be in ${outputLang}, practical, and refer to real user purchasing behaviors. Respect the brand's natural audience (B2C consumer brand → consumer questions; B2B → professional buyer questions). Respond ONLY with a JSON array: ["question1", "question2", "question3"]`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
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
