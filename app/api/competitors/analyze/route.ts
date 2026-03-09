import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

const bodySchema = z.object({
  project_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[competitors/analyze] No authenticated user");
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      console.error("[competitors/analyze] Invalid body:", parsed.error.flatten());
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    const { project_id } = parsed.data;
    console.log("[competitors/analyze] called for project:", project_id, "by user:", user.id);

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();
    if (projectError) {
      console.error("[competitors/analyze] project query error:", projectError.message);
    }
    if (!project) {
      console.error("[competitors/analyze] Project not found or not owned:", project_id);
      return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
    }

    // Get all competitors for this project
    console.log("[competitors/analyze] projectId received:", project_id);
    const { data: competitors, error: compError } = await supabase
      .from("competitors")
      .select("*")
      .eq("project_id", project_id);

    if (compError) {
      console.error("[competitors/analyze] competitors query error:", compError.message, compError);
    }
    console.log("[competitors/analyze] competitors query result:", competitors?.length, competitors?.map((c: any) => c.name));

    if (!competitors?.length) {
      return NextResponse.json({ error: "Nessun competitor trovato" }, { status: 400 });
    }

    // Get all runs for this project
    const { data: runs } = await supabase
      .from("analysis_runs")
      .select("id")
      .eq("project_id", project_id);
    const runIds = (runs ?? []).map((r: any) => r.id);
    console.log("[competitors/analyze] runs found:", runIds.length);

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
    console.log("[competitors/analyze] prompts with responses:", promptIds.length);

    if (!promptIds.length) {
      return NextResponse.json({ error: "Nessuna risposta disponibile" }, { status: 400 });
    }

    // Get response_analysis to find which prompts mention which competitors
    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("prompt_executed_id, competitors_found")
      .in("prompt_executed_id", promptIds);

    console.log("[competitors/analyze] analyses found:", (analyses ?? []).length);

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

    console.log("[competitors/analyze] compTexts keys:", Array.from(compTexts.keys()).slice(0, 5));

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("[competitors/analyze] OPENAI_API_KEY is not set!");
      return NextResponse.json({ error: "API key OpenAI non configurata" }, { status: 500 });
    }

    // Analyze each competitor with GPT-4o-mini
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const results: { id: string; name: string; analysis: any }[] = [];

    for (const comp of competitors as any[]) {
      const key = comp.name.toLowerCase().trim();
      const texts = compTexts.get(key);
      console.log(`[competitors/analyze] competitor "${comp.name}" (key="${key}"): ${texts?.length ?? 0} texts`);

      if (!texts?.length) {
        results.push({ id: comp.id, name: comp.name, analysis: { macro_themes: [], positioning_summary: "Nessun contesto disponibile per l'analisi." } });
        continue;
      }

      // Limit to max 10 responses to keep prompt size manageable
      const sampledTexts = texts.length > 10
        ? texts.sort(() => Math.random() - 0.5).slice(0, 10)
        : texts;

      // Truncate each response to ~500 chars
      const truncated = sampledTexts.map((t, i) => `[Risposta ${i + 1}]: ${t.slice(0, 500)}`).join("\n\n");

      const prompt = `Analizza questi testi in cui il brand "${comp.name}" viene menzionato e identifica i macro-temi ricorrenti per cui viene citato. Restituisci SOLO un JSON così:
{
  "macro_themes": [
    {
      "theme": "nome macro tema (es. Comfort e Vestibilità)",
      "description": "breve descrizione di come il brand viene associato a questo tema",
      "keywords": ["parola1", "parola2", "parola3"],
      "frequency": numero da 1 a 10
    }
  ],
  "positioning_summary": "una frase che riassume come le AI posizionano questo brand"
}
Massimo 5 macro temi. Temi concreti e significativi, non generici.

Testi:
${truncated}`;

      try {
        console.log(`[competitors/analyze] calling OpenAI for competitor: "${comp.name}"`);
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = completion.choices[0]?.message?.content ?? "";
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

        console.log(`[competitors/analyze] success for "${comp.name}": ${analysis.macro_themes?.length ?? 0} themes`);
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

    console.log(`[competitors/analyze] done: ${results.length} analyzed, ${saveErrors} save errors`);
    return NextResponse.json({ success: true, analyzed: results.length, saveErrors });
  } catch (err) {
    console.error("[competitors/analyze] unexpected error:", err instanceof Error ? err.stack : err);
    return NextResponse.json({ error: `Errore interno: ${err instanceof Error ? err.message : "errore sconosciuto"}` }, { status: 500 });
  }
}
