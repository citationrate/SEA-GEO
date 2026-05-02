import { NextResponse } from "next/server";
import { createAuthServiceClient, createDataClient } from "@/lib/supabase/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

/**
 * Permanent account deletion (GDPR Art. 17). Wipes:
 *   - seageo1 (AVI): projects + cascading runs/prompts/responses/avi_history,
 *     plus the seageo1 profile row.
 *   - CitationRate: audits, lifecycle_emails, profile, then the auth.users
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

    const { error: projErr } = await data.from("projects").delete().eq("user_id", userId);
    if (projErr) {
      console.error("[account/delete] seageo projects delete failed:", projErr.message);
      return NextResponse.json({ error: "Errore eliminazione progetti" }, { status: 500 });
    }
    await (data.from("profiles") as any).delete().eq("id", userId);

    await cr.from("audits").delete().eq("user_id", userId);
    await cr.from("lifecycle_emails").delete().eq("user_id", userId);
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
