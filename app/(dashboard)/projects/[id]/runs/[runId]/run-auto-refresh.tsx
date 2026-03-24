"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function RunAutoRefresh({ status }: { status: string }) {
  const router = useRouter();
  const prevStatus = useRef(status);

  useEffect(() => {
    // If status just changed from running → completed/failed, do a final refresh
    if (prevStatus.current === "running" && status !== "running") {
      router.refresh();
    }
    prevStatus.current = status;

    if (status !== "running" && status !== "pending") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
