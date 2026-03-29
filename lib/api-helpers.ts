import { NextResponse } from "next/server";
import { createAuthServiceClient, createDataClient } from "@/lib/supabase/server";

/**
 * Ensure a profile exists in seageo1 for the given CitationRate user.
 * Creates one with demo plan if missing. Runs on every authenticated request
 * but the SELECT is fast (PK lookup) and the INSERT only happens once.
 *
 * If a profile exists for the same email under a different ID (auth.users
 * was recreated), auto-corrects by migrating the profile + all FK references
 * to the current CitationRate auth ID.
 */
async function ensureProfile(
  supabase: ReturnType<typeof createDataClient>,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<string> {
  // Fast path: profile exists with matching ID
  const { data, error: selectError } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("[ensureProfile] SELECT error:", selectError.message, selectError.code, "user:", user.id);
  }

  if (data) return user.id;

  // No profile by ID — check if one exists for this email (ID mismatch scenario)
  if (user.email) {
    const { data: emailMatch } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (emailMatch) {
      const oldId = emailMatch.id;
      const newId = user.id;
      console.warn(
        `[ensureProfile] ID mismatch detected for email: ${user.email} — CitationRate ID: ${newId}, seageo1 ID: ${oldId}`
      );

      // Auto-correct: migrate profile to new auth ID
      try {
        // 1. Create new profile with current auth ID (copy plan + settings from old)
        const { error: createErr } = await (supabase.from("profiles") as any).insert({
          id: newId,
          email: emailMatch.email,
          full_name: emailMatch.full_name ?? (user.user_metadata?.full_name as string) ?? null,
          avatar_url: emailMatch.avatar_url ?? null,
          plan: emailMatch.plan ?? "demo",
        });

        if (createErr) {
          // If new profile already exists (race condition), that's fine
          if (createErr.code !== "23505") {
            console.error("[ensureProfile] Migration: create new profile failed:", createErr.message);
            return oldId; // Fallback: use old profile
          }
        }

        // 2. Migrate all FK references from old ID to new ID
        const fkTables = [
          { table: "projects", column: "user_id" },
          { table: "analysis_runs", column: "created_by" },
          { table: "usage_monthly", column: "user_id" },
          { table: "competitive_analyses", column: "user_id" },
          { table: "packages_purchased", column: "user_id" },
        ];

        for (const { table, column } of fkTables) {
          const { error: fkErr, count } = await (supabase.from(table) as any)
            .update({ [column]: newId })
            .eq(column, oldId);
          if (fkErr) {
            console.error(`[ensureProfile] Migration: ${table}.${column} update failed:`, fkErr.message);
          } else if (count && count > 0) {
            console.log(`[ensureProfile] Migration: ${table}.${column} — ${count} rows migrated`);
          }
        }

        // 3. Delete old profile (all FKs now point to new ID)
        const { error: deleteErr } = await (supabase.from("profiles") as any)
          .delete()
          .eq("id", oldId);
        if (deleteErr) {
          console.error("[ensureProfile] Migration: delete old profile failed:", deleteErr.message);
        }

        console.log(`[ensureProfile] Migration complete: ${oldId} → ${newId} for ${user.email}`);
        return newId;
      } catch (e: any) {
        console.error("[ensureProfile] Migration failed, falling back to old profile:", e?.message);
        return oldId;
      }
    }
  }

  // No profile at all — create new one
  const { error: insertError } = await (supabase.from("profiles") as any).insert({
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string) ?? null,
    plan: "demo",
  });
  if (insertError) {
    // Handle race: another request may have created a profile for this email concurrently
    if (insertError.code === "23505" && user.email) {
      const { data: raceMatch } = await (supabase.from("profiles") as any)
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (raceMatch) {
        console.warn("[ensureProfile] Race condition resolved, using existing profile:", raceMatch.id);
        return raceMatch.id;
      }
    }
    console.error("[ensureProfile] INSERT error:", insertError.message, insertError.code, insertError.details);
  } else {
    console.log("[ensureProfile] Profile created:", user.id);
  }
  return user.id;
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
