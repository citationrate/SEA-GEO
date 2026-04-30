"use client";

import { useEffect } from "react";
import {
  trackAviDashboardViewOnce,
  trackAviProjectsViewOnce,
  trackAviPricingViewOnce,
} from "@/lib/meta-track";

type Variant = "dashboard" | "projects" | "pricing";

/**
 * Mount-only client wrapper that lets server components fire the right Meta
 * ViewContent event without each page importing meta-track directly.
 */
export function MetaPageTrack({ variant }: { variant: Variant }) {
  useEffect(() => {
    if (variant === "dashboard") void trackAviDashboardViewOnce();
    else if (variant === "projects") void trackAviProjectsViewOnce();
    else if (variant === "pricing") void trackAviPricingViewOnce();
  }, [variant]);

  return null;
}
