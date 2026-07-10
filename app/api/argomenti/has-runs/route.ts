import { requireAuth } from "@/lib/api-helpers";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const argomentoId = request.nextUrl.searchParams.get("argomento_id");
    if (!argomentoId) return NextResponse.json({ error: "argomento_id required" }, { status: 400 });

    const { count } = await (supabase.from("analysis_runs") as any)
      .select("id", { count: "exact", head: true })
      .eq("argomento_id", argomentoId)
      .is("deleted_at", null)
      .eq("status", "completed");

    return NextResponse.json({ hasRuns: (count ?? 0) > 0, count: count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
