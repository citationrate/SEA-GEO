import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest";
import { apiError, requireAuth } from "@/lib/api-helpers";
import { BRAND_PROFILE_START_EVENT } from "@/lib/brand-profile/inngest";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpAccessAllowed, bpModelsForPlan } from "@/lib/brand-profile/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_RUN_LIMITS: Record<string, number> = {
  demo: 1,
  free: 1,
  base: 3,
  pro: 10,
  agency: 10,
  enterprise: 999,
};

const StartSchema = z.object({
  brand: z.string().trim().min(2).max(120),
  brand_url: z.string().trim().url(),
  sector: z.string().trim().min(2).max(120),
  country: z.string().trim().toUpperCase().refine((c) => ["IT", "US", "GB", "ES", "FR", "DE"].includes(c)),
  locale: z.enum(["it", "en", "fr", "de", "es"]).default("it"),
  // models removed from the wizard — the server picks the pool by plan via
  // bpModelsForPlan(). Schema stays silent on this field for forward compat.
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let payload: z.infer<typeof StartSchema>;
  try {
    payload = StartSchema.parse(await request.json());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Payload non valido", 400);
  }

  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan, is_admin")
    .eq("id", user.id)
    .single();

  // Soft-launch gate (mirrors the (brand-profile)/layout.tsx check).
  if (!bpAccessAllowed({ email: user.email, isAdmin: (profile as any)?.is_admin })) {
    return apiError("Brand Profile non disponibile durante il soft launch", 403);
  }

  const plan = (profile?.plan as string | undefined)?.toLowerCase() ?? "demo";
  const maxRuns = PLAN_RUN_LIMITS[plan] ?? 0;
  const models = bpModelsForPlan(plan);

  if (maxRuns === 0) {
    return apiError("Brand Profile non disponibile sul tuo piano", 402);
  }
  if (models.length === 0) {
    return apiError("Nessun modello disponibile per il tuo piano", 402);
  }

  const { data: rpcResult, error: rpcErr } = await (cr as any).rpc("try_consume_brand_profile", {
    p_user_id: user.id,
    p_max_runs: maxRuns,
  });
  if (rpcErr) return apiError(`RPC error: ${rpcErr.message}`, 500);
  if (!rpcResult?.allowed) {
    return apiError("Quota Brand Profile esaurita per questo ciclo", 402);
  }

  const { data: run, error: insertErr } = await (
    (await import("@/lib/supabase/service")).createServiceClient().schema("brand_profile" as any).from("runs") as any
  )
    .insert({
      user_id: user.id,
      brand_name: payload.brand,
      brand_url: payload.brand_url,
      sector: payload.sector,
      country: payload.country,
      locale: payload.locale,
      models,
      plan_at_run: plan,
      status: "pending",
      total_prompts: 15 * models.length,
    })
    .select("id")
    .single();

  if (insertErr || !run) {
    return apiError(`Insert run failed: ${insertErr?.message ?? "unknown"}`, 500);
  }

  await inngest.send({
    name: BRAND_PROFILE_START_EVENT,
    data: {
      runId: run.id,
      userId: user.id,
      brand: payload.brand,
      brandUrl: payload.brand_url,
      sector: payload.sector,
      country: payload.country,
      locale: payload.locale,
      models,
    },
  });

  return NextResponse.json({ runId: run.id, status: "pending" });
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const svc = (await import("@/lib/supabase/service")).createServiceClient();
  const { data: runs, error: queryErr } = await (svc.schema("brand_profile" as any).from("runs") as any)
    .select("id, brand_name, sector, country, status, started_at, completed_at, total_prompts")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  if (queryErr) return apiError(queryErr.message, 500);
  return NextResponse.json(
    { runs: runs ?? [] },
    { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } },
  );
}
