import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.id)
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
