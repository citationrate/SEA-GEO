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

  const [{ data: scores }, { data: diagnostics }, { data: insights }] = await Promise.all([
    (bp.from("scores") as any).select("*").eq("run_id", params.id).maybeSingle(),
    (bp.from("diagnostics") as any).select("*").eq("run_id", params.id),
    (bp.from("insights") as any).select("*").eq("run_id", params.id),
  ]);

  return NextResponse.json({
    run,
    scores: scores ?? null,
    diagnostics: diagnostics ?? [],
    insights: insights ?? [],
  });
}
