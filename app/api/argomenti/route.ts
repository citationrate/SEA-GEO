import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// ── GET — lista argomenti di un progetto ──────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    const { data, error: dbError } = await (supabase.from("argomenti") as any)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

// ── POST — crea nuovo argomento ───────────────────────────────────────────
const createSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    // Verifica che il progetto appartenga all'utente
    const { data: proj } = await (supabase.from("projects") as any)
      .select("id")
      .eq("id", parsed.data.project_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!proj) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // Verifica nome duplicato
    const { data: existing } = await (supabase.from("argomenti") as any)
      .select("id")
      .eq("project_id", parsed.data.project_id)
      .ilike("name", parsed.data.name.trim())
      .is("deleted_at", null);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Un argomento con questo nome esiste già" }, { status: 409 });
    }

    const { data, error: dbError } = await (supabase.from("argomenti") as any)
      .insert({
        project_id: parsed.data.project_id,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
      })
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

// ── PATCH — aggiorna nome/descrizione ─────────────────────────────────────
const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const updates: Record<string, string> = {};
    if (parsed.data.name) updates.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) updates.description = parsed.data.description.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
    }

    const { data, error: dbError } = await (supabase.from("argomenti") as any)
      .update(updates)
      .eq("id", parsed.data.id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Argomento non trovato" }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

// ── DELETE — soft delete (blocca se ha run) ───────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

    // Blocca eliminazione se l'argomento ha run
    const { data: runs } = await (supabase.from("analysis_runs") as any)
      .select("id")
      .eq("argomento_id", id)
      .is("deleted_at", null)
      .limit(1);
    if (runs && runs.length > 0) {
      return NextResponse.json({ error: "Non puoi eliminare un argomento con analisi eseguite" }, { status: 409 });
    }

    const { error: dbError } = await (supabase.from("argomenti") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
