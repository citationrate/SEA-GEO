import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify run belongs to user's project
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

  // Check action: delete or restore
  const body = await _req.json().catch(() => ({}));
  const restore = body.restore === true;

  const { error } = await (supabase.from("analysis_runs") as any)
    .update({ deleted_at: restore ? null : new Date().toISOString() })
    .eq("id", params.runId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
