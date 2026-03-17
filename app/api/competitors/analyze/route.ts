import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const bodySchema = z.object({
  project_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    const { project_id } = parsed.data;

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, language")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
    }

    const projectLang = (project as any).language ?? "it";
    const langLabel = projectLang === "en" ? "English" : projectLang === "fr" ? "French" : projectLang === "de" ? "German" : projectLang === "es" ? "Spanish" : "Italian";

    // Get all competitors for this project
    const { data: competitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("project_id", project_id);

    if (!competitors?.length) {
      return NextResponse.json({ error: "Nessun competitor trovato" }, { status: 400 });
    }

    // Get all active runs for this project
    const { data: runs } = await supabase
      .from("analysis_runs")
      .select("id")
      .eq("project_id", project_id)
      .is("deleted_at", null);
    const runIds = (runs ?? []).map((r: any) => r.id);

    if (!runIds.length) {
      return NextResponse.json({ error: "Nessuna analisi eseguita" }, { status: 400 });
    }

    // Get all prompts for these runs
    const { data: prompts } = await supabase
      .from("prompts_executed")
      .select("id, raw_response")
      .in("run_id", runIds)
      .not("raw_response", "is", null);

    const promptIds = (prompts ?? []).map((p: any) => p.id);
    const promptResponseMap = new Map((prompts ?? []).map((p: any) => [p.id, p.raw_response as string]));

    if (!promptIds.length) {
      return NextResponse.json({ error: "Nessuna risposta disponibile" }, { status: 400 });
    }

    // Get response_analysis to find which prompts mention which competitors
    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("prompt_executed_id, competitors_found")
      .in("prompt_executed_id", promptIds);

    // Build map: competitor name -> list of raw_response texts (case-insensitive)
    const compTexts = new Map<string, string[]>();
    (analyses ?? []).forEach((a: any) => {
      const response = promptResponseMap.get(a.prompt_executed_id);
      if (!response) return;
      (a.competitors_found ?? []).forEach((name: string) => {
        const key = name.toLowerCase().trim();
        if (!compTexts.has(key)) compTexts.set(key, []);
        compTexts.get(key)!.push(response);
      });
    });

    // Check Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key Anthropic non configurata" }, { status: 500 });
    }

    // Analyze each competitor with Claude Haiku
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const results: { id: string; name: string; analysis: any }[] = [];

    for (const comp of competitors as any[]) {
      const key = comp.name.toLowerCase().trim();
      const texts = compTexts.get(key);
      if (!texts?.length) {
        results.push({ id: comp.id, name: comp.name, analysis: { macro_themes: [], positioning_summary: projectLang === "en" ? "No context available for analysis." : "Nessun contesto disponibile per l'analisi." } });
        continue;
      }

      // Limit to max 10 responses to keep prompt size manageable
      const sampledTexts = texts.length > 10
        ? texts.sort(() => Math.random() - 0.5).slice(0, 10)
        : texts;

      // Truncate each response to ~500 chars
      const truncated = sampledTexts.map((t, i) => `[Response ${i + 1}]: ${t.slice(0, 500)}`).join("\n\n");

      const prompt = `Analyze these texts where the brand "${comp.name}" is mentioned and identify the recurring macro-themes for which it is cited.
IMPORTANT: All theme names, descriptions, keywords, and the positioning summary MUST be in ${langLabel}.

Return ONLY a JSON like this:
{
  "macro_themes": [
    {
      "theme": "macro theme name (in ${langLabel})",
      "description": "brief description of how the brand is associated with this theme (in ${langLabel})",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "frequency": number from 1 to 10
    }
  ],
  "positioning_summary": "one sentence summarizing how AIs position this brand (in ${langLabel})"
}
Maximum 5 macro themes. Concrete and meaningful themes, not generic.

Texts:
${truncated}`;

      try {
        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          temperature: 0.3,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
        // Extract JSON from response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        let analysis: any = { macro_themes: [], positioning_summary: "" };

        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (parseErr) {
            console.error(`[competitors/analyze] JSON parse error for "${comp.name}":`, parseErr instanceof Error ? parseErr.message : parseErr);
            analysis = { macro_themes: [], positioning_summary: raw.slice(0, 200) };
          }
        }

        // Save raw_excerpts for each theme's keywords so drawer can show examples
        if (analysis.macro_themes) {
          for (const theme of analysis.macro_themes) {
            const excerpts: string[] = [];
            const keywords = (theme.keywords ?? []).map((k: string) => k.toLowerCase());
            for (const text of sampledTexts) {
              if (excerpts.length >= 3) break;
              const lower = text.toLowerCase();
              if (keywords.some((kw: string) => lower.includes(kw))) {
                for (const kw of keywords) {
                  const idx = lower.indexOf(kw);
                  if (idx >= 0) {
                    const start = Math.max(0, idx - 80);
                    const end = Math.min(text.length, idx + kw.length + 120);
                    excerpts.push((start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : ""));
                    break;
                  }
                }
              }
            }
            theme.excerpts = excerpts;
          }
        }

        results.push({ id: comp.id, name: comp.name, analysis });
      } catch (err) {
        console.error(`[competitors/analyze] OpenAI error for "${comp.name}":`, err instanceof Error ? err.message : err);
        results.push({
          id: comp.id,
          name: comp.name,
          analysis: { macro_themes: [], positioning_summary: `Errore: ${err instanceof Error ? err.message : "errore sconosciuto"}` },
        });
      }
    }

    // Save results to DB
    let saveErrors = 0;
    for (const result of results) {
      const { error: updateErr } = await (supabase.from("competitors") as any)
        .update({ theme_analysis: result.analysis })
        .eq("id", result.id);
      if (updateErr) {
        console.error(`[competitors/analyze] DB update error for "${result.name}":`, updateErr.message);
        saveErrors++;
      }
    }

    return NextResponse.json({ success: true, analyzed: results.length, saveErrors });
  } catch (err) {
    console.error("[competitors/analyze] unexpected error:", err instanceof Error ? err.stack : err);
    return NextResponse.json({ error: `Errore interno: ${err instanceof Error ? err.message : "errore sconosciuto"}` }, { status: 500 });
  }
}
