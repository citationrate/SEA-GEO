"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RunAutoRefresh({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
