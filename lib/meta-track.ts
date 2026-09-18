/**
 * AVI browser-side Meta tracking helper. Mirrors suite/aivx-frontend.
 * Same Pixel ID (901458989607754) so events from both domains land in the
 * same dataset and Meta sees them as a unified funnel.
 *
 * Privacy: CAPI is gated by the cookie_consent cookie — marketing events
 * are sent only when the user has granted marketing consent. Pixel browser
 * is gated by Consent Mode v2 via the suite/AVI cookie banner.
 */

interface TrackOptions {
  email?: string;
  first_name?: string;
  last_name?: string;
  external_id?: string;
  custom_data?: Record<string, unknown>;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function trackEvent(eventName: string, options: TrackOptions = {}): Promise<void> {
  const eventId = newEventId();

  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      // Check marketing consent before firing browser-side pixel
      let consent = false;
      try {
        const m = document.cookie.match(/(?:^|; )cookie_consent=([^;]*)/);
        if (m) consent = JSON.parse(decodeURIComponent(m[1])).marketing === true;
      } catch { /* no consent */ }
      if (consent) {
        window.fbq("track", eventName, options.custom_data ?? {}, { eventID: eventId });
      }
    }
  } catch {
    // Pixel errors must never block CAPI fallback.
  }

  try {
    await fetch("/api/meta/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        email: options.email,
        first_name: options.first_name,
        last_name: options.last_name,
        external_id: options.external_id,
        custom_data: options.custom_data,
        event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
  } catch {
    // Tracking must never throw to the caller.
  }
}

async function trackOncePerSession(
  storageKey: string,
  eventName: string,
  options: TrackOptions = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // sessionStorage unavailable — fire anyway.
  }
  await trackEvent(eventName, options);
}

export async function trackAviDashboardViewOnce(): Promise<void> {
  await trackOncePerSession("meta_avi_dashboard_view_fired", "ViewContent", {
    custom_data: { content_name: "avi_dashboard", content_category: "avi_navigation" },
  });
}

export async function trackAviProjectsViewOnce(): Promise<void> {
  await trackOncePerSession("meta_avi_projects_view_fired", "ViewContent", {
    custom_data: { content_name: "avi_projects", content_category: "avi_navigation" },
  });
}

export async function trackAviPricingViewOnce(): Promise<void> {
  await trackOncePerSession("meta_avi_pricing_view_fired", "ViewContent", {
    custom_data: { content_name: "avi_pricing", content_category: "upgrade_intent" },
  });
}

/**
 * AVI run completed (custom event). Fires once per run_id when the run reaches
 * "completed" status. High-value engagement signal for Meta Custom Audiences.
 */
export async function trackAviRunCompletedOnce(
  runId: string,
  projectId?: string,
  aviScore?: number,
): Promise<void> {
  await trackOncePerSession(`meta_avi_run_completed_${runId}`, "AuditCompleted", {
    custom_data: {
      content_name: "avi_run_completed",
      content_category: "avi_run",
      content_ids: [runId],
      ...(projectId ? { project_id: projectId } : {}),
      ...(typeof aviScore === "number" ? { avi_score: aviScore } : {}),
    },
  });
}

/**
 * AVI run viewed. Fires once per run_id when the user opens a completed run.
 */
export async function trackAviRunViewOnce(runId: string, projectId?: string): Promise<void> {
  await trackOncePerSession(`meta_avi_run_view_${runId}`, "ViewContent", {
    custom_data: {
      content_name: "avi_run_report",
      content_category: "avi_run",
      content_ids: [runId],
      ...(projectId ? { project_id: projectId } : {}),
    },
  });
}

/**
 * StartTrial — fires once per session when a demo user creates their first
 * AVI project (intent signal for top-of-funnel optimisation).
 */
export async function trackAviStartTrialOnce(plan: string): Promise<void> {
  if (plan !== "demo") return;
  await trackOncePerSession("meta_avi_start_trial_fired", "StartTrial", {
    custom_data: {
      content_name: "first_avi_project",
      content_category: "demo_activation",
      currency: "EUR",
      value: 0,
    },
  });
}
