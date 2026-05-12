import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const svc = createServiceClient();
  const bp = svc.schema("brand_profile" as any);

  const { data: run } = await (bp.from("runs") as any)
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!run) return apiError("Run non trovata", 404);

  const [{ data: scores }, { data: diagnostics }, { data: insights }, { count: completedPrompts }] = await Promise.all([
    (bp.from("scores") as any).select("*").eq("run_id", params.id).maybeSingle(),
    (bp.from("diagnostics") as any).select("*").eq("run_id", params.id),
    (bp.from("insights") as any).select("*").eq("run_id", params.id),
    (bp.from("prompt_results") as any)
      .select("id", { count: "exact", head: true })
      .eq("run_id", params.id),
  ]);

  return NextResponse.json(
    {
      run,
      scores: scores ?? null,
      diagnostics: diagnostics ?? [],
      insights: insights ?? [],
      progress: {
        completed: Number(completedPrompts ?? 0),
        total: Number((run as any)?.total_prompts ?? 0),
      },
    },
    { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const svc = createServiceClient();
  const bp = svc.schema("brand_profile" as any);

  const { data: run } = await (bp.from("runs") as any)
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!run) return apiError("Run non trovata", 404);

  const { error: delErr } = await (bp.from("runs") as any)
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (delErr) return apiError(`Delete failed: ${delErr.message}`, 500);

  return NextResponse.json({ ok: true });
}
