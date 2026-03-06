// Deploy 2026-03-06
import { createServiceClient } from "@/lib/supabase/server";
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
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    const { data, error } = await supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = segmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { data, error } = await supabase
      .from("audience_segments")
      .insert(parsed.data as any)
      .select("*")
      .single();

    if (error) {
      console.error("[segments POST] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[segments POST] Unexpected error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { id, ...updates } = parsed.data;
    const { data, error } = await (supabase
      .from("audience_segments") as any)
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

    const { error } = await supabase
      .from("audience_segments")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
