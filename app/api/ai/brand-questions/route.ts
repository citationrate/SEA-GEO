import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadBrandContext, brandContextLines, inferDefaultAudience } from "@/lib/brand-context";

/**
 * Brand-questions endpoint — genera 3 domande di intake per affinare il
 * contesto prima della generazione query.
 *
 * Architettura "frame-first":
 *   1) Carica brand context (target_brand, sector, brand_type, …) — non è
 *      mai stato esposto al modello prima del 2026-05 ed era una delle
 *      cause principali di bias B2B/B2C.
 *   2) UNA SOLA call al modello, ma con output strutturato che lo costringe
 *      PRIMA a dichiarare il "frame" dell'indagine (audience implicita,
 *      momento, criteri decisivi) e SOLO DOPO a generare 3 domande dentro
 *      quel frame.
 *   3) Validazione minimale (numero di domande, lunghezza). Il vincolo di
 *      coerenza col frame è garantito dal fatto che lo schema di output
 *      forza il modello a "committarsi" al frame nello stesso turno.
 *
 * Questa struttura generalizza a qualsiasi tema/dominio: il modello deve
 * sempre dichiarare il frame prima di parlare, quindi non può deragliare
 * dietro la semantica naive di una parola del tema.
 */
export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  console.log("[BRAND-QUESTIONS] Request received:", JSON.stringify(body).slice(0, 300));
  const {
    project_id,
    categoria,
    mercato,
    punti_di_forza,
    competitor,
    obiezioni,
    lang,
    mode,
    theme,
    theme_context,
  } = body;

  const isSpecific = mode === "specifiche" && typeof theme === "string" && theme.trim().length > 0;

  if (!isSpecific && !categoria) {
    console.log("[BRAND-QUESTIONS] Missing categoria");
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  const brandCtx = await loadBrandContext(supabase, project_id, user.id);
  const defaultAudience = inferDefaultAudience(brandCtx);

  const userContextLines = [
    ...brandContextLines(brandCtx, "minimal"),
    isSpecific ? `Topic to investigate: ${String(theme).trim()}` : null,
    isSpecific && theme_context ? `User's investigation goal (point of view): ${String(theme_context).trim()}` : null,
    categoria ? `Brand category (background): ${categoria}` : null,
    mercato ? `Market: ${mercato}` : null,
    !isSpecific && punti_di_forza?.length ? `Strengths: ${punti_di_forza.join(", ")}` : null,
    !isSpecific && competitor?.length ? `Competitors: ${competitor.join(", ")}` : null,
    !isSpecific && obiezioni?.length ? `Common objections: ${obiezioni.join(", ")}` : null,
    defaultAudience !== "unknown" ? `Inferred natural audience (from brand_type, use as hint not hard rule): ${defaultAudience.toUpperCase()}` : null,
  ].filter(Boolean);

  const context = userContextLines.join("\n");

  const langName: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German", es: "Spanish" };
  const outputLang = langName[lang] ?? "English";

  const systemPrompt = isSpecific
    ? buildSpecificFramePrompt(outputLang)
    : buildGeneraliFramePrompt(outputLang);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: context }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseFrameAndQuestions(text);
    if (!parsed) {
      console.warn("[BRAND-QUESTIONS] Parsing failed, falling back to empty");
      return NextResponse.json({ questions: [] });
    }

    // Log del frame per osservabilità: utile in fase di tuning per capire
    // come il modello sta leggendo l'indagine. Non viene mai esposto al client.
    console.log("[BRAND-QUESTIONS] Frame:", JSON.stringify(parsed.frame));

    const sanitizedQuestions = parsed.questions
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter((q) => q.length > 5)
      .slice(0, 3);

    return NextResponse.json({ questions: sanitizedQuestions, frame: parsed.frame });
  } catch (err: any) {
    console.error("[BRAND-QUESTIONS] ERROR:", err?.message ?? err, err?.status, err?.stack?.slice(0, 300));
    return NextResponse.json({ error: "Error generating questions" }, { status: 500 });
  }
}

/* ───────────────────────────────────────────────────────────────────────
 * Prompt building
 * ─────────────────────────────────────────────────────────────────────── */

