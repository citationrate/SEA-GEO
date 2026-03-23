import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  project_id: z.string().uuid(),
  text: z.string().min(1),
  funnel_stage: z.enum(["tofu", "mofu", "bofu"]),
});

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });

    const { data, error: dbError } = await supabase
      .from("queries")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

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

    const { data, error: dbError } = await supabase
      .from("queries")
      .insert(parsed.data as any)
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
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

    const { error: dbError } = await supabase.from("queries").delete().eq("id", id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
