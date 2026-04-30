"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackAviRunCompletedOnce, trackAviRunViewOnce } from "@/lib/meta-track";

export function RunAutoRefresh({
  status,
  runId,
  projectId,
  aviScore,
}: {
  status: string;
  runId?: string;
  projectId?: string;
  aviScore?: number;
}) {
  const router = useRouter();
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current === "running" && status !== "running") {
      router.refresh();
      if (status === "completed" && runId) {
        void trackAviRunCompletedOnce(runId, projectId, aviScore);
      }
    }
    prevStatus.current = status;

    if (status === "completed" && runId) {
      void trackAviRunViewOnce(runId, projectId);
    }

    if (status !== "running" && status !== "pending") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [status, router, runId, projectId, aviScore]);

  return null;
}