function buildSpecificFramePrompt(outputLang: string): string {
  return `You are helping a brand researcher refine the framing of their AVI investigation.

The user provides a TOPIC and an INVESTIGATION GOAL (point of view they want to study). Your task: ensure the 3 follow-up questions stay STRICTLY within the user's stated frame, regardless of how the topic word might suggest other framings.

Output a JSON object with this exact shape:
{
  "frame": {
    "audience": string,           // e.g. "consumer (perfume buyer)", "B2B procurement manager", "amateur runner"
    "audience_register": "B2C" | "B2B" | "prosumer" | "mixed",
    "search_moment_kind": string, // e.g. "consumer discovery", "post-purchase comparison", "supplier sourcing"
    "criteria_dimensions": string[], // 2-4 dimensions, e.g. ["quality cues", "price tier", "sustainability"]
    "rationale": string           // one-sentence reasoning: WHY this frame fits the user's goal
  },
  "questions": [string, string, string]
}

⚠️ HARD RULES for frame inference:
1. Parse the INVESTIGATION GOAL first. The audience and register are determined by what the user wrote, NOT by the topic word's most common semantic.
   - "how consumers / utenti / clienti / customers search" → audience_register = B2C
   - "procurement / sourcing / suppliers / fornitori / startup buying" → audience_register = B2B
   - If the goal is ambiguous, default to the brand's natural audience (look at brand_type / sector).
2. NEVER let a topic word like "raw materials", "sourcing", "formazione", "consulting" drag the frame to B2B if the goal/brand context point to consumers. The topic is a SUBJECT, not the buyer.
3. The frame must be expressed in the audience's own language and journey vocabulary, not the industry/supply-chain vocabulary.

⚠️ HARD RULES for questions:
4. Each question is a multi-choice option set with 2-4 alternatives, ALL of them variants of the inferred frame:
   - Question 1 (axis: AUDIENCE) — which sub-type of the frame's audience? All options must be subtypes of the same register.
   - Question 2 (axis: MOMENT) — when in the audience's journey is this person searching? Moments must fit the register (consumer journey vs. procurement journey, not mixed).
   - Question 3 (axis: CRITERIA) — what criteria drive the decision? Criteria must align with the register too.
5. Each question should be ~15-25 words, in natural conversational ${outputLang}, ending with a "?".
6. NEVER mix B2C and B2B options inside the same question.

❌ EXAMPLE OF WRONG (consumer perfume brand, topic="raw materials", goal="how consumers search info about quality raw materials in perfumes"):
   Frame audience_register = "B2B" → WRONG, the goal explicitly says consumers.
   Question 2 = "In which phase: startup sourcing, alternative suppliers, or routine restock?" → WRONG, all options are B2B procurement.

✅ EXAMPLE OF RIGHT for the same case:
   Frame audience_register = "B2C", audience = "premium fragrance consumer curious about ingredients".
   Question 2 = "When do these consumers care about raw-material quality: when choosing a gift, when looking for natural/organic options, or when comparing premium fragrances?"

Output ONLY the JSON object. No prose, no markdown.`;
}

function buildGeneraliFramePrompt(outputLang: string): string {
  return `You are an expert in brand marketing and AI visibility. Analyze the provided brand context and infer the brand's natural audience and journey. Then generate 3 short questions that help understand the brand better, all coherent with that audience.

Output a JSON object with this exact shape:
{
  "frame": {
    "audience": string,
    "audience_register": "B2C" | "B2B" | "prosumer" | "mixed",
    "search_moment_kind": string,
    "criteria_dimensions": string[],
    "rationale": string
  },
  "questions": [string, string, string]
}

The 3 questions must:
- Be in natural ${outputLang}, ~15-25 words each, ending with "?".
- Refer to REAL user purchasing behaviors of the inferred audience (not generic marketing-speak).
- Stay within the audience_register (don't mix B2C and B2B in the same question).

Output ONLY the JSON object.`;
}

/* ───────────────────────────────────────────────────────────────────────
 * Output parsing — tollera markdown fences e testo wrap accidentale
 * ─────────────────────────────────────────────────────────────────────── */

interface ParsedFrameOutput {
  frame: {
    audience?: string;
    audience_register?: string;
    search_moment_kind?: string;
    criteria_dimensions?: string[];
    rationale?: string;
  };
  questions: string[];
}

function parseFrameAndQuestions(raw: string): ParsedFrameOutput | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objMatch) return null;

  try {
    const obj = JSON.parse(objMatch[0]);
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.questions)) return null;
    return {
      frame: typeof obj.frame === "object" && obj.frame !== null ? obj.frame : {},
      questions: obj.questions,
    };
  } catch {
    return null;
  }
}
