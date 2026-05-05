import { redirect, notFound } from "next/navigation";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { BrandProfileReport } from "./report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrandProfileRunPage({ params }: { params: { id: string } }) {
  const auth = createServerClient();
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const data = createDataClient();
  const bp = data.schema("brand_profile" as any);

  const { data: run } = await (bp.from("runs") as any)
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!run) notFound();

  const { data: scores } = await (bp.from("scores") as any)
    .select("*")
    .eq("run_id", params.id)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-[1400px]">
      <BrandProfileReport
        runId={params.id}
        initialRun={run as any}
        initialScores={scores as any}
      />
    </div>
  );
}
