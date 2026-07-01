"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Keep in sync with ACTIVE_PROJECT_COOKIE in lib/utils/active-project.ts.
// Non-HttpOnly on purpose: pure UX state, not a security boundary. (Imported as
// a literal here rather than from active-project.ts because that module pulls in
// next/headers, which is server-only and would break this client component.)
const ACTIVE_PROJECT_COOKIE = "avi_active_project";

/**
 * Persists the active project to a cookie whenever a page URL carries
 * ?projectId=. getActiveProjectId() reads this cookie server-side, so
 * navigating via the sidebar (which drops the query param) keeps the user on
 * the same project instead of jumping to another brand's last analysis.
 */
export function ActiveProjectSync() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid) {
      document.cookie = `${ACTIVE_PROJECT_COOKIE}=${encodeURIComponent(pid)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [searchParams]);
  return null;
}
