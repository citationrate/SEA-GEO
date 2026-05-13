import { redirect } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import {
  bpHistoryPlanAllowed,
  bpTimeSeriesAllowed,
} from "@/lib/brand-profile/plans";
import { HistoryClient } from "./history-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Storico — Brand Profile" };

export default async function BrandProfileHistoryPage() {
  const auth = createServerClient();
  // SECURITY: getUser() validates the JWT; getSession() only reads the cookie
  // and can return a stale identity after cross-account handoffs.
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const cr = createCitationRateServiceClient();
  const { data: profile } = await (cr.from("profiles") as any)
    .select("plan")
    .eq("id", user.id)
    .single();
  const plan = (profile?.plan as string | undefined)?.toLowerCase() ?? "demo";
  if (!bpHistoryPlanAllowed(plan)) redirect("/brand-profile");
  const showTimeSeries = bpTimeSeriesAllowed(plan);

  const data = createDataClient();
  const bp = data.schema("brand_profile" as any);

  const { data: runs } = await (bp.from("runs") as any)
    .select("id, brand_name, sector, country, locale, status, completed_at, started_at, models")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(200);

  const completedIds = ((runs as any[] | null) ?? [])
    .filter((r) => r.status === "completed")
    .map((r) => r.id as string);

  const { data: scores } = completedIds.length > 0
    ? await (bp.from("scores") as any)
        .select("run_id, recognition, clarity, authority, relevance, sentiment, total")
        .in("run_id", completedIds)
    : { data: [] as any[] };

  const scoresByRun = new Map<string, any>();
  for (const s of (scores ?? []) as any[]) scoresByRun.set(s.run_id, s);

  const items = ((runs as any[] | null) ?? []).map((r) => ({
    id: r.id as string,
    brand_name: r.brand_name as string,
    sector: r.sector as string,
    country: r.country as string,
    locale: r.locale as string,
    status: r.status as string,
    completed_at: r.completed_at as string | null,
    started_at: r.started_at as string,
    models: (r.models as string[] | null) ?? [],
    scores: scoresByRun.get(r.id) ?? null,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <HistoryClient items={items} showTimeSeries={showTimeSeries} />
    </div>
  );
}
