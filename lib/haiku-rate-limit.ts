import type { createDataClient } from "@/lib/supabase/server";

/** Max Haiku calls per user per UTC day. Applies to all on-demand endpoints. */
export const HAIKU_DAILY_LIMIT = 20;

export type HaikuLimitResult =
  | { allowed: true; used: number; remaining: number }
  | { allowed: false; used: number; remaining: 0; limit: number };

/**
 * Atomically increment the Haiku daily counter for the given user and
 * return whether the call is allowed. If the limit has been reached, the
 * counter is still incremented (so subsequent calls stay blocked for the
 * rest of the day), but `allowed` is `false`.
 *
 * Reset happens naturally at UTC midnight: the next day inserts a new row
 * with count=1.
 *
 * Must be called BEFORE the Haiku API call, not after.
 */
export async function checkAndIncrementHaikuLimit(
  supabase: ReturnType<typeof createDataClient>,
  userId: string,
): Promise<HaikuLimitResult> {
  const { data, error } = await (supabase.rpc as any)("increment_haiku_count", {
    p_user_id: userId,
  });

  if (error || data == null) {
    // Fail-open: if the rate limit table/RPC is unavailable we don't want
    // narrative generation to break site-wide. Log loudly so we notice.
    console.error("[haiku-rate-limit] RPC failed, failing open:", error?.message);
    return { allowed: true, used: 0, remaining: HAIKU_DAILY_LIMIT };
  }

  const used = Number(data);
  if (used > HAIKU_DAILY_LIMIT) {
    return { allowed: false, used, remaining: 0, limit: HAIKU_DAILY_LIMIT };
  }
  return { allowed: true, used, remaining: HAIKU_DAILY_LIMIT - used };
}
