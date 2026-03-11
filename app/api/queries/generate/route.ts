import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const personaSchema = z.object({
  id: z.string(),
  mode: z.enum(["demographic", "decision_drivers"]),
  zona: z.string().optional(),
  contesto_uso: z.string().optional(),
  ruolo: z.string().optional(),
  priorita: z.string().optional(),
  must_have: z.string().optional(),
  no_go: z.string().optional(),
});

const bodySchema = z.object({
  project_id: z.string().uuid(),
  queries: z.array(z.object({
    text: z.string().min(1),
    set_type: z.enum(["generale", "verticale", "persona"]),
    layer: z.enum(["A", "B", "C"]),
    funnel: z.enum(["TOFU", "MOFU"]),
    persona_mode: z.enum(["demographic", "decision_drivers"]).optional(),
    persona_id: z.string().optional(),
  })),
  inputs: z.object({
    categoria: z.string().min(1),
    mercato: z.string().optional(),
    use_cases: z.array(z.string()).default([]),
    criteri: z.array(z.string()).default([]),
    must_have: z.array(z.string()).default([]),
    vincoli: z.string().optional(),
    obiezioni: z.string().optional(),
    linguaggio_mercato: z.string().optional(),
    ruolo: z.string().optional(),
    dimensione_azienda: z.string().optional(),
    personas_enabled: z.boolean().default(false),
    personas: z.array(personaSchema).default([]),
  }),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

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
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // Save generation inputs
    await (supabase.from("query_generation_inputs") as any).insert({
      project_id,
      ...inputs,
    });

    // Insert queries
    const rows = queries.map((q) => ({
      project_id,
      text: q.text,
      funnel_stage: q.funnel.toLowerCase() as "tofu" | "mofu",
      set_type: q.set_type,
      layer: q.layer,
      funnel: q.funnel,
      persona_mode: q.persona_mode || null,
      persona_id: q.persona_id || null,
    }));

    const { error } = await supabase.from("queries").insert(rows as any);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: rows.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
