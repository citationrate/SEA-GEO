import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const personaSchema = z.object({
  id: z.string(),
  nome: z.string().optional(),
  prompt_context: z.string().optional(),
  persona_attributes: z.record(z.unknown()).optional(),
  // Legacy fields
  mode: z.enum(["demographic", "decision_drivers"]).optional(),
  eta: z.string().optional(),
  sesso: z.string().optional(),
  situazione: z.string().optional(),
  ruolo: z.string().optional(),
  settore: z.string().optional(),
  problema: z.string().optional(),
  must_have: z.string().optional(),
  no_go: z.string().optional(),
}).passthrough();

const bodySchema = z.object({
  project_id: z.string().uuid(),
  argomento_id: z.string().uuid().optional(),
  queries: z.array(z.object({
    text: z.string().min(1),
    set_type: z.enum(["generale", "verticale", "persona", "branded"]),
    funnel_stage: z.enum(["TOFU", "MOFU"]),
    persona_mode: z.enum(["demographic", "decision_drivers"]).optional(),
    persona_id: z.string().optional(),
  })),
  inputs: z.object({
    categoria: z.string().default(""),
    mode: z.enum(["generali", "specifiche"]).optional(),
    theme: z.string().optional(),
    theme_context: z.string().optional(),
    mercato: z.string().optional(),
    luogo: z.string().optional(),
    punti_di_forza: z.array(z.string()).default([]),
    competitor: z.array(z.string()).default([]),
    obiezioni: z.array(z.string()).default([]),
    ai_answers: z.array(z.string()).default([]),
    // Legacy fields
    use_cases: z.array(z.string()).default([]),
    criteri: z.array(z.string()).default([]),
    must_have: z.array(z.string()).default([]),
    vincoli: z.string().optional(),
    linguaggio_mercato: z.string().optional(),
    ruolo: z.string().optional(),
    dimensione_azienda: z.string().optional(),
    personas_enabled: z.boolean().default(false),
    personas: z.array(personaSchema).default([]),
  }),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    const { project_id, queries, inputs } = parsed.data;

    // Verify project ownership + load fields needed to fill missing categoria.
    const { data: project } = await supabase
      .from("projects")
      .select("id, sector, site_analysis")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // In modalità "specifiche" l'utente NON compila categoria (compila solo
    // theme). Per non bloccare il salvataggio, prendiamo la categoria dal
    // progetto: prima il sector dichiarato, poi quello dedotto da
    // site_analysis. Se neanche quello esiste, ripieghiamo sul theme.
    const projAny = project as any;
    if (!inputs.categoria || inputs.categoria.trim().length === 0) {
      const fallback =
        projAny.sector ??
        projAny.site_analysis?.main_service ??
        (Array.isArray(projAny.site_analysis?.sector_keywords)
          ? projAny.site_analysis.sector_keywords[0]
          : null) ??
        inputs.theme ??
        "";
      inputs.categoria = String(fallback).trim();
    }

    // Save generation inputs
    await (supabase.from("query_generation_inputs") as any).insert({
      project_id,
      ...inputs,
    });

    // Dedup contro le query esistenti nel progetto. Distinguiamo:
    //   - LIVE duplicates (deleted_at NULL) → skip totalmente
    //   - DEAD duplicates (deleted_at NOT NULL) → revive senza re-inserire,
    //     così non perdiamo lo storico né creiamo righe orfane.
    const { data: existing } = await supabase
      .from("queries")
      .select("id, text, deleted_at")
      .eq("project_id", project_id);
    const liveTexts = new Set(
      (existing ?? []).filter((r: any) => !r.deleted_at).map((r: any) => r.text.trim().toLowerCase()),
    );
    const deadMap = new Map(
      (existing ?? [])
        .filter((r: any) => r.deleted_at)
        .map((r: any) => [r.text.trim().toLowerCase(), r.id]),
    );

    const toRevive: string[] = [];
    const toInsert: typeof queries = [];
    for (const q of queries) {
      const key = q.text.trim().toLowerCase();
      if (liveTexts.has(key)) continue; // skip: già attiva
      const deadId = deadMap.get(key);
      if (deadId) toRevive.push(deadId as string);
      else toInsert.push(q);
    }

    if (toRevive.length === 0 && toInsert.length === 0) {
      return NextResponse.json({ error: "Tutte le query esistono già nel progetto" }, { status: 409 });
    }

    if (toRevive.length > 0) {
      // Cast as any: supabase typed client non conosce ancora deleted_at
      // (verrà aggiornato dopo aver applicato la migration 042).
      const { error: reviveErr } = await (supabase.from("queries") as any)
        .update({ deleted_at: null, is_active: true })
        .in("id", toRevive);
      if (reviveErr) return NextResponse.json({ error: reviveErr.message }, { status: 500 });
    }

    // Resolve argomento_id: from body or default
    let argomentoId = parsed.data.argomento_id;
    if (!argomentoId) {
      const { data: argList } = await (supabase.from("argomenti") as any)
        .select("id").eq("project_id", project_id).is("deleted_at", null)
        .order("created_at", { ascending: true }).limit(1);
      argomentoId = argList?.[0]?.id;
    }

    // Insert queries with full metadata (set_type, persona_id, persona_mode)
    const rows = toInsert.map((q) => ({
      project_id,
      argomento_id: argomentoId,
      text: q.text,
      funnel_stage: q.funnel_stage.toLowerCase() as "tofu" | "mofu",
      set_type: q.set_type,
      ...(q.persona_id ? { persona_id: q.persona_id } : {}),
      ...(q.persona_mode ? { persona_mode: q.persona_mode } : {}),
    }));

    const { error: dbError } = rows.length > 0
      ? await supabase.from("queries").insert(rows as any)
      : { error: null };

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    const processed = toInsert.length + toRevive.length;
    const skipped = queries.length - processed;
    return NextResponse.json({ ok: true, count: processed, skipped }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
