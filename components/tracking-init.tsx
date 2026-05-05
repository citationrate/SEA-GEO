"use client";

import { useEffect, useRef } from "react";
import { initTracking, trackEvent } from "@/lib/tracking";
import { usePathname } from "next/navigation";

// Only track exact main pages — not sub-routes
const TRACKED_PAGES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/piano": "Pricing",
  "/settings": "Impostazioni",
  "/projects": "Progetti",
  "/competitors": "Competitor",
  "/compare": "Comparazioni",
  "/sources": "Fonti",
  "/topics": "Topic",
  "/datasets": "Dataset",
  "/results": "Risultati",
};

// Internal/test accounts — don't track
const INTERNAL_EMAILS = [
  "@citationrate.com",
  "tutorial@",
  "metatest-funnel@",
  "+test",
  "+pixel",
  "admin@",
  "demo@",
];

export function TrackingInit({ userId, email }: { userId: string; email?: string }) {
  const pathname = usePathname();
  const lastTracked = useRef<string>("");

  // Check if internal account
  const isInternal = email && INTERNAL_EMAILS.some((pattern) =>
    email.includes(pattern)
  );

  // Init tracking with user ID
  useEffect(() => {
    if (isInternal) return;
    initTracking(userId);
  }, [userId, isInternal]);

  // Track page views — exact match only, no duplicates
  useEffect(() => {
    if (isInternal) return;
    const pageName = TRACKED_PAGES[pathname];
    if (pageName && lastTracked.current !== pathname) {
      lastTracked.current = pathname;
      trackEvent("page_viewed", null, {
        page_url: pathname,
        page_name: pageName,
      });
    }
  }, [pathname, isInternal]);

  return null;
}
