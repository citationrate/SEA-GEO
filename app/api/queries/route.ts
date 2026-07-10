import { requireAuth } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  project_id: z.string().uuid(),
  argomento_id: z.string().uuid(),
  text: z.string().min(1),
  funnel_stage: z.enum(["tofu", "mofu", "bofu"]),
});

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });
    const argomentoId = request.nextUrl.searchParams.get("argomento_id");

    // Le query soft-deleted (deleted_at IS NOT NULL) sono nascoste dalla
    // dashboard di gestione. Lo storico delle run e gli export le pescano
    // direttamente dalle proprie API senza usare questo handler, quindi
    // filtrare qui non rompe i grafici/report storici.
    let q = (supabase.from("queries") as any)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (argomentoId) q = q.eq("argomento_id", argomentoId);
    const { data, error: dbError } = await q;

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    // Duplicate check considera ANCHE le soft-deleted: se l'utente aveva
    // cancellato una query e ora la rigita identica, riusciamo la stessa
    // riga (revive) invece di rifiutare con 409 — UX più gentile e mantiene
    // l'integrità con lo storico (mantiene lo stesso id, niente duplicati).
    const { data: existing } = await supabase
      .from("queries")
      .select("id, deleted_at")
      .eq("project_id", parsed.data.project_id)
      .ilike("text", parsed.data.text.trim());
    const liveDup = (existing ?? []).find((q: any) => !q.deleted_at);
    if (liveDup) {
      return NextResponse.json({ error: "Questa query esiste già nel progetto" }, { status: 409 });
    }
    const deadDup = (existing ?? []).find((q: any) => q.deleted_at) as any;
    if (deadDup) {
      const svc = createServiceClient();
      const { data: revived, error: reviveErr } = await (svc.from("queries") as any)
        .update({ deleted_at: null, is_active: true, funnel_stage: parsed.data.funnel_stage })
        .eq("id", deadDup.id)
        .select("*")
        .single();
      if (reviveErr) return NextResponse.json({ error: reviveErr.message }, { status: 500 });
      return NextResponse.json(revived, { status: 201 });
    }

    const { data, error: dbError } = await supabase
      .from("queries")
      .insert({ ...parsed.data, set_type: "manual" } as any)
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { id, is_active, text } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (typeof is_active !== "boolean" && (typeof text !== "string" || !text.trim())) {
      return NextResponse.json({ error: "must update is_active or text" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof is_active === "boolean") patch.is_active = is_active;
    if (typeof text === "string" && text.trim()) patch.text = text.trim();

    // Use service client to bypass RLS
    const svc = createServiceClient();
    const { error: dbError } = await (svc.from("queries") as any)
      .update(patch)
      .eq("id", id);

    if (dbError) {
      console.error("[queries PATCH] error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[queries PATCH] crash:", err?.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

    // Soft delete: prompts_executed.query_id ha FK NO ACTION verso queries(id),
    // quindi un DELETE fisico fallisce sempre con foreign_key_violation per ogni
    // query già usata in almeno una run. Marcare deleted_at preserva lo storico
    // (run detail / export continuano a vedere il testo) e rimuove la query
    // dalle viste attive (GET, dashboard, pipeline di analisi).
    const svc = createServiceClient();
    const { error: dbError } = await (svc.from("queries") as any)
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null); // idempotente: no-op se già soft-deleted
    if (dbError) {
      console.error("[queries DELETE] error:", dbError.message, dbError.code);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[queries DELETE] crash:", err?.message);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
