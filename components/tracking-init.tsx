"use client";

import { useEffect } from "react";
import { initTracking, trackEvent } from "@/lib/tracking";
import { usePathname } from "next/navigation";

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

export function TrackingInit({ userId }: { userId: string }) {
  const pathname = usePathname();

  // Init tracking with user ID
  useEffect(() => {
    initTracking(userId);
  }, [userId]);

  // Track page views for main pages
  useEffect(() => {
    const pageName = Object.entries(TRACKED_PAGES).find(
      ([path]) => pathname === path || pathname.startsWith(path + "/")
    )?.[1];

    if (pageName) {
      trackEvent("page_viewed", null, {
        page_url: pathname,
        page_name: pageName,
      });
    }
  }, [pathname]);

  return null;
}
