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
  queries: z.array(z.object({
    text: z.string().min(1),
    set_type: z.enum(["generale", "verticale", "persona"]),
    funnel_stage: z.enum(["TOFU", "MOFU"]),
    persona_mode: z.enum(["demographic", "decision_drivers"]).optional(),
    persona_id: z.string().optional(),
  })),
  inputs: z.object({
    categoria: z.string().min(1),
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

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // Save generation inputs
    await (supabase.from("query_generation_inputs") as any).insert({
      project_id,
      ...inputs,
    });

    // Insert queries — only columns that exist: project_id, text, funnel_stage
    const rows = queries.map((q) => ({
      project_id,
      text: q.text,
      funnel_stage: q.funnel_stage.toLowerCase() as "tofu" | "mofu",
    }));

    const { error: dbError } = await supabase.from("queries").insert(rows as any);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: queries.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
