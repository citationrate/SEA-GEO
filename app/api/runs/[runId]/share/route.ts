import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  // Verify ownership
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, project_id, share_token")
    .eq("id", params.runId)
    .single();

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", (run as any).project_id)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // If already shared, return existing token
  if ((run as any).share_token) {
    return NextResponse.json({ token: (run as any).share_token });
  }

  const token = nanoid(16);
  const { error: dbError } = await (supabase.from("analysis_runs") as any)
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq("id", params.runId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ token });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, project_id")
    .eq("id", params.runId)
    .single();

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", (run as any).project_id)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: dbError } = await (supabase.from("analysis_runs") as any)
    .update({ share_token: null, shared_at: null })
    .eq("id", params.runId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
