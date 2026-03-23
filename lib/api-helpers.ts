import { NextResponse } from "next/server";
import { createAuthServiceClient, createDataClient } from "@/lib/supabase/server";

/**
 * Authenticate the current request via CitationRate auth,
 * then return the seageo1 data client + user.
 * Returns a 401 NextResponse if not authenticated.
 */
export async function requireAuth() {
  const auth = createAuthServiceClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return { supabase: null, user: null, error: apiError("Non autenticato", 401) } as const;
  }
  const supabase = createDataClient();
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
