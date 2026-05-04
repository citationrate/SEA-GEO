/**
 * User event tracking — inserts into public.user_events on CitationRate Supabase.
 * Used for product analytics: tool selection, analysis lifecycle, page views.
 *
 * All tracking is fire-and-forget (no await needed in UI code).
 * Errors are silently logged — never block the user.
 */

import { createClient } from "@/lib/supabase/client";

export async function trackEvent(
  eventType: string,
  tool?: string | null,
  metadata?: Record<string, unknown>,
  durationSeconds?: number | null,
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_events" as any).insert({
      user_id: user.id,
      event_type: eventType,
      tool: tool || null,
      metadata: metadata || {},
      duration_seconds: durationSeconds || null,
    });
  } catch (e) {
    // Silent fail — tracking should never break the app
    console.warn("[tracking]", eventType, e);
  }
}

/**
 * Track with sendBeacon for unload events (analysis_abandoned, session_ended).
 * Uses the Supabase REST API directly since sendBeacon only supports POST.
 */
export function trackBeacon(
  eventType: string,
  tool?: string | null,
  metadata?: Record<string, unknown>,
  durationSeconds?: number | null,
) {
  try {
    const userId = sessionStorage.getItem("tracking_user_id");
    if (!userId) return;

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_events`;
    const body = JSON.stringify({
      user_id: userId,
      event_type: eventType,
      tool: tool || null,
      metadata: metadata || {},
      duration_seconds: durationSeconds || null,
    });

    navigator.sendBeacon(
      url,
      new Blob([body], { type: "application/json" })
    );
  } catch {
    // Silent fail
  }
}

/** Save user ID to sessionStorage for beacon tracking */
export function initTracking(userId: string) {
  try {
    sessionStorage.setItem("tracking_user_id", userId);
  } catch {
    // Silent fail (SSR or private browsing)
  }
}

/** Save analysis start timestamp for duration calculation */
export function markAnalysisStart() {
  try {
    sessionStorage.setItem("analysis_start", Date.now().toString());
  } catch {}
}

/** Get duration since analysis start in seconds */
export function getAnalysisDuration(): number | null {
  try {
    const start = sessionStorage.getItem("analysis_start");
    if (!start) return null;
    return Math.round((Date.now() - parseInt(start)) / 1000);
  } catch {
    return null;
  }
}
