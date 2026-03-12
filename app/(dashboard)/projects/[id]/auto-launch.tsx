"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AutoLaunch() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("launch") === "true") {
      // Small delay to ensure launcher component is mounted
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-analysis-modal"));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return null;
}
