import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

/**
 * Cancel an in-flight run.
 *
 * The Inngest pipeline (lib/inngest-functions.ts) re-fetches the run status
 * at each step boundary: as soon as we set status="cancelled" here, the
 * pipeline aborts on its next checkpoint. Crediti già consumati fino a quel
 * momento NON vengono rimborsati (la UI avvisa l'utente prima della conferma).
 */
export async function POST(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  // Ownership: il run deve appartenere a un progetto dell'utente.
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, project_id, status")
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

  const currentStatus = (run as any).status as string;
  if (currentStatus !== "running" && currentStatus !== "pending") {
    return NextResponse.json({ error: `Run non annullabile (stato: ${currentStatus})` }, { status: 400 });
  }

  const { error: dbError } = await (supabase.from("analysis_runs") as any)
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", params.runId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
