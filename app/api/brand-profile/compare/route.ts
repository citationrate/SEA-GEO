import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import {
  bpComparePlanAllowed,
  BP_COMPARE_MIN_RUNS,
  BP_COMPARE_MAX_RUNS,
} from "@/lib/brand-profile/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .single();
  const plan = (profile?.plan as string | undefined)?.toLowerCase() ?? "demo";
  if (!bpComparePlanAllowed(plan)) {
    return apiError("Compare disponibile solo sui piani Pro/Enterprise", 402);
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("runIds") ?? "";
  const ids = Array.from(
    new Set(raw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s))),
  );
  if (ids.length < BP_COMPARE_MIN_RUNS || ids.length > BP_COMPARE_MAX_RUNS) {
    return apiError(
      `Servono da ${BP_COMPARE_MIN_RUNS} a ${BP_COMPARE_MAX_RUNS} run id validi`,
      400,
    );
  }

  const svc = createServiceClient();
  const bp = svc.schema("brand_profile" as any);

  const { data: runs, error: runsErr } = await (bp.from("runs") as any)
    .select("id, brand_name, sector, country, locale, status, completed_at, models")
    .in("id", ids)
    .eq("user_id", user.id);
  if (runsErr) return apiError(runsErr.message, 500);
  const ownedRuns = (runs as any[] | null) ?? [];
  if (ownedRuns.length !== ids.length) {
    return apiError("Una o più run non sono accessibili", 403);
  }

  const completed = ownedRuns.filter((r) => r.status === "completed");
  if (completed.length < BP_COMPARE_MIN_RUNS) {
    return apiError(
      `Almeno ${BP_COMPARE_MIN_RUNS} run devono essere completate`,
      400,
    );
  }

  const completedIds = completed.map((r) => r.id as string);

  const [{ data: scores }, { data: diagnostics }] = await Promise.all([
    (bp.from("scores") as any)
      .select("run_id, recognition, clarity, authority, relevance, sentiment, total, breakdown")
      .in("run_id", completedIds),
    (bp.from("diagnostics") as any)
      .select("run_id, pillar, cs_parameter_id, cs_status, note")
      .in("run_id", completedIds),
  ]);

  const scoresByRun = new Map<string, any>();
  for (const s of (scores ?? []) as any[]) scoresByRun.set(s.run_id, s);

  const diagByRun = new Map<string, any[]>();
  for (const d of (diagnostics ?? []) as any[]) {
    const arr = diagByRun.get(d.run_id) ?? [];
    arr.push(d);
    diagByRun.set(d.run_id, arr);
  }

  const orderedRuns = ids
    .map((id) => completed.find((r) => r.id === id))
    .filter((r): r is (typeof completed)[number] => Boolean(r));

  const compareItems = orderedRuns.map((r) => ({
    run: r,
    scores: scoresByRun.get(r.id) ?? null,
    diagnostics: diagByRun.get(r.id) ?? [],
  }));

  return NextResponse.json({ items: compareItems });
}
