import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the most-recent COMPLETED BP run for the same user + brand_name
 * that started strictly BEFORE the current run. Used by report.tsx to
 * compute Δ-vs-previous on the 5 pillars and surface the variability
 * banner when at least one pillar deviates by more than 10 pts.
 *
 * Query params:
 *   brand_name (required) — must match the current run's brand_name
 *   before     (required) — current run id, used to exclude self
 */
export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const brandName = (searchParams.get("brand_name") ?? "").trim();
  const before = (searchParams.get("before") ?? "").trim();
  if (!brandName || !before) return apiError("brand_name and before are required", 400);

  const svc = createServiceClient();
  const bp = svc.schema("brand_profile" as any);

  // 1) Find started_at of the current run (we'll filter older runs by it)
  const { data: current } = await (bp.from("runs") as any)
    .select("started_at")
    .eq("id", before)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ scores: null });

  // 2) Get the previous completed run for same brand_name
  const { data: prev } = await (bp.from("runs") as any)
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("brand_name", brandName)
    .eq("status", "completed")
    .lt("started_at", current.started_at)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return NextResponse.json({ scores: null });

  // 3) Pull its scores row
  const { data: scores } = await (bp.from("scores") as any)
    .select("recognition, clarity, authority, relevance, sentiment, total")
    .eq("run_id", prev.id)
    .maybeSingle();

  return NextResponse.json(
    { scores: scores ?? null, prev_run_id: prev.id, prev_started_at: prev.started_at },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
