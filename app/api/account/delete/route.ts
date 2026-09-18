import { NextResponse } from "next/server";
import { createAuthServiceClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Permanent account deletion (GDPR Art. 17). Wipes:
 *   - seageo1 (AVI): brand_profile.runs (cascading scores/insights/prompt_results/diagnostics),
 *     query_wallet, projects (cascading runs/prompts/responses/avi_history/competitive_analyses),
 *     plus the seageo1 profile row.
 *   - CitationRate: audits, lifecycle_emails, email_events, profile, then the auth.users
 *     record itself (which invalidates the session and revokes all subdomain
 *     cookies).
 *
 * The auth.admin.deleteUser call is the last step on purpose — if any of the
 * data wipes fail we want to surface the error before the user is logged out
 * of an account they can no longer recover.
 */
export async function DELETE() {
  const auth = createAuthServiceClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const data = createDataClient();
    const cr = createCitationRateServiceClient();

    const svc = createServiceClient();

    // seageo1: brand_profile schema (runs cascade to scores, insights, prompt_results, diagnostics)
    await (svc.schema("brand_profile" as any).from("runs") as any).delete().eq("user_id", userId);

    // seageo1: query_wallet
    await (svc.from("query_wallet") as any).delete().eq("user_id", userId);

    // seageo1: projects (cascades to runs, prompts, responses, avi_history, competitive_analyses, competitive_prompts, competitors, sources, topics)
    const { error: projErr } = await data.from("projects").delete().eq("user_id", userId);
    if (projErr) {
      console.error("[account/delete] seageo projects delete failed:", projErr.message);
      return NextResponse.json({ error: "Errore eliminazione progetti" }, { status: 500 });
    }
    await (data.from("profiles") as any).delete().eq("id", userId);

    // CitationRate: audits, lifecycle_emails, email_events, profile
    await cr.from("audits").delete().eq("user_id", userId);
    await cr.from("lifecycle_emails").delete().eq("user_id", userId);
    await (cr.from("email_events") as any).delete().eq("user_id", userId);
    await cr.from("profiles").delete().eq("id", userId);

    const { error: authErr } = await cr.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[account/delete] auth admin error:", authErr.message);
      return NextResponse.json({ error: "Errore eliminazione account" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[account/delete] unexpected:", msg);
    return NextResponse.json({ error: "Errore eliminazione account" }, { status: 500 });
  }
}
