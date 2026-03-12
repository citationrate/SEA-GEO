import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  return NextResponse.json(project);
}

const updateSchema = z.object({
  name: z.string().min(1, "Nome progetto obbligatorio"),
  target_brand: z.string().min(1, "Brand target obbligatorio"),
  website_url: z.string().min(1, "Sito web obbligatorio"),
  sector: z.string().nullable().default(null),
  brand_type: z.string().nullable().default(null),
  market_context: z.string().nullable().default(null),
  language: z.enum(["it", "en"]),
  country: z.string().nullable().default(null),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.id)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const body = await request.json();

  // Handle restore action
  if (body.restore === true) {
    const { error } = await (supabase.from("projects") as any)
      .update({ deleted_at: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error } = await (supabase.from("projects") as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Verify project belongs to user and is not already deleted
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  // Soft delete: set deleted_at instead of deleting
  const { error } = await (supabase.from("projects") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
