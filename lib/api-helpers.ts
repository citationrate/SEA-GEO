import { NextResponse } from "next/server";
import { createAuthServiceClient, createDataClient } from "@/lib/supabase/server";

/**
 * Ensure a profile exists in seageo1 for the given CitationRate user.
 * Creates one with demo plan if missing. Runs on every authenticated request
 * but the SELECT is fast (PK lookup) and the INSERT only happens once.
 */
async function ensureProfile(
  supabase: ReturnType<typeof createDataClient>,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
) {
  const { data, error: selectError } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("[ensureProfile] SELECT error:", selectError.message, selectError.code, "user:", user.id);
  }

  if (!data) {
    console.log("[ensureProfile] No profile found, creating for user:", user.id, user.email);
    const { error: insertError } = await (supabase.from("profiles") as any).insert({
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string) ?? null,
      plan: "demo",
    });
    if (insertError) {
      console.error("[ensureProfile] INSERT error:", insertError.message, insertError.code, insertError.details);
    } else {
      console.log("[ensureProfile] Profile created:", user.id);
    }
  }
}

/**
 * Authenticate the current request via CitationRate auth,
 * then return the seageo1 data client + user.
 * Auto-creates profile in seageo1 if not yet synced.
 * Returns a 401 NextResponse if not authenticated.
 */
export async function requireAuth() {
  const auth = createAuthServiceClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return { supabase: null, user: null, error: apiError("Non autenticato", 401) } as const;
  }
  const supabase = createDataClient();
  await ensureProfile(supabase, user);
  return { supabase, user, error: null } as const;
}

/** Standardised JSON error response */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify the current user owns a project. Returns the project row or a 404
 * response.
 */
export async function requireProject(
  supabase: ReturnType<typeof createDataClient>,
  projectId: string,
  userId: string,
) {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    return { project: null, error: apiError("Progetto non trovato", 404) } as const;
  }
  return { project, error: null } as const;
}
