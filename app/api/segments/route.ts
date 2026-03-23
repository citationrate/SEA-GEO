// Deploy 2026-03-06
import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const segmentSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  label: z.string().min(1),
  prompt_context: z.string().min(1),
  is_active: z.boolean().default(true),
  persona_attributes: z.record(z.any()).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  prompt_context: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  persona_attributes: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    const { data, error: dbError } = await supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

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
    const parsed = segmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { data, error: dbError } = await supabase
      .from("audience_segments")
      .insert(parsed.data as any)
      .select("*")
      .single();

    if (dbError) {
      console.error("[segments POST] Supabase error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[segments POST] Unexpected error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { id, ...updates } = parsed.data;
    const { data, error: dbError } = await (supabase
      .from("audience_segments") as any)
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

    const { error: dbError } = await supabase
      .from("audience_segments")
      .delete()
      .eq("id", id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
