import { redirect, notFound } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { bpComparePlanAllowed } from "@/lib/brand-profile/plans";
import { BrandProfileReport } from "./report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrandProfileRunPage({ params }: { params: { id: string } }) {
  const auth = createServerClient();
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const cr = createCitationRateServiceClient();
  const { data: crProfile } = await (cr.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .single();
  const canExport = bpComparePlanAllowed((crProfile?.plan as string | undefined) ?? "demo");

  const data = createDataClient();
  const bp = data.schema("brand_profile" as any);

  const { data: run } = await (bp.from("runs") as any)
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!run) notFound();

  const [{ data: scores }, { data: insights }, { data: prompts }, { data: diagnostics }] = await Promise.all([
    (bp.from("scores") as any).select("*").eq("run_id", params.id).maybeSingle(),
    (bp.from("insights") as any)
      .select("pillar, insight_text")
      .eq("run_id", params.id),
    (bp.from("prompt_results") as any)
      .select("pillar, prompt_index, prompt_text, model, response_raw, brand_mentioned, error_message")
      .eq("run_id", params.id)
      .order("pillar")
      .order("prompt_index"),
    (bp.from("diagnostics") as any)
      .select("pillar, cs_parameter_id, cs_status, cs_audit_id, cs_audit_date, note")
      .eq("run_id", params.id),
  ]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <BrandProfileReport
        runId={params.id}
        initialRun={run as any}
        initialScores={scores as any}
        initialInsights={(insights as any) ?? []}
        initialPrompts={(prompts as any) ?? []}
        initialDiagnostics={(diagnostics as any) ?? []}
        canExport={canExport}
      />
    </div>
  );
}
